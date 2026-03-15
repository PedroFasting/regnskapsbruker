# Spec: Varsling

## Hva

Systemet sender varsler til riktig person til riktig tid. Varsler driver prosessen fremover uten at RF manuelt må følge opp eller kunden må huske å logge inn.

## Varseltyper

### Til kunden

| Hendelse | Varsel | Tidspunkt |
|----------|--------|-----------|
| Invitasjon | "Din regnskapsfører har invitert deg til Regnskapsbruker" | Ved onboarding |
| Ny syklus | "Regnskap 2025 er klar. Logg inn for å se hva vi trenger fra deg." | Når RF oppretter syklus |
| Påminnelse | "Du har 3 uleverte oppgaver for Regnskap 2025" | Automatisk etter X dager, eller manuelt fra RF |
| Frist nærmer seg | "Frist for bilag er om 2 uker" | Konfigurerbart (f.eks. 14 og 7 dager før) |
| Godkjenning klar | "Årsregnskapet ditt er klart for gjennomgang" | Når RF sender til godkjenning |
| RF har kommentar | "Regnskapsføreren din har en kommentar til dine dokumenter" | Når RF markerer "trenger mer" |

### Til RF

| Hendelse | Varsel | Tidspunkt |
|----------|--------|-----------|
| Dokument levert | "Verksted AS har lastet opp bilag" | Ved opplasting |
| Alle oppgaver levert | "Verksted AS har levert alt - klar for årsoppgjør" | Når siste oppgave er levert |
| Godkjenning gitt | "Verksted AS har godkjent årsregnskapet" | Ved godkjenning |
| Kunde har spørsmål | "Verksted AS har et spørsmål om årsregnskapet" | Ved "Har spørsmål" |

## Kanal

**MVP: Kun e-post**

Alle varsler sendes som e-post med:
- Tydelig avsender: "Regnskapsbruker <no-reply@regnskapsbruker.no>"
- Kort, handlingsrettet tekst
- Én tydelig call-to-action-knapp ("Logg inn og se oppgavene dine")
- Lenke direkte til relevant visning

**Senere:** Push-varsler (mobil), SMS for kritiske frister, in-app-varsler.

## Frekvens og sammenslåing

- Dokumentopplastinger samles: RF får maks én e-post per kunde per time (med oppsummering)
- Påminnelser til kunde: Maks én per uke, med mindre RF manuelt utløser
- Fristvarsler: Maks to per frist (14 dager + 7 dager før)
- Kunden kan ikke slå av fristvarsler (disse er viktige), men kan justere frekvens på påminnelser

## Datamodell

```
Varsel:
  id: string
  mottaker_bruker_id: string
  mottaker_epost: string
  type: string (en av typene over)
  selskap_id: string
  innhold: string (rendret tekst)
  sendt_dato: datetime | null
  lest_dato: datetime | null
  kanal: "epost" (MVP)
  relatert_oppgave_id: string | null
```

## E-postleveranse

- Transaksjonell e-post via tjeneste (SendGrid, Postmark, eller lignende)
- Ikke markedsførings-e-post - trenger ikke avmelding (men har preferanser)
- SPF/DKIM/DMARC konfigurert for leverbarhet

## Avgrensninger

- MVP: Kun e-post, ingen push/SMS/in-app
- MVP: Ingen preferanseinnstillinger for kunden (alle varsler er på)
- MVP: Norsk språk kun
- Senere: Flerspråklig, kanalvalg, varselpreferanser, daglig oppsummering for RF
