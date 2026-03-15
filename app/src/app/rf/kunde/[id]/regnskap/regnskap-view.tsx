"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Account = {
  id: string;
  accountNumber: number;
  name: string;
  accountClass: string;
};

type JournalEntry = {
  id: string;
  accountId: string;
  accountNumber: number;
  accountName: string;
  debit: string;
  credit: string;
  description: string | null;
};

type Voucher = {
  id: string;
  voucherNumber: number;
  voucherDate: string;
  description: string;
  status: string;
  documentId: string | null;
  aiConfidence: string | null;
  aiReasoning: string | null;
  createdAt: string;
  entries: JournalEntry[];
};

type BankLine = {
  id: string;
  transactionDate: string;
  description: string;
  amount: string;
  bankReference: string | null;
  status: string;
  matchedVoucherId: string | null;
  matchedVoucher: { voucherNumber: number; description: string } | null;
};

type UploadedDocument = {
  id: string;
  taskId: string | null;
  taskTitle: string | null;
  category: string;
  categoryLabel: string;
  originalFilename: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
};

type Tab = "apningsbalanse" | "bilag" | "hovedbok" | "saldobalanse" | "resultat" | "balanse" | "bank";

const accountClassLabels: Record<string, string> = {
  eiendeler: "1 — Eiendeler",
  egenkapital: "2 — Egenkapital",
  gjeld: "2 — Gjeld",
  inntekter: "3 — Salgsinntekter",
  varekostnad: "4 — Varekostnad",
  lonnskostnad: "5 — Lønnskostnad",
  avskrivninger: "6 — Avskr. / andre driftskostn.",
  andre_kostnader: "7 — Andre driftskostnader",
  finans: "8 — Finans",
};

const voucherStatusLabels: Record<string, { label: string; color: string }> = {
  utkast: { label: "Utkast", color: "bg-ecit-beige text-ecit-navy/60" },
  foreslatt: { label: "AI-foreslått", color: "bg-ecit-purple text-white" },
  godkjent: { label: "Godkjent", color: "bg-ecit-blue text-white" },
  postert: { label: "Postert", color: "bg-ecit-green text-white" },
  avvist: { label: "Avvist", color: "bg-ecit-ruby text-white" },
};

function formatNumber(n: number): string {
  return n.toLocaleString("nb-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── Nytt bilag form ───
type NewEntry = {
  accountId: string;
  debit: string;
  credit: string;
};

type BilagPrefill = {
  description: string;
  documentId: string;
  documentFilename: string;
};

// ── Nøkkelord → konto-forslag ──
// Brukes til å foreslå motkonto basert på filnavn/beskrivelse.
// Forbereder for AI-utvidelse: AI kan sette dette direkte fra PDF-innhold.
type AccountSuggestion = {
  label: string;        // "Forsikring", "Strøm", etc.
  accountNumber: number;
  keywords: string[];   // matchord i filnavn/beskrivelse
};

const ACCOUNT_SUGGESTIONS: AccountSuggestion[] = [
  { label: "Forsikring", accountNumber: 7500, keywords: ["forsikring", "if ", "gjensidige", "tryg", "fremtind", "storebrand forsikring", "insurance"] },
  { label: "Strøm / energi", accountNumber: 6340, keywords: ["tibber", "strom", "strøm", "energi", "hafslund", "fortum", "fjordkraft", "gudbrandsdal energi"] },
  { label: "Telefon / internett", accountNumber: 6900, keywords: ["telenor", "telia", "ice", "phonero", "mycall", "telefon", "internett", "mobil"] },
  { label: "Kontorrekvisita", accountNumber: 6860, keywords: ["kontorrekvisita", "staples", "clas ohlson", "jysk", "ikea"] },
  { label: "Regnskapstjenester", accountNumber: 6700, keywords: ["regnskap", "revisjon", "revisor", "accountant"] },
  { label: "Leie / husleie", accountNumber: 6300, keywords: ["husleie", "leie", "kontorleie", "obos", "leieavtale"] },
  { label: "Vedlikehold", accountNumber: 6695, keywords: ["vedlikehold", "reparasjon", "service"] },
  { label: "Reisekostnad", accountNumber: 7140, keywords: ["reise", "fly", "tog", "sas", "norwegian", "vy", "wideroe", "widerøe", "flybillett"] },
  { label: "Salgsinntekt", accountNumber: 3000, keywords: ["faktura", "salg", "inntekt", "honorar", "kunde"] },
  { label: "Bankgebyr", accountNumber: 7770, keywords: ["gebyr", "bankgebyr", "kostnader ved bruk"] },
  { label: "Renter", accountNumber: 8050, keywords: ["rente", "renter"] },
];

function suggestAccounts(text: string, accounts: Account[]): { suggestion: AccountSuggestion; account: Account }[] {
  const lower = text.toLowerCase();
  const results: { suggestion: AccountSuggestion; account: Account }[] = [];

  for (const suggestion of ACCOUNT_SUGGESTIONS) {
    if (suggestion.keywords.some(kw => lower.includes(kw))) {
      // Find matching account in company's kontoplan
      const account = accounts.find(a => a.accountNumber === suggestion.accountNumber);
      if (account) {
        results.push({ suggestion, account });
      }
    }
  }

  return results;
}

function NyttBilagForm({
  accounts,
  companyId,
  cycleId,
  onCreated,
  prefill,
  onPrefillConsumed,
  onClose,
}: {
  accounts: Account[];
  companyId: string;
  cycleId: string;
  onCreated: () => void;
  prefill?: BilagPrefill | null;
  onPrefillConsumed?: () => void;
  onClose?: () => void;
}) {
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [linkedDocumentId, setLinkedDocumentId] = useState<string | null>(null);
  const [linkedDocumentName, setLinkedDocumentName] = useState<string | null>(null);
  const isDocumentMode = !!linkedDocumentId;

  // Apply prefill when it changes
  useEffect(() => {
    if (prefill) {
      setDescription(prefill.description);
      setLinkedDocumentId(prefill.documentId);
      setLinkedDocumentName(prefill.documentFilename);
      onPrefillConsumed?.();
    }
  }, [prefill, onPrefillConsumed]);
  const [entries, setEntries] = useState<NewEntry[]>([
    { accountId: "", debit: "", credit: "" },
    { accountId: "", debit: "", credit: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // AI-forslag state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [aiApplied, setAiApplied] = useState(false);

  // Kontoforslag basert på filnavn/beskrivelse
  const suggestions = useMemo(() => {
    const text = [description, linkedDocumentName || ""].join(" ");
    return suggestAccounts(text, accounts);
  }, [description, linkedDocumentName, accounts]);

  const applySuggestion = (accountId: string) => {
    setEntries(prev => {
      const next = [...prev];
      // Set the first empty line's account to the suggested account
      const emptyIdx = next.findIndex(e => !e.accountId);
      if (emptyIdx >= 0) {
        next[emptyIdx] = { ...next[emptyIdx], accountId };
      } else {
        // All lines filled — set first line
        next[0] = { ...next[0], accountId };
      }
      return next;
    });
  };

  // Hent AI-forslag fra Gemini
  const fetchAiSuggestion = async () => {
    if (!linkedDocumentId) return;
    setAiLoading(true);
    setAiError("");
    setAiReasoning(null);
    setAiConfidence(null);
    setAiApplied(false);

    try {
      const res = await fetch("/api/ai/parse-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: linkedDocumentId, companyId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setAiError(data.error || "Feil ved AI-analyse");
        return;
      }

      const suggestion = await res.json();

      // Fyll ut skjemaet med AI-forslag
      if (suggestion.date) setDate(suggestion.date);
      if (suggestion.description) setDescription(suggestion.description);
      if (suggestion.reasoning) setAiReasoning(suggestion.reasoning);
      if (suggestion.confidence != null) setAiConfidence(suggestion.confidence);

      // Map AI-entries til skjemaet (match kontonummer → accountId)
      if (suggestion.entries?.length) {
        const mappedEntries: NewEntry[] = suggestion.entries.map(
          (e: { accountNumber: number; debit: number; credit: number }) => {
            const account = accounts.find(a => a.accountNumber === e.accountNumber);
            return {
              accountId: account?.id || "",
              debit: e.debit > 0 ? e.debit.toFixed(2) : "",
              credit: e.credit > 0 ? e.credit.toFixed(2) : "",
            };
          }
        );
        setEntries(mappedEntries);
      }

      setAiApplied(true);
    } catch {
      setAiError("Nettverksfeil — kunne ikke nå AI-tjenesten");
    } finally {
      setAiLoading(false);
    }
  };

  const addLine = () =>
    setEntries((prev) => [...prev, { accountId: "", debit: "", credit: "" }]);

  const removeLine = (idx: number) => {
    if (entries.length <= 2) return;
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateEntry = (idx: number, field: keyof NewEntry, value: string) => {
    setEntries((prev) =>
      prev.map((e, i) => {
        if (i !== idx) return e;
        if (field === "debit" || field === "credit") {
          const cleaned = value.replace(/[^0-9.,-]/g, "").replace(",", ".");
          return { ...e, [field]: cleaned };
        }
        return { ...e, [field]: value };
      })
    );
  };

  const totalDebit = entries.reduce(
    (sum, e) => sum + (parseFloat(e.debit) || 0),
    0
  );
  const totalCredit = entries.reduce(
    (sum, e) => sum + (parseFloat(e.credit) || 0),
    0
  );
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const handleSubmit = async () => {
    setError("");
    if (!date || !description) {
      setError("Dato og beskrivelse er påkrevd.");
      return;
    }
    if (!isBalanced) {
      setError("Debet og kredit må være like.");
      return;
    }
    const validEntries = entries.filter(
      (e) => e.accountId && ((parseFloat(e.debit) || 0) > 0 || (parseFloat(e.credit) || 0) > 0)
    );
    if (validEntries.length < 2) {
      setError("Minst to posteringslinjer kreves.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          cycleId,
          voucherDate: date,
          description,
          entries: validEntries,
          documentId: linkedDocumentId,
        }),
      });
      if (res.ok) {
        setDate("");
        setDescription("");
        setLinkedDocumentId(null);
        setLinkedDocumentName(null);
        setEntries([
          { accountId: "", debit: "", credit: "" },
          { accountId: "", debit: "", credit: "" },
        ]);
        setAiReasoning(null);
        setAiConfidence(null);
        setAiApplied(false);
        setAiError("");
        onCreated();
        onClose?.();
      } else {
        const data = await res.json();
        setError(data.error || "Feil ved lagring");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setLinkedDocumentId(null);
    setLinkedDocumentName(null);
    setDescription("");
    setDate("");
    setEntries([
      { accountId: "", debit: "", credit: "" },
      { accountId: "", debit: "", credit: "" },
    ]);
    setError("");
    setAiReasoning(null);
    setAiConfidence(null);
    setAiApplied(false);
    setAiError("");
    onClose?.();
  };

  // Document mode: two-column layout with PDF preview + form
  if (isDocumentMode) {
    return (
      <Card id="nytt-bilag-form" className="mb-6 border-ecit-blue/30 shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-bold text-ecit-navy">
              <svg className="h-4 w-4 text-ecit-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Bokfør dokument
            </CardTitle>
            <button
              onClick={handleClose}
              className="text-sm text-ecit-navy/40 hover:text-ecit-ruby"
              title="Lukk"
            >
              Avbryt
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {/* Venstre: PDF-forhåndsvisning */}
            <div className="flex flex-col">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-xs text-ecit-navy/40">Dokument</span>
                <a
                  href={`/api/companies/${companyId}/documents/${linkedDocumentId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-ecit-link-blue hover:text-ecit-navy underline"
                >
                  Åpne i ny fane
                </a>
              </div>
              {linkedDocumentName?.toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={`/api/companies/${companyId}/documents/${linkedDocumentId}`}
                  className="h-[500px] w-full border border-ecit-beige-dark bg-white"
                  title={linkedDocumentName}
                />
              ) : linkedDocumentName && /\.(jpg|jpeg|png|gif|webp)$/i.test(linkedDocumentName) ? (
                <img
                  src={`/api/companies/${companyId}/documents/${linkedDocumentId}`}
                  alt={linkedDocumentName}
                  className="max-h-[500px] w-full border border-ecit-beige-dark bg-white object-contain"
                />
              ) : (
                <div className="flex h-[500px] items-center justify-center border border-ecit-beige-dark bg-ecit-cream text-sm text-ecit-navy/40">
                  <div className="text-center">
                    <p className="mb-2 text-lg">Forhåndsvisning ikke tilgjengelig</p>
                    <a
                      href={`/api/companies/${companyId}/documents/${linkedDocumentId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ecit-link-blue underline"
                    >
                      Last ned {linkedDocumentName}
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Høyre: Bokføringsskjema */}
            <div className="flex flex-col">
              {/* Kontoforslag */}
              {suggestions.length > 0 && (
                <div className="mb-3 border border-ecit-green/20 bg-ecit-green/5 p-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ecit-green">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Foreslått kontering
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map(({ suggestion, account }) => (
                      <button
                        key={account.id}
                        onClick={() => applySuggestion(account.id)}
                        className="border border-ecit-green/30 bg-white px-2.5 py-1 text-xs font-medium text-ecit-navy transition-colors hover:border-ecit-green hover:bg-ecit-green/10"
                        title={`${account.accountNumber} — ${account.name}`}
                      >
                        {suggestion.label} ({account.accountNumber})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* AI-forslag fra Gemini */}
              {!aiApplied && !aiLoading && (
                <div className="mb-3 border border-ecit-purple/15 bg-ecit-purple/5 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-ecit-purple/80">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <span>La AI analysere dokumentet og foreslå kontering</span>
                    </div>
                    <button
                      onClick={fetchAiSuggestion}
                      className="border border-ecit-purple/30 bg-white px-3 py-1 text-xs font-semibold text-ecit-purple transition-colors hover:border-ecit-purple hover:bg-ecit-purple/10"
                    >
                      Hent AI-forslag
                    </button>
                  </div>
                  {aiError && (
                    <p className="mt-2 text-xs text-ecit-ruby">{aiError}</p>
                  )}
                </div>
              )}

              {aiLoading && (
                <div className="mb-3 border border-ecit-purple/20 bg-ecit-purple/5 p-3">
                  <div className="flex items-center gap-2 text-xs text-ecit-purple/70">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    <span>Analyserer dokumentet med AI...</span>
                  </div>
                </div>
              )}

              {aiApplied && aiReasoning && (
                <div className="mb-3 border border-ecit-green/20 bg-ecit-green/5 p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-ecit-green">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      AI-forslag brukt
                    </div>
                    {aiConfidence != null && (
                      <span className={`font-mono text-xs font-semibold ${aiConfidence >= 0.7 ? "text-ecit-green" : aiConfidence >= 0.4 ? "text-ecit-navy/60" : "text-ecit-ruby"}`}>
                        {Math.round(aiConfidence * 100)}% sikkerhet
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ecit-navy/60">{aiReasoning}</p>
                  <button
                    onClick={fetchAiSuggestion}
                    className="mt-2 text-xs text-ecit-purple/60 underline hover:text-ecit-purple"
                  >
                    Analyser på nytt
                  </button>
                </div>
              )}

              {/* Skjema-felt */}
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ecit-navy/50">Dato</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-0.5 w-full border border-ecit-beige-dark bg-white px-2 py-1.5 font-mono text-sm text-ecit-navy outline-none focus:border-ecit-navy"
                  />
                </div>
                <div>
                  <label className="text-xs text-ecit-navy/50">Beskrivelse</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="F.eks. Innkjøp kontorrekvisita"
                    className="mt-0.5 w-full border border-ecit-beige-dark bg-white px-2 py-1.5 text-sm text-ecit-navy outline-none placeholder:text-ecit-navy/20 focus:border-ecit-navy"
                  />
                </div>
              </div>

              {/* Lenket dokument */}
              <div className="mb-3 flex items-center gap-2 border border-ecit-blue/20 bg-ecit-blue/5 px-3 py-1.5 text-xs text-ecit-navy">
                <svg className="h-4 w-4 text-ecit-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className="font-medium">{linkedDocumentName}</span>
              </div>

              {/* Posteringslinjer */}
              <table className="mb-2 w-full text-sm">
                <thead>
                  <tr className="border-b border-ecit-beige-dark text-left text-xs text-ecit-navy/40">
                    <th className="py-1 font-normal">Konto</th>
                    <th className="w-24 py-1 text-right font-normal">Debet</th>
                    <th className="w-24 py-1 text-right font-normal">Kredit</th>
                    <th className="w-6 py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, idx) => (
                    <tr key={idx} className="border-b border-ecit-beige-dark/30 last:border-0">
                      <td className="py-1">
                        <select
                          value={entry.accountId}
                          onChange={(e) => updateEntry(idx, "accountId", e.target.value)}
                          className="w-full border border-ecit-beige-dark bg-white px-1 py-1 text-sm text-ecit-navy outline-none focus:border-ecit-navy"
                        >
                          <option value="">Velg konto...</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.accountNumber} — {a.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={entry.debit}
                          onChange={(e) => updateEntry(idx, "debit", e.target.value)}
                          placeholder="0,00"
                          className="w-full bg-transparent text-right font-mono text-ecit-navy outline-none placeholder:text-ecit-navy/20 focus:bg-ecit-beige/50"
                        />
                      </td>
                      <td className="py-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={entry.credit}
                          onChange={(e) => updateEntry(idx, "credit", e.target.value)}
                          placeholder="0,00"
                          className="w-full bg-transparent text-right font-mono text-ecit-navy outline-none placeholder:text-ecit-navy/20 focus:bg-ecit-beige/50"
                        />
                      </td>
                      <td className="py-1 text-center">
                        {entries.length > 2 && (
                          <button
                            onClick={() => removeLine(idx)}
                            className="text-ecit-navy/20 hover:text-ecit-ruby"
                            title="Fjern linje"
                          >
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-ecit-navy/10">
                    <td className="py-1.5 text-xs font-semibold text-ecit-navy/50">Sum</td>
                    <td className={`py-1.5 text-right font-mono font-semibold ${isBalanced ? "text-ecit-green" : "text-ecit-navy"}`}>
                      {formatNumber(totalDebit)}
                    </td>
                    <td className={`py-1.5 text-right font-mono font-semibold ${isBalanced ? "text-ecit-green" : "text-ecit-navy"}`}>
                      {formatNumber(totalCredit)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>

              <div className="flex items-center justify-between">
                <button onClick={addLine} className="text-sm text-ecit-blue hover:text-ecit-navy">
                  + Legg til linje
                </button>
                <div className="flex items-center gap-3">
                  {error && <span className="text-sm text-ecit-ruby">{error}</span>}
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || !isBalanced}
                    className="bg-ecit-navy text-white hover:bg-ecit-dark-navy disabled:opacity-40"
                  >
                    {submitting ? "Lagrer..." : "Bokfør bilag"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Standard mode: compact form
  return (
    <Card id="nytt-bilag-form" className="mb-6 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold text-ecit-navy">
          Nytt bilag
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-ecit-navy/50">Dato</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-0.5 w-full border border-ecit-beige-dark bg-white px-2 py-1.5 font-mono text-sm text-ecit-navy outline-none focus:border-ecit-navy"
            />
          </div>
          <div>
            <label className="text-xs text-ecit-navy/50">Beskrivelse</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="F.eks. Innkjøp kontorrekvisita"
              className="mt-0.5 w-full border border-ecit-beige-dark bg-white px-2 py-1.5 text-sm text-ecit-navy outline-none placeholder:text-ecit-navy/20 focus:border-ecit-navy"
            />
          </div>
        </div>

        {/* Posteringslinjer */}
        <table className="mb-2 w-full text-sm">
          <thead>
            <tr className="border-b border-ecit-beige-dark text-left text-xs text-ecit-navy/40">
              <th className="py-1 font-normal">Konto</th>
              <th className="w-28 py-1 text-right font-normal">Debet</th>
              <th className="w-28 py-1 text-right font-normal">Kredit</th>
              <th className="w-8 py-1"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, idx) => (
              <tr
                key={idx}
                className="border-b border-ecit-beige-dark/30 last:border-0"
              >
                <td className="py-1">
                  <select
                    value={entry.accountId}
                    onChange={(e) =>
                      updateEntry(idx, "accountId", e.target.value)
                    }
                    className="w-full border border-ecit-beige-dark bg-white px-1 py-1 text-sm text-ecit-navy outline-none focus:border-ecit-navy"
                  >
                    <option value="">Velg konto...</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.accountNumber} — {a.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={entry.debit}
                    onChange={(e) =>
                      updateEntry(idx, "debit", e.target.value)
                    }
                    placeholder="0,00"
                    className="w-full bg-transparent text-right font-mono text-ecit-navy outline-none placeholder:text-ecit-navy/20 focus:bg-ecit-beige/50"
                  />
                </td>
                <td className="py-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={entry.credit}
                    onChange={(e) =>
                      updateEntry(idx, "credit", e.target.value)
                    }
                    placeholder="0,00"
                    className="w-full bg-transparent text-right font-mono text-ecit-navy outline-none placeholder:text-ecit-navy/20 focus:bg-ecit-beige/50"
                  />
                </td>
                <td className="py-1 text-center">
                  {entries.length > 2 && (
                    <button
                      onClick={() => removeLine(idx)}
                      className="text-ecit-navy/20 hover:text-ecit-ruby"
                      title="Fjern linje"
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-ecit-navy/10">
              <td className="py-1.5 text-xs font-semibold text-ecit-navy/50">
                Sum
              </td>
              <td
                className={`py-1.5 text-right font-mono font-semibold ${
                  isBalanced ? "text-ecit-green" : "text-ecit-navy"
                }`}
              >
                {formatNumber(totalDebit)}
              </td>
              <td
                className={`py-1.5 text-right font-mono font-semibold ${
                  isBalanced ? "text-ecit-green" : "text-ecit-navy"
                }`}
              >
                {formatNumber(totalCredit)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        <div className="flex items-center justify-between">
          <button
            onClick={addLine}
            className="text-sm text-ecit-blue hover:text-ecit-navy"
          >
            + Legg til linje
          </button>
          <div className="flex items-center gap-3">
            {error && (
              <span className="text-sm text-ecit-ruby">{error}</span>
            )}
            <Button
              onClick={handleSubmit}
              disabled={submitting || !isBalanced}
              className="bg-ecit-navy text-white hover:bg-ecit-dark-navy disabled:opacity-40"
            >
              {submitting ? "Lagrer..." : "Bokfør bilag"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main view ───

export function RegnskapView({
  companyId,
  cycleId,
  cycleYear,
  accounts,
  initialBalances,
  uploadedDocuments = [],
}: {
  companyId: string;
  cycleId: string;
  cycleYear: number;
  accounts: Account[];
  initialBalances: Record<string, string>;
  uploadedDocuments?: UploadedDocument[];
}) {
  const [activeTab, setActiveTab] = useState<Tab>("apningsbalanse");
  const [balances, setBalances] = useState<Record<string, string>>(initialBalances);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showOnlyWithBalance, setShowOnlyWithBalance] = useState(
    Object.keys(initialBalances).length > 0
  );
  // Prefill-state for NyttBilagForm (set from "Bokfør" buttons on documents)
  const [bilagPrefill, setBilagPrefill] = useState<BilagPrefill | null>(null);

  // Document state (make mutable so RF uploads appear immediately)
  const [docList, setDocList] = useState<UploadedDocument[]>(uploadedDocuments || []);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadDocError, setUploadDocError] = useState("");

  // RF file upload handler
  const handleRfUpload = useCallback(async (files: FileList | File[], category: string) => {
    setUploadingDoc(true);
    setUploadDocError("");
    try {
      const formData = new FormData();
      formData.append("cycleId", cycleId);
      formData.append("category", category);
      for (const file of files) {
        formData.append("files", file);
      }
      const res = await fetch(`/api/companies/${companyId}/documents`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        setUploadDocError(data.error || "Feil ved opplasting");
        return;
      }
      const data = await res.json();
      // Add the uploaded docs to local state immediately
      const newDocs: UploadedDocument[] = data.documents.map((d: { id: string; originalFilename: string; fileSize: number; category: string }) => ({
        id: d.id,
        taskId: null,
        taskTitle: null,
        category: d.category,
        categoryLabel: d.category === "bilag" ? "Bilag" : d.category === "bankutskrift" ? "Bankutskrift" : d.category,
        originalFilename: d.originalFilename,
        fileType: files instanceof FileList
          ? Array.from(files).find(f => f.name === d.originalFilename)?.type || ""
          : files.find(f => f.name === d.originalFilename)?.type || "",
        fileSize: d.fileSize,
        uploadedAt: new Date().toISOString(),
      }));
      setDocList(prev => [...prev, ...newDocs]);
    } catch {
      setUploadDocError("Nettverksfeil ved opplasting");
    } finally {
      setUploadingDoc(false);
    }
  }, [companyId, cycleId]);

  // Bilag state
  const [voucherList, setVoucherList] = useState<Voucher[]>([]);
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [expandedVoucher, setExpandedVoucher] = useState<string | null>(null);

  // Bank state
  const [bankLineList, setBankLineList] = useState<BankLine[]>([]);
  const [loadingBank, setLoadingBank] = useState(false);
  const [csvInput, setCsvInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [matchingLineId, setMatchingLineId] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState("");
  const [pdfResult, setPdfResult] = useState("");

  // Bilag redigering/sletting
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editEntries, setEditEntries] = useState<{ accountId: string; debit: string; credit: string }[]>([]);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");
  const [deletingVoucherId, setDeletingVoucherId] = useState<string | null>(null);

  // Bokfør fra banklinje state
  const [bookingLineId, setBookingLineId] = useState<string | null>(null);
  const [bookingContraAccountId, setBookingContraAccountId] = useState("");
  const [bookingBankAccountId, setBookingBankAccountId] = useState("");
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState("");

  // Åpningsbalanse import state
  const [importingIB, setImportingIB] = useState(false);
  const [importIBResult, setImportIBResult] = useState("");

  const loadVouchers = useCallback(async () => {
    setLoadingVouchers(true);
    try {
      const res = await fetch(
        `/api/vouchers?companyId=${companyId}&cycleId=${cycleId}`
      );
      if (res.ok) {
        setVoucherList(await res.json());
      }
    } finally {
      setLoadingVouchers(false);
    }
  }, [companyId, cycleId]);

  const loadBankLines = useCallback(async () => {
    setLoadingBank(true);
    try {
      const res = await fetch(
        `/api/bank-lines?companyId=${companyId}&cycleId=${cycleId}`
      );
      if (res.ok) {
        setBankLineList(await res.json());
      }
    } finally {
      setLoadingBank(false);
    }
  }, [companyId, cycleId]);

  useEffect(() => {
    if (activeTab === "bilag" || activeTab === "hovedbok" || activeTab === "saldobalanse" || activeTab === "resultat" || activeTab === "balanse") {
      loadVouchers();
    }
    if (activeTab === "bank") {
      loadBankLines();
      loadVouchers(); // need vouchers for matching
    }
  }, [activeTab, loadVouchers, loadBankLines]);

  // ── Åpningsbalanse logic ──
  const handleBalanceChange = useCallback((accountId: string, value: string) => {
    const cleaned = value.replace(/[^0-9.,-]/g, "").replace(",", ".");
    setBalances((prev) => ({ ...prev, [accountId]: cleaned }));
    setSaved(false);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const balanceEntries = Object.entries(balances)
        .filter(([, v]) => v && parseFloat(v) !== 0)
        .map(([accountId, balance]) => ({ accountId, balance }));

      const res = await fetch("/api/opening-balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, cycleId, balances: balanceEntries }),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Importer åpningsbalanse fra CSV-dokument ──
  const csvDocuments = useMemo(
    () =>
      docList.filter(
        (d) =>
          d.category === "aapningsbalanse" ||
          d.originalFilename.toLowerCase().endsWith(".csv") ||
          d.fileType === "text/csv" ||
          d.fileType === "application/vnd.ms-excel"
      ),
    [docList]
  );

  const handleImportIB = async (documentId: string) => {
    setImportingIB(true);
    setImportIBResult("");
    try {
      const res = await fetch("/api/opening-balances/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, documentId }),
      });
      const data = await res.json();
      if (res.ok) {
        // Populate balances state with imported values
        const newBalances: Record<string, string> = {};
        for (const b of data.balances) {
          // Store as dot-decimal string (consistent with handleBalanceChange)
          const num = parseFloat(b.balance);
          newBalances[b.accountId] = num.toFixed(2);
        }
        setBalances(newBalances);
        setSaved(false);
        setShowOnlyWithBalance(true);
        setImportIBResult(
          `${data.mapped} kontoer importert` +
            (data.skipped > 0 ? `, ${data.skipped} ikke i kontoplan` : "") +
            ". Kontroller verdiene og klikk Lagre."
        );
      } else {
        setImportIBResult(data.error || "Feil ved import");
      }
    } catch {
      setImportIBResult("Feil ved import av saldobalanse");
    } finally {
      setImportingIB(false);
    }
  };

  const groupedAccounts = useMemo(() => {
    const groups: Record<string, Account[]> = {};
    for (const acc of accounts) {
      if (!groups[acc.accountClass]) groups[acc.accountClass] = [];
      groups[acc.accountClass].push(acc);
    }
    return groups;
  }, [accounts]);

  const totals = useMemo(() => {
    let sumEiendeler = 0;
    let sumEKGjeld = 0;

    for (const acc of accounts) {
      const val = parseFloat(balances[acc.id] || "0") || 0;
      if (acc.accountClass === "eiendeler") {
        sumEiendeler += val;
      } else if (acc.accountClass === "egenkapital" || acc.accountClass === "gjeld") {
        sumEKGjeld += val;
      }
    }

    return { sumEiendeler, sumEKGjeld, diff: sumEiendeler + sumEKGjeld };
  }, [accounts, balances]);

  const hasAnyBalance = Object.values(balances).some(
    (v) => v && parseFloat(v) !== 0
  );

  const visibleAccounts = useCallback(
    (accs: Account[]) => {
      if (!showOnlyWithBalance) return accs;
      return accs.filter((a) => {
        const val = balances[a.id];
        return val && parseFloat(val) !== 0;
      });
    },
    [showOnlyWithBalance, balances]
  );

  // ── Hovedbok: grupper alle posterte posteringer per konto ──
  const hovedbokData = useMemo(() => {
    const accountMap = new Map<
      string,
      { account: Account; entries: { voucher: Voucher; debit: number; credit: number; description: string | null }[] }
    >();

    for (const v of voucherList) {
      if (v.status !== "postert") continue;
      for (const e of v.entries) {
        if (!accountMap.has(e.accountId)) {
          const acc = accounts.find((a) => a.id === e.accountId);
          if (acc) {
            accountMap.set(e.accountId, { account: acc, entries: [] });
          }
        }
        accountMap.get(e.accountId)?.entries.push({
          voucher: v,
          debit: parseFloat(e.debit) || 0,
          credit: parseFloat(e.credit) || 0,
          description: e.description,
        });
      }
    }

    return Array.from(accountMap.values()).sort(
      (a, b) => a.account.accountNumber - b.account.accountNumber
    );
  }, [voucherList, accounts]);

  // ── Saldobalanse: IB + bevegelser = UB per konto ──
  const saldobalanseData = useMemo(() => {
    const rows: {
      account: Account;
      ib: number;
      debit: number;
      credit: number;
      ub: number;
    }[] = [];

    for (const acc of accounts) {
      const ib = parseFloat(balances[acc.id] || "0") || 0;
      let debit = 0;
      let credit = 0;

      for (const v of voucherList) {
        if (v.status !== "postert") continue;
        for (const e of v.entries) {
          if (e.accountId === acc.id) {
            debit += parseFloat(e.debit) || 0;
            credit += parseFloat(e.credit) || 0;
          }
        }
      }

      if (ib !== 0 || debit !== 0 || credit !== 0) {
        rows.push({
          account: acc,
          ib,
          debit,
          credit,
          ub: ib + debit - credit,
        });
      }
    }

    return rows;
  }, [accounts, balances, voucherList]);

  // ── Resultatregnskap (income statement) ──
  // Kontoklasse 3-8: inntekter og kostnader for perioden
  const resultatData = useMemo(() => {
    type ResultatGroup = {
      label: string;
      classRange: [number, number];
      rows: { account: Account; amount: number }[];
      total: number;
    };

    const groups: ResultatGroup[] = [
      { label: "Salgsinntekter", classRange: [3000, 3999], rows: [], total: 0 },
      { label: "Varekostnad", classRange: [4000, 4999], rows: [], total: 0 },
      { label: "Lønnskostnad", classRange: [5000, 5999], rows: [], total: 0 },
      { label: "Avskrivninger", classRange: [6000, 6999], rows: [], total: 0 },
      { label: "Andre driftskostnader", classRange: [7000, 7999], rows: [], total: 0 },
      { label: "Finansposter", classRange: [8000, 8999], rows: [], total: 0 },
    ];

    // For resultatkontoer: kredit - debet = amount
    // Inntekter (3xxx): krediteres normalt → positive = inntekt
    // Kostnader (4-8xxx): debiteres normalt → negative = kostnad
    for (const row of saldobalanseData) {
      const num = row.account.accountNumber;
      if (num < 3000 || num > 8999) continue;

      // Bevegelse i perioden (kredit - debet)
      const amount = row.credit - row.debit;

      for (const group of groups) {
        if (num >= group.classRange[0] && num <= group.classRange[1]) {
          group.rows.push({ account: row.account, amount });
          group.total += amount;
          break;
        }
      }
    }

    // Driftsresultat = sum 3xxx-7xxx, Årsresultat = sum 3xxx-8xxx
    const driftsresultat = groups.slice(0, 5).reduce((s, g) => s + g.total, 0);
    const aarsresultat = groups.reduce((s, g) => s + g.total, 0);

    return { groups, driftsresultat, aarsresultat };
  }, [saldobalanseData]);

  // ── Balanse (balance sheet) ──
  // Kontoklasse 1-2: eiendeler, egenkapital, gjeld
  const balanseData = useMemo(() => {
    type BalanseGroup = {
      label: string;
      classRange: [number, number];
      rows: { account: Account; ub: number }[];
      total: number;
    };

    const eiendeler: BalanseGroup[] = [
      { label: "Anleggsmidler", classRange: [1000, 1799], rows: [], total: 0 },
      { label: "Omløpsmidler", classRange: [1800, 1999], rows: [], total: 0 },
    ];

    const ekGjeld: BalanseGroup[] = [
      { label: "Egenkapital", classRange: [2000, 2099], rows: [], total: 0 },
      { label: "Langsiktig gjeld", classRange: [2100, 2499], rows: [], total: 0 },
      { label: "Kortsiktig gjeld", classRange: [2500, 2999], rows: [], total: 0 },
    ];

    for (const row of saldobalanseData) {
      const num = row.account.accountNumber;
      if (num < 1000 || num > 2999) continue;

      // UB = IB + debet - kredit (saldo for balansekontoer)
      const ub = row.ub;

      const targetGroups = num < 2000 ? eiendeler : ekGjeld;
      for (const group of targetGroups) {
        if (num >= group.classRange[0] && num <= group.classRange[1]) {
          group.rows.push({ account: row.account, ub });
          group.total += ub;
          break;
        }
      }
    }

    const sumEiendeler = eiendeler.reduce((s, g) => s + g.total, 0);
    const sumEkGjeld = ekGjeld.reduce((s, g) => s + g.total, 0);

    // Inkluder periodens resultat i EK-siden
    const aarsresultat = resultatData.aarsresultat;
    const sumEkGjeldMedResultat = sumEkGjeld + aarsresultat;

    return { eiendeler, ekGjeld, sumEiendeler, sumEkGjeld, sumEkGjeldMedResultat, aarsresultat };
  }, [saldobalanseData, resultatData.aarsresultat]);

  // ── Bank import/matching ──
  const handleImportCSV = async () => {
    if (!csvInput.trim()) return;
    setImporting(true);
    try {
      const res = await fetch("/api/bank-lines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, cycleId, csvData: csvInput }),
      });
      if (res.ok) {
        setCsvInput("");
        loadBankLines();
      }
    } finally {
      setImporting(false);
    }
  };

  const handleBankAction = async (
    bankLineId: string,
    action: "avstem" | "ignorer" | "fjern_avstemming",
    voucherId?: string
  ) => {
    await fetch("/api/bank-lines", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankLineId, action, voucherId }),
    });
    setMatchingLineId(null);
    loadBankLines();
  };

  // ── Bokfør fra banklinje ──
  const handleBookFromBankLine = async (bankLineId: string) => {
    if (!bookingContraAccountId) {
      setBookingError("Velg motkonto");
      return;
    }
    setBookingSubmitting(true);
    setBookingError("");
    try {
      const res = await fetch("/api/vouchers/from-bank-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankLineId,
          contraAccountId: bookingContraAccountId,
          bankAccountId: bookingBankAccountId || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setBookingLineId(null);
        setBookingContraAccountId("");
        setBookingBankAccountId("");
        loadBankLines();
        loadVouchers();
      } else {
        setBookingError(data.error || "Feil ved bokføring");
      }
    } catch {
      setBookingError("Nettverksfeil");
    } finally {
      setBookingSubmitting(false);
    }
  };

  const startEditVoucher = (v: Voucher) => {
    setEditingVoucherId(v.id);
    setEditDescription(v.description);
    setEditDate(v.voucherDate);
    setEditEntries(
      v.entries.map((e) => ({
        accountId: e.accountId,
        debit: parseFloat(e.debit) > 0 ? e.debit : "",
        credit: parseFloat(e.credit) > 0 ? e.credit : "",
      }))
    );
    setEditError("");
  };

  const handleUpdateVoucher = async () => {
    if (!editingVoucherId) return;
    setEditSubmitting(true);
    setEditError("");

    // Valider at debet = kredit
    const totalDebit = editEntries.reduce((s, e) => s + (parseFloat(e.debit) || 0), 0);
    const totalCredit = editEntries.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      setEditError(`Debet (${totalDebit.toFixed(2)}) og kredit (${totalCredit.toFixed(2)}) stemmer ikke`);
      setEditSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/vouchers/${editingVoucherId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: editDescription,
          voucherDate: editDate,
          entries: editEntries.map((e) => ({
            accountId: e.accountId,
            debit: e.debit || "0",
            credit: e.credit || "0",
          })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEditingVoucherId(null);
        loadVouchers();
      } else {
        setEditError(data.error || "Feil ved oppdatering");
      }
    } catch {
      setEditError("Nettverksfeil");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteVoucher = async (voucherId: string) => {
    setDeletingVoucherId(voucherId);
    try {
      const res = await fetch(`/api/vouchers/${voucherId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setExpandedVoucher(null);
        loadVouchers();
        loadBankLines();
      }
    } finally {
      setDeletingVoucherId(null);
    }
  };

  const addEditEntry = () => {
    setEditEntries([...editEntries, { accountId: "", debit: "", credit: "" }]);
  };

  const removeEditEntry = (idx: number) => {
    setEditEntries(editEntries.filter((_, i) => i !== idx));
  };

  const updateEditEntry = (idx: number, field: "accountId" | "debit" | "credit", value: string) => {
    const updated = [...editEntries];
    updated[idx] = { ...updated[idx], [field]: value };
    setEditEntries(updated);
  };

  // Bankkontoer for dropdown (19xx-kontoer)
  const bankAccounts = useMemo(
    () => accounts.filter((a) => a.accountNumber >= 1900 && a.accountNumber <= 1999),
    [accounts]
  );

  // Default bankkonto (1920 eller første 19xx)
  const defaultBankAccountId = useMemo(() => {
    const acc1920 = bankAccounts.find((a) => a.accountNumber === 1920);
    return acc1920?.id || bankAccounts[0]?.id || "";
  }, [bankAccounts]);

  // Bank summary
  const bankSummary = useMemo(() => {
    const total = bankLineList.length;
    const avstemt = bankLineList.filter((l) => l.status === "avstemt").length;
    const ignorert = bankLineList.filter((l) => l.status === "ignorert").length;
    const uavstemt = bankLineList.filter((l) => l.status === "uavstemt").length;
    const sumInn = bankLineList
      .filter((l) => parseFloat(l.amount) > 0)
      .reduce((s, l) => s + parseFloat(l.amount), 0);
    const sumUt = bankLineList
      .filter((l) => parseFloat(l.amount) < 0)
      .reduce((s, l) => s + parseFloat(l.amount), 0);
    return { total, avstemt, ignorert, uavstemt, sumInn, sumUt };
  }, [bankLineList]);

  // ── PDF upload handler ──
  const handleUploadPdf = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setImporting(true);
    setPdfResult("");
    try {
      // 1. Save PDFs as documents with category "bankutskrift"
      const docFormData = new FormData();
      docFormData.append("cycleId", cycleId);
      docFormData.append("category", "bankutskrift");
      for (const file of Array.from(files)) {
        docFormData.append("files", file);
      }
      const docRes = await fetch(`/api/companies/${companyId}/documents`, {
        method: "POST",
        body: docFormData,
      });
      if (!docRes.ok) {
        const docErr = await docRes.json();
        setPdfResult(docErr.error || "Feil ved lagring av dokument");
        return;
      }
      const docData = await docRes.json();
      const savedDocIds: string[] = docData.documents.map((d: { id: string }) => d.id);

      // Add to local doc list so they appear immediately
      const newDocs: UploadedDocument[] = docData.documents.map((d: { id: string; originalFilename: string; fileSize: number; category: string }) => ({
        id: d.id,
        taskId: null,
        taskTitle: null,
        category: d.category,
        categoryLabel: "Bankutskrift",
        originalFilename: d.originalFilename,
        fileType: "application/pdf",
        fileSize: d.fileSize,
        uploadedAt: new Date().toISOString(),
      }));
      setDocList(prev => [...prev, ...newDocs]);

      // 2. Import bank lines from the saved documents
      const res = await fetch("/api/bank-lines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, cycleId, documentIds: savedDocIds }),
      });
      const data = await res.json();
      if (res.ok) {
        const names = Array.from(files).map(f => f.name).join(", ");
        setPdfFileName(names);
        const parts = [`${data.count} transaksjoner importert`];
        if (data.skipped > 0) parts.push(`${data.skipped} duplikater hoppet over`);
        setPdfResult(parts.join(", "));
        setCsvInput("");
        loadBankLines();
      } else {
        setPdfResult(data.error || "Feil ved import");
      }
    } catch {
      setPdfResult("Feil ved opplasting");
    } finally {
      setImporting(false);
    }
  };

  // ── Import from kunde-uploaded documents ──
  const handleImportFromDocuments = async (docIds: string[]) => {
    if (docIds.length === 0) return;
    setImporting(true);
    setPdfResult("");
    try {
      const res = await fetch("/api/bank-lines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, cycleId, documentIds: docIds }),
      });
      const data = await res.json();
      if (res.ok) {
        const parts = [`${data.count} transaksjoner importert fra kundedokumenter`];
        if (data.skipped > 0) parts.push(`${data.skipped} duplikater hoppet over`);
        setPdfResult(parts.join(", "));
        loadBankLines();
      } else {
        setPdfResult(data.error || "Feil ved import");
      }
    } catch {
      setPdfResult("Feil ved import fra dokumenter");
    } finally {
      setImporting(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "apningsbalanse", label: "Åpningsbalanse" },
    { key: "bilag", label: `Bilag (${voucherList.length})` },
    { key: "hovedbok", label: "Hovedbok" },
    { key: "saldobalanse", label: "Saldobalanse" },
    { key: "resultat", label: "Resultat" },
    { key: "balanse", label: "Balanse" },
    { key: "bank", label: `Bank (${bankLineList.length})` },
  ];

  // ── Fremdriftssteg for årsregnskapet ──
  type StepStatus = "ikke_startet" | "pagar" | "ferdig";
  type Step = {
    label: string;
    status: StepStatus;
    tab: Tab;
    detail: string;
  };

  // Document IDs that are already linked to vouchers (shared between stepper and bilag tab)
  const linkedDocIds = useMemo(
    () => new Set(voucherList.filter((v) => v.documentId).map((v) => v.documentId)),
    [voucherList]
  );

  // Bilag documents (category === "bilag")
  const bilagDocs = useMemo(
    () => docList.filter((d) => d.category === "bilag"),
    [docList]
  );

  const steps: Step[] = useMemo(() => {
    // 1. Åpningsbalanse
    const hasIB = Object.values(balances).some((v) => parseFloat(v) !== 0);
    const ibStatus: StepStatus = hasIB ? "ferdig" : "ikke_startet";

    // 2. Importer bankutskrifter
    const hasBankLines = bankLineList.length > 0;
    const bankImportStatus: StepStatus = hasBankLines ? "ferdig" : "ikke_startet";

    // 3. Bokfør banklinjer
    const uavstemt = bankLineList.filter((l) => l.status === "uavstemt").length;
    const totalBank = bankLineList.length;
    const bokfortStatus: StepStatus =
      !hasBankLines ? "ikke_startet" :
      uavstemt === 0 ? "ferdig" : "pagar";
    const bokfortPct = totalBank > 0 ? Math.round(((totalBank - uavstemt) / totalBank) * 100) : 0;

    // 3b. Bilag fra kunde — track which customer-uploaded bilag docs have been linked to a voucher
    const totalBilagDocs = bilagDocs.length;
    const processedBilagDocs = bilagDocs.filter((d) => linkedDocIds.has(d.id)).length;
    const bilagFraKundeStatus: StepStatus =
      totalBilagDocs === 0 ? "ferdig" :
      processedBilagDocs === totalBilagDocs ? "ferdig" :
      processedBilagDocs > 0 ? "pagar" : "ikke_startet";

    // 4. Bankavstemming (kontosaldo 1920 = sum banklinjer)
    const bankSaldo1920 = saldobalanseData.find(
      (r) => r.account.accountNumber === 1920
    );
    const bokfortBankSaldo = bankSaldo1920?.ub || 0;
    const sumBankLinjer = bankLineList
      .reduce((s, l) => s + parseFloat(l.amount), 0);
    const bankAvstemt = hasBankLines && Math.abs(bokfortBankSaldo - sumBankLinjer) < 0.01;
    const bankAvstemmingStatus: StepStatus =
      !hasBankLines ? "ikke_startet" :
      bankAvstemt ? "ferdig" : "pagar";

    // 5. Manuelle bilag (avskrivninger etc.) — ferdig når det finnes bilag som IKKE er fra banklinjer
    const hasVouchers = voucherList.filter((v) => v.status === "postert").length > 0;
    const manuelleStatus: StepStatus = hasVouchers ? "ferdig" : "ikke_startet";

    // 6. Kontroller resultat og balanse
    const balanseOk = balanseData.sumEiendeler !== 0 &&
      Math.abs(balanseData.sumEiendeler - Math.abs(balanseData.sumEkGjeldMedResultat)) < 0.01;
    const kontrollStatus: StepStatus =
      !hasVouchers ? "ikke_startet" :
      balanseOk ? "ferdig" : "pagar";

    // 7. Årsoppgjør — alltid manuelt for nå
    const aarsoppgjorStatus: StepStatus = "ikke_startet";

    return [
      { label: "Åpningsbalanse", status: ibStatus, tab: "apningsbalanse" as Tab, detail: hasIB ? "Registrert" : "Ikke registrert" },
      { label: "Importer bank", status: bankImportStatus, tab: "bank" as Tab, detail: hasBankLines ? `${totalBank} linjer` : "Ingen banklinjer" },
      { label: "Bokfør bank", status: bokfortStatus, tab: "bank" as Tab, detail: !hasBankLines ? "—" : uavstemt === 0 ? "Alle bokført" : `${uavstemt} gjenstår (${bokfortPct}%)` },
      { label: "Bilag fra kunde", status: bilagFraKundeStatus, tab: "bilag" as Tab, detail: totalBilagDocs === 0 ? "Ingen dok." : processedBilagDocs === totalBilagDocs ? "Alle behandlet" : `${processedBilagDocs}/${totalBilagDocs} behandlet` },
      { label: "Bankavstemming", status: bankAvstemmingStatus, tab: "bank" as Tab, detail: !hasBankLines ? "—" : bankAvstemt ? "Stemmer" : `Diff: ${formatNumber(bokfortBankSaldo - sumBankLinjer)}` },
      { label: "Manuelle bilag", status: manuelleStatus, tab: "bilag" as Tab, detail: hasVouchers ? `${voucherList.length} bilag` : "Ingen bilag" },
      { label: "Kontroller", status: kontrollStatus, tab: "balanse" as Tab, detail: !hasVouchers ? "—" : balanseOk ? "Balanse OK" : "Balanse stemmer ikke" },
      { label: "Årsoppgjør", status: aarsoppgjorStatus, tab: "balanse" as Tab, detail: "Ikke startet" },
    ];
  }, [balances, bankLineList, saldobalanseData, voucherList, balanseData, bilagDocs, linkedDocIds]);

  return (
    <div>
      {/* ── Fremdrift: årsregnskapsprosessen ── */}
      <div className="mb-6">
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            const colors =
              step.status === "ferdig"
                ? "bg-ecit-green/10 border-ecit-green/40"
                : step.status === "pagar"
                ? "bg-ecit-blue/5 border-ecit-blue/40"
                : "bg-ecit-beige/50 border-ecit-beige-dark/40";
            const dotColor =
              step.status === "ferdig"
                ? "bg-ecit-green"
                : step.status === "pagar"
                ? "bg-ecit-blue"
                : "bg-ecit-beige-dark/50";

            return (
              <React.Fragment key={step.label}>
                <button
                  onClick={() => setActiveTab(step.tab)}
                  className={`flex min-w-0 flex-col border px-3 py-2 text-left transition-colors hover:bg-ecit-beige/80 ${colors}`}
                  title={step.detail}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
                    <span className="truncate text-xs font-semibold text-ecit-navy">
                      {step.label}
                    </span>
                  </div>
                  <span className="mt-0.5 truncate text-[10px] text-ecit-navy/50">
                    {step.detail}
                  </span>
                </button>
                {!isLast && (
                  <span className="shrink-0 text-ecit-navy/20">&rsaquo;</span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="mb-6 flex gap-1 border-b border-ecit-beige-dark">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-ecit-navy text-ecit-navy"
                : "text-ecit-navy/40 hover:text-ecit-navy/70"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: Åpningsbalanse ═══ */}
      {activeTab === "apningsbalanse" && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-ecit-navy">
                Åpningsbalanse {cycleYear}
              </h2>
              <p className="text-sm text-ecit-navy/50">
                Saldo per 01.01.{cycleYear} (IB). Positive beløp = debet,
                negative = kredit.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {hasAnyBalance && (
                <label className="flex items-center gap-2 text-sm text-ecit-navy/60">
                  <input
                    type="checkbox"
                    checked={showOnlyWithBalance}
                    onChange={(e) => setShowOnlyWithBalance(e.target.checked)}
                    className="accent-ecit-navy"
                  />
                  Vis kun med saldo
                </label>
              )}
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-ecit-navy text-white hover:bg-ecit-dark-navy"
              >
                {saving ? "Lagrer..." : saved ? "Lagret!" : "Lagre"}
              </Button>
            </div>
          </div>

          {/* Import fra saldobalanse CSV */}
          <Card className="mb-4 border-ecit-blue/20 bg-ecit-beige/30 shadow-sm">
            <CardContent className="py-3">
              {csvDocuments.length > 0 ? (
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ecit-navy">
                      Importer fra saldobalanse
                    </p>
                    <p className="text-xs text-ecit-navy/50">
                      {csvDocuments.map((d) => d.originalFilename).join(", ")}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleImportIB(csvDocuments[0].id)}
                    disabled={importingIB}
                    className="shrink-0 bg-ecit-blue text-white hover:bg-ecit-navy"
                  >
                    {importingIB ? "Importerer..." : "Importer"}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ecit-navy">
                      Importer fra saldobalanse
                    </p>
                    <p className="text-xs text-ecit-navy/50">
                      Last opp en saldobalanse-CSV (eksport fra Tripletex e.l.)
                    </p>
                  </div>
                  <label className="shrink-0 cursor-pointer border border-ecit-blue bg-white px-4 py-2 text-sm font-semibold text-ecit-blue transition-colors hover:bg-ecit-beige">
                    <input
                      type="file"
                      accept=".csv,text/csv,application/vnd.ms-excel"
                      className="hidden"
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (files && files.length > 0) {
                          await handleRfUpload(files, "aapningsbalanse");
                        }
                        e.target.value = "";
                      }}
                      disabled={uploadingDoc}
                    />
                    {uploadingDoc ? "Laster opp..." : "Last opp CSV"}
                  </label>
                </div>
              )}
              {importIBResult && (
                <p
                  className={`mt-2 text-sm ${
                    importIBResult.includes("Feil")
                      ? "text-ecit-ruby"
                      : "text-ecit-green"
                  }`}
                >
                  {importIBResult}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="mb-6 grid grid-cols-3 gap-4">
            <Card className="shadow-sm">
              <CardContent className="py-3 text-center">
                <div className="font-mono text-xs text-ecit-navy/40">Sum eiendeler</div>
                <div className="text-lg font-bold text-ecit-navy">
                  {formatNumber(totals.sumEiendeler)}
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="py-3 text-center">
                <div className="font-mono text-xs text-ecit-navy/40">Sum EK + gjeld</div>
                <div className="text-lg font-bold text-ecit-navy">
                  {formatNumber(totals.sumEKGjeld)}
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="py-3 text-center">
                <div className="font-mono text-xs text-ecit-navy/40">Differanse</div>
                <div
                  className={`text-lg font-bold ${
                    Math.abs(totals.diff) < 0.01 ? "text-ecit-green" : "text-ecit-ruby"
                  }`}
                >
                  {formatNumber(totals.diff)}
                </div>
              </CardContent>
            </Card>
          </div>

          {Object.entries(groupedAccounts).map(([cls, accs]) => {
            const visible = visibleAccounts(accs);
            if (showOnlyWithBalance && visible.length === 0) return null;

            return (
              <Card key={cls} className="mb-4 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-ecit-navy">
                    {accountClassLabels[cls] || cls}
                    <span className="ml-2 font-mono text-xs font-normal text-ecit-navy/30">
                      {visible.length} kontoer
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-ecit-beige-dark text-left text-xs text-ecit-navy/40">
                        <th className="w-20 py-1 font-mono font-normal">Konto</th>
                        <th className="py-1 font-normal">Navn</th>
                        <th className="w-36 py-1 text-right font-normal">IB {cycleYear}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((acc) => (
                        <tr key={acc.id} className="border-b border-ecit-beige-dark/30 last:border-0">
                          <td className="py-1.5 font-mono text-ecit-navy/60">{acc.accountNumber}</td>
                          <td className="py-1.5 text-ecit-navy">{acc.name}</td>
                          <td className="py-1.5 text-right">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={balances[acc.id] || ""}
                              onChange={(e) => handleBalanceChange(acc.id, e.target.value)}
                              placeholder="0,00"
                              className="w-full bg-transparent text-right font-mono text-ecit-navy outline-none placeholder:text-ecit-navy/20 focus:bg-ecit-beige/50"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-ecit-navy/10">
                        <td></td>
                        <td className="py-1.5 text-xs font-semibold text-ecit-navy/50">Sum</td>
                        <td className="py-1.5 text-right font-mono font-semibold text-ecit-navy">
                          {formatNumber(
                            accs.reduce((sum, a) => sum + (parseFloat(balances[a.id] || "0") || 0), 0)
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </CardContent>
              </Card>
            );
          })}

          {hasAnyBalance && Math.abs(totals.diff) > 0.01 && (
            <div className="mt-4 border border-ecit-ruby/30 bg-ecit-ruby/5 p-4">
              <p className="text-sm font-semibold text-ecit-ruby">Balansen stemmer ikke</p>
              <p className="mt-1 text-sm text-ecit-ruby/70">
                Differanse: {formatNumber(totals.diff)}. Eiendeler skal = EK + gjeld.
              </p>
            </div>
          )}
          {hasAnyBalance && Math.abs(totals.diff) < 0.01 && (
            <div className="mt-4 border border-ecit-green/30 bg-ecit-green/5 p-4">
              <p className="text-sm font-semibold text-ecit-green">Balansen stemmer</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: Bilag ═══ */}
      {activeTab === "bilag" && (
        <div>
          {/* Bilagsdokumenter fra kunde (ikke bankutskrifter/åpningsbalanse) */}
          {(() => {
            if (bilagDocs.length === 0) return null;

            // Gruppér etter kilde (oppgavetittel eller "Lastet opp av regnskapsfører")
            const groups = new Map<string, typeof bilagDocs>();
            for (const doc of bilagDocs) {
              const key = doc.taskTitle || "Lastet opp av regnskapsfører";
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key)!.push(doc);
            }

            return (
              <Card className="mb-6 border-ecit-blue/30 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-bold text-ecit-navy">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-ecit-blue text-xs font-bold text-white">
                      {bilagDocs.length}
                    </span>
                    Bilagsdokumenter
                    {bilagDocs.filter((d) => linkedDocIds.has(d.id)).length > 0 && (
                      <span className="ml-1 font-mono text-xs font-normal text-ecit-green">
                        ({bilagDocs.filter((d) => linkedDocIds.has(d.id)).length}/{bilagDocs.length} behandlet)
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  {Array.from(groups.entries()).map(([sourceLabel, docs]) => (
                    <div key={sourceLabel} className="mb-3 last:mb-0">
                      <div className="mb-1.5 font-mono text-xs text-ecit-navy/40">{sourceLabel}</div>
                      <div className="space-y-1.5">
                        {docs.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between gap-3 border border-ecit-beige-dark/30 bg-ecit-cream px-3 py-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="shrink-0 font-mono text-xs text-ecit-navy/40">
                                {doc.fileType === "application/pdf" ? "PDF" : doc.fileType.startsWith("image/") ? "IMG" : "FIL"}
                              </span>
                              <a
                                href={`/api/companies/${companyId}/documents/${doc.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="truncate text-sm font-medium text-ecit-blue hover:text-ecit-navy underline"
                              >
                                {doc.originalFilename}
                              </a>
                              <span className="shrink-0 font-mono text-[10px] text-ecit-navy/30">
                                {Math.round(doc.fileSize / 1024)} KB
                              </span>
                            </div>
                             <div className="shrink-0">
                              {linkedDocIds.has(doc.id) ? (
                                <span className="text-xs font-semibold text-ecit-green">Bokført</span>
                              ) : (
                                <button
                                  onClick={() => {
                                    const name = doc.originalFilename.replace(/\.[^.]+$/, "");
                                    setBilagPrefill({
                                      description: name,
                                      documentId: doc.id,
                                      documentFilename: doc.originalFilename,
                                    });
                                    // Scroll to form after React renders
                                    setTimeout(() => {
                                      document.getElementById("nytt-bilag-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
                                    }, 50);
                                  }}
                                  className="text-xs font-semibold text-ecit-blue hover:text-ecit-navy"
                                >
                                  Bokfør
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })()}

          {/* Last opp bilagsdokumenter (RF) */}
          <div className="mb-6">
            <label
              htmlFor="rf-bilag-upload"
              className="flex cursor-pointer items-center justify-center gap-2 border-2 border-dashed border-ecit-beige-dark bg-ecit-cream/50 px-4 py-3 text-sm text-ecit-navy/50 transition hover:border-ecit-blue hover:bg-ecit-blue/5 hover:text-ecit-navy"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {uploadingDoc ? "Laster opp..." : "Last opp bilag (PDF, bilde, CSV)"}
            </label>
            <input
              id="rf-bilag-upload"
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.csv,.xlsx"
              className="hidden"
              disabled={uploadingDoc}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleRfUpload(e.target.files, "bilag");
                  e.target.value = "";
                }
              }}
            />
            {uploadDocError && (
              <p className="mt-1 text-xs text-ecit-ruby">{uploadDocError}</p>
            )}
          </div>

          <NyttBilagForm
            accounts={accounts}
            companyId={companyId}
            cycleId={cycleId}
            onCreated={loadVouchers}
            prefill={bilagPrefill}
            onPrefillConsumed={() => setBilagPrefill(null)}
            onClose={() => setBilagPrefill(null)}
          />

          <h2 className="mb-3 text-lg font-bold text-ecit-navy">
            Bilagsliste
            <span className="ml-2 font-mono text-sm font-normal text-ecit-navy/40">
              {voucherList.length} bilag
            </span>
          </h2>

          {loadingVouchers ? (
            <p className="text-sm text-ecit-navy/50">Laster bilag...</p>
          ) : voucherList.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="py-8 text-center text-ecit-navy/50">
                Ingen bilag registrert ennå.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {voucherList.map((v) => {
                const isExpanded = expandedVoucher === v.id;
                const statusInfo = voucherStatusLabels[v.status] || {
                  label: v.status,
                  color: "bg-ecit-beige text-ecit-navy/60",
                };
                const totalDebit = v.entries.reduce(
                  (s, e) => s + (parseFloat(e.debit) || 0),
                  0
                );

                return (
                  <Card key={v.id} className="shadow-sm">
                    <CardContent className="py-3">
                      <button
                        onClick={() =>
                          setExpandedVoucher(isExpanded ? null : v.id)
                        }
                        className="flex w-full items-center justify-between text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm text-ecit-navy/40">
                            #{v.voucherNumber}
                          </span>
                          <span className="font-mono text-sm text-ecit-navy/40">
                            {v.voucherDate}
                          </span>
                          <span className="font-semibold text-ecit-navy">
                            {v.description}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm text-ecit-navy/50">
                            {formatNumber(totalDebit)}
                          </span>
                          <Badge className={statusInfo.color}>
                            {statusInfo.label}
                          </Badge>
                          <svg
                            className={`h-4 w-4 text-ecit-navy/30 transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="mt-3 border-t border-ecit-beige-dark/50 pt-3">
                          {editingVoucherId === v.id ? (
                            /* ── Redigeringsmodus ── */
                            <div className="space-y-3">
                              <div className="flex gap-3">
                                <div className="flex-1">
                                  <label className="mb-0.5 block text-xs text-ecit-navy/50">Beskrivelse</label>
                                  <input
                                    type="text"
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    className="w-full border border-ecit-beige-dark bg-white px-2 py-1.5 text-sm text-ecit-navy outline-none focus:border-ecit-navy"
                                  />
                                </div>
                                <div className="w-40">
                                  <label className="mb-0.5 block text-xs text-ecit-navy/50">Dato</label>
                                  <input
                                    type="date"
                                    value={editDate}
                                    onChange={(e) => setEditDate(e.target.value)}
                                    className="w-full border border-ecit-beige-dark bg-white px-2 py-1.5 text-sm text-ecit-navy outline-none focus:border-ecit-navy"
                                  />
                                </div>
                              </div>

                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-left text-xs text-ecit-navy/40">
                                    <th className="py-1 font-normal">Konto</th>
                                    <th className="w-28 py-1 text-right font-normal">Debet</th>
                                    <th className="w-28 py-1 text-right font-normal">Kredit</th>
                                    <th className="w-10 py-1" />
                                  </tr>
                                </thead>
                                <tbody>
                                  {editEntries.map((entry, idx) => (
                                    <tr key={idx} className="border-b border-ecit-beige-dark/20">
                                      <td className="py-1">
                                        <select
                                          value={entry.accountId}
                                          onChange={(e) => updateEditEntry(idx, "accountId", e.target.value)}
                                          className="w-full border border-ecit-beige-dark bg-white px-1 py-1 text-sm text-ecit-navy outline-none focus:border-ecit-navy"
                                        >
                                          <option value="">Velg konto...</option>
                                          {accounts.map((a) => (
                                            <option key={a.id} value={a.id}>
                                              {a.accountNumber} — {a.name}
                                            </option>
                                          ))}
                                        </select>
                                      </td>
                                      <td className="py-1">
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={entry.debit}
                                          onChange={(e) => updateEditEntry(idx, "debit", e.target.value)}
                                          placeholder="0.00"
                                          className="w-full border border-ecit-beige-dark bg-white px-1 py-1 text-right font-mono text-sm text-ecit-navy outline-none focus:border-ecit-navy"
                                        />
                                      </td>
                                      <td className="py-1">
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={entry.credit}
                                          onChange={(e) => updateEditEntry(idx, "credit", e.target.value)}
                                          placeholder="0.00"
                                          className="w-full border border-ecit-beige-dark bg-white px-1 py-1 text-right font-mono text-sm text-ecit-navy outline-none focus:border-ecit-navy"
                                        />
                                      </td>
                                      <td className="py-1 text-center">
                                        {editEntries.length > 2 && (
                                          <button
                                            onClick={() => removeEditEntry(idx)}
                                            className="text-ecit-navy/30 hover:text-ecit-ruby"
                                            title="Fjern linje"
                                          >
                                            &times;
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>

                              <div className="flex items-center justify-between">
                                <button
                                  onClick={addEditEntry}
                                  className="text-xs text-ecit-blue hover:text-ecit-navy"
                                >
                                  + Legg til linje
                                </button>
                                <div className="flex items-center gap-2">
                                  {editError && (
                                    <span className="text-xs text-ecit-ruby">{editError}</span>
                                  )}
                                  <button
                                    onClick={() => setEditingVoucherId(null)}
                                    className="text-xs text-ecit-navy/40 hover:text-ecit-navy"
                                  >
                                    Avbryt
                                  </button>
                                  <Button
                                    onClick={handleUpdateVoucher}
                                    disabled={editSubmitting}
                                    className="bg-ecit-green text-white hover:bg-ecit-green/80 disabled:opacity-40"
                                  >
                                    {editSubmitting ? "Lagrer..." : "Lagre endringer"}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* ── Visningsmodus ── */
                            <>
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-left text-xs text-ecit-navy/40">
                                    <th className="w-20 py-1 font-mono font-normal">Konto</th>
                                    <th className="py-1 font-normal">Navn</th>
                                    <th className="w-28 py-1 text-right font-normal">Debet</th>
                                    <th className="w-28 py-1 text-right font-normal">Kredit</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {v.entries.map((e) => (
                                    <tr key={e.id} className="border-b border-ecit-beige-dark/20 last:border-0">
                                      <td className="py-1 font-mono text-ecit-navy/60">
                                        {e.accountNumber}
                                      </td>
                                      <td className="py-1 text-ecit-navy">
                                        {e.accountName}
                                      </td>
                                      <td className="py-1 text-right font-mono text-ecit-navy">
                                        {parseFloat(e.debit) > 0
                                          ? formatNumber(parseFloat(e.debit))
                                          : ""}
                                      </td>
                                      <td className="py-1 text-right font-mono text-ecit-navy">
                                        {parseFloat(e.credit) > 0
                                          ? formatNumber(parseFloat(e.credit))
                                          : ""}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <div className="mt-2 flex justify-end gap-2">
                                <button
                                  onClick={() => startEditVoucher(v)}
                                  className="text-xs text-ecit-blue hover:text-ecit-navy"
                                >
                                  Rediger
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`Slette bilag #${v.voucherNumber} "${v.description}"? Eventuelle bankavstemminger fjernes også.`)) {
                                      handleDeleteVoucher(v.id);
                                    }
                                  }}
                                  disabled={deletingVoucherId === v.id}
                                  className="text-xs text-ecit-ruby/60 hover:text-ecit-ruby disabled:opacity-40"
                                >
                                  {deletingVoucherId === v.id ? "Sletter..." : "Slett"}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: Hovedbok ═══ */}
      {activeTab === "hovedbok" && (
        <div>
          <h2 className="mb-3 text-lg font-bold text-ecit-navy">Hovedbok</h2>
          {hovedbokData.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="py-8 text-center text-ecit-navy/50">
                Ingen posterte bilag ennå. Bokfør bilag i Bilag-fanen for å se hovedboken.
              </CardContent>
            </Card>
          ) : (
            hovedbokData.map(({ account, entries }) => {
              const ib = parseFloat(balances[account.id] || "0") || 0;
              let running = ib;

              return (
                <Card key={account.id} className="mb-4 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-ecit-navy">
                      {account.accountNumber} — {account.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-ecit-beige-dark text-left text-xs text-ecit-navy/40">
                          <th className="w-24 py-1 font-normal">Dato</th>
                          <th className="w-16 py-1 font-mono font-normal">Bilag</th>
                          <th className="py-1 font-normal">Tekst</th>
                          <th className="w-24 py-1 text-right font-normal">Debet</th>
                          <th className="w-24 py-1 text-right font-normal">Kredit</th>
                          <th className="w-28 py-1 text-right font-normal">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ib !== 0 && (
                          <tr className="border-b border-ecit-beige-dark/30 bg-ecit-beige/30">
                            <td className="py-1 font-mono text-ecit-navy/60">01.01</td>
                            <td className="py-1 font-mono text-ecit-navy/40">IB</td>
                            <td className="py-1 text-ecit-navy/60">Åpningsbalanse</td>
                            <td className="py-1 text-right font-mono text-ecit-navy">
                              {ib > 0 ? formatNumber(ib) : ""}
                            </td>
                            <td className="py-1 text-right font-mono text-ecit-navy">
                              {ib < 0 ? formatNumber(Math.abs(ib)) : ""}
                            </td>
                            <td className="py-1 text-right font-mono font-semibold text-ecit-navy">
                              {formatNumber(ib)}
                            </td>
                          </tr>
                        )}
                        {entries.map((e, idx) => {
                          running += e.debit - e.credit;
                          return (
                            <tr
                              key={idx}
                              className="border-b border-ecit-beige-dark/30 last:border-0"
                            >
                              <td className="py-1 font-mono text-ecit-navy/60">
                                {e.voucher.voucherDate.substring(5).replace("-", ".")}
                              </td>
                              <td className="py-1 font-mono text-ecit-navy/40">
                                #{e.voucher.voucherNumber}
                              </td>
                              <td className="py-1 text-ecit-navy">
                                {e.description || e.voucher.description}
                              </td>
                              <td className="py-1 text-right font-mono text-ecit-navy">
                                {e.debit > 0 ? formatNumber(e.debit) : ""}
                              </td>
                              <td className="py-1 text-right font-mono text-ecit-navy">
                                {e.credit > 0 ? formatNumber(e.credit) : ""}
                              </td>
                              <td className="py-1 text-right font-mono font-semibold text-ecit-navy">
                                {formatNumber(running)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ═══ TAB: Saldobalanse ═══ */}
      {activeTab === "saldobalanse" && (
        <div>
          <h2 className="mb-3 text-lg font-bold text-ecit-navy">
            Saldobalanse {cycleYear}
          </h2>
          {saldobalanseData.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="py-8 text-center text-ecit-navy/50">
                Registrer åpningsbalanse og/eller bokfør bilag for å se saldobalansen.
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-sm">
              <CardContent className="pb-3 pt-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ecit-beige-dark text-left text-xs text-ecit-navy/40">
                      <th className="w-20 py-2 font-mono font-normal">Konto</th>
                      <th className="py-2 font-normal">Navn</th>
                      <th className="w-28 py-2 text-right font-normal">IB</th>
                      <th className="w-28 py-2 text-right font-normal">Debet</th>
                      <th className="w-28 py-2 text-right font-normal">Kredit</th>
                      <th className="w-28 py-2 text-right font-normal">UB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saldobalanseData.map((row) => (
                      <tr
                        key={row.account.id}
                        className="border-b border-ecit-beige-dark/30 last:border-0"
                      >
                        <td className="py-1.5 font-mono text-ecit-navy/60">
                          {row.account.accountNumber}
                        </td>
                        <td className="py-1.5 text-ecit-navy">
                          {row.account.name}
                        </td>
                        <td className="py-1.5 text-right font-mono text-ecit-navy">
                          {row.ib !== 0 ? formatNumber(row.ib) : ""}
                        </td>
                        <td className="py-1.5 text-right font-mono text-ecit-navy">
                          {row.debit > 0 ? formatNumber(row.debit) : ""}
                        </td>
                        <td className="py-1.5 text-right font-mono text-ecit-navy">
                          {row.credit > 0 ? formatNumber(row.credit) : ""}
                        </td>
                        <td className="py-1.5 text-right font-mono font-semibold text-ecit-navy">
                          {formatNumber(row.ub)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-ecit-navy/20">
                      <td></td>
                      <td className="py-2 text-xs font-bold text-ecit-navy">
                        TOTALT
                      </td>
                      <td className="py-2 text-right font-mono font-bold text-ecit-navy">
                        {formatNumber(
                          saldobalanseData.reduce((s, r) => s + r.ib, 0)
                        )}
                      </td>
                      <td className="py-2 text-right font-mono font-bold text-ecit-navy">
                        {formatNumber(
                          saldobalanseData.reduce((s, r) => s + r.debit, 0)
                        )}
                      </td>
                      <td className="py-2 text-right font-mono font-bold text-ecit-navy">
                        {formatNumber(
                          saldobalanseData.reduce((s, r) => s + r.credit, 0)
                        )}
                      </td>
                      <td className="py-2 text-right font-mono font-bold text-ecit-navy">
                        {formatNumber(
                          saldobalanseData.reduce((s, r) => s + r.ub, 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══ TAB: Resultatregnskap ═══ */}
      {activeTab === "resultat" && (
        <div>
          <h2 className="mb-3 text-lg font-bold text-ecit-navy">Resultatregnskap</h2>
          {voucherList.filter((v) => v.status === "postert").length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="py-8 text-center text-ecit-navy/50">
                Ingen posterte bilag ennå. Bokfør bilag for å se resultatregnskapet.
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-sm">
              <CardContent className="py-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ecit-beige-dark text-left text-xs text-ecit-navy/40">
                      <th className="w-20 py-2 font-mono font-normal">Konto</th>
                      <th className="py-2 font-normal">Beskrivelse</th>
                      <th className="w-32 py-2 text-right font-normal">Beløp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultatData.groups.map((group) => {
                      if (group.rows.length === 0) return null;
                      return (
                        <React.Fragment key={group.label}>
                          {/* Gruppeoverskrift */}
                          <tr className="bg-ecit-beige/30">
                            <td colSpan={2} className="py-2 text-xs font-bold text-ecit-navy">
                              {group.label}
                            </td>
                            <td className="py-2 text-right font-mono text-xs font-bold text-ecit-navy">
                              {formatNumber(group.total)}
                            </td>
                          </tr>
                          {/* Kontolinjer */}
                          {group.rows.map((row) => (
                            <tr key={row.account.id} className="border-b border-ecit-beige-dark/20">
                              <td className="py-1.5 font-mono text-ecit-navy/60">
                                {row.account.accountNumber}
                              </td>
                              <td className="py-1.5 text-ecit-navy">
                                {row.account.name}
                              </td>
                              <td className={`py-1.5 text-right font-mono ${row.amount >= 0 ? "text-ecit-green" : "text-ecit-navy"}`}>
                                {formatNumber(row.amount)}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                    {/* Driftsresultat */}
                    <tr className="border-t-2 border-ecit-navy/20 bg-ecit-beige/50">
                      <td colSpan={2} className="py-2 font-bold text-ecit-navy">
                        Driftsresultat
                      </td>
                      <td className={`py-2 text-right font-mono font-bold ${resultatData.driftsresultat >= 0 ? "text-ecit-green" : "text-ecit-ruby"}`}>
                        {formatNumber(resultatData.driftsresultat)}
                      </td>
                    </tr>
                    {/* Årsresultat */}
                    <tr className="border-t-2 border-ecit-navy bg-ecit-navy/5">
                      <td colSpan={2} className="py-2 text-sm font-bold text-ecit-navy">
                        Årsresultat (resultat før skatt)
                      </td>
                      <td className={`py-2 text-right font-mono text-sm font-bold ${resultatData.aarsresultat >= 0 ? "text-ecit-green" : "text-ecit-ruby"}`}>
                        {formatNumber(resultatData.aarsresultat)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══ TAB: Balanse ═══ */}
      {activeTab === "balanse" && (
        <div>
          <h2 className="mb-3 text-lg font-bold text-ecit-navy">Balanse</h2>
          {saldobalanseData.filter((r) => r.account.accountNumber < 3000).length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="py-8 text-center text-ecit-navy/50">
                Ingen balansedata ennå. Registrer åpningsbalanse eller bokfør bilag.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Eiendeler (venstre) */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-ecit-navy">Eiendeler</CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-ecit-beige-dark text-left text-xs text-ecit-navy/40">
                        <th className="w-16 py-1 font-mono font-normal">Konto</th>
                        <th className="py-1 font-normal">Navn</th>
                        <th className="w-28 py-1 text-right font-normal">Beløp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balanseData.eiendeler.map((group) => {
                        if (group.rows.length === 0) return null;
                        return (
                          <React.Fragment key={group.label}>
                            <tr className="bg-ecit-beige/30">
                              <td colSpan={2} className="py-1.5 text-xs font-bold text-ecit-navy">
                                {group.label}
                              </td>
                              <td className="py-1.5 text-right font-mono text-xs font-bold text-ecit-navy">
                                {formatNumber(group.total)}
                              </td>
                            </tr>
                            {group.rows.map((row) => (
                              <tr key={row.account.id} className="border-b border-ecit-beige-dark/20">
                                <td className="py-1 font-mono text-ecit-navy/60">{row.account.accountNumber}</td>
                                <td className="py-1 text-ecit-navy">{row.account.name}</td>
                                <td className="py-1 text-right font-mono text-ecit-navy">{formatNumber(row.ub)}</td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                      <tr className="border-t-2 border-ecit-navy bg-ecit-navy/5">
                        <td colSpan={2} className="py-2 font-bold text-ecit-navy">
                          Sum eiendeler
                        </td>
                        <td className="py-2 text-right font-mono font-bold text-ecit-navy">
                          {formatNumber(balanseData.sumEiendeler)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* EK + Gjeld (høyre) */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-ecit-navy">Egenkapital og gjeld</CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-ecit-beige-dark text-left text-xs text-ecit-navy/40">
                        <th className="w-16 py-1 font-mono font-normal">Konto</th>
                        <th className="py-1 font-normal">Navn</th>
                        <th className="w-28 py-1 text-right font-normal">Beløp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balanseData.ekGjeld.map((group) => {
                        if (group.rows.length === 0) return null;
                        return (
                          <React.Fragment key={group.label}>
                            <tr className="bg-ecit-beige/30">
                              <td colSpan={2} className="py-1.5 text-xs font-bold text-ecit-navy">
                                {group.label}
                              </td>
                              <td className="py-1.5 text-right font-mono text-xs font-bold text-ecit-navy">
                                {formatNumber(group.total)}
                              </td>
                            </tr>
                            {group.rows.map((row) => (
                              <tr key={row.account.id} className="border-b border-ecit-beige-dark/20">
                                <td className="py-1 font-mono text-ecit-navy/60">{row.account.accountNumber}</td>
                                <td className="py-1 text-ecit-navy">{row.account.name}</td>
                                <td className="py-1 text-right font-mono text-ecit-navy">{formatNumber(Math.abs(row.ub))}</td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                      {/* Periodens resultat */}
                      <tr className="border-t border-ecit-beige-dark/50 bg-ecit-beige/30">
                        <td colSpan={2} className="py-1.5 text-xs font-bold text-ecit-navy">
                          Periodens resultat
                        </td>
                        <td className={`py-1.5 text-right font-mono text-xs font-bold ${balanseData.aarsresultat >= 0 ? "text-ecit-green" : "text-ecit-ruby"}`}>
                          {formatNumber(Math.abs(balanseData.aarsresultat))}
                        </td>
                      </tr>
                      <tr className="border-t-2 border-ecit-navy bg-ecit-navy/5">
                        <td colSpan={2} className="py-2 font-bold text-ecit-navy">
                          Sum EK og gjeld
                        </td>
                        <td className="py-2 text-right font-mono font-bold text-ecit-navy">
                          {formatNumber(Math.abs(balanseData.sumEkGjeldMedResultat))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Balansekontroll */}
          {Math.abs(balanseData.sumEiendeler - Math.abs(balanseData.sumEkGjeldMedResultat)) > 0.01 && balanseData.sumEiendeler !== 0 && (
            <div className="mt-4 border border-ecit-ruby/30 bg-ecit-ruby/5 p-4">
              <p className="text-sm font-semibold text-ecit-ruby">
                Balansen stemmer ikke! Eiendeler ({formatNumber(balanseData.sumEiendeler)}) ≠ EK+Gjeld ({formatNumber(Math.abs(balanseData.sumEkGjeldMedResultat))}).
                Differanse: {formatNumber(balanseData.sumEiendeler - Math.abs(balanseData.sumEkGjeldMedResultat))}
              </p>
            </div>
          )}
          {balanseData.sumEiendeler !== 0 && Math.abs(balanseData.sumEiendeler - Math.abs(balanseData.sumEkGjeldMedResultat)) < 0.01 && (
            <div className="mt-4 border border-ecit-green/30 bg-ecit-green/5 p-4">
              <p className="text-sm font-semibold text-ecit-green">Balansen stemmer</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: Bank ═══ */}
      {activeTab === "bank" && (
        <div>
          <h2 className="mb-3 text-lg font-bold text-ecit-navy">
            Bankavstemming {cycleYear}
          </h2>

          {/* Import-seksjon */}
          <Card className="mb-6 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-ecit-navy">
                Importer bankutskrift
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-ecit-navy/50">
                Last opp bankutskrift som PDF, eller lim inn CSV-data fra nettbanken.
              </p>

              {/* PDF-opplasting */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-ecit-navy/60">
                  PDF-opplasting (anbefalt)
                </label>
                <div className="mt-1 flex items-center gap-3">
                  <label className="cursor-pointer border border-ecit-beige-dark bg-white px-4 py-2 text-sm text-ecit-navy transition-colors hover:bg-ecit-beige">
                    <input
                      type="file"
                      accept=".pdf"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files && files.length > 0) handleUploadPdf(files);
                        e.target.value = "";
                      }}
                      disabled={importing}
                    />
                    {importing ? "Importerer..." : "Velg PDF-fil(er)"}
                  </label>
                  {pdfFileName && (
                    <span className="text-sm text-ecit-navy/50">{pdfFileName}</span>
                  )}
                  {pdfResult && (
                    <span
                      className={`text-sm ${
                        pdfResult.includes("importert")
                          ? "text-ecit-green"
                          : "text-ecit-ruby"
                      }`}
                    >
                      {pdfResult}
                    </span>
                  )}
                </div>
              </div>

              {/* Import fra kundedokumenter */}
              {docList.filter(d => d.fileType === "application/pdf").length > 0 && (
                <div className="mb-4 border-t border-ecit-beige-dark pt-3">
                  <label className="text-xs font-semibold text-ecit-navy/60">
                    Importer fra dokumenter
                  </label>
                  <p className="mt-1 mb-2 text-xs text-ecit-navy/40">
                    Velg PDF-filer som er bankutskrifter for å importere.
                  </p>
                  <div className="space-y-1">
                    {docList
                      .filter(d => d.fileType === "application/pdf")
                      .map((doc) => (
                        <div key={doc.id} className="flex items-center gap-2">
                          <button
                            onClick={() => handleImportFromDocuments([doc.id])}
                            disabled={importing}
                            className="text-sm text-ecit-link-blue underline hover:text-ecit-navy disabled:opacity-40"
                          >
                            {doc.originalFilename}
                          </button>
                          <span className="text-xs text-ecit-navy/30">
                            {Math.round(doc.fileSize / 1024)} KB
                          </span>
                        </div>
                      ))}
                  </div>
                  {docList.filter(d => d.fileType === "application/pdf").length > 1 && (
                    <Button
                      onClick={() =>
                        handleImportFromDocuments(
                          docList
                            .filter(d => d.fileType === "application/pdf")
                            .map(d => d.id)
                        )
                      }
                      disabled={importing}
                      className="mt-2 bg-ecit-navy text-white hover:bg-ecit-dark-navy disabled:opacity-40"
                      size="sm"
                    >
                      {importing ? "Importerer..." : "Importer alle PDF-er"}
                    </Button>
                  )}
                </div>
              )}

              {/* CSV-fallback */}
              <details className="group">
                <summary className="cursor-pointer text-xs font-semibold text-ecit-navy/40 hover:text-ecit-navy/60">
                  Alternativt: lim inn CSV-data
                </summary>
                <div className="mt-2">
                  <textarea
                    value={csvInput}
                    onChange={(e) => setCsvInput(e.target.value)}
                    placeholder={"Dato;Forklaring;Ut av konto;Inn på konto\n15.01.2025;Vipps *Kaffebrenneriet;89,00;\n16.01.2025;Overføring fra kunde;;5000,00"}
                    rows={5}
                    className="w-full border border-ecit-beige-dark bg-white px-3 py-2 font-mono text-sm text-ecit-navy outline-none placeholder:text-ecit-navy/20 focus:border-ecit-navy"
                  />
                  <div className="mt-2 flex justify-end">
                    <Button
                      onClick={handleImportCSV}
                      disabled={importing || !csvInput.trim()}
                      className="bg-ecit-navy text-white hover:bg-ecit-dark-navy disabled:opacity-40"
                    >
                      {importing ? "Importerer..." : "Importer CSV"}
                    </Button>
                  </div>
                </div>
              </details>
            </CardContent>
          </Card>

          {/* Sammendrag */}
          {bankLineList.length > 0 && (
            <div className="mb-6 grid grid-cols-4 gap-4">
              <Card className="shadow-sm">
                <CardContent className="py-3 text-center">
                  <div className="font-mono text-xs text-ecit-navy/40">Totalt</div>
                  <div className="text-lg font-bold text-ecit-navy">
                    {bankSummary.total}
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="py-3 text-center">
                  <div className="font-mono text-xs text-ecit-navy/40">Avstemt</div>
                  <div className="text-lg font-bold text-ecit-green">
                    {bankSummary.avstemt}
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="py-3 text-center">
                  <div className="font-mono text-xs text-ecit-navy/40">Uavstemt</div>
                  <div className={`text-lg font-bold ${bankSummary.uavstemt > 0 ? "text-ecit-ruby" : "text-ecit-green"}`}>
                    {bankSummary.uavstemt}
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="py-3 text-center">
                  <div className="font-mono text-xs text-ecit-navy/40">Netto bevegelse</div>
                  <div className="text-lg font-bold text-ecit-navy">
                    {formatNumber(bankSummary.sumInn + bankSummary.sumUt)}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Banklinjer-liste */}
          {loadingBank ? (
            <p className="text-sm text-ecit-navy/50">Laster banklinjer...</p>
          ) : bankLineList.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="py-8 text-center text-ecit-navy/50">
                Ingen banklinjer importert ennå. Last opp en bankutskrift (PDF) for å komme i gang.
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-sm">
              <CardContent className="pb-3 pt-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ecit-beige-dark text-left text-xs text-ecit-navy/40">
                      <th className="w-24 py-2 font-normal">Dato</th>
                      <th className="py-2 font-normal">Beskrivelse</th>
                      <th className="w-28 py-2 text-right font-normal">Beløp</th>
                      <th className="w-28 py-2 text-center font-normal">Status</th>
                      <th className="w-40 py-2 font-normal">Bilag</th>
                      <th className="w-24 py-2 text-right font-normal">Handling</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankLineList.map((line) => {
                      const amount = parseFloat(line.amount);
                      const isMatching = matchingLineId === line.id;
                      const isBooking = bookingLineId === line.id;

                      const statusBadge =
                        line.status === "avstemt" ? (
                          <Badge className="bg-ecit-green text-white">Avstemt</Badge>
                        ) : line.status === "ignorert" ? (
                          <Badge className="bg-ecit-beige text-ecit-navy/60">Ignorert</Badge>
                        ) : (
                          <Badge className="bg-ecit-ruby/10 text-ecit-ruby">Uavstemt</Badge>
                        );

                      return (
                        <React.Fragment key={line.id}>
                          <tr
                            className={`border-b border-ecit-beige-dark/30 last:border-0 ${isBooking ? "bg-ecit-beige/30" : ""}`}
                          >
                            <td className="py-2 font-mono text-ecit-navy/60">
                              {line.transactionDate.substring(5).replace("-", ".")}
                            </td>
                            <td className="py-2 text-ecit-navy">{line.description}</td>
                            <td
                              className={`py-2 text-right font-mono ${
                                amount >= 0 ? "text-ecit-green" : "text-ecit-navy"
                              }`}
                            >
                              {formatNumber(amount)}
                            </td>
                            <td className="py-2 text-center">{statusBadge}</td>
                            <td className="py-2">
                              {line.matchedVoucher ? (
                                <span className="text-sm text-ecit-navy/60">
                                  #{line.matchedVoucher.voucherNumber} — {line.matchedVoucher.description}
                                </span>
                              ) : isMatching ? (
                                <select
                                  autoFocus
                                  className="w-full border border-ecit-beige-dark bg-white px-1 py-1 text-sm text-ecit-navy outline-none focus:border-ecit-navy"
                                  defaultValue=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleBankAction(line.id, "avstem", e.target.value);
                                    }
                                  }}
                                  onBlur={() => setMatchingLineId(null)}
                                >
                                  <option value="">Velg bilag...</option>
                                  {voucherList
                                    .filter((v) => v.status === "postert")
                                    .map((v) => (
                                      <option key={v.id} value={v.id}>
                                        #{v.voucherNumber} — {v.description} ({formatNumber(
                                          v.entries.reduce(
                                            (s, e) => s + (parseFloat(e.debit) || 0),
                                            0
                                          )
                                        )})
                                      </option>
                                    ))}
                                </select>
                              ) : (
                                <span className="text-sm text-ecit-navy/20">—</span>
                              )}
                            </td>
                            <td className="py-2 text-right">
                              {line.status === "uavstemt" && (
                                <div className="flex justify-end gap-1">
                                  <button
                                    onClick={() => {
                                      setBookingLineId(isBooking ? null : line.id);
                                      setBookingContraAccountId("");
                                      setBookingBankAccountId(defaultBankAccountId);
                                      setBookingError("");
                                      setMatchingLineId(null);
                                    }}
                                    className={`text-xs font-semibold ${isBooking ? "text-ecit-navy" : "text-ecit-green hover:text-ecit-navy"}`}
                                    title="Opprett bilag fra banklinjen"
                                  >
                                    {isBooking ? "Lukk" : "Bokfør"}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setMatchingLineId(line.id);
                                      setBookingLineId(null);
                                    }}
                                    className="text-xs text-ecit-blue hover:text-ecit-navy"
                                    title="Koble til eksisterende bilag"
                                  >
                                    Avstem
                                  </button>
                                  <button
                                    onClick={() => handleBankAction(line.id, "ignorer")}
                                    className="text-xs text-ecit-navy/30 hover:text-ecit-navy/60"
                                    title="Ignorer denne linjen"
                                  >
                                    Ignorer
                                  </button>
                                </div>
                              )}
                              {(line.status === "avstemt" || line.status === "ignorert") && (
                                <button
                                  onClick={() => handleBankAction(line.id, "fjern_avstemming")}
                                  className="text-xs text-ecit-navy/30 hover:text-ecit-ruby"
                                  title="Fjern avstemming"
                                >
                                  Angre
                                </button>
                              )}
                            </td>
                          </tr>
                          {/* Inline bokforing-rad */}
                          {isBooking && (
                            <tr className="border-b border-ecit-beige-dark/30 bg-ecit-beige/20">
                              <td colSpan={6} className="px-2 py-3">
                                <div className="flex items-end gap-3">
                                  <div className="flex-1">
                                    <label className="mb-0.5 block text-xs text-ecit-navy/50">
                                      Motkonto {amount < 0 ? "(kostnad/eiendel)" : "(inntekt/gjeld)"}
                                    </label>
                                    <select
                                      autoFocus
                                      value={bookingContraAccountId}
                                      onChange={(e) => setBookingContraAccountId(e.target.value)}
                                      className="w-full border border-ecit-beige-dark bg-white px-2 py-1.5 text-sm text-ecit-navy outline-none focus:border-ecit-navy"
                                    >
                                      <option value="">Velg motkonto...</option>
                                      {accounts
                                        .filter((a) => {
                                          // Filter ut bankkontoer (19xx) - de er bankkontoen, ikke motkonto
                                          if (a.accountNumber >= 1900 && a.accountNumber <= 1999) return false;
                                          return true;
                                        })
                                        .map((a) => (
                                          <option key={a.id} value={a.id}>
                                            {a.accountNumber} — {a.name}
                                          </option>
                                        ))}
                                    </select>
                                  </div>
                                  <div className="w-56">
                                    <label className="mb-0.5 block text-xs text-ecit-navy/50">
                                      Bankkonto
                                    </label>
                                    <select
                                      value={bookingBankAccountId || defaultBankAccountId}
                                      onChange={(e) => setBookingBankAccountId(e.target.value)}
                                      className="w-full border border-ecit-beige-dark bg-white px-2 py-1.5 text-sm text-ecit-navy outline-none focus:border-ecit-navy"
                                    >
                                      {bankAccounts.map((a) => (
                                        <option key={a.id} value={a.id}>
                                          {a.accountNumber} — {a.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      onClick={() => handleBookFromBankLine(line.id)}
                                      disabled={bookingSubmitting || !bookingContraAccountId}
                                      className="bg-ecit-green text-white hover:bg-ecit-green/80 disabled:opacity-40"
                                    >
                                      {bookingSubmitting ? "Bokfører..." : `Bokfør ${formatNumber(Math.abs(amount))}`}
                                    </Button>
                                    <button
                                      onClick={() => setBookingLineId(null)}
                                      className="text-xs text-ecit-navy/40 hover:text-ecit-navy"
                                    >
                                      Avbryt
                                    </button>
                                  </div>
                                </div>
                                {bookingError && (
                                  <p className="mt-1 text-xs text-ecit-ruby">{bookingError}</p>
                                )}
                                <p className="mt-1 text-xs text-ecit-navy/40">
                                  {amount < 0
                                    ? `Kredit ${bankAccounts.find(a => a.id === (bookingBankAccountId || defaultBankAccountId))?.accountNumber || "1920"} (bank), Debet motkonto`
                                    : `Debet ${bankAccounts.find(a => a.id === (bookingBankAccountId || defaultBankAccountId))?.accountNumber || "1920"} (bank), Kredit motkonto`}
                                  {" — "}bilag opprettes og banklinjen avstemmes automatisk.
                                </p>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
