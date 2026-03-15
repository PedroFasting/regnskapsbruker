/**
 * Prosessmotor – Syklusgenerator
 *
 * Tar en regelkonfigurasjon og et regnskapsår og genererer
 * en komplett liste med oppgaver klar for databaseinnsetting.
 */

import type {
  Regelkonfigurasjon,
  Selskapsattributter,
  GenererSyklus,
  GenererOppgave,
} from "@/types/prosessmotor";
import { finnMatchendeRegel } from "./regler";

/**
 * Generer en syklus med oppgaver basert på regelkonfigurasjon.
 *
 * Tar en regel og et år og returnerer en GenererSyklus med alle
 * oppgavene ferdig utfylt og klare for innsetting i databasen.
 */
export function genererSyklusFraRegel(
  regel: Regelkonfigurasjon,
  year: number
): GenererSyklus {
  const oppgaver: GenererOppgave[] = regel.oppgaver.map((oppgave) => ({
    regelOppgaveId: oppgave.id,
    tittel: oppgave.tittel,
    beskrivelse: oppgave.beskrivelse,
    hjelpetekst: oppgave.hjelpetekst ?? null,
    type: oppgave.type,
    sortOrder: oppgave.rekkefølge,
    required: oppgave.paakrevd,
    deadlineRelative: oppgave.frist_relativ,
  }));

  return { year, oppgaver };
}

/**
 * Generer en syklus basert på selskapsattributter.
 *
 * Dette er hovedfunksjonen som brukes av applikasjonen:
 * gitt et selskaps attributter og et regnskapsår, finn riktig
 * regel og generer alle oppgaver.
 *
 * Returnerer null hvis ingen regel matcher selskapets attributter.
 */
export function genererSyklus(
  attributter: Selskapsattributter,
  year: number
): GenererSyklus | null {
  const regel = finnMatchendeRegel(attributter);
  if (!regel) {
    return null;
  }
  return genererSyklusFraRegel(regel, year);
}
