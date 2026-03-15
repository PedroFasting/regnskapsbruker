"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface SoeketreffSelskap {
  orgNr: string;
  navn: string;
  selskapstype: string;
  poststed: string | null;
}

interface Selskapsinfo {
  orgNr: string;
  navn: string;
  selskapstype: string;
  mvaRegistrert: boolean;
  harAnsatte: boolean;
  adresse: string | null;
  næringskode: string | null;
  næringsbeskrivelse: string | null;
  stiftelsesdato: string | null;
  aktiv: boolean;
}

export default function NyKundePage() {
  const router = useRouter();
  const [soek, setSoek] = useState("");
  const [treff, setTreff] = useState<SoeketreffSelskap[]>([]);
  const [visDropdown, setVisDropdown] = useState(false);
  const [soeker, setSoeker] = useState(false);
  const [selskap, setSelskap] = useState<Selskapsinfo | null>(null);
  const [kontaktNavn, setKontaktNavn] = useState("");
  const [kontaktEpost, setKontaktEpost] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced søk mot Brreg
  const utfoerSoek = useCallback(async (query: string) => {
    if (query.length < 2) {
      setTreff([]);
      setVisDropdown(false);
      return;
    }

    setSoeker(true);
    try {
      const res = await fetch(`/api/brreg?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data: SoeketreffSelskap[] = await res.json();
        setTreff(data);
        setVisDropdown(data.length > 0);
      }
    } catch {
      // Ignorer nettverksfeil under søk
    } finally {
      setSoeker(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (selskap) return; // Ikke søk på nytt etter valg

    debounceRef.current = setTimeout(() => {
      utfoerSoek(soek);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [soek, selskap, utfoerSoek]);

  // Lukk dropdown ved klikk utenfor
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setVisDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Velg selskap fra dropdown → hent full info
  async function velgSelskap(orgNr: string) {
    setVisDropdown(false);
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/brreg?orgNr=${encodeURIComponent(orgNr)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
      } else {
        setSelskap(data);
        setSoek(data.navn);
      }
    } catch {
      setError("Kunne ikke hente selskapsdata");
    } finally {
      setLoading(false);
    }
  }

  // Nullstill valgt selskap
  function nullstill() {
    setSelskap(null);
    setSoek("");
    setTreff([]);
    setError(null);
  }

  async function handleSave() {
    if (!selskap) return;
    setError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgNr: selskap.orgNr,
          kontaktNavn: kontaktNavn || undefined,
          kontaktEpost: kontaktEpost || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/rf/dashboard"), 1500);
      }
    } catch {
      setError("Kunne ikke lagre selskapet");
    } finally {
      setSaving(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <Card className="shadow-ecit">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center bg-ecit-green">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <CardTitle className="text-2xl font-extrabold text-ecit-green">
              Selskapet er opprettet
            </CardTitle>
            <CardDescription className="text-ecit-navy/60">
              {selskap?.navn} er lagt til med sjekkliste for{" "}
              {new Date().getFullYear() - 1}. Du blir sendt tilbake til
              dashboardet.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-8 text-2xl font-extrabold text-ecit-navy">Legg til ny kunde</h1>

      {/* Steg 1: Søk etter selskap */}
      <Card className="mb-6 overflow-visible shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center bg-ecit-navy font-mono text-sm font-bold text-white">1</span>
            <div>
              <CardTitle className="text-base font-bold text-ecit-navy">Finn selskap</CardTitle>
              <CardDescription className="text-ecit-navy/50">
                Søk på selskapsnavn eller organisasjonsnummer.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative" ref={dropdownRef}>
            <Input
              placeholder="F.eks. «Nordmann Holding» eller «912 345 678»"
              value={soek}
              onChange={(e) => {
                setSoek(e.target.value);
                if (selskap) nullstill();
              }}
              onFocus={() => {
                if (treff.length > 0 && !selskap) setVisDropdown(true);
              }}
              disabled={loading}
              className="border-ecit-beige-dark focus:border-ecit-blue focus:ring-ecit-blue"
            />
            {soeker && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-ecit-navy/40">
                Søker...
              </span>
            )}

            {/* Dropdown med søkeresultater */}
            {visDropdown && (
              <div className="absolute z-10 mt-1 w-full border border-ecit-beige-dark bg-white shadow-ecit">
                {treff.map((t) => (
                  <button
                    key={t.orgNr}
                    className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-ecit-beige"
                    onClick={() => velgSelskap(t.orgNr)}
                  >
                    <div>
                      <div className="font-semibold text-ecit-navy">{t.navn}</div>
                      <div className="font-mono text-sm text-ecit-navy/40">
                        {t.orgNr}
                        {t.poststed && ` · ${t.poststed}`}
                      </div>
                    </div>
                    <Badge className="ml-2 shrink-0 bg-ecit-beige text-ecit-navy">
                      {t.selskapstype}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selskap && (
            <button
              onClick={nullstill}
              className="mt-2 text-sm text-ecit-blue underline hover:text-ecit-navy"
            >
              Velg et annet selskap
            </button>
          )}
        </CardContent>
      </Card>

      {/* Steg 2: Vis selskapsinfo */}
      {selskap && (
        <Card className="mb-6 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center bg-ecit-navy font-mono text-sm font-bold text-white">2</span>
              <div>
                <CardTitle className="text-base font-bold text-ecit-navy">Bekreft selskapsdata</CardTitle>
                <CardDescription className="text-ecit-navy/50">
                  Sjekk at informasjonen stemmer.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-ecit-navy/50">Navn</span>
              <span className="font-semibold text-ecit-navy">{selskap.navn}</span>
            </div>
            <Separator className="bg-ecit-beige-dark/50" />
            <div className="flex justify-between">
              <span className="text-ecit-navy/50">Org.nr</span>
              <span className="font-mono text-ecit-navy">{selskap.orgNr}</span>
            </div>
            <Separator className="bg-ecit-beige-dark/50" />
            <div className="flex justify-between">
              <span className="text-ecit-navy/50">Type</span>
              <Badge className="bg-ecit-beige text-ecit-navy">{selskap.selskapstype}</Badge>
            </div>
            <Separator className="bg-ecit-beige-dark/50" />
            <div className="flex justify-between">
              <span className="text-ecit-navy/50">MVA-registrert</span>
              <span className="text-ecit-navy">{selskap.mvaRegistrert ? "Ja" : "Nei"}</span>
            </div>
            <Separator className="bg-ecit-beige-dark/50" />
            <div className="flex justify-between">
              <span className="text-ecit-navy/50">Ansatte</span>
              <span className="text-ecit-navy">{selskap.harAnsatte ? "Ja" : "Nei"}</span>
            </div>
            {selskap.adresse && (
              <>
                <Separator className="bg-ecit-beige-dark/50" />
                <div className="flex justify-between">
                  <span className="text-ecit-navy/50">Adresse</span>
                  <span className="text-right text-ecit-navy">{selskap.adresse}</span>
                </div>
              </>
            )}
            {selskap.næringsbeskrivelse && (
              <>
                <Separator className="bg-ecit-beige-dark/50" />
                <div className="flex justify-between">
                  <span className="text-ecit-navy/50">Næring</span>
                  <span className="text-right text-ecit-navy">
                    {selskap.næringsbeskrivelse}
                  </span>
                </div>
              </>
            )}

            {!selskap.aktiv && (
              <p className="mt-4 bg-ecit-ruby/10 p-3 text-sm text-ecit-ruby">
                Selskapet er under avvikling eller konkurs og kan ikke legges
                til.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Steg 3: Kontaktperson */}
      {selskap && selskap.aktiv && (
        <Card className="mb-6 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center bg-ecit-navy font-mono text-sm font-bold text-white">3</span>
              <div>
                <CardTitle className="text-base font-bold text-ecit-navy">Kontaktperson (valgfritt)</CardTitle>
                <CardDescription className="text-ecit-navy/50">
                  Legg til kundens kontaktperson. De vil motta en invitasjon per
                  e-post.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="kontakt-navn" className="font-semibold text-ecit-navy">Navn</Label>
              <Input
                id="kontakt-navn"
                placeholder="Ola Nordmann"
                value={kontaktNavn}
                onChange={(e) => setKontaktNavn(e.target.value)}
                className="border-ecit-beige-dark focus:border-ecit-blue focus:ring-ecit-blue"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kontakt-epost" className="font-semibold text-ecit-navy">E-post</Label>
              <Input
                id="kontakt-epost"
                type="email"
                placeholder="ola@selskapet.no"
                value={kontaktEpost}
                onChange={(e) => setKontaktEpost(e.target.value)}
                className="border-ecit-beige-dark focus:border-ecit-blue focus:ring-ecit-blue"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lagre */}
      {selskap && selskap.aktiv && (
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-ecit-navy text-white hover:bg-ecit-navy-dark"
          size="lg"
        >
          {saving ? "Lagrer..." : "Opprett kunde og generer sjekkliste"}
        </Button>
      )}

      {error && (
        <p className="mt-4 text-center text-sm text-ecit-ruby">{error}</p>
      )}
    </div>
  );
}
