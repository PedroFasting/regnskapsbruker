# Proposal: Regnskapsbruker MVP

## Why

Regnskapsførere (RF) og deres kunder mangler et dedikert samhandlingslag. I dag skjer koordinering via e-post, telefon og ad-hoc-meldinger. RF oppdager at dokumentasjon mangler, purrer kunden, kunden spør hva som menes, flere runder frem og tilbake. Resultatet er dager og uker med unødvendig friksjon.

CataCloud (ECIT sitt ERP) håndterer selve regnskapsføringen, men har ingen kundevendt portal der kunden kan se hva som trengs, levere dokumentasjon, og følge status. Dette gapet finnes hos de fleste regnskapssystemer - Tripletex og Fiken lar kunden inn i selve regnskapssystemet, men det er komplekst og ikke designet for den oppgavebaserte samhandlingen som trengs.

Holdingservice og Sanna Regnskap har vist at en oppgavedrevet, prosessstyrt tilnærming fungerer - men de er nisjeaktører begrenset til holdingselskap. Det finnes ingen generell løsning som gir denne opplevelsen på tvers av selskapstyper.

### Problemet oppsummert

- **For kunden:** "Jeg vet ikke hva regnskapsføreren trenger fra meg, eller når."
- **For RF:** "Jeg bruker for mye tid på å jage dokumentasjon og purre kunder i stedet for å føre regnskap."

## What Changes

Regnskapsbruker blir et prosessdrevet samhandlingslag mellom RF og kunde. Systemet vet hva som trengs basert på selskapstype og -situasjon, driver kunden gjennom en enkel oppgaveliste, og gir RF oversikt over status og unntak.

### MVP-scope

MVP-en fokuserer på den enkleste brukscasen: **et lite AS uten ansatte og uten MVA-registrering** (årsbasert prosessmodell). Konkret pilotselskap: et verksted-AS med få kostnadsposter, noe lån, og ingen MVA.

MVP-en dekker **én komplett årssyklus** for dette selskapet:
1. RF oppretter kunden med selskapstype i Regnskapsbruker
2. Systemet genererer en sjekkliste basert på "enkelt AS, ingen MVA, ingen ansatte"
3. Kunden logger inn og ser hva som trengs (bilag, bankutskrift, låneavtale, etc.)
4. Kunden laster opp dokumentasjon
5. RF ser at dokumentasjon er levert (eller hva som mangler)
6. RF klargjør årsregnskap (i CataCloud) og sender til godkjenning
7. Kunden godkjenner årsregnskap og signerer generalforsamlingsprotokoll

### Hva MVP-en IKKE er

- Ikke et regnskapssystem - bokføring og årsoppgjør skjer i CataCloud
- Ikke en AI-motor for automatisk bokføring (som Sanna)
- Ikke en løsning for lønn, MVA-melding eller kompleks konsernrapportering (ennå)
- Ikke team-funksjonalitet for flere RF-er per kunde (ennå)

## Capabilities

### 1. prosessmotor

Regelbasert motor som genererer riktig sjekkliste basert på selskapsattributter. For MVP: selskapstype (AS), MVA-status (nei), ansatte (nei), og prosessmodell (årsbasert). Motoren definerer hvilke dokumenter/oppgaver som kreves og i hvilken rekkefølge.

Skaleres senere med: MVA-terminer (løpende modell), lønn, revisjonsplikt, konsernforhold.

### 2. kunde-onboarding

RF oppretter et selskap i Regnskapsbruker med grunndata (org.nr, navn, selskapstype, MVA-status, ansattstatus). Systemet henter tilgjengelig informasjon fra Brønnøysundregistrene der det er mulig. Kunden får en invitasjon til å logge inn.

### 3. kundevisning

Kunden logger inn og ser en enkel, oppgavebasert visning: "Her er hva vi trenger fra deg." Hver oppgave har en beskrivelse, en status (ikke startet / levert / godkjent), og mulighet for å laste opp filer. Kunden ser aldri regnskapssystemet - bare sin egen sjekkliste.

### 4. dokumentopplasting

Kunden laster opp bilag, bankutskrifter og andre dokumenter knyttet til en spesifikk oppgave i sjekklisten. Filene tagges automatisk med oppgavetype og periode. RF får varsel om nye opplastinger.

### 5. rf-oversikt

RF ser et dashboard med alle sine kunder og status per kunde: hvem har levert alt, hvem mangler noe, hvem har ikke begynt. Gir umiddelbar oversikt uten å måtte sjekke e-post eller ringe rundt. Drill-down til enkeltkundens sjekkliste.

### 6. godkjenningsflyt

Når RF har klargjort årsregnskap, sender RF en godkjenningsforespørsel gjennom Regnskapsbruker. Kunden ser hva som skal godkjennes, kan lese dokumentene, og gir digital godkjenning. Erstatter e-post med PDF-vedlegg og signatur-jakt.

### 7. varsling

Systemet sender varsler til kunden når nye oppgaver venter, og til RF når dokumentasjon er levert. Påminnelser ved frister som nærmer seg. MVP: e-postvarsler. Senere: push, SMS.

## Impact

### For kunden (verkstedeieren)
- Vet til enhver tid hva som forventes av ham
- Leverer dokumentasjon én gang, på ett sted, uten å lure på om det er riktig
- Godkjenner årsregnskap digitalt uten å printe, signere og skanne

### For RF
- Slipper å sende purre-e-poster og ringe kunder
- Ser umiddelbart hvem som har levert og hvem som mangler
- Kan fokusere på regnskapsarbeidet i CataCloud, ikke på administrativ oppfølging

### For ECIT
- Differensiator mot konkurrenter som kun tilbyr regnskapssystem
- Mulig å betjene flere kunder per RF (lavere administrasjonskostnad)
- Plattform som kan utvides med mer funksjonalitet og flere segmenter over tid

## Skalerbarhet

MVP-en er bevisst enkel, men arkitekturen skal støtte utvidelse:

| Dimensjon | MVP | Neste steg | Fremtid |
|-----------|-----|------------|---------|
| Selskapstype | Enkelt AS uten MVA | AS med MVA (løpende modell) | ENK, NUF, holding, konsern |
| Prosessmodell | Årsbasert | Terminbasert (MVA) | Løpende + årsbasert kombinert |
| Aktører | 1 RF + 1 kunde | 1 RF + flere kunder | Team av RF + kundeorganisasjon |
| Integrasjoner | Manuell | CataCloud API (bilag, status) | Intect (lønn), BankID (signering) |
| Varsling | E-post | Push-varsler | SMS, in-app |

## Referanser

- **Holdingservice:** Oppgavebasert portal for holdingselskap. ~10 min/år fra kunden. Fast pris fra 3 999 kr/år.
- **Sanna Regnskap:** AI-drevet regnskapstjeneste for holding. Selger utfall, ikke teknologi. 3 990 kr/år.
- **Fiken:** Selvbetjenings-regnskap for SMB. 125 000 brukere. Kunden eier systemet.
- **Tripletex:** Full ERP, 150 000 brukere. RF og kunde i samme system med rolletilgang. 468 integrasjoner.
- **Unimicro:** ERP med RF som distribusjonskanal. AI-satsing. Byrå-modul for multi-klient.
- **CataCloud:** ECIT sitt ERP. GraphQL API. Ubegrenset brukere. Mangler kundeportal.
