/**
 * PUT    /api/vouchers/[id] — rediger bilag (beskrivelse, dato, posteringer)
 * DELETE /api/vouchers/[id] — slett bilag + posteringer, og fjern eventuell bankavsteming
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
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  }

  const { id: voucherId } = await params;

  // Hent eksisterende bilag
  const [voucher] = await db
    .select()
    .from(vouchers)
    .where(eq(vouchers.id, voucherId))
    .limit(1);

  if (!voucher) {
    return NextResponse.json({ error: "Bilag ikke funnet" }, { status: 404 });
  }

  const company = await verifyRfOwnership(session.user.id, voucher.companyId);
  if (!company) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 });
  }

  const body = await req.json();
  const {
    voucherDate,
    description,
    entries,
  } = body as {
    voucherDate?: string;
    description?: string;
    entries?: { accountId: string; debit: string; credit: string; description?: string }[];
  };

  // Oppdater bilagshode
  const updates: Record<string, unknown> = {};
  if (voucherDate) updates.voucherDate = voucherDate;
  if (description) updates.description = description;

  // Hvis nye posteringer er oppgitt, valider og erstatt
  if (entries && entries.length > 0) {
    const totalDebit = entries.reduce(
      (sum, e) => sum + (parseFloat(e.debit) || 0),
      0
    );
    const totalCredit = entries.reduce(
      (sum, e) => sum + (parseFloat(e.credit) || 0),
      0
    );

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return NextResponse.json(
        {
          error: `Debet (${totalDebit.toFixed(2)}) og kredit (${totalCredit.toFixed(2)}) stemmer ikke`,
        },
        { status: 400 }
      );
    }

    // Verifiser at alle kontoer tilhorer selskapet
    for (const entry of entries) {
      const [acc] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(
          and(eq(accounts.id, entry.accountId), eq(accounts.companyId, voucher.companyId))
        )
        .limit(1);

      if (!acc) {
        return NextResponse.json(
          { error: `Konto ${entry.accountId} tilhorer ikke selskapet` },
          { status: 400 }
        );
      }
    }

    // Erstatt posteringer i transaksjon
    await db.transaction(async (tx) => {
      // Slett gamle posteringer
      await tx.delete(journalEntries).where(eq(journalEntries.voucherId, voucherId));

      // Opprett nye posteringer
      for (const entry of entries) {
        if (
          (parseFloat(entry.debit) || 0) === 0 &&
          (parseFloat(entry.credit) || 0) === 0
        ) {
          continue;
        }
        await tx.insert(journalEntries).values({
          voucherId,
          accountId: entry.accountId,
          debit: entry.debit || "0",
          credit: entry.credit || "0",
          description: entry.description || null,
        });
      }

      // Oppdater bilagshode
      if (Object.keys(updates).length > 0) {
        await tx
          .update(vouchers)
          .set(updates)
          .where(eq(vouchers.id, voucherId));
      }
    });
  } else if (Object.keys(updates).length > 0) {
    // Bare oppdater hode (ingen endring i posteringer)
    await db
      .update(vouchers)
      .set(updates)
      .where(eq(vouchers.id, voucherId));
  }

  return NextResponse.json({ ok: true, voucherId });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  }

  const { id: voucherId } = await params;

  // Hent eksisterende bilag
  const [voucher] = await db
    .select()
    .from(vouchers)
    .where(eq(vouchers.id, voucherId))
    .limit(1);

  if (!voucher) {
    return NextResponse.json({ error: "Bilag ikke funnet" }, { status: 404 });
  }

  const company = await verifyRfOwnership(session.user.id, voucher.companyId);
  if (!company) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 });
  }

  // Slett i transaksjon: posteringer + bilag + fjern bankavsteming
  await db.transaction(async (tx) => {
    // 1. Slett posteringer
    await tx.delete(journalEntries).where(eq(journalEntries.voucherId, voucherId));

    // 2. Fjern bankavsteming (sett matchedVoucherId=null, status=uavstemt)
    await tx
      .update(bankLines)
      .set({ matchedVoucherId: null, status: "uavstemt" })
      .where(eq(bankLines.matchedVoucherId, voucherId));

    // 3. Slett bilaget
    await tx.delete(vouchers).where(eq(vouchers.id, voucherId));
  });

  return NextResponse.json({ ok: true });
}
