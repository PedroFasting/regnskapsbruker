# Tasks: Regnskapsbruker MVP

## Fase 0: Prosjektoppsett

- [ ] Opprett Next.js-prosjekt med App Router og TypeScript
- [ ] Konfigurer Tailwind CSS og shadcn/ui
- [ ] Sett opp Drizzle ORM med PostgreSQL (Supabase/Neon)
- [ ] Konfigurer NextAuth.js med e-post/passord og magic link
- [ ] Sett opp Resend for transaksjonell e-post
- [ ] Sett opp fillagring (Supabase Storage / S3)
- [ ] Konfigurer Vercel-deployment med preview-miljø
- [ ] Opprett databaseskjema (migrasjoner via Drizzle Kit)

## Fase 1: Prosessmotor

- [ ] Definer YAML-regelformat for sjekklister
- [ ] Skriv regelkonfigurasjon for "enkelt AS uten MVA" (`rules/enkelt-as.yaml`)
- [ ] Implementer regelparser som leser YAML og genererer oppgaveliste
- [ ] Implementer syklusopprettelse: gitt selskapsattributter -> generer oppgaver i database
- [ ] Skriv tester for prosessmotoren (korrekt antall oppgaver, riktig rekkefølge, riktige typer)

## Fase 2: Autentisering og brukermodell

- [ ] Implementer brukerregistrering for RF (e-post + passord)
- [ ] Implementer magic link-innlogging for kunder
- [ ] Implementer rollebasert tilgang (middleware: kunde vs. RF)
- [ ] Implementer invitasjonsflyt: RF inviterer kunde via e-post -> kunde klikker lenke -> konto opprettes
- [ ] Lag innloggingsside med rollevalg (eller automatisk routing basert på brukertype)

## Fase 3: Kunde-onboarding (RF-side)

- [ ] Lag side "Legg til ny kunde" med orgnr-felt
- [ ] Implementer Brønnøysundregistrene API-klient (`lib/brreg/`)
- [ ] Vis hentet selskapsdata og la RF bekrefte/justere (MVA, ansatte, kontaktperson)
- [ ] Lagre selskap i databasen
- [ ] Utløs prosessmotor: generer syklus med oppgaver for selskapet
- [ ] Send invitasjons-e-post til kontaktperson
- [ ] Lag e-postmal for invitasjon (React Email)

## Fase 4: Kundevisning

- [ ] Lag kundens dashboard: oppgaveliste med progresjon
- [ ] Implementer oppgavedetalj-visning med hjelpetekst
- [ ] Implementer statusmodell for oppgaver (ikke_startet -> levert -> godkjent)
- [ ] Lag responsivt layout som fungerer på mobil og desktop
- [ ] Implementer "Ferdig"-knapp for å markere oppgave som levert

## Fase 5: Dokumentopplasting

- [ ] Implementer filopplasting med drag-and-drop (desktop)
- [ ] Implementer kameratilgang for mobilopplasting
- [ ] Validere filtyper server-side (PDF, JPEG, PNG, XLSX, CSV)
- [ ] Generere standardisert filnavn ved opplasting
- [ ] Lagre fil i S3/Supabase Storage med presigned URLs
- [ ] Lagre metadata i databasen (dokument-tabell)
- [ ] Vis opplastede filer under oppgaven med mulighet for nedlasting
- [ ] Implementer filstørrelsesgrense (25 MB)

## Fase 6: RF-oversikt (dashboard)

- [ ] Lag RF-dashboardet med kundeoversikt gruppert etter status
- [ ] Implementer aggregering: beregn status per kunde (trenger oppfølging / venter / ferdig)
- [ ] Lag drill-down til enkeltkundens oppgaveliste
- [ ] Vis opplastede dokumenter per oppgave med nedlasting
- [ ] Implementer "Godkjenn dokument" og "Trenger mer" med kommentar fra RF
- [ ] Implementer søk/filter på kundenavn og orgnr
- [ ] Implementer "Send påminnelse"-knapp per kunde

## Fase 7: Godkjenningsflyt

- [ ] Lag "Send til godkjenning"-flyt for RF (last opp årsregnskap PDF, legg til melding)
- [ ] Oppdater kundens oppgaveliste: aktiver godkjenningsoppgaver
- [ ] Lag kundens godkjenningsvisning (les dokument, godkjenn eller still spørsmål)
- [ ] Implementer godkjenningslogg (audit trail med tidsstempel, IP, bruker)
- [ ] Implementer "Har spørsmål"-flyt: kunde sender melding til RF
- [ ] Send e-postvarsel til RF ved godkjenning eller spørsmål

## Fase 8: Varsling

- [ ] Implementer varselmotor som sender e-post ved hendelser
- [ ] Lag e-postmaler for alle varseltyper (React Email):
  - [ ] Invitasjon
  - [ ] Ny syklus
  - [ ] Påminnelse om uleverte oppgaver
  - [ ] Frist nærmer seg
  - [ ] Godkjenning klar
  - [ ] Dokument levert (til RF)
  - [ ] Alle oppgaver levert (til RF)
  - [ ] Godkjenning gitt (til RF)
  - [ ] Kunde har spørsmål (til RF)
- [ ] Implementer sammenslåing: maks én e-post per kunde per time til RF
- [ ] Implementer fristvarsler: 14 og 7 dager før frist
- [ ] Implementer manuell påminnelse: RF kan utløse påminnelse fra dashboard

## Fase 9: Testing og pilot

- [ ] End-to-end test: komplett flyt fra onboarding til godkjenning
- [ ] Test med pilotselskapet (verksted-AS):
  - [ ] RF oppretter selskapet med orgnr
  - [ ] Systemet henter data fra Brønnøysund
  - [ ] Sjekkliste genereres korrekt (7 oppgaver)
  - [ ] Kunde mottar invitasjon og logger inn
  - [ ] Kunde laster opp bilag og bankutskrift
  - [ ] RF ser status oppdatert i dashboard
  - [ ] RF sender årsregnskap til godkjenning
  - [ ] Kunde godkjenner
- [ ] Fiks eventuelle UX-problemer identifisert i piloten
- [ ] Verifiser e-postleveranse (SPF/DKIM/DMARC)
- [ ] Verifiser mobil-UX på iPhone og Android

## Fase 10: Produksjonsklar

- [ ] Konfigurer produksjonsdomene (regnskapsbruker.no eller lignende)
- [ ] Sett opp SSL-sertifikat
- [ ] Konfigurer Vercel produksjons-deployment
- [ ] Sett opp feillogging (Sentry eller lignende)
- [ ] Gjennomgå sikkerhet: autorisering, input-validering, filtyper
- [ ] GDPR-gjennomgang: personvernserklæring, databehandleravtale
- [ ] Backup-strategi for database og filer
