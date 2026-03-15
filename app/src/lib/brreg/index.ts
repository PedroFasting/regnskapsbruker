/**
 * Brønnøysundregistrene API-klient
 *
 * Åpent API, ingen autentisering nødvendig.
 * Brukes ved kunde-onboarding for å hente selskapsdata fra orgnr.
 *
 * API-dokumentasjon: https://data.brreg.no/enhetsregisteret/api/docs/index.html
 */

const BRREG_BASE_URL = "https://data.brreg.no/enhetsregisteret/api/enheter";

// ── Søkeresultat (forenklet) ──

export interface SoeketreffSelskap {
  orgNr: string;
  navn: string;
  selskapstype: string;
  poststed: string | null;
}

// ── Typer fra Brønnøysund-APIet ──

interface BrregSoekerespons {
  _embedded?: {
    enheter: BrregEnhet[];
  };
  page: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
  };
}

export interface BrregEnhet {
  organisasjonsnummer: string;
  navn: string;
  organisasjonsform: {
    kode: string; // "AS", "ENK", "NUF", etc.
    beskrivelse: string;
  };
  registreringsdatoEnhetsregisteret?: string;
  registrertIMvaregisteret?: boolean;
  forretningsadresse?: {
    land: string;
    landkode: string;
    postnummer: string;
    poststed: string;
    adresse: string[];
    kommune: string;
    kommunenummer: string;
  };
  naeringskode1?: {
    kode: string;
    beskrivelse: string;
  };
  antallAnsatte?: number;
  stiftelsesdato?: string;
  institusjonellSektorkode?: {
    kode: string;
    beskrivelse: string;
  };
  konkurs?: boolean;
  underAvvikling?: boolean;
  underTvangsavviklingEllerTvangsopplosning?: boolean;
}

// ── Vår forenklede type ──

export interface Selskapsinfo {
  orgNr: string;
  navn: string;
  selskapstype: string;
  mvaRegistrert: boolean;
  harAnsatte: boolean;
  adresse: string | null;
  næringskode: string | null;
  næringsbeskrivelse: string | null;
  stiftelsesdato: string | null;
  aktiv: boolean; // false hvis konkurs, under avvikling, etc.
}

// ── API-feil ──

export class BrregError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "BrregError";
  }
}

/**
 * Hent selskapsdata fra Brønnøysundregistrene basert på organisasjonsnummer.
 *
 * @param orgNr - 9-sifret organisasjonsnummer
 * @returns Selskapsinfo eller kaster BrregError
 */
export async function hentSelskap(orgNr: string): Promise<Selskapsinfo> {
  // Valider format: 9 siffer
  const cleaned = orgNr.replace(/\s/g, "");
  if (!/^\d{9}$/.test(cleaned)) {
    throw new BrregError("Ugyldig organisasjonsnummer. Må være 9 siffer.", 400);
  }

  const response = await fetch(`${BRREG_BASE_URL}/${cleaned}`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (response.status === 404) {
    throw new BrregError(
      `Fant ingen enhet med organisasjonsnummer ${cleaned}`,
      404
    );
  }

  if (!response.ok) {
    throw new BrregError(
      `Feil ved oppslag i Brønnøysundregistrene: ${response.statusText}`,
      response.status
    );
  }

  const data: BrregEnhet = await response.json();

  // Bygg forenklet adressestreng
  const adresse = data.forretningsadresse
    ? [
        ...(data.forretningsadresse.adresse || []),
        `${data.forretningsadresse.postnummer} ${data.forretningsadresse.poststed}`,
      ].join(", ")
    : null;

  return {
    orgNr: data.organisasjonsnummer,
    navn: data.navn,
    selskapstype: data.organisasjonsform.kode,
    mvaRegistrert: data.registrertIMvaregisteret ?? false,
    harAnsatte: (data.antallAnsatte ?? 0) > 0,
    adresse,
    næringskode: data.naeringskode1?.kode ?? null,
    næringsbeskrivelse: data.naeringskode1?.beskrivelse ?? null,
    stiftelsesdato: data.stiftelsesdato ?? null,
    aktiv:
      !data.konkurs &&
      !data.underAvvikling &&
      !data.underTvangsavviklingEllerTvangsopplosning,
  };
}

/**
 * Søk etter selskaper i Brønnøysundregistrene.
 *
 * Støtter søk på selskapsnavn eller organisasjonsnummer.
 * Returnerer opptil 10 treff.
 *
 * @param query - Selskapsnavn eller orgnr (minst 2 tegn)
 * @returns Liste med forenklede søketreff
 */
export async function soekSelskap(
  query: string
): Promise<SoeketreffSelskap[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  // Sjekk om det ligner et orgnr (bare siffer etter å ha fjernet mellomrom)
  const cleaned = trimmed.replace(/\s/g, "");
  const erOrgnr = /^\d+$/.test(cleaned);

  const params = new URLSearchParams({
    size: "10",
  });

  if (erOrgnr) {
    params.set("organisasjonsnummer", cleaned);
  } else {
    params.set("navn", trimmed);
  }

  const response = await fetch(`${BRREG_BASE_URL}?${params}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new BrregError(
      `Feil ved søk i Brønnøysundregistrene: ${response.statusText}`,
      response.status
    );
  }

  const data: BrregSoekerespons = await response.json();

  if (!data._embedded?.enheter) return [];

  return data._embedded.enheter.map((enhet) => ({
    orgNr: enhet.organisasjonsnummer,
    navn: enhet.navn,
    selskapstype: enhet.organisasjonsform.kode,
    poststed: enhet.forretningsadresse?.poststed ?? null,
  }));
}
