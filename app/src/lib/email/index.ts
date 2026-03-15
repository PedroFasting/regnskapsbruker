/**
 * E-postmodul – Resend-integrasjon
 *
 * Brukes for å sende transaksjonelle e-poster:
 * - Invitasjoner til kunder
 * - Påminnelser om oppgaver
 * - Varsler ved hendelser (dokument levert, godkjenning klar, etc.)
 *
 * Lazy-initialisert slik at build ikke krasjer uten RESEND_API_KEY.
 * Uten RESEND_API_KEY logges e-poster til konsollen (dev-modus).
 */

import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const DEFAULT_FROM =
  process.env.EMAIL_FROM ?? "Regnskapsbruker <noreply@regnskapsbruker.no>";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send én e-post via Resend.
 * Uten RESEND_API_KEY logges e-posten til konsollen i stedet.
 */
export async function sendEmail({ to, subject, html, text }: SendEmailParams) {
  const resend = getResend();

  if (!resend) {
    console.log("\n📧 [DEV E-POST] ─────────────────────────────────");
    console.log(`  Til:    ${to}`);
    console.log(`  Fra:    ${DEFAULT_FROM}`);
    console.log(`  Emne:   ${subject}`);
    if (text) {
      console.log(`  Tekst:  ${text}`);
    }
    console.log("──────────────────────────────────────────────────\n");
    return { data: { id: `dev-${Date.now()}` }, error: null };
  }

  const result = await resend.emails.send({
    from: DEFAULT_FROM,
    to,
    subject,
    html,
    text,
  });

  return result;
}
