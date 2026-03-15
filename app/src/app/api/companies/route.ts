/**
 * API: POST /api/companies
 *
 * Opprett et nytt selskap (kun for RF-brukere).
 * 1. Validerer at bruker er RF
 * 2. Henter selskapsdata fra Brønnøysund
 * 3. Lagrer selskapet i databasen
 * 4. Genererer syklus med oppgaver via prosessmotoren
 * 5. Returnerer selskapet
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { companies, contacts, cycles, tasks, accountants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hentSelskap, BrregError } from "@/lib/brreg";
import { genererSyklus } from "@/lib/prosessmotor";
import { opprettKontoplan } from "@/lib/db/kontoplan";
import type { Selskapsattributter } from "@/types/prosessmotor";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user || session.user.role !== "rf") {
    return NextResponse.json(
      { error: "Kun regnskapsførere kan opprette selskaper" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { orgNr, kontaktNavn, kontaktEpost, kontaktRolle } = body;

  if (!orgNr) {
    return NextResponse.json(
      { error: "Organisasjonsnummer er påkrevd" },
      { status: 400 }
    );
  }

  // 1. Hent selskapsdata fra Brønnøysund
  let selskapsinfo;
  try {
    selskapsinfo = await hentSelskap(orgNr);
  } catch (err) {
    if (err instanceof BrregError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode }
      );
    }
    throw err;
  }

  if (!selskapsinfo.aktiv) {
    return NextResponse.json(
      { error: "Selskapet er under avvikling eller konkurs" },
      { status: 400 }
    );
  }

  // 2. Sjekk at selskapet ikke allerede er registrert
  const [existing] = await db
    .select()
    .from(companies)
    .where(eq(companies.orgNr, selskapsinfo.orgNr))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: "Selskapet er allerede registrert" },
      { status: 409 }
    );
  }

  // 3. Finn RF sin accountant-rad
  const [accountant] = await db
    .select()
    .from(accountants)
    .where(eq(accountants.userId, session.user.id))
    .limit(1);

  if (!accountant) {
    return NextResponse.json(
      { error: "Kunne ikke finne regnskapsførerprofilen din" },
      { status: 400 }
    );
  }

  // 4. Lagre selskapet
  const [company] = await db
    .insert(companies)
    .values({
      orgNr: selskapsinfo.orgNr,
      name: selskapsinfo.navn,
      companyType: selskapsinfo.selskapstype === "AS" ? "AS" : "AS", // MVP: kun AS
      vatRegistered: selskapsinfo.mvaRegistrert,
      hasEmployees: selskapsinfo.harAnsatte,
      processModel: "aarsbasert",
      address: selskapsinfo.adresse,
      industryCode: selskapsinfo.næringskode,
      foundedDate: selskapsinfo.stiftelsesdato,
      accountantId: accountant.id,
    })
    .returning();

  // 5. Lagre kontaktperson (hvis oppgitt)
  if (kontaktNavn && kontaktEpost) {
    await db.insert(contacts).values({
      companyId: company.id,
      name: kontaktNavn,
      email: kontaktEpost,
      role: kontaktRolle ?? "daglig_leder",
    });
  }

  // 6. Generer syklus via prosessmotoren
  const currentYear = new Date().getFullYear();
  // Regnskapsåret er forrige år (vi jobber med fjorårets regnskap)
  const regnskapsaar = currentYear - 1;

  const attributter: Selskapsattributter = {
    selskapstype: "AS",
    mva_registrert: selskapsinfo.mvaRegistrert,
    har_ansatte: selskapsinfo.harAnsatte,
    prosessmodell: "aarsbasert",
  };

  const syklus = genererSyklus(attributter, regnskapsaar);

  if (syklus) {
    const [cycle] = await db
      .insert(cycles)
      .values({
        companyId: company.id,
        year: syklus.year,
        status: "aktiv",
      })
      .returning();

    // Opprett alle oppgaver
    for (const oppgave of syklus.oppgaver) {
      await db.insert(tasks).values({
        cycleId: cycle.id,
        title: oppgave.tittel,
        description: oppgave.beskrivelse,
        helpText: oppgave.hjelpetekst,
        type: oppgave.type,
        sortOrder: oppgave.sortOrder,
        required: oppgave.required,
        status: "ikke_startet",
        deadlineRelative: oppgave.deadlineRelative,
      });
    }
  }

  // 7. Opprett NS 4102-kontoplan for selskapet
  await opprettKontoplan(company.id);

  return NextResponse.json({
    success: true,
    company: {
      id: company.id,
      orgNr: company.orgNr,
      name: company.name,
    },
  });
}
