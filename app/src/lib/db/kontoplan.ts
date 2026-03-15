/**
 * NS 4102 kontoplan — standard norsk kontoplan.
 *
 * Brukes ved opprettelse av nye selskaper og i seed.
 * Relevant subset for enkel AS uten MVA/ansatte (139 kontoer).
 */

import { db } from "./index";
import { accounts } from "./schema";

export type KontoEntry = {
  accountNumber: number;
  name: string;
  accountClass:
    | "eiendeler"
    | "egenkapital"
    | "gjeld"
    | "inntekter"
    | "varekostnad"
    | "lonnskostnad"
    | "avskrivninger"
    | "andre_kostnader"
    | "finans";
};

export const NS4102_KONTOPLAN: KontoEntry[] = [
  // ══ KLASSE 1: EIENDELER (1000-1999) ══
  // Anleggsmidler
  { accountNumber: 1000, name: "Forskning og utvikling", accountClass: "eiendeler" },
  { accountNumber: 1020, name: "Konsesjoner", accountClass: "eiendeler" },
  { accountNumber: 1050, name: "Programvare / IT-systemer", accountClass: "eiendeler" },
  { accountNumber: 1060, name: "Goodwill", accountClass: "eiendeler" },
  { accountNumber: 1200, name: "Tomter og bygninger", accountClass: "eiendeler" },
  { accountNumber: 1230, name: "Bygninger", accountClass: "eiendeler" },
  { accountNumber: 1240, name: "Boliger inkl. borettslagsandeler", accountClass: "eiendeler" },
  { accountNumber: 1250, name: "Maskiner og anlegg", accountClass: "eiendeler" },
  { accountNumber: 1260, name: "Driftsløsøre / inventar / verktøy", accountClass: "eiendeler" },
  { accountNumber: 1280, name: "Kontormaskiner", accountClass: "eiendeler" },
  { accountNumber: 1290, name: "Andre driftsmidler", accountClass: "eiendeler" },
  { accountNumber: 1300, name: "Investeringer i datterselskap", accountClass: "eiendeler" },
  { accountNumber: 1340, name: "Lån til foretak i same konsern", accountClass: "eiendeler" },
  { accountNumber: 1350, name: "Investeringer i aksjer og andeler", accountClass: "eiendeler" },
  { accountNumber: 1380, name: "Andre fordringer (langsiktige)", accountClass: "eiendeler" },
  // Omløpsmidler
  { accountNumber: 1400, name: "Varelager", accountClass: "eiendeler" },
  { accountNumber: 1500, name: "Kundefordringer", accountClass: "eiendeler" },
  { accountNumber: 1530, name: "Opptjent, ikke fakturert driftsinntekt", accountClass: "eiendeler" },
  { accountNumber: 1570, name: "Andre kortsiktige fordringer", accountClass: "eiendeler" },
  { accountNumber: 1580, name: "Avsetning tap på fordringer", accountClass: "eiendeler" },
  { accountNumber: 1700, name: "Forskuddsbetalte kostnader", accountClass: "eiendeler" },
  { accountNumber: 1740, name: "Mellomregning aksjonær", accountClass: "eiendeler" },
  { accountNumber: 1750, name: "Påløpte inntekter", accountClass: "eiendeler" },
  { accountNumber: 1800, name: "Aksjer og andeler (kortsiktig)", accountClass: "eiendeler" },
  { accountNumber: 1900, name: "Bankinnskudd driftskonto", accountClass: "eiendeler" },
  { accountNumber: 1910, name: "Bankinnskudd sparekonto", accountClass: "eiendeler" },
  { accountNumber: 1920, name: "Skattetrekkskonto", accountClass: "eiendeler" },
  { accountNumber: 1950, name: "Kasse / kontanter", accountClass: "eiendeler" },

  // ══ KLASSE 2: EGENKAPITAL OG GJELD (2000-2999) ══
  // Egenkapital
  { accountNumber: 2000, name: "Aksjekapital", accountClass: "egenkapital" },
  { accountNumber: 2020, name: "Overkursfond", accountClass: "egenkapital" },
  { accountNumber: 2050, name: "Annen innskutt egenkapital", accountClass: "egenkapital" },
  { accountNumber: 2080, name: "Udekket tap", accountClass: "egenkapital" },
  { accountNumber: 2090, name: "Annen egenkapital / opptjent EK", accountClass: "egenkapital" },
  // Langsiktig gjeld
  { accountNumber: 2200, name: "Konvertible lån", accountClass: "gjeld" },
  { accountNumber: 2210, name: "Pantelån", accountClass: "gjeld" },
  { accountNumber: 2250, name: "Andre langsiktige lån", accountClass: "gjeld" },
  { accountNumber: 2280, name: "Lån fra aksjonærer / nærstående", accountClass: "gjeld" },
  { accountNumber: 2290, name: "Annen langsiktig gjeld", accountClass: "gjeld" },
  // Kortsiktig gjeld
  { accountNumber: 2390, name: "Annen kortsiktig gjeld", accountClass: "gjeld" },
  { accountNumber: 2400, name: "Leverandørgjeld", accountClass: "gjeld" },
  { accountNumber: 2500, name: "Betalbar skatt", accountClass: "gjeld" },
  { accountNumber: 2510, name: "Forskuddsskatt", accountClass: "gjeld" },
  { accountNumber: 2600, name: "Skattetrekk", accountClass: "gjeld" },
  { accountNumber: 2770, name: "Skyldig arbeidsgiveravgift", accountClass: "gjeld" },
  { accountNumber: 2780, name: "Påløpt arbeidsgiveravgift feriepenger", accountClass: "gjeld" },
  { accountNumber: 2800, name: "Avsatt utbytte", accountClass: "gjeld" },
  { accountNumber: 2900, name: "Annen kortsiktig gjeld", accountClass: "gjeld" },
  { accountNumber: 2910, name: "Gjeld til aksjonær (kortsiktig)", accountClass: "gjeld" },
  { accountNumber: 2960, name: "Påløpte kostnader", accountClass: "gjeld" },
  { accountNumber: 2990, name: "Annen kortsiktig gjeld (diverse)", accountClass: "gjeld" },

  // ══ KLASSE 3: SALGSINNTEKTER (3000-3999) ══
  { accountNumber: 3000, name: "Salgsinntekt, avgiftspliktig", accountClass: "inntekter" },
  { accountNumber: 3100, name: "Salgsinntekt, avgiftsfri", accountClass: "inntekter" },
  { accountNumber: 3200, name: "Salgsinntekt utenfor avgiftsområdet", accountClass: "inntekter" },
  { accountNumber: 3400, name: "Offentlig tilskudd / refusjon", accountClass: "inntekter" },
  { accountNumber: 3600, name: "Leieinntekter", accountClass: "inntekter" },
  { accountNumber: 3700, name: "Provisjonsinntekter", accountClass: "inntekter" },
  { accountNumber: 3900, name: "Annen driftsinntekt", accountClass: "inntekter" },

  // ══ KLASSE 4: VAREKOSTNAD (4000-4999) ══
  { accountNumber: 4000, name: "Varekostnad", accountClass: "varekostnad" },
  { accountNumber: 4100, name: "Innkjøp råvarer og halvfabrikata", accountClass: "varekostnad" },
  { accountNumber: 4200, name: "Innkjøp av varer for videresalg", accountClass: "varekostnad" },
  { accountNumber: 4300, name: "Innkjøp av underentreprise / fremmedtjenester", accountClass: "varekostnad" },
  { accountNumber: 4500, name: "Fremmedtjenester / underentreprise", accountClass: "varekostnad" },
  { accountNumber: 4900, name: "Beholdningsendring", accountClass: "varekostnad" },

  // ══ KLASSE 5: LØNNSKOSTNAD (5000-5999) ══
  { accountNumber: 5000, name: "Lønn til ansatte", accountClass: "lonnskostnad" },
  { accountNumber: 5090, name: "Feriepenger", accountClass: "lonnskostnad" },
  { accountNumber: 5400, name: "Arbeidsgiveravgift", accountClass: "lonnskostnad" },
  { accountNumber: 5420, name: "Arbeidsgiveravgift av feriepenger", accountClass: "lonnskostnad" },
  { accountNumber: 5500, name: "Annen kostnadsgodtgjørelse", accountClass: "lonnskostnad" },
  { accountNumber: 5800, name: "Styrehonorar", accountClass: "lonnskostnad" },
  { accountNumber: 5900, name: "Annen personalkostnad", accountClass: "lonnskostnad" },

  // ══ KLASSE 6: AVSKRIVNINGER OG ANDRE DRIFTSKOSTNADER (6000-6999) ══
  { accountNumber: 6000, name: "Avskrivning på driftsmidler", accountClass: "avskrivninger" },
  { accountNumber: 6010, name: "Avskrivning på bygninger", accountClass: "avskrivninger" },
  { accountNumber: 6050, name: "Avskrivning på immaterielle eiendeler", accountClass: "avskrivninger" },
  { accountNumber: 6100, name: "Frakt og transportkostnad", accountClass: "avskrivninger" },
  { accountNumber: 6200, name: "Elektrisitet", accountClass: "avskrivninger" },
  { accountNumber: 6300, name: "Leie lokale", accountClass: "avskrivninger" },
  { accountNumber: 6310, name: "Leie kontor / coworking", accountClass: "avskrivninger" },
  { accountNumber: 6340, name: "Lys, varme", accountClass: "avskrivninger" },
  { accountNumber: 6360, name: "Renhold", accountClass: "avskrivninger" },
  { accountNumber: 6400, name: "Leie maskiner / inventar", accountClass: "avskrivninger" },
  { accountNumber: 6410, name: "Leie datasystemer / programvare", accountClass: "avskrivninger" },
  { accountNumber: 6440, name: "Leie bil / transportmiddel", accountClass: "avskrivninger" },
  { accountNumber: 6490, name: "Annen leiekostnad", accountClass: "avskrivninger" },
  { accountNumber: 6500, name: "Verktøy, inventar (ikke aktivert)", accountClass: "avskrivninger" },
  { accountNumber: 6520, name: "Datautstyr (ikke aktivert)", accountClass: "avskrivninger" },
  { accountNumber: 6540, name: "Kontorrekvisita", accountClass: "avskrivninger" },
  { accountNumber: 6550, name: "Faglitteratur / tidsskrifter", accountClass: "avskrivninger" },
  { accountNumber: 6560, name: "Møbler og innredning (ikke aktivert)", accountClass: "avskrivninger" },
  { accountNumber: 6600, name: "Reparasjon og vedlikehold", accountClass: "avskrivninger" },
  { accountNumber: 6700, name: "Revisjonshonorar", accountClass: "avskrivninger" },
  { accountNumber: 6705, name: "Regnskapshonorar", accountClass: "avskrivninger" },
  { accountNumber: 6720, name: "Juridisk bistand", accountClass: "avskrivninger" },
  { accountNumber: 6790, name: "Annen ekstern tjeneste", accountClass: "avskrivninger" },
  { accountNumber: 6800, name: "Kontorrekvisita", accountClass: "avskrivninger" },
  { accountNumber: 6840, name: "Avisabonnement / fagtidsskrifter", accountClass: "avskrivninger" },
  { accountNumber: 6860, name: "Møte, kurs, oppdatering", accountClass: "avskrivninger" },
  { accountNumber: 6900, name: "Telefon", accountClass: "avskrivninger" },
  { accountNumber: 6910, name: "Datakommunikasjon / Internett", accountClass: "avskrivninger" },
  { accountNumber: 6940, name: "Porto", accountClass: "avskrivninger" },

  // ══ KLASSE 7: ANDRE DRIFTSKOSTNADER (7000-7999) ══
  { accountNumber: 7000, name: "Drivstoff bil", accountClass: "andre_kostnader" },
  { accountNumber: 7020, name: "Vedlikehold bil", accountClass: "andre_kostnader" },
  { accountNumber: 7040, name: "Forsikring bil", accountClass: "andre_kostnader" },
  { accountNumber: 7080, name: "Bilkostnader, bom/parkering", accountClass: "andre_kostnader" },
  { accountNumber: 7100, name: "Reisekostnad, ikke oppgavepliktig", accountClass: "andre_kostnader" },
  { accountNumber: 7130, name: "Reisekostnad, oppgavepliktig", accountClass: "andre_kostnader" },
  { accountNumber: 7140, name: "Reisekostnad, diett", accountClass: "andre_kostnader" },
  { accountNumber: 7150, name: "Kilometergodtgjørelse", accountClass: "andre_kostnader" },
  { accountNumber: 7300, name: "Salgskostnad", accountClass: "andre_kostnader" },
  { accountNumber: 7320, name: "Reklamekostnad", accountClass: "andre_kostnader" },
  { accountNumber: 7350, name: "Representasjon (fradragsberettiget)", accountClass: "andre_kostnader" },
  { accountNumber: 7370, name: "Representasjon (ikke fradragsberettiget)", accountClass: "andre_kostnader" },
  { accountNumber: 7390, name: "Kontingenter og gaver", accountClass: "andre_kostnader" },
  { accountNumber: 7400, name: "Forsikringspremie", accountClass: "andre_kostnader" },
  { accountNumber: 7500, name: "Forsikring / garanti", accountClass: "andre_kostnader" },
  { accountNumber: 7600, name: "Lisenskostnad / royalties", accountClass: "andre_kostnader" },
  { accountNumber: 7700, name: "Annen kostnad", accountClass: "andre_kostnader" },
  { accountNumber: 7770, name: "Bank- og kortgebyr", accountClass: "andre_kostnader" },
  { accountNumber: 7790, name: "Annen driftskostnad", accountClass: "andre_kostnader" },
  { accountNumber: 7800, name: "Tap på fordringer", accountClass: "andre_kostnader" },
  { accountNumber: 7830, name: "Innkommet på tidligere avskrevne fordringer", accountClass: "andre_kostnader" },

  // ══ KLASSE 8: FINANS (8000-8999) ══
  { accountNumber: 8000, name: "Inntekt på investering i datterselskap", accountClass: "finans" },
  { accountNumber: 8040, name: "Renteinntekt konsernfordring", accountClass: "finans" },
  { accountNumber: 8050, name: "Annen renteinntekt", accountClass: "finans" },
  { accountNumber: 8060, name: "Valutagevinst (agio)", accountClass: "finans" },
  { accountNumber: 8070, name: "Annen finansinntekt", accountClass: "finans" },
  { accountNumber: 8080, name: "Verdiendring markedsbaserte fin.instrumenter", accountClass: "finans" },
  { accountNumber: 8100, name: "Verdiendring fin. instrumenter", accountClass: "finans" },
  { accountNumber: 8120, name: "Nedskrivning av finansielle eiendeler", accountClass: "finans" },
  { accountNumber: 8140, name: "Rentekostnad konserngjeld", accountClass: "finans" },
  { accountNumber: 8150, name: "Annen rentekostnad", accountClass: "finans" },
  { accountNumber: 8160, name: "Valutatap (disagio)", accountClass: "finans" },
  { accountNumber: 8170, name: "Annen finanskostnad", accountClass: "finans" },
  { accountNumber: 8300, name: "Betalbar skatt", accountClass: "finans" },
  { accountNumber: 8320, name: "Endring utsatt skatt", accountClass: "finans" },
  { accountNumber: 8800, name: "Årsresultat", accountClass: "finans" },
  { accountNumber: 8900, name: "Overføring til/fra annen egenkapital", accountClass: "finans" },
  { accountNumber: 8910, name: "Overføring til/fra udekket tap", accountClass: "finans" },
  { accountNumber: 8920, name: "Avsatt utbytte", accountClass: "finans" },
  { accountNumber: 8960, name: "Overføring til/fra fond", accountClass: "finans" },
];

/**
 * Opprett NS 4102-kontoplan for et selskap.
 * Kaller db.insert for alle 139 kontoer.
 */
export async function opprettKontoplan(companyId: string): Promise<number> {
  const values = NS4102_KONTOPLAN.map((konto) => ({
    companyId,
    ...konto,
  }));

  await db.insert(accounts).values(values);

  return NS4102_KONTOPLAN.length;
}
