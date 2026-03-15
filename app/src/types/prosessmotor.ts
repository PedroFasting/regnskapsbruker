/**
 * Type-definisjoner for prosessmotoren (regelmotor).
 *
 * Disse typene speiler strukturen i YAML-regelfilene (rules/*.yaml)
 * og brukes av parseren og syklusgeneratoren.
 */

// ── Selskapsattributter (input til regelmatching) ──

export type Selskapstype = "AS" | "ENK" | "NUF";
export type Prosessmodell = "aarsbasert" | "loepende";

export interface Selskapsattributter {
  selskapstype: Selskapstype;
  mva_registrert: boolean;
  har_ansatte: boolean;
  prosessmodell: Prosessmodell;
}

// ── Oppgavetyper ──

export type OppgaveType =
  | "dokument_opplasting"
  | "bekreftelse"
  | "godkjenning"
  | "signering";

export type OppgaveStatus =
  | "ikke_startet"
  | "levert"
  | "godkjent"
  | "trenger_mer";

// ── Regel-YAML-struktur ──

export interface RegelOppgave {
  id: string;
  tittel: string;
  beskrivelse: string;
  hjelpetekst?: string;
  type: OppgaveType;
  rekkefølge: number;
  paakrevd: boolean;
  frist_relativ: string; // "MM-DD" date or "naar_rf_ferdig"
}

export interface RegelKrav {
  selskapstype: Selskapstype;
  mva_registrert: boolean;
  har_ansatte: boolean;
  prosessmodell: Prosessmodell;
}

export interface RegelFrister {
  skattemelding: string; // "MM-DD"
  generalforsamling: string;
  aarsregnskap: string;
}

export interface Regelkonfigurasjon {
  id: string;
  navn: string;
  beskrivelse: string;
  krav: RegelKrav;
  frister: RegelFrister;
  oppgaver: RegelOppgave[];
}

// ── Genererte oppgaver (output fra prosessmotoren) ──

export interface GenererOppgave {
  regelOppgaveId: string;
  tittel: string;
  beskrivelse: string;
  hjelpetekst: string | null;
  type: OppgaveType;
  sortOrder: number;
  required: boolean;
  deadlineRelative: string;
}

export interface GenererSyklus {
  year: number;
  oppgaver: GenererOppgave[];
}
