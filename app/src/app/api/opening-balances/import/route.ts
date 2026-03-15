/**
 * POST /api/opening-balances/import
 *
 * Parses a saldobalanse CSV (uploaded as a kunde document) and returns
 * opening balance values mapped to account UUIDs.
 *
 * Body: { companyId, documentId }
 * Returns: { balances: { accountId: string, balance: string }[], parsed: number, mapped: number, skipped: number }
 *
 * The CSV format (from Tripletex saldobalanse export):
 *   ;"Kontonummer";"Kontonavn";"Inngående saldo";"Endring";"Utgående saldo"
 *   ;"1160";"Verksted";"1392064,59";"0,00";"1392064,59"
 *
 * Only balance sheet accounts (1000-2999) are imported.
 * Account numbers are mapped to UUIDs via the accounts table.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  documents,
  accounts,
  companies,
  accountants,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

const UPLOAD_DIR = join(process.cwd(), "uploads");

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

/**
 * Determine accountClass based on account number (NS 4102 ranges).
 */
type AccountClass = "eiendeler" | "egenkapital" | "gjeld" | "inntekter" | "varekostnad" | "lonnskostnad" | "avskrivninger" | "andre_kostnader" | "finans";

function accountClassFromNumber(num: number): AccountClass {
  if (num >= 1000 && num <= 1999) return "eiendeler";
  if (num >= 2000 && num <= 2099) return "egenkapital";
  if (num >= 2100 && num <= 2999) return "gjeld";
  if (num >= 3000 && num <= 3999) return "inntekter";
  if (num >= 4000 && num <= 4999) return "varekostnad";
  if (num >= 5000 && num <= 5999) return "lonnskostnad";
  if (num >= 6000 && num <= 6999) return "avskrivninger";
  if (num >= 7000 && num <= 7999) return "andre_kostnader";
  if (num >= 8000 && num <= 8999) return "finans";
  return "andre_kostnader";
}

/**
 * Parse a semicolon-separated saldobalanse CSV.
 * Returns array of { accountNumber, accountName, inngaaendeSaldo } for balance sheet accounts.
 */
function parseSaldobalanseCsv(rawBuffer: Buffer): { accountNumber: string; accountName: string; inngaaendeSaldo: number }[] {
  // Try UTF-8 first, fall back to Latin-1 if we detect garbled characters
  let text = rawBuffer.toString("utf-8");
  if (text.includes("�") || text.includes("\ufffd")) {
    text = rawBuffer.toString("latin1");
  }

  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

  // Find header line to determine column indices
  const headerIdx = lines.findIndex(
    (line) =>
      line.toLowerCase().includes("kontonummer") &&
      line.toLowerCase().includes("kontonavn")
  );

  if (headerIdx === -1) {
    throw new Error(
      "Fant ikke overskriftsrad med 'Kontonummer' og 'Kontonavn' i CSV-filen"
    );
  }

  const headerCells = parseSemicolonLine(lines[headerIdx]);

  // Find column indices (case-insensitive, fuzzy match for encoding issues)
  const kontonummerIdx = headerCells.findIndex((c) =>
    c.toLowerCase().includes("kontonummer")
  );
  const kontonavnIdx = headerCells.findIndex((c) =>
    c.toLowerCase().includes("kontonavn")
  );
  const inngaaendeIdx = headerCells.findIndex(
    (c) =>
      c.toLowerCase().includes("inng") && c.toLowerCase().includes("saldo")
  );

  if (kontonummerIdx === -1) {
    throw new Error("Fant ikke 'Kontonummer'-kolonne i CSV-filen");
  }
  if (inngaaendeIdx === -1) {
    throw new Error("Fant ikke 'Inngående saldo'-kolonne i CSV-filen");
  }

  const results: { accountNumber: string; accountName: string; inngaaendeSaldo: number }[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = parseSemicolonLine(lines[i]);
    const accountNumber = cells[kontonummerIdx]?.trim();
    const accountName = kontonavnIdx !== -1 ? (cells[kontonavnIdx]?.trim() || "") : "";
    const saldoRaw = cells[inngaaendeIdx]?.trim();

    if (!accountNumber || !saldoRaw) continue;

    // Only numbers 1000-2999 are balance sheet accounts
    const accNum = parseInt(accountNumber, 10);
    if (isNaN(accNum) || accNum < 1000 || accNum > 2999) continue;

    // Parse Norwegian number format: "1392064,59" or "-30000,00"
    const saldo = parseNorwegianNumber(saldoRaw);
    if (saldo === 0) continue; // Skip zero balances

    results.push({ accountNumber, accountName, inngaaendeSaldo: saldo });
  }

  return results;
}

/**
 * Parse a semicolon-separated line, handling quoted fields.
 * Lines start with ; (empty first field), each field wrapped in "..."
 */
function parseSemicolonLine(line: string): string[] {
  const cells: string[] = [];
  let i = 0;

  while (i < line.length) {
    if (line[i] === ";") {
      i++; // skip separator
      continue;
    }

    if (line[i] === '"') {
      // Quoted field
      i++; // skip opening quote
      let value = "";
      while (i < line.length && line[i] !== '"') {
        value += line[i];
        i++;
      }
      i++; // skip closing quote
      cells.push(value);
    } else {
      // Unquoted field
      let value = "";
      while (i < line.length && line[i] !== ";") {
        value += line[i];
        i++;
      }
      cells.push(value.trim());
    }
  }

  return cells;
}

/**
 * Parse Norwegian number format: comma as decimal separator.
 * Examples: "1392064,59" → 1392064.59, "-30000,00" → -30000
 */
function parseNorwegianNumber(str: string): number {
  // Remove spaces and non-breaking spaces (thousand separator in some formats)
  const cleaned = str.replace(/[\s\u00a0]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  }

  const body = await req.json();
  const { companyId, documentId } = body as {
    companyId: string;
    documentId: string;
  };

  if (!companyId || !documentId) {
    return NextResponse.json(
      { error: "companyId og documentId kreves" },
      { status: 400 }
    );
  }

  const company = await verifyRfOwnership(session.user.id, companyId);
  if (!company) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 });
  }

  // Fetch the document record
  const [doc] = await db
    .select()
    .from(documents)
    .where(
      and(eq(documents.id, documentId), eq(documents.companyId, companyId))
    )
    .limit(1);

  if (!doc) {
    return NextResponse.json(
      { error: "Dokument ikke funnet" },
      { status: 404 }
    );
  }

  // Read the file from disk
  const filePath = join(UPLOAD_DIR, doc.storedPath);
  let fileBuffer: Buffer;
  try {
    fileBuffer = await readFile(filePath);
  } catch {
    return NextResponse.json(
      { error: "Kunne ikke lese filen fra disk" },
      { status: 500 }
    );
  }

  // Parse the CSV
  let parsed: { accountNumber: string; accountName: string; inngaaendeSaldo: number }[];
  try {
    parsed = parseSaldobalanseCsv(fileBuffer);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Kunne ikke parse CSV-filen";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (parsed.length === 0) {
    return NextResponse.json(
      { error: "Ingen balansekontoer (1000-2999) funnet i filen" },
      { status: 400 }
    );
  }

  // Fetch all accounts for this company to map accountNumber → UUID
  const companyAccounts = await db
    .select({ id: accounts.id, accountNumber: accounts.accountNumber })
    .from(accounts)
    .where(eq(accounts.companyId, companyId));

  const numberToId = new Map<number, string>();
  for (const acc of companyAccounts) {
    numberToId.set(acc.accountNumber, acc.id);
  }

  // Create missing accounts from the CSV automatically.
  // The customer's actual kontoplan (from Tripletex etc.) may have sub-accounts
  // not in the standard NS 4102 template (e.g. 1160, 1921, 2991).
  let created = 0;
  for (const row of parsed) {
    const accNum = parseInt(row.accountNumber, 10);
    if (numberToId.has(accNum)) continue;

    // Insert missing account
    const accountClass = accountClassFromNumber(accNum);
    const [newAcc] = await db
      .insert(accounts)
      .values({
        companyId,
        accountNumber: accNum,
        name: row.accountName || `Konto ${accNum}`,
        accountClass,
      })
      .returning({ id: accounts.id });

    numberToId.set(accNum, newAcc.id);
    created++;
  }

  // Map parsed CSV rows to account UUIDs (all should match now)
  const balances: { accountId: string; balance: string }[] = [];
  let skipped = 0;

  for (const row of parsed) {
    const accNum = parseInt(row.accountNumber, 10);
    const accountId = numberToId.get(accNum);

    if (!accountId) {
      skipped++;
      continue;
    }

    balances.push({
      accountId,
      balance: row.inngaaendeSaldo.toString(),
    });
  }

  return NextResponse.json({
    ok: true,
    balances,
    parsed: parsed.length,
    mapped: balances.length,
    created,
    skipped,
  });
}
