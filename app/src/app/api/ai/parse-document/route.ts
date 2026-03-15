/**
 * POST /api/ai/parse-document
 *
 * Sender et dokument (PDF/bilde) til Gemini og ber om bokføringsforslag.
 * Returnerer: dato, beskrivelse, beløp, kontoforslag, begrunnelse, og confidence.
 *
 * Body: { documentId: string, companyId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents, accounts, companies, accountants } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { readFile } from "fs/promises";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// Gemini-klient — lazy-initialisert
function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY mangler i .env");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
}

// Map filtype til Gemini MIME-type
function toGeminiMime(fileType: string): string {
  const map: Record<string, string> = {
    "application/pdf": "application/pdf",
    "image/jpeg": "image/jpeg",
    "image/jpg": "image/jpeg",
    "image/png": "image/png",
    "image/webp": "image/webp",
    "image/gif": "image/gif",
  };
  return map[fileType] || fileType;
}

export type AiSuggestion = {
  date: string | null;           // ISO-dato fra dokumentet
  description: string | null;    // Beskrivelse av transaksjonen
  totalAmount: number | null;    // Totalbeløp inkl. mva
  entries: {
    accountNumber: number;       // NS 4102 kontonummer
    accountName: string;         // Kontonavn
    debit: number;
    credit: number;
    description?: string;
  }[];
  reasoning: string;             // AI sin begrunnelse
  confidence: number;            // 0.0 – 1.0
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  }

  const body = await req.json();
  const { documentId, companyId } = body as {
    documentId: string;
    companyId: string;
  };

  if (!documentId || !companyId) {
    return NextResponse.json(
      { error: "documentId og companyId kreves" },
      { status: 400 }
    );
  }

  // Verifiser RF-tilgang
  const [accountant] = await db
    .select()
    .from(accountants)
    .where(eq(accountants.userId, session.user.id))
    .limit(1);

  if (!accountant) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 });
  }

  const [company] = await db
    .select()
    .from(companies)
    .where(
      and(eq(companies.id, companyId), eq(companies.accountantId, accountant.id))
    )
    .limit(1);

  if (!company) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 });
  }

  // Hent dokumentet
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.companyId, companyId)))
    .limit(1);

  if (!doc) {
    return NextResponse.json(
      { error: "Dokument ikke funnet" },
      { status: 404 }
    );
  }

  // Hent selskapets kontoplan for kontekst til Gemini
  const companyAccounts = await db
    .select({
      accountNumber: accounts.accountNumber,
      name: accounts.name,
      accountClass: accounts.accountClass,
    })
    .from(accounts)
    .where(and(eq(accounts.companyId, companyId), eq(accounts.active, true)))
    .orderBy(asc(accounts.accountNumber));

  // Les filen fra disk
  const fullPath = path.join(UPLOAD_DIR, doc.storedPath);
  let fileBuffer: Buffer;
  try {
    fileBuffer = await readFile(fullPath);
  } catch {
    return NextResponse.json(
      { error: "Filen ble ikke funnet på disk" },
      { status: 404 }
    );
  }

  // Bygg kontoplan-kontekst (bare relevante kontoer)
  const kontoplantekst = companyAccounts
    .map((a) => `${a.accountNumber} ${a.name} (${a.accountClass})`)
    .join("\n");

  const prompt = `Du er en norsk regnskapsfører-AI. Analyser dette dokumentet (bilag/faktura/kvittering) og foreslå bokføring etter norsk NS 4102 kontoplan.

VIKTIG: Selskapet er et lite AS uten ansatte og uten MVA-registrering. Det betyr:
- INGEN mva-beregning (alt bokføres inkl. mva som én sum)
- Bruk ALDRI konto 2700/2710/2711 (inngående merverdiavgift) — de finnes ikke i kontoplanen
- Totalbeløp = beløp inkl. mva (hele fakturabeløpet)

Selskapets kontoplan:
${kontoplantekst}

Regler for dobbel bokføring:
1. Sum debet SKAL være lik sum kredit
2. For en utgift: debet på kostnadskonto, kredit på 1920 (bankkonto)
3. For en inntekt: debet på 1920 (bankkonto), kredit på inntektskonto (f.eks. 3000)
4. Bruk BARE kontonumre som finnes i kontoplanen over
5. Beløp skal være i NOK

Returner ALLTID svar som gyldig JSON (ingen markdown, ingen forklaring utenfor JSON):
{
  "date": "YYYY-MM-DD eller null hvis ikke lesbart",
  "description": "kort beskrivelse av transaksjonen",
  "totalAmount": 1234.56,
  "entries": [
    { "accountNumber": 7500, "accountName": "Forsikringspremie", "debit": 1234.56, "credit": 0 },
    { "accountNumber": 1920, "accountName": "Bankinnskudd", "debit": 0, "credit": 1234.56 }
  ],
  "reasoning": "Kort begrunnelse for valg av kontoer",
  "confidence": 0.85
}

Analyser dokumentet nå:`;

  try {
    const model = getGeminiModel();
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: toGeminiMime(doc.fileType),
          data: fileBuffer.toString("base64"),
        },
      },
      { text: prompt },
    ]);

    const responseText = result.response.text();

    // Parse JSON fra respons (håndter mulige markdown-blokker)
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith("```")) {
      // Fjern markdown code block
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }

    let parsed: AiSuggestion;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Kunne ikke parse Gemini-respons som JSON:", responseText);
      return NextResponse.json(
        {
          error: "AI returnerte ugyldig format",
          rawResponse: responseText.substring(0, 500),
        },
        { status: 502 }
      );
    }

    // Valider at entries balanserer
    const totalDebit = parsed.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCredit = parsed.entries.reduce((sum, e) => sum + (e.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      // Ikke feil — bare legg til advarsel
      parsed.reasoning += ` (ADVARSEL: AI-forslaget balanserer ikke — debet ${totalDebit.toFixed(2)} ≠ kredit ${totalCredit.toFixed(2)})`;
      parsed.confidence = Math.min(parsed.confidence, 0.3);
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Gemini API-feil:", err);
    const message =
      err instanceof Error ? err.message : "Ukjent feil ved AI-analyse";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
