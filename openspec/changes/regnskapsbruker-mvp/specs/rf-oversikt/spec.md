# Spec: RF-oversikt

## Hva

Dashboardet der regnskapsføreren ser status på tvers av alle sine kunder. Hovedformålet: umiddelbart se hvem som har levert, hvem som mangler noe, og hvem som trenger oppfølging - uten å sjekke e-post eller ringe.

## Designprinsipper

1. **Unntak først.** Det som krever oppmerksomhet vises øverst
2. **Null-klikk innsikt.** Status skal være synlig uten å klikke inn på enkeltkunder
3. **Batch-effektivitet.** RF skal kunne jobbe seg gjennom en liste, ikke hoppe mellom skjermer

## Visninger

### Hovedvisning: Kundeoversikt

```
Mine kunder - Regnskap 2025                    12 kunder totalt
─────────────────────────────────────────────────────────────────

Trenger oppfølging (3)
  ! Verksted AS          2/7 oppgaver    Mangler: bilag, låneavtaler
  ! Konsult AS           0/7 oppgaver    Ikke begynt. Invitert 3. jan.
  ! Butikken AS          5/7 oppgaver    Mangler: godkjenning (purret 2x)

Venter på RF (4)
  → Hansen Holding AS    7/7 oppgaver    Alt levert. Klar for årsoppgjør.
  → Jensens IT AS        7/7 oppgaver    Alt levert.
  → Nordlys AS           6/7 oppgaver    Godkjenning sendt, venter svar.
  → Fjord Eiendom AS     7/7 oppgaver    Alt levert.

Ferdig (5)
  ✓ Lund AS              Årsregnskap godkjent 15. mars
  ✓ Berg AS              Årsregnskap godkjent 12. mars
  ...
```

### Enkeltkundevisning (drill-down)

Når RF klikker på en kunde, ser de:
- Kundens sjekkliste med samme status som kunden ser
- Opplastede dokumenter per oppgave (kan åpne/laste ned)
- Mulighet til å markere dokumenter som godkjent/trenger mer
- Mulighet til å sende godkjenningsforespørsel
- Mulighet til å sende påminnelse til kunden

### Handlinger fra dashboardet

RF kan direkte fra oversikten:
- **Send påminnelse:** Utløser e-post til kunden om manglende oppgaver
- **Se dokumenter:** Drill-down til kundens opplastede filer
- **Send godkjenning:** Starter godkjenningsflyt for årsregnskap
- **Legg til kunde:** Starter kunde-onboarding

## Sortering og filtrering

- **Standard sortering:** Etter status (trenger oppfølging > venter på RF > ferdig), deretter alfabetisk
- **Filtrer på status:** Vis kun "trenger oppfølging", "venter", "ferdig"
- **Søk:** Fritekst på kundenavn eller orgnr

## Datamodell (aggregert visning)

```
KundeStatus:
  selskap_id: string
  selskap_navn: string
  orgnr: string
  totalt_oppgaver: number
  fullforte_oppgaver: number
  status: "trenger_oppfolging" | "venter_paa_rf" | "ferdig"
  siste_aktivitet: datetime
  manglende_oppgaver: string[] (titler)
  antall_purringer: number
```

## Avgrensninger

- MVP: Ingen aggregert statistikk (gjennomsnittlig leveringstid, etc.)
- MVP: Ingen eksport av status (Excel, PDF)
- MVP: Ingen tilpasning av kolonner eller visning
- Senere: Statistikk, rapporter, teamvisning (flere RF-ere), batch-purring
