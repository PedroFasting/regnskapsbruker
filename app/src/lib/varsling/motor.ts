/**
 * Varslingsmotor – Kjernelogikk
 *
 * - Lagrer varsel i notifications-tabellen
 * - Sender e-post via Resend
 * - Rate limiting: maks 1 e-post per (recipient + company) per time til RF
 *
 * Alle varsler kjøres "fire-and-forget" – feil i e-postsending
 * skal aldri blokkere API-responsen.
 */

import { db } from "@/lib/db";
import { notifications, users, contacts, companies, accountants, cycles, tasks } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { sendEmail } from "@/lib/email";
import * as maler from "./maler";

// ── Hjelpefunksjoner for å slå opp kontekst ──

/** Finn kontaktperson (kunde) for et selskap */
async function finnKundeKontakt(companyId: string) {
  const [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.companyId, companyId))
    .limit(1);
  return contact;
}

/** Finn RF-bruker for et selskap */
async function finnRfBruker(companyId: string) {
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!company) return null;

  const [accountant] = await db
    .select()
    .from(accountants)
    .where(eq(accountants.id, company.accountantId))
    .limit(1);
  if (!accountant) return null;

  const [rfUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, accountant.userId))
    .limit(1);
  if (!rfUser) return null;

  return { user: rfUser, accountant, company };
}

/** Finn oppgave med selskapsinfo via syklus */
async function finnOppgaveKontekst(taskId: string) {
  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);
  if (!task) return null;

  const [cycle] = await db
    .select()
    .from(cycles)
    .where(eq(cycles.id, task.cycleId))
    .limit(1);
  if (!cycle) return null;

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, cycle.companyId))
    .limit(1);
  if (!company) return null;

  return { task, cycle, company };
}

// ── Rate limiting ──

/**
 * Sjekk om vi kan sende varsel til mottaker for dette selskapet.
 * RF mottar maks 1 e-post per selskap per time.
 * Kunder har ingen rate limiting (varsler er sjeldne og viktige).
 */
async function kanSendeTilRf(
  recipientUserId: string,
  companyId: string
): Promise<boolean> {
  const enTimesSiden = new Date(Date.now() - 60 * 60 * 1000);

  const [recent] = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientUserId, recipientUserId),
        eq(notifications.companyId, companyId),
        gt(notifications.sentAt, enTimesSiden)
      )
    )
    .limit(1);

  return !recent;
}

// ── Intern send-funksjon ──

async function sendVarsel(params: {
  recipientUserId: string;
  recipientEmail: string;
  type: string;
  companyId: string;
  content: string;
  relatedTaskId?: string;
  epost: { subject: string; html: string; text?: string };
  rateLimitRf?: boolean;
}) {
  try {
    // Rate limit-sjekk for RF-varsler
    if (params.rateLimitRf) {
      const kanSende = await kanSendeTilRf(
        params.recipientUserId,
        params.companyId
      );
      if (!kanSende) {
        // Lagre i DB men ikke send e-post
        await db.insert(notifications).values({
          recipientUserId: params.recipientUserId,
          recipientEmail: params.recipientEmail,
          type: params.type,
          companyId: params.companyId,
          content: params.content,
          channel: "epost",
          relatedTaskId: params.relatedTaskId ?? null,
          // sentAt forblir null – e-post ble ikke sendt pga rate limiting
        });
        return;
      }
    }

    // Send e-post
    await sendEmail({
      to: params.recipientEmail,
      subject: params.epost.subject,
      html: params.epost.html,
      text: params.epost.text,
    });

    // Lagre i DB med sentAt satt
    await db.insert(notifications).values({
      recipientUserId: params.recipientUserId,
      recipientEmail: params.recipientEmail,
      type: params.type,
      companyId: params.companyId,
      content: params.content,
      sentAt: new Date(),
      channel: "epost",
      relatedTaskId: params.relatedTaskId ?? null,
    });
  } catch (err) {
    // Fire-and-forget: logg feil men ikke kast videre
    console.error(`[varsling] Feil ved sending av ${params.type}:`, err);
  }
}

// ── Offentlige hendelsesbaserte funksjoner ──

/**
 * Kunde har levert en oppgave → varsle RF
 */
export async function varsleOmLevering(taskId: string) {
  const ctx = await finnOppgaveKontekst(taskId);
  if (!ctx) return;

  const rf = await finnRfBruker(ctx.company.id);
  if (!rf) return;

  // Sjekk om alle oppgaver nå er levert
  const alleTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.cycleId, ctx.cycle.id));

  const alleLevertEllerGodkjent = alleTasks.every(
    (t) => t.status === "levert" || t.status === "godkjent"
  );

  if (alleLevertEllerGodkjent) {
    // Send "alle levert" i stedet
    const epost = maler.alleLevert({
      rfNavn: rf.user.name,
      selskapNavn: ctx.company.name,
      companyId: ctx.company.id,
    });

    await sendVarsel({
      recipientUserId: rf.user.id,
      recipientEmail: rf.user.email,
      type: "alle_levert",
      companyId: ctx.company.id,
      content: `${ctx.company.name} har levert alle oppgaver.`,
      epost,
      rateLimitRf: true,
    });
  } else {
    const epost = maler.dokumentLevert({
      rfNavn: rf.user.name,
      selskapNavn: ctx.company.name,
      oppgaveTittel: ctx.task.title,
      companyId: ctx.company.id,
    });

    await sendVarsel({
      recipientUserId: rf.user.id,
      recipientEmail: rf.user.email,
      type: "dokument_levert",
      companyId: ctx.company.id,
      content: `${ctx.company.name} har levert "${ctx.task.title}".`,
      relatedTaskId: taskId,
      epost,
      rateLimitRf: true,
    });
  }
}

/**
 * RF har markert "trenger mer" → varsle kunde
 */
export async function varsleOmTrengerMer(
  taskId: string,
  kommentar?: string
) {
  const ctx = await finnOppgaveKontekst(taskId);
  if (!ctx) return;

  const kontakt = await finnKundeKontakt(ctx.company.id);
  if (!kontakt) return;

  const epost = maler.trengerMer({
    kundeNavn: kontakt.name,
    selskapNavn: ctx.company.name,
    oppgaveTittel: ctx.task.title,
    kommentar,
  });

  await sendVarsel({
    recipientUserId: kontakt.userId ?? kontakt.id,
    recipientEmail: kontakt.email,
    type: "trenger_mer",
    companyId: ctx.company.id,
    content: `Regnskapsfører trenger mer info om "${ctx.task.title}".`,
    relatedTaskId: taskId,
    epost,
  });
}

/**
 * RF sender selskap til godkjenning → varsle kunde
 */
export async function varsleOmGodkjenningKlar(
  companyId: string,
  melding?: string
) {
  const kontakt = await finnKundeKontakt(companyId);
  if (!kontakt) return;

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!company) return;

  const epost = maler.godkjenningKlar({
    kundeNavn: kontakt.name,
    selskapNavn: company.name,
    rfMelding: melding ?? undefined,
  });

  await sendVarsel({
    recipientUserId: kontakt.userId ?? kontakt.id,
    recipientEmail: kontakt.email,
    type: "godkjenning_klar",
    companyId,
    content: `Årsregnskapet for ${company.name} er klart for godkjenning.`,
    epost,
  });
}

/**
 * Kunde har godkjent en oppgave → varsle RF
 */
export async function varsleOmGodkjenning(taskId: string) {
  const ctx = await finnOppgaveKontekst(taskId);
  if (!ctx) return;

  const rf = await finnRfBruker(ctx.company.id);
  if (!rf) return;

  const epost = maler.godkjenningGitt({
    rfNavn: rf.user.name,
    selskapNavn: ctx.company.name,
    oppgaveTittel: ctx.task.title,
    companyId: ctx.company.id,
  });

  await sendVarsel({
    recipientUserId: rf.user.id,
    recipientEmail: rf.user.email,
    type: "godkjenning_gitt",
    companyId: ctx.company.id,
    content: `${ctx.company.name} har godkjent "${ctx.task.title}".`,
    relatedTaskId: taskId,
    epost,
    rateLimitRf: true,
  });
}

/**
 * Kunde har spørsmål om en oppgave → varsle RF
 * (Denne lagres allerede i question API, men her sender vi også e-post)
 */
export async function varsleOmSpoersmaal(
  taskId: string,
  kundeNavn: string,
  melding: string
) {
  const ctx = await finnOppgaveKontekst(taskId);
  if (!ctx) return;

  const rf = await finnRfBruker(ctx.company.id);
  if (!rf) return;

  const epost = maler.kundeHarSpoersmaal({
    rfNavn: rf.user.name,
    selskapNavn: ctx.company.name,
    kundeNavn,
    oppgaveTittel: ctx.task.title,
    melding,
    companyId: ctx.company.id,
  });

  await sendVarsel({
    recipientUserId: rf.user.id,
    recipientEmail: rf.user.email,
    type: "kunde_har_spoersmaal",
    companyId: ctx.company.id,
    content: `Spørsmål fra ${kundeNavn} om "${ctx.task.title}": ${melding}`,
    relatedTaskId: taskId,
    epost,
    rateLimitRf: true,
  });
}
