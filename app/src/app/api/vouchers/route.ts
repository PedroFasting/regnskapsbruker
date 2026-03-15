/**
 * GET  /api/vouchers?companyId=xxx&cycleId=yyy
 * POST /api/vouchers — opprett nytt bilag med posteringer
 *
 * Bilag-håndtering for regnskapsmodulen.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  vouchers,
  journalEntries,
  accounts,
  companies,
  accountants,
  cycles,
} from "@/lib/db/schema";
import { eq, and, asc, desc, sql } from "drizzle-orm";
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

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  }

  const companyId = req.nextUrl.searchParams.get("companyId");
  const cycleId = req.nextUrl.searchParams.get("cycleId");

  if (!companyId || !cycleId) {
    return NextResponse.json(
      { error: "companyId og cycleId kreves" },
      { status: 400 }
    );
  }

  const company = await verifyRfOwnership(session.user.id, companyId);
  if (!company) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 });
  }

  // Hent bilag med posteringer
  const voucherList = await db
    .select()
    .from(vouchers)
    .where(
      and(eq(vouchers.companyId, companyId), eq(vouchers.cycleId, cycleId))
    )
    .orderBy(asc(vouchers.voucherNumber));

  // Hent posteringer for hvert bilag
  const result = [];
  for (const v of voucherList) {
    const entries = await db
      .select({
        id: journalEntries.id,
        accountId: journalEntries.accountId,
        accountNumber: accounts.accountNumber,
        accountName: accounts.name,
        debit: journalEntries.debit,
        credit: journalEntries.credit,
        description: journalEntries.description,
      })
      .from(journalEntries)
      .innerJoin(accounts, eq(journalEntries.accountId, accounts.id))
      .where(eq(journalEntries.voucherId, v.id))
      .orderBy(asc(accounts.accountNumber));

    result.push({ ...v, entries });
  }

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  }

  const body = await req.json();
  const {
    companyId,
    cycleId,
    voucherDate,
    description,
    entries,
    documentId,
  } = body as {
    companyId: string;
    cycleId: string;
    voucherDate: string;
    description: string;
    entries: { accountId: string; debit: string; credit: string; description?: string }[];
    documentId?: string | null;
  };

  if (!companyId || !cycleId || !voucherDate || !description || !entries?.length) {
    return NextResponse.json(
      { error: "Mangler påkrevde felt" },
      { status: 400 }
    );
  }

  const company = await verifyRfOwnership(session.user.id, companyId);
  if (!company) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 });
  }

  // Verifiser syklus
  const [cycle] = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.id, cycleId), eq(cycles.companyId, companyId)))
    .limit(1);

  if (!cycle) {
    return NextResponse.json({ error: "Syklus ikke funnet" }, { status: 404 });
  }

  // Valider at debet = kredit
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

  // Finn neste bilagsnummer
  const [maxVoucher] = await db
    .select({ maxNum: sql<number>`COALESCE(MAX(${vouchers.voucherNumber}), 0)` })
    .from(vouchers)
    .where(
      and(eq(vouchers.companyId, companyId), eq(vouchers.cycleId, cycleId))
    );

  const nextNumber = (maxVoucher?.maxNum || 0) + 1;

  // Opprett bilag
  const [voucher] = await db
    .insert(vouchers)
    .values({
      companyId,
      cycleId,
      voucherNumber: nextNumber,
      voucherDate,
      description,
      documentId: documentId || null,
      status: "postert", // RF oppretter manuelt = direkte postert
      createdBy: session.user.id,
    })
    .returning();

  // Opprett posteringer
  for (const entry of entries) {
    if (
      (parseFloat(entry.debit) || 0) === 0 &&
      (parseFloat(entry.credit) || 0) === 0
    ) {
      continue;
    }

    await db.insert(journalEntries).values({
      voucherId: voucher.id,
      accountId: entry.accountId,
      debit: entry.debit || "0",
      credit: entry.credit || "0",
      description: entry.description || null,
    });
  }

  return NextResponse.json({ ok: true, voucherId: voucher.id, voucherNumber: nextNumber });
}
