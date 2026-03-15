/**
 * E-postmaler for alle varseltyper.
 *
 * Hver mal returnerer { subject, html, text } som kan sendes via sendEmail().
 * Alle maler følger samme design: enkel, handlingsrettet, med én CTA-knapp.
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://regnskapsbruker.no";

function ctaButton(text: string, url: string): string {
  return `
    <p style="margin: 32px 0;">
      <a href="${url}"
         style="background-color: #18181b; color: white; padding: 12px 24px;
                text-decoration: none; border-radius: 6px; font-weight: 500;">
        ${text}
      </a>
    </p>
  `;
}

function wrap(content: string): string {
  return `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">${content}</div>`;
}

// ── Til kunden ──

/** Invitasjon til Regnskapsbruker */
export function invitasjon(params: {
  kundeNavn: string;
  firmanavn: string;
  selskapNavn: string;
  invitasjonsUrl: string;
}) {
  const subject = `${params.firmanavn} inviterer deg til Regnskapsbruker`;
  const html = wrap(`
    <h2>Hei ${params.kundeNavn},</h2>
    <p>
      ${params.firmanavn} har satt opp <strong>${params.selskapNavn}</strong>
      i Regnskapsbruker, og inviterer deg til å logge inn.
    </p>
    <p>
      Regnskapsbruker gir deg oversikt over hva regnskapsfører trenger fra deg,
      og lar deg laste opp dokumenter og følge med på fremdriften.
    </p>
    ${ctaButton("Logg inn i Regnskapsbruker", params.invitasjonsUrl)}
    <p style="color: #71717a; font-size: 14px;">
      Lenken er gyldig i 7 dager.
    </p>
  `);
  const text = `Hei ${params.kundeNavn},\n\n${params.firmanavn} har satt opp ${params.selskapNavn} i Regnskapsbruker.\n\nLogg inn her: ${params.invitasjonsUrl}\n\nLenken er gyldig i 7 dager.`;

  return { subject, html, text };
}

/** Ny syklus er opprettet */
export function nySyklus(params: {
  kundeNavn: string;
  selskapNavn: string;
  år: number;
}) {
  const subject = `Regnskap ${params.år} er klar for ${params.selskapNavn}`;
  const url = `${BASE_URL}/dashboard`;
  const html = wrap(`
    <h2>Hei ${params.kundeNavn},</h2>
    <p>
      Regnskap <strong>${params.år}</strong> for ${params.selskapNavn} er klar.
      Logg inn for å se hva vi trenger fra deg.
    </p>
    ${ctaButton("Se oppgavene dine", url)}
  `);
  const text = `Hei ${params.kundeNavn},\n\nRegnskap ${params.år} for ${params.selskapNavn} er klar. Logg inn for å se hva vi trenger fra deg.\n\n${url}`;

  return { subject, html, text };
}

/** Påminnelse om uleverte oppgaver */
export function paaminnelse(params: {
  kundeNavn: string;
  selskapNavn: string;
  antallUleverte: number;
}) {
  const n = params.antallUleverte;
  const subject = `Påminnelse: ${n} oppgave${n > 1 ? "r" : ""} venter for ${params.selskapNavn}`;
  const url = `${BASE_URL}/dashboard`;
  const html = wrap(`
    <h2>Hei ${params.kundeNavn},</h2>
    <p>
      Du har <strong>${n} oppgave${n > 1 ? "r" : ""}</strong>
      som venter for ${params.selskapNavn}.
    </p>
    ${ctaButton("Se oppgavene", url)}
  `);
  const text = `Hei ${params.kundeNavn},\n\nDu har ${n} oppgave${n > 1 ? "r" : ""} som venter for ${params.selskapNavn}.\n\n${url}`;

  return { subject, html, text };
}

/** Frist nærmer seg */
export function fristVarsel(params: {
  kundeNavn: string;
  selskapNavn: string;
  oppgaveTittel: string;
  dagerIgjen: number;
}) {
  const subject = `Frist for "${params.oppgaveTittel}" er om ${params.dagerIgjen} dager`;
  const url = `${BASE_URL}/dashboard`;
  const html = wrap(`
    <h2>Hei ${params.kundeNavn},</h2>
    <p>
      Fristen for <strong>${params.oppgaveTittel}</strong> for ${params.selskapNavn}
      er om <strong>${params.dagerIgjen} dager</strong>.
    </p>
    ${ctaButton("Se oppgaven", url)}
  `);
  const text = `Hei ${params.kundeNavn},\n\nFristen for "${params.oppgaveTittel}" for ${params.selskapNavn} er om ${params.dagerIgjen} dager.\n\n${url}`;

  return { subject, html, text };
}

/** Godkjenning er klar (RF har sendt til godkjenning) */
export function godkjenningKlar(params: {
  kundeNavn: string;
  selskapNavn: string;
  rfMelding?: string;
}) {
  const subject = `Årsregnskapet for ${params.selskapNavn} er klart for gjennomgang`;
  const url = `${BASE_URL}/dashboard`;
  const html = wrap(`
    <h2>Hei ${params.kundeNavn},</h2>
    <p>
      Årsregnskapet for <strong>${params.selskapNavn}</strong> er klart for gjennomgang og godkjenning.
    </p>
    ${params.rfMelding ? `<p style="background: #f4f4f5; padding: 12px 16px; border-radius: 6px; font-style: italic;">"${params.rfMelding}"</p>` : ""}
    ${ctaButton("Se og godkjenn", url)}
  `);
  const text = `Hei ${params.kundeNavn},\n\nÅrsregnskapet for ${params.selskapNavn} er klart for gjennomgang.\n\n${params.rfMelding ? `Melding fra regnskapsfører: "${params.rfMelding}"\n\n` : ""}${url}`;

  return { subject, html, text };
}

/** RF har kommentar / trenger mer */
export function trengerMer(params: {
  kundeNavn: string;
  selskapNavn: string;
  oppgaveTittel: string;
  kommentar?: string;
}) {
  const subject = `Regnskapsføreren din har en kommentar til "${params.oppgaveTittel}"`;
  const url = `${BASE_URL}/dashboard`;
  const html = wrap(`
    <h2>Hei ${params.kundeNavn},</h2>
    <p>
      Regnskapsføreren din har sett på <strong>${params.oppgaveTittel}</strong>
      for ${params.selskapNavn} og trenger mer informasjon fra deg.
    </p>
    ${params.kommentar ? `<p style="background: #fef3c7; padding: 12px 16px; border-radius: 6px;">"${params.kommentar}"</p>` : ""}
    ${ctaButton("Se oppgaven", url)}
  `);
  const text = `Hei ${params.kundeNavn},\n\nRegnskapsføreren din trenger mer informasjon om "${params.oppgaveTittel}" for ${params.selskapNavn}.${params.kommentar ? `\n\nKommentar: "${params.kommentar}"` : ""}\n\n${url}`;

  return { subject, html, text };
}

// ── Til RF ──

/** Kunde har levert et dokument */
export function dokumentLevert(params: {
  rfNavn: string;
  selskapNavn: string;
  oppgaveTittel: string;
  companyId: string;
}) {
  const subject = `${params.selskapNavn} har levert "${params.oppgaveTittel}"`;
  const url = `${BASE_URL}/kunde/${params.companyId}`;
  const html = wrap(`
    <h2>Hei ${params.rfNavn},</h2>
    <p>
      <strong>${params.selskapNavn}</strong> har markert
      <strong>${params.oppgaveTittel}</strong> som levert.
    </p>
    ${ctaButton("Se leveransen", url)}
  `);
  const text = `Hei ${params.rfNavn},\n\n${params.selskapNavn} har levert "${params.oppgaveTittel}".\n\n${url}`;

  return { subject, html, text };
}

/** Alle oppgaver er levert for et selskap */
export function alleLevert(params: {
  rfNavn: string;
  selskapNavn: string;
  companyId: string;
}) {
  const subject = `${params.selskapNavn} har levert alt – klar for årsoppgjør`;
  const url = `${BASE_URL}/kunde/${params.companyId}`;
  const html = wrap(`
    <h2>Hei ${params.rfNavn},</h2>
    <p>
      <strong>${params.selskapNavn}</strong> har levert alle oppgaver og er klar for årsoppgjør.
    </p>
    ${ctaButton("Se kundedetaljene", url)}
  `);
  const text = `Hei ${params.rfNavn},\n\n${params.selskapNavn} har levert alt og er klar for årsoppgjør.\n\n${url}`;

  return { subject, html, text };
}

/** Kunde har godkjent årsregnskap/protokoll */
export function godkjenningGitt(params: {
  rfNavn: string;
  selskapNavn: string;
  oppgaveTittel: string;
  companyId: string;
}) {
  const subject = `${params.selskapNavn} har godkjent "${params.oppgaveTittel}"`;
  const url = `${BASE_URL}/kunde/${params.companyId}`;
  const html = wrap(`
    <h2>Hei ${params.rfNavn},</h2>
    <p>
      <strong>${params.selskapNavn}</strong> har godkjent
      <strong>${params.oppgaveTittel}</strong>.
    </p>
    ${ctaButton("Se godkjenningen", url)}
  `);
  const text = `Hei ${params.rfNavn},\n\n${params.selskapNavn} har godkjent "${params.oppgaveTittel}".\n\n${url}`;

  return { subject, html, text };
}

/** Kunde har et spørsmål */
export function kundeHarSpoersmaal(params: {
  rfNavn: string;
  selskapNavn: string;
  kundeNavn: string;
  oppgaveTittel: string;
  melding: string;
  companyId: string;
}) {
  const subject = `${params.selskapNavn} har et spørsmål om "${params.oppgaveTittel}"`;
  const url = `${BASE_URL}/kunde/${params.companyId}`;
  const html = wrap(`
    <h2>Hei ${params.rfNavn},</h2>
    <p>
      <strong>${params.kundeNavn}</strong> fra ${params.selskapNavn} har et spørsmål om
      <strong>${params.oppgaveTittel}</strong>:
    </p>
    <p style="background: #f4f4f5; padding: 12px 16px; border-radius: 6px; font-style: italic;">
      "${params.melding}"
    </p>
    ${ctaButton("Se kundedetaljene", url)}
  `);
  const text = `Hei ${params.rfNavn},\n\n${params.kundeNavn} fra ${params.selskapNavn} har et spørsmål om "${params.oppgaveTittel}":\n\n"${params.melding}"\n\n${url}`;

  return { subject, html, text };
}
