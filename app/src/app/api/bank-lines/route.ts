/**
 * GET    /api/bank-lines?companyId=xxx&cycleId=yyy
 * POST   /api/bank-lines — importer banklinjer fra PDF (bankutskrift) eller CSV
 * PATCH  /api/bank-lines — avstem/ignorer/fjern avstemming
 *
 * Støtter DNB og Pareto Bank kontoutskrifter (PDF).
 * pdf-parse v2 API: new PDFParse({ data }) → load({ data }) → getText()
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  bankLines,
  vouchers,
  companies,
  accountants,
  cycles,
  documents,
} from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { PDFParse } from "pdf-parse";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

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

// ── Hjelpefunksjoner ──

type ParsedLine = {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // positiv = inn, negativ = ut
};

function parseNorwegianDate(dateStr: string): string {
  const trimmed = dateStr.trim();

  // DD.MM.YYYY
  const dotMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotMatch) {
    return `${dotMatch[3]}-${dotMatch[2].padStart(2, "0")}-${dotMatch[1].padStart(2, "0")}`;
  }

  // DD.MM.YY
  const dotShort = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})$/);
  if (dotShort) {
    const year = parseInt(dotShort[3]) > 50 ? `19${dotShort[3]}` : `20${dotShort[3]}`;
    return `${year}-${dotShort[2].padStart(2, "0")}-${dotShort[1].padStart(2, "0")}`;
  }

  return trimmed;
}

function parseNorwegianAmount(str: string): number {
  // Norsk format: "1 234,56" eller "-1 234,56" eller "1.234,56"
  const cleaned = str
    .trim()
    .replace(/\s/g, "")       // fjern mellomrom
    .replace(/\.(?=\d{3})/g, "") // fjern tusenskilletegn (punktum foran 3 siffer)
    .replace(",", ".");       // norsk desimaltegn -> punkt
  return parseFloat(cleaned) || 0;
}

/**
 * Ekstraher tekst fra PDF-buffer via pdf-parse v2.
 * Returnerer ren tekst-streng.
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text;
}

// ── DNB kontoutskrift-parser ──
//
// DNB-format (fra PDF-tekst):
//   DD.MM.YY DD.MM.YY Forklarende tekst
//   (valgfri fortsettelseslinje)
//   beløp DD.MM.YY arkivref
//
// Transaksjoner begynner med to datoer (bruksdato + bokføringsdato).
// Beløp kommer enten i "Ut av konto" eller "Inn på konto" kolonne,
// men i PDF-tekst er kolonneinformasjonen tapt — alle beløp er positive.
//
// Løsning: bruk "Saldo forrige utskrift" og "Ny saldo" fra seksjonsheaderen
// for å beregne forventet nettoendring, og prøv alle fortegnkombinasjoner
// (maks 2^n der n er antall transaksjoner per seksjon, typisk 2-5).

type UnsignedTx = {
  date: string;
  description: string;
  absAmount: number;
};

function parseDNB(text: string): ParsedLine[] {
  const result: ParsedLine[] = [];

  // Split teksten i seksjoner per kontoutskrift (separert av "-- X of Y --")
  const sections = text.split(/--\s*\d+\s+of\s+\d+\s*--/);

  for (const section of sections) {
    // Sjekk om dette er en kontoutskrift-seksjon (ikke årsoppgave, sikringsfond, etc.)
    if (!section.includes("Kontoutskrift for") && !section.includes("Dato Forklarende tekst")) {
      continue;
    }

    // Hent saldo for å beregne fortegn
    const saldoForrigeMatch = section.match(
      /Saldo forrige utskrift[\s\S]*?NOK\s+([\d.\s]+,\d{2})/
    );
    const nySaldoMatch = section.match(
      /Ny saldo per[\s\S]*?NOK\s+([\d.\s]+,\d{2})/
    );

    const saldoForrige = saldoForrigeMatch
      ? parseNorwegianAmount(saldoForrigeMatch[1])
      : null;
    const nySaldo = nySaldoMatch
      ? parseNorwegianAmount(nySaldoMatch[1])
      : null;

    const expectedNet =
      saldoForrige !== null && nySaldo !== null
        ? Math.round((nySaldo - saldoForrige) * 100) / 100
        : null;

    // Finn transaksjonsdelen (etter header-linjen "Bruk Bokføring")
    const headerIdx = section.indexOf("Bruk Bokføring");
    if (headerIdx === -1) continue;

    // Finn slutten (før "Renter, gebyrer" eller lignende)
    const endPatterns = [
      "Renter, gebyrer",
      "Betalte omkostninger",
      "Informasjon om renter",
      "Rapportering til valutaregisteret",
      "Vi gjør oppmerksom",
    ];

    let transactionText = section.substring(
      headerIdx + "Bruk Bokføring".length
    );
    for (const endPat of endPatterns) {
      const endIdx = transactionText.indexOf(endPat);
      if (endIdx !== -1) {
        transactionText = transactionText.substring(0, endIdx);
      }
    }

    const txLines = transactionText
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    // Sjekk for "Ingen transaksjoner denne perioden"
    if (txLines.some((l) => l.includes("Ingen transaksjoner"))) {
      continue;
    }

    // ── Første pass: samle transaksjoner med absolutt beløp ──
    const unsignedTxs: UnsignedTx[] = [];
    let currentDate: string | null = null;
    let descriptionParts: string[] = [];
    let currentAmount: number | null = null;

    const flushTx = () => {
      if (
        currentDate &&
        currentAmount !== null &&
        descriptionParts.length > 0
      ) {
        unsignedTxs.push({
          date: currentDate,
          description: descriptionParts.join(" ").trim(),
          absAmount: Math.abs(currentAmount),
        });
      }
      currentDate = null;
      descriptionParts = [];
      currentAmount = null;
    };

    for (const line of txLines) {
      // Ny transaksjon starter med DD.MM.YY DD.MM.YY
      const dateMatch = line.match(
        /^(\d{2}\.\d{2}\.\d{2})\s+(\d{2}\.\d{2}\.\d{2})\s+(.*)$/
      );

      if (dateMatch) {
        flushTx();
        currentDate = parseNorwegianDate(dateMatch[2]); // bokføringsdato
        descriptionParts = [dateMatch[3]];
        continue;
      }

      // Beløpslinje: "beløp DD.MM.YY arkivref"
      const amountMatch = line.match(
        /^([\d.,\s]+,\d{2})\s+(\d{2}\.\d{2}\.\d{2})\s+(\d+)$/
      );

      if (amountMatch && currentDate && currentAmount === null) {
        currentAmount = parseNorwegianAmount(amountMatch[1]);
        continue;
      }

      // Rentelinje uten arkivref: "Renter 0,11 01.04.25 150647000"
      // Sjekk for dette spesialtilfelle (Renter er beskrivelse, beløp følger)
      const renteMatch = line.match(
        /^Renter\s+([\d.,]+,\d{2})\s+(\d{2}\.\d{2}\.\d{2})\s+(\d+)$/
      );
      if (renteMatch && currentDate && currentAmount === null) {
        descriptionParts = ["Renter"];
        currentAmount = parseNorwegianAmount(renteMatch[1]);
        continue;
      }

      // Beskrivelseslinjer (fortsettelse)
      if (currentDate && currentAmount === null) {
        if (
          !line.match(/^Saldo/) &&
          !line.match(/^Ny saldo/) &&
          !line.match(/^Dato\s/) &&
          !line.match(/^Side\s/) &&
          line.length > 1
        ) {
          descriptionParts.push(line);
        }
      }
    }

    flushTx();

    if (unsignedTxs.length === 0) continue;

    // ── Andre pass: bestem fortegn via saldo-avstemming ──
    if (expectedNet !== null && unsignedTxs.length <= 15) {
      // Prøv alle 2^n kombinasjoner (n er typisk 2-5, maks ~15)
      const n = unsignedTxs.length;
      let bestCombo = -1;
      let bestDiff = Infinity;

      for (let combo = 0; combo < 1 << n; combo++) {
        let sum = 0;
        for (let j = 0; j < n; j++) {
          // bit=0 → negativt (ut), bit=1 → positivt (inn)
          sum +=
            combo & (1 << j)
              ? unsignedTxs[j].absAmount
              : -unsignedTxs[j].absAmount;
        }
        const diff = Math.abs(
          Math.round(sum * 100) / 100 - expectedNet
        );
        if (diff < bestDiff) {
          bestDiff = diff;
          bestCombo = combo;
        }
        if (diff < 0.01) break; // eksakt treff
      }

      if (bestCombo >= 0 && bestDiff < 1) {
        // Legg til med riktige fortegn
        for (let j = 0; j < n; j++) {
          const sign = bestCombo & (1 << j) ? 1 : -1;
          result.push({
            date: unsignedTxs[j].date,
            description: unsignedTxs[j].description,
            amount: sign * unsignedTxs[j].absAmount,
          });
        }
        continue; // Neste seksjon
      }
    }

    // Fallback: anta alle er negative (ut av konto)
    for (const tx of unsignedTxs) {
      result.push({
        date: tx.date,
        description: tx.description,
        amount: -tx.absAmount,
      });
    }
  }

  return result;
}

// ── Pareto Bank kontoutskrift-parser ──
//
// Pareto-format (fra PDF-tekst):
//   "Til: Tibber Norge AS Betalt: 09.01.25 	1001 	387,40 	0901 	995163 	938099343"
//   "Fra: Jarand Rorgemoen Betalt: 11.01.25 	1301 	13.307,00 	1301 	542 	797641690"
//   "Kostnader ved bruk av banktjenester:"
//   "3 Nettgiro m/kid forfall i dag 	3101 	3,00 	3101"
//
// Tabs (\t) brukes som separator i Pareto-utskrifter.

function parsePareto(text: string): ParsedLine[] {
  const result: ParsedLine[] = [];

  // Fjern "Regnskapsbilag"-seksjoner som gjentar kostnadslinjene
  // Disse starter med "Regnskapsbilag for konto" og slutter ved neste "-- X of Y --"
  const cleanedText = text.replace(
    /Regnskapsbilag for konto[\s\S]*?(?=(?:--\s*\d+\s+of\s+\d+\s*--)|$)/g,
    ""
  );

  // Hent saldo-info for fortegnsberegning
  const saldoForrigeMatch = cleanedText.match(
    /Saldo fra kontoutskrift[\s\S]*?\t\s*([\d.\s]+,\d{2})/
  );
  const nySaldoMatch = cleanedText.match(
    /Saldo i (?:Deres|vår) favør\s*\t?\s*([\d.\s]+,\d{2})/
  );
  const saldoForrige = saldoForrigeMatch
    ? parseNorwegianAmount(saldoForrigeMatch[1])
    : null;
  const nySaldo = nySaldoMatch ? parseNorwegianAmount(nySaldoMatch[1]) : null;

  // "Saldo i vår favør" betyr kontoen er negativ (bank skylder kunde ingenting)
  // "Saldo i Deres favør" betyr kontoen er positiv
  const nySaldoSigned =
    nySaldo !== null
      ? cleanedText.includes("Saldo i vår favør")
        ? -nySaldo
        : nySaldo
      : null;
  const saldoForrigeSigned =
    saldoForrige !== null
      ? // Forrige saldo kan også være "i vår favør" - sjekk kontekst
        saldoForrige
      : null;

  const lines = cleanedText
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Flagg: er vi i kostnadsseksjonen?
  let inCostSection = false;

  for (const line of lines) {
    // Marker kostnadsseksjon
    if (line.startsWith("Kostnader ved bruk")) {
      inCostSection = true;
      continue;
    }
    // Slutt på kostnadsseksjon
    if (line.startsWith("Saldo i ") || line.startsWith("Betalte omkostninger")) {
      inCostSection = false;
      continue;
    }

    // Mønster 1: "Til: mottaker Betalt: DD.MM.YY \t ..."
    // eller "Fra: avsender Betalt: DD.MM.YY \t ..."
    const txMatch = line.match(
      /^(Til|Fra):\s+(.+?)\s+Betalt:\s+(\d{2}\.\d{2}\.\d{2})/
    );

    if (txMatch) {
      const direction = txMatch[1]; // "Til" = ut, "Fra" = inn
      const counterparty = txMatch[2].trim();
      const date = parseNorwegianDate(txMatch[3]);

      // Finn beløp: split resten på tab og finn beløp-feltet
      const afterDate = line.substring(
        line.indexOf(txMatch[3]) + txMatch[3].length
      );
      const parts = afterDate
        .split(/\t/)
        .map((p) => p.trim())
        .filter(Boolean);

      // Beløp er typisk i parts[1] (etter rentedato)
      let amount = 0;
      for (const part of parts) {
        const parsed = parseNorwegianAmount(part);
        if (parsed > 0 && part.includes(",")) {
          amount = parsed;
          break;
        }
      }

      if (amount > 0 && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        result.push({
          date,
          description: counterparty,
          amount: direction === "Til" ? -amount : amount,
        });
      }
      continue;
    }

    // Mønster 2: Tab-separerte transaksjonslinjer (kostnad eller generell)
    // Format: "Beskrivelse \t DDMM \t beløp \t DDMM [\t ref]"
    // Eller: "N Beskrivelse \t DDMM \t beløp \t DDMM"
    const tabParts = line.split(/\t/).map((p) => p.trim());
    if (tabParts.length >= 4) {
      const description = tabParts[0].trim();

      // Hopp over header-linjer og saldo-linjer
      if (
        description.startsWith("Forklaring") ||
        description.startsWith("Saldo") ||
        description.startsWith("Betalte") ||
        description.startsWith("Sum ")
      ) {
        continue;
      }

      // Finn beløp og rentedato fra tab-deler
      let amount = 0;
      let rentedato = "";
      for (let i = 1; i < tabParts.length; i++) {
        // DDMM format (4 siffer)
        if (tabParts[i].match(/^\d{4}$/) && !rentedato) {
          rentedato = tabParts[i];
          continue;
        }
        // Beløp (inneholder komma)
        if (tabParts[i].includes(",") && !amount) {
          const parsed = parseNorwegianAmount(tabParts[i]);
          if (parsed > 0) {
            amount = parsed;
            continue;
          }
        }
      }

      if (amount > 0 && rentedato) {
        const dd = rentedato.substring(0, 2);
        const mm = rentedato.substring(2, 4);
        const yearMatch = text.match(
          /perioden\s+\d{2}\.\d{2}\.(\d{4})/
        );
        const year = yearMatch
          ? yearMatch[1]
          : new Date().getFullYear().toString();
        const date = `${year}-${mm}-${dd}`;

        // Kostnadsseksjon → alltid negativt
        // Ellers: bruk nøkkelord for å gjette retning
        let sign = -1;
        if (!inCostSection) {
          // "Tilbakeførsel", "Refusjon", "Kreditnota" → inn
          if (
            description.match(/tilbakeførs/i) ||
            description.match(/refusjon/i) ||
            description.match(/kredit/i)
          ) {
            sign = 1;
          }
        }

        result.push({
          date,
          description: description,
          amount: sign * amount,
        });
      }
    }
  }

  return result;
}

// ── Hovedparser som prøver DNB og Pareto ──

function parseBankPdfText(text: string, fallbackYear?: string): ParsedLine[] {
  // Sjekk om det er DNB-format
  if (text.includes("Kontoutskrift for") && text.includes("Bruk Bokføring")) {
    const dnbResult = parseDNB(text);
    if (dnbResult.length > 0) return dnbResult;
  }

  // Sjekk om det er Pareto-format
  if (text.includes("Paretokonto") || text.match(/^(Til|Fra):\s/m)) {
    const paretoResult = parsePareto(text);
    if (paretoResult.length > 0) return paretoResult;
  }

  // Fallback: generisk linje-parser (for andre banker)
  return parseGeneric(text, fallbackYear);
}

// Generisk parser for ukjente formater
function parseGeneric(text: string, fallbackYear?: string): ParsedLine[] {
  const rawLines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const result: ParsedLine[] = [];
  const year = fallbackYear || new Date().getFullYear().toString();

  for (const line of rawLines) {
    // DD.MM.YYYY ... beløp
    const m1 = line.match(/^(\d{1,2}\.\d{1,2}\.\d{4})\s+(?:\d{1,2}\.\d{1,2}\.\d{4}\s+)?(.+)$/);
    if (m1) {
      const date = parseNorwegianDate(m1[1]);
      const parsed = extractAmountFromEnd(m1[2]);
      if (parsed && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        result.push({ date, description: parsed.description, amount: parsed.amount });
        continue;
      }
    }

    // DD.MM.YY ... beløp
    const m2 = line.match(/^(\d{1,2}\.\d{1,2}\.\d{2})\s+(?:\d{1,2}\.\d{1,2}\.\d{2}\s+)?(.+)$/);
    if (m2) {
      const date = parseNorwegianDate(m2[1]);
      const parsed = extractAmountFromEnd(m2[2]);
      if (parsed && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        result.push({ date, description: parsed.description, amount: parsed.amount });
        continue;
      }
    }

    // DD.MM ... beløp (med fallback-år)
    const m3 = line.match(/^(\d{1,2})\.(\d{1,2})\s+(?:\d{1,2}\.\d{1,2}\s+)?(.+)$/);
    if (m3) {
      const date = `${year}-${m3[2].padStart(2, "0")}-${m3[1].padStart(2, "0")}`;
      const parsed = extractAmountFromEnd(m3[3]);
      if (parsed) {
        result.push({ date, description: parsed.description, amount: parsed.amount });
      }
    }
  }

  return result;
}

function extractAmountFromEnd(text: string): { description: string; amount: number } | null {
  const amountRegex = /-?[\d][\d\s.]*,\d{2}/g;
  const matches: { match: string; index: number }[] = [];
  let m;
  while ((m = amountRegex.exec(text)) !== null) {
    matches.push({ match: m[0], index: m.index });
  }

  if (matches.length === 0) return null;

  const amountMatch = matches.length >= 2 ? matches[matches.length - 2] : matches[0];
  const amount = parseNorwegianAmount(amountMatch.match);

  if (amount === 0) return null;

  const firstAmountIdx = matches[0].index;
  const description = text.substring(0, firstAmountIdx).trim();

  if (!description || description.length < 2) return null;

  return { description, amount };
}

// ── CSV-parsing ──

function parseBankCSV(csv: string): ParsedLine[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  const header = lines[0];
  const separator = header.includes(";") ? ";" : header.includes("\t") ? "\t" : ",";
  const columns = header.split(separator).map((c) => c.trim().toLowerCase().replace(/"/g, ""));

  const dateIdx = columns.findIndex(
    (c) => c.includes("dato") || c.includes("date") || c.includes("bokføring")
  );
  const descIdx = columns.findIndex(
    (c) => c.includes("forklaring") || c.includes("beskrivelse") || c.includes("tekst")
  );

  const hasUtInn =
    columns.some((c) => c.includes("ut av") || c.includes("ut fra")) &&
    columns.some((c) => c.includes("inn på") || c.includes("inn pa"));
  const hasBeloep = columns.some((c) => c.includes("beløp") || c.includes("belop") || c === "amount");

  const result: ParsedLine[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(separator).map((v) => v.trim().replace(/^"|"$/g, ""));
    if (vals.length < 2) continue;

    const date = parseNorwegianDate(vals[dateIdx >= 0 ? dateIdx : 0]);
    const description = vals[descIdx >= 0 ? descIdx : 1] || "";
    let amount = 0;

    if (hasUtInn) {
      const utIdx = columns.findIndex((c) => c.includes("ut av") || c.includes("ut fra"));
      const innIdx = columns.findIndex((c) => c.includes("inn på") || c.includes("inn pa"));
      const utVal = parseNorwegianAmount(vals[utIdx] || "0");
      const innVal = parseNorwegianAmount(vals[innIdx] || "0");
      amount = innVal > 0 ? innVal : utVal > 0 ? -utVal : 0;
    } else if (hasBeloep) {
      const belIdx = columns.findIndex((c) => c.includes("beløp") || c.includes("belop") || c === "amount");
      amount = parseNorwegianAmount(vals[belIdx] || "0");
    } else {
      amount = parseNorwegianAmount(vals[2] || "0");
    }

    if (date && amount !== 0) {
      result.push({ date, description, amount });
    }
  }

  return result;
}

// ── Routes ──

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  }

  const companyId = req.nextUrl.searchParams.get("companyId");
  const cycleId = req.nextUrl.searchParams.get("cycleId");

  if (!companyId || !cycleId) {
    return NextResponse.json({ error: "companyId og cycleId kreves" }, { status: 400 });
  }

  const company = await verifyRfOwnership(session.user.id, companyId);
  if (!company) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 });
  }

  const lines = await db
    .select()
    .from(bankLines)
    .where(and(eq(bankLines.companyId, companyId), eq(bankLines.cycleId, cycleId)))
    .orderBy(asc(bankLines.transactionDate));

  // Hent bilag-info for avstemte linjer
  const voucherMap: Record<string, { voucherNumber: number; description: string }> = {};
  if (lines.some((l) => l.matchedVoucherId)) {
    const voucherList = await db
      .select({ id: vouchers.id, voucherNumber: vouchers.voucherNumber, description: vouchers.description })
      .from(vouchers)
      .where(eq(vouchers.companyId, companyId));
    for (const v of voucherList) {
      voucherMap[v.id] = { voucherNumber: v.voucherNumber, description: v.description };
    }
  }

  const result = lines.map((l) => ({
    ...l,
    matchedVoucher: l.matchedVoucherId ? voucherMap[l.matchedVoucherId] || null : null,
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") || "";

  let companyId: string;
  let cycleId: string;
  let pdfBuffers: Buffer[] = [];
  let csvData: string | null = null;
  // documentIds fra kundeopplastinger (for å importere direkte)
  let documentIds: string[] = [];

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    companyId = formData.get("companyId") as string;
    cycleId = formData.get("cycleId") as string;

    // Støtt både "file" (enkelt) og "files" (flervalg)
    const singleFile = formData.get("file") as File | null;
    const multiFiles = formData.getAll("files") as File[];

    const files: File[] = [];
    if (singleFile) files.push(singleFile);
    for (const f of multiFiles) {
      if (f instanceof File) files.push(f);
    }

    if (!companyId || !cycleId || files.length === 0) {
      return NextResponse.json({ error: "companyId, cycleId og minst én fil kreves" }, { status: 400 });
    }

    for (const file of files) {
      pdfBuffers.push(Buffer.from(await file.arrayBuffer()));
    }
  } else {
    // JSON: enten csvData eller documentIds (importer fra kundedokumenter)
    const body = await req.json();
    companyId = body.companyId;
    cycleId = body.cycleId;
    csvData = body.csvData as string | null;
    documentIds = body.documentIds as string[] || [];

    if (!companyId || !cycleId || (!csvData && documentIds.length === 0)) {
      return NextResponse.json({ error: "companyId, cycleId og csvData eller documentIds kreves" }, { status: 400 });
    }
  }

  // Verifiser tilgang og hent syklus
  const company = await verifyRfOwnership(session.user.id, companyId);
  if (!company) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 });
  }

  const [cycle] = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.id, cycleId), eq(cycles.companyId, companyId)))
    .limit(1);

  if (!cycle) {
    return NextResponse.json({ error: "Syklus ikke funnet" }, { status: 404 });
  }

  // Hent PDF-buffere fra kundedokumenter hvis documentIds er angitt
  if (documentIds.length > 0) {
    for (const docId of documentIds) {
      const [doc] = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, docId), eq(documents.companyId, companyId)))
        .limit(1);

      if (doc && doc.fileType === "application/pdf") {
        try {
          const fullPath = path.join(UPLOAD_DIR, doc.storedPath);
          const buffer = await readFile(fullPath);
          pdfBuffers.push(buffer);
        } catch {
          // Fil ikke funnet på disk, hopp over
        }
      }
    }
  }

  // Pars data
  let parsed: ParsedLine[] = [];
  const pdfErrors: string[] = [];

  for (const buffer of pdfBuffers) {
    try {
      const text = await extractPdfText(buffer);
      const lines = parseBankPdfText(text, cycle.year.toString());
      parsed.push(...lines);

      // Hvis PDF-parsing gir 0 resultater, prøv CSV-fallback
      if (lines.length === 0) {
        const csvLines = parseBankCSV(text);
        parsed.push(...csvLines);
      }
    } catch (err) {
      // Fortsett med neste fil hvis en feiler
      const msg = err instanceof Error ? err.message : String(err);
      console.error("PDF-parsing feilet:", msg);
      pdfErrors.push(msg);
    }
  }

  if (csvData) {
    parsed.push(...parseBankCSV(csvData));
  }

  if (parsed.length === 0) {
    const errorDetail = pdfErrors.length > 0
      ? `PDF-feil: ${pdfErrors.join("; ")}`
      : "Ingen transaksjoner funnet. Sjekk at filen er en bankutskrift med transaksjonslinjer.";
    return NextResponse.json(
      { error: errorDetail },
      { status: 400 }
    );
  }

  // Duplikatsjekk
  const existing = await db
    .select({
      transactionDate: bankLines.transactionDate,
      description: bankLines.description,
      amount: bankLines.amount,
    })
    .from(bankLines)
    .where(
      and(eq(bankLines.companyId, companyId), eq(bankLines.cycleId, cycleId))
    );

  const existingSet = new Set(
    existing.map((e) => `${e.transactionDate}|${e.description}|${e.amount}`)
  );

  const newLines = parsed.filter(
    (line) => !existingSet.has(`${line.date}|${line.description}|${line.amount.toString()}`)
  );

  const skipped = parsed.length - newLines.length;

  if (newLines.length === 0 && skipped > 0) {
    return NextResponse.json({
      ok: true,
      count: 0,
      skipped,
      message: `Alle ${skipped} transaksjoner finnes allerede. Ingen nye lagt til.`,
    });
  }

  let inserted = 0;
  for (const line of newLines) {
    await db.insert(bankLines).values({
      companyId,
      cycleId,
      transactionDate: line.date,
      description: line.description,
      amount: line.amount.toString(),
      status: "uavstemt",
    });
    inserted++;
  }

  return NextResponse.json({ ok: true, count: inserted, skipped });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  }

  const body = await req.json();
  const { bankLineId, voucherId, action } = body as {
    bankLineId: string;
    voucherId?: string;
    action: "avstem" | "ignorer" | "fjern_avstemming";
  };

  if (!bankLineId || !action) {
    return NextResponse.json({ error: "bankLineId og action kreves" }, { status: 400 });
  }

  const [line] = await db
    .select()
    .from(bankLines)
    .where(eq(bankLines.id, bankLineId))
    .limit(1);

  if (!line) {
    return NextResponse.json({ error: "Banklinje ikke funnet" }, { status: 404 });
  }

  const company = await verifyRfOwnership(session.user.id, line.companyId);
  if (!company) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 });
  }

  if (action === "avstem" && voucherId) {
    await db
      .update(bankLines)
      .set({ status: "avstemt", matchedVoucherId: voucherId })
      .where(eq(bankLines.id, bankLineId));
  } else if (action === "ignorer") {
    await db
      .update(bankLines)
      .set({ status: "ignorert", matchedVoucherId: null })
      .where(eq(bankLines.id, bankLineId));
  } else if (action === "fjern_avstemming") {
    await db
      .update(bankLines)
      .set({ status: "uavstemt", matchedVoucherId: null })
      .where(eq(bankLines.id, bankLineId));
  }

  return NextResponse.json({ ok: true });
}
