/**
 * Seed-skript for lokal utvikling.
 *
 * Kjør: npm run db:seed
 *
 * Oppretter:
 * - 1 RF-bruker (pedro@test.no / passord123)
 * - 1 kunde-bruker (kunde@test.no / passord123)
 * - 1 accountant-profil
 * - 1 testselskap (Pedro Verksted AS, orgnr 999888777)
 * - 1 kontaktperson koblet til selskapet og kundebrukeren
 * - 1 aktiv syklus (regnskapsår 2025) med 7 oppgaver fra enkelt-as-regelen
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hash } from "bcryptjs";
import * as schema from "./schema";
import { NS4102_KONTOPLAN } from "./kontoplan";

const {
  users,
  accountants,
  companies,
  contacts,
  cycles,
  tasks,
  accounts,
} = schema;

async function seed() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL er ikke satt. Opprett .env først.");
    process.exit(1);
  }

  const client = postgres(url);
  const db = drizzle(client, { schema });

  console.log("Seeding database...\n");

  // ── 1. RF-bruker ──
  const rfPasswordHash = await hash("passord123", 12);
  const [rfUser] = await db
    .insert(users)
    .values({
      name: "Pedro Regnskapsfører",
      email: "pedro@test.no",
      passwordHash: rfPasswordHash,
      role: "rf",
    })
    .onConflictDoNothing({ target: users.email })
    .returning();

  if (!rfUser) {
    console.log("RF-bruker finnes allerede (pedro@test.no). Avbryter seed.");
    await client.end();
    return;
  }

  console.log(`  ✓ RF-bruker: ${rfUser.email} (passord: passord123)`);

  // ── 2. Accountant-profil ──
  const [accountant] = await db
    .insert(accountants)
    .values({
      userId: rfUser.id,
      firmName: "Pedro Regnskap AS",
    })
    .returning();

  console.log(`  ✓ Accountant: ${accountant.firmName}`);

  // ── 3. Kunde-bruker ──
  const kundePasswordHash = await hash("passord123", 12);
  const [kundeUser] = await db
    .insert(users)
    .values({
      name: "Kari Kunde",
      email: "kunde@test.no",
      passwordHash: kundePasswordHash,
      role: "kunde",
    })
    .returning();

  console.log(`  ✓ Kunde-bruker: ${kundeUser.email} (passord: passord123)`);

  // ── 4. Testselskap ──
  const [company] = await db
    .insert(companies)
    .values({
      orgNr: "999888777",
      name: "Pedro Verksted AS",
      companyType: "AS",
      vatRegistered: false,
      hasEmployees: false,
      processModel: "aarsbasert",
      address: "Testveien 1, 0123 Oslo",
      industryCode: "62.010",
      foundedDate: "2020-01-15",
      accountantId: accountant.id,
    })
    .returning();

  console.log(`  ✓ Selskap: ${company.name} (${company.orgNr})`);

  // ── 5. Kontaktperson ──
  const [contact] = await db
    .insert(contacts)
    .values({
      companyId: company.id,
      userId: kundeUser.id,
      name: "Kari Kunde",
      email: "kunde@test.no",
      role: "daglig_leder",
    })
    .returning();

  console.log(`  ✓ Kontakt: ${contact.name} (${contact.role})`);

  // ── 6. Syklus (regnskapsår 2025) ──
  const [cycle] = await db
    .insert(cycles)
    .values({
      companyId: company.id,
      year: 2025,
      status: "aktiv",
    })
    .returning();

  console.log(`  ✓ Syklus: Regnskapsår ${cycle.year}`);

  // ── 7. Oppgaver (fra enkelt-as-regelen) ──
  const oppgaver = [
    {
      title: "Last opp åpningsbalanse",
      description: "Balanse per 31.12 forrige år (eller stiftelsesdato for nye selskaper)",
      helpText: "Åpningsbalansen er utgangspunktet for regnskapet ditt — den forteller oss hva selskapet eide (eiendeler), skyldte (gjeld) og hadde i egenkapital ved starten av regnskapsåret. Uten denne kan vi ikke begynne å føre årets regnskap. Har selskapet hatt regnskapsfører tidligere? Be om årsregnskapet eller saldobalanse per 31.12 fra forrige regnskapsfører. For nylig stiftede selskaper holder det med dokumentasjon på innbetalt aksjekapital (f.eks. kvittering fra banken). Last opp som PDF.",
      type: "dokument_opplasting" as const,
      sortOrder: 1,
      required: true,
      deadlineRelative: "01-31",
    },
    {
      title: "Last opp bilag",
      description: "Alle kvitteringer og fakturaer (inn og ut) for regnskapsåret",
      helpText: "Last opp alle kvitteringer og fakturaer du har mottatt eller sendt i løpet av året. Dette inkluderer innkjøpsfakturaer, salgsfakturaer, kvitteringer for utlegg, og eventuelle kreditnotaer. Det er bedre å laste opp for mye enn for lite - regnskapsfører sorterer og bokfører.",
      type: "dokument_opplasting" as const,
      sortOrder: 2,
      required: true,
      deadlineRelative: "02-28",
    },
    {
      title: "Last opp bankutskrifter",
      description: "Komplett bankutskrift for alle konti, hele året",
      helpText: "Last ned og last opp bankutskrift for alle bedriftens bankkonti for hele regnskapsåret (1. januar - 31. desember). De fleste banker lar deg eksportere dette som PDF fra nettbanken. Husk alle konti - driftskonto, skattetrekkskonto, sparekonto osv.",
      type: "dokument_opplasting" as const,
      sortOrder: 3,
      required: true,
      deadlineRelative: "02-28",
    },
    {
      title: "Bekreft kontoutskrift 31.12",
      description: "Bankbalanse per årsslutt for avstemming",
      helpText: "Vi trenger saldo på alle bankkonti per 31. desember for å avstemme regnskapet. Du kan laste opp et skjermbilde av saldo fra nettbanken, eller eksportere en kontoutskrift som viser saldo per 31.12.",
      type: "dokument_opplasting" as const,
      sortOrder: 4,
      required: true,
      deadlineRelative: "01-31",
    },
    {
      title: "Last opp låneavtaler",
      description: "Gjeldende låneavtaler med saldo",
      helpText: "Har selskapet lån, leasing eller andre gjeldsforhold? Last opp låneavtaler og årsoppgave fra banken som viser gjenstående saldo per 31. desember. Gjelder også lån fra aksjonærer til selskapet eller omvendt. Hvis selskapet ikke har lån, kan du bekrefte dette i stedet.",
      type: "dokument_opplasting" as const,
      sortOrder: 5,
      required: false,
      deadlineRelative: "02-28",
    },
    {
      title: "Bekreft selskapsinformasjon",
      description: "Aksjonærer, styre, vedtekter - stemmer dette fortsatt?",
      helpText: "Bekreft at informasjonen vi har om selskapet fortsatt stemmer. Har det vært endringer i aksjonærer, styresammensetning eller vedtekter i løpet av året? Har selskapet endret adresse eller kontaktinformasjon? Har det vært kapitalendringer (emisjon, splitt, spleis)?",
      type: "bekreftelse" as const,
      sortOrder: 6,
      required: true,
      deadlineRelative: "01-31",
    },
    {
      title: "Godkjenn årsregnskap",
      description: "Gjennomgå og godkjenn resultat, balanse og noter",
      helpText: "Regnskapsfører har utarbeidet årsregnskapet. Gjennomgå resultatregnskap, balanse og noter. Har du spørsmål, kan du stille dem direkte herfra. Når du er fornøyd, godkjenner du årsregnskapet.",
      type: "godkjenning" as const,
      sortOrder: 7,
      required: true,
      deadlineRelative: "naar_rf_ferdig",
    },
    {
      title: "Signer generalforsamlingsprotokoll",
      description: "Digital signering av protokoll",
      helpText: "Generalforsamlingsprotokollen dokumenterer at årsregnskapet er godkjent. Gjennomgå protokollen og signer digitalt. Fristen for å avholde ordinær generalforsamling er 30. juni.",
      type: "godkjenning" as const,
      sortOrder: 8,
      required: true,
      deadlineRelative: "06-30",
    },
  ];

  for (const oppgave of oppgaver) {
    await db.insert(tasks).values({
      cycleId: cycle.id,
      ...oppgave,
      status: "ikke_startet",
    });
  }

  console.log(`  ✓ ${oppgaver.length} oppgaver opprettet`);

  // ── 8. Kontoplan — NS 4102 (relevant subset for enkel AS uten MVA/ansatte) ──
  for (const konto of NS4102_KONTOPLAN) {
    await db.insert(accounts).values({
      companyId: company.id,
      ...konto,
    });
  }

  console.log(`  ✓ ${NS4102_KONTOPLAN.length} kontoer opprettet (NS 4102)`);

  console.log("\nSeeding ferdig!\n");
  console.log("Innlogging:");
  console.log("  RF:    pedro@test.no / passord123");
  console.log("  Kunde: kunde@test.no / passord123");

  await client.end();
}

seed().catch((err) => {
  console.error("Seed feilet:", err);
  process.exit(1);
});
