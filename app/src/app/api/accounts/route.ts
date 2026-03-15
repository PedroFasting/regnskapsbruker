/**
 * GET /api/accounts?companyId=xxx
 * Henter kontoplan for et selskap, sortert etter kontonummer.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { accounts, companies, accountants } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  }

  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId mangler" }, { status: 400 });
  }

  // Verifiser at RF eier selskapet
  const [accountant] = await db
    .select()
    .from(accountants)
    .where(eq(accountants.userId, session.user.id))
    .limit(1);

  if (!accountant) {
    return NextResponse.json({ error: "Ikke RF" }, { status: 403 });
  }

  const [company] = await db
    .select()
    .from(companies)
    .where(
      and(eq(companies.id, companyId), eq(companies.accountantId, accountant.id))
    )
    .limit(1);

  if (!company) {
    return NextResponse.json({ error: "Selskap ikke funnet" }, { status: 404 });
  }

  const accountList = await db
    .select()
    .from(accounts)
    .where(eq(accounts.companyId, companyId))
    .orderBy(asc(accounts.accountNumber));

  return NextResponse.json(accountList);
}
