/**
 * GET  /api/opening-balances?companyId=xxx&cycleId=yyy
 * POST /api/opening-balances — { companyId, cycleId, balances: [{ accountId, balance }] }
 *
 * Henter eller lagrer åpningsbalanse for et selskap og en syklus.
 * POST overskriver eksisterende balanser (delete + insert).
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  openingBalances,
  companies,
  accountants,
  cycles,
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

  const balances = await db
    .select()
    .from(openingBalances)
    .where(
      and(
        eq(openingBalances.companyId, companyId),
        eq(openingBalances.cycleId, cycleId)
      )
    );

  return NextResponse.json(balances);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  }

  const body = await req.json();
  const { companyId, cycleId, balances } = body as {
    companyId: string;
    cycleId: string;
    balances: { accountId: string; balance: string }[];
  };

  if (!companyId || !cycleId || !balances) {
    return NextResponse.json(
      { error: "companyId, cycleId og balances kreves" },
      { status: 400 }
    );
  }

  const company = await verifyRfOwnership(session.user.id, companyId);
  if (!company) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 });
  }

  // Verifiser at cycle tilhører selskapet
  const [cycle] = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.id, cycleId), eq(cycles.companyId, companyId)))
    .limit(1);

  if (!cycle) {
    return NextResponse.json(
      { error: "Syklus ikke funnet" },
      { status: 404 }
    );
  }

  // Filtrer bort kontoer uten saldo
  const nonZeroBalances = balances.filter(
    (b) => b.balance && parseFloat(b.balance) !== 0
  );

  // Slett eksisterende og sett inn nye i en transaksjon (atomisk)
  await db.transaction(async (tx) => {
    await tx.delete(openingBalances).where(
      and(
        eq(openingBalances.companyId, companyId),
        eq(openingBalances.cycleId, cycleId)
      )
    );

    if (nonZeroBalances.length > 0) {
      await tx.insert(openingBalances).values(
        nonZeroBalances.map((b) => ({
          companyId,
          cycleId,
          accountId: b.accountId,
          balance: b.balance,
        }))
      );
    }
  });

  return NextResponse.json({
    ok: true,
    count: nonZeroBalances.length,
  });
}
