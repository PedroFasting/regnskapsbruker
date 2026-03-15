/**
 * POST /api/vouchers/from-bank-line
 *
 * Opprett bilag direkte fra en banklinje.
 * Lager et bilag med to posteringslinjer (bankkonto + motkonto),
 * og avstemmer banklinjen automatisk.
 *
 * Body: {
 *   bankLineId: string,
 *   contraAccountId: string,    // Motkonto (f.eks. en kostnadskonto)
 *   bankAccountId?: string,     // Bankkonto (default: selskapets 1920-konto)
 *   description?: string,       // Overstyrt beskrivelse (default: fra banklinjen)
 *   voucherDate?: string,       // Overstyrt dato (default: fra banklinjen)
 * }
 *
 * Logikk:
 *   Beløp < 0 (betaling ut):
 *     Kredit bankkonto (penger ut), Debet motkonto (kostnad øker)
 *   Beløp > 0 (innbetaling):
 *     Debet bankkonto (penger inn), Kredit motkonto (inntekt/gjeld)
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  vouchers,
  journalEntries,
  bankLines,
  accounts,
  companies,
  accountants,
  cycles,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

async function verifyRfOwnership(userId: string, companyId: string) {
  const [accountant] = await db
    .select()
    .from(accountants)
    .where(eq(accountants.userId, userId))
    .limit(1);

  if (!accountant) return null;

  const [company] = await db
    .select()
    .from(companies)
    .where(
      and(eq(companies.id, companyId), eq(companies.accountantId, accountant.id))
    )
    .limit(1);

  return company;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  }

  const body = await req.json();
  const {
    bankLineId,
    contraAccountId,
    bankAccountId,
    description: descOverride,
    voucherDate: dateOverride,
  } = body as {
    bankLineId: string;
    contraAccountId: string;
    bankAccountId?: string;
    description?: string;
    voucherDate?: string;
  };

  if (!bankLineId || !contraAccountId) {
    return NextResponse.json(
      { error: "bankLineId og contraAccountId (motkonto) kreves" },
      { status: 400 }
    );
  }

  // Hent banklinjen
  const [bankLine] = await db
    .select()
    .from(bankLines)
    .where(eq(bankLines.id, bankLineId))
    .limit(1);

  if (!bankLine) {
    return NextResponse.json(
      { error: "Banklinje ikke funnet" },
      { status: 404 }
    );
  }

  if (bankLine.status === "avstemt") {
    return NextResponse.json(
      { error: "Banklinjen er allerede avstemt" },
      { status: 400 }
    );
  }

  // Verifiser tilgang
  const company = await verifyRfOwnership(session.user.id, bankLine.companyId);
  if (!company) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 });
  }

  // Verifiser syklus
  const [cycle] = await db
    .select()
    .from(cycles)
    .where(
      and(eq(cycles.id, bankLine.cycleId), eq(cycles.companyId, bankLine.companyId))
    )
    .limit(1);

  if (!cycle) {
    return NextResponse.json(
      { error: "Syklus ikke funnet" },
      { status: 404 }
    );
  }

  // Finn bankkonto — bruk oppgitt ID eller finn selskapets 1920-konto
  let resolvedBankAccountId = bankAccountId;
  if (!resolvedBankAccountId) {
    const [bankAcc] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.companyId, bankLine.companyId),
          eq(accounts.accountNumber, 1920)
        )
      )
      .limit(1);

    if (!bankAcc) {
      return NextResponse.json(
        { error: "Finner ikke bankkonto (1920) for selskapet. Spesifiser bankAccountId." },
        { status: 400 }
      );
    }
    resolvedBankAccountId = bankAcc.id;
  }

  // Verifiser at motkonto tilhører selskapet
  const [contraAcc] = await db
    .select({ id: accounts.id, accountNumber: accounts.accountNumber, name: accounts.name })
    .from(accounts)
    .where(
      and(eq(accounts.id, contraAccountId), eq(accounts.companyId, bankLine.companyId))
    )
    .limit(1);

  if (!contraAcc) {
    return NextResponse.json(
      { error: "Motkonto ikke funnet for dette selskapet" },
      { status: 400 }
    );
  }

  const amount = parseFloat(bankLine.amount);
  if (amount === 0) {
    return NextResponse.json(
      { error: "Banklinjen har beløp 0" },
      { status: 400 }
    );
  }

  const absAmount = Math.abs(amount).toFixed(2);
  const voucherDate = dateOverride || bankLine.transactionDate;
  const voucherDesc = descOverride || bankLine.description;

  // Finn neste bilagsnummer
  const [maxVoucher] = await db
    .select({
      maxNum: sql<number>`COALESCE(MAX(${vouchers.voucherNumber}), 0)`,
    })
    .from(vouchers)
    .where(
      and(
        eq(vouchers.companyId, bankLine.companyId),
        eq(vouchers.cycleId, bankLine.cycleId)
      )
    );

  const nextNumber = (maxVoucher?.maxNum || 0) + 1;

  // Opprett bilag + posteringer + avstem i én transaksjon
  const result = await db.transaction(async (tx) => {
    // 1. Opprett bilag
    const [voucher] = await tx
      .insert(vouchers)
      .values({
        companyId: bankLine.companyId,
        cycleId: bankLine.cycleId,
        voucherNumber: nextNumber,
        voucherDate,
        description: voucherDesc,
        status: "postert",
        createdBy: session.user.id,
      })
      .returning();

    // 2. Opprett posteringslinjer
    if (amount < 0) {
      // Betaling ut: kredit bank, debet motkonto
      await tx.insert(journalEntries).values({
        voucherId: voucher.id,
        accountId: resolvedBankAccountId!,
        debit: "0",
        credit: absAmount,
        description: voucherDesc,
      });
      await tx.insert(journalEntries).values({
        voucherId: voucher.id,
        accountId: contraAccountId,
        debit: absAmount,
        credit: "0",
        description: voucherDesc,
      });
    } else {
      // Innbetaling: debet bank, kredit motkonto
      await tx.insert(journalEntries).values({
        voucherId: voucher.id,
        accountId: resolvedBankAccountId!,
        debit: absAmount,
        credit: "0",
        description: voucherDesc,
      });
      await tx.insert(journalEntries).values({
        voucherId: voucher.id,
        accountId: contraAccountId,
        debit: "0",
        credit: absAmount,
        description: voucherDesc,
      });
    }

    // 3. Avstem banklinjen
    await tx
      .update(bankLines)
      .set({ status: "avstemt", matchedVoucherId: voucher.id })
      .where(eq(bankLines.id, bankLineId));

    return voucher;
  });

  return NextResponse.json({
    ok: true,
    voucherId: result.id,
    voucherNumber: nextNumber,
  });
}
