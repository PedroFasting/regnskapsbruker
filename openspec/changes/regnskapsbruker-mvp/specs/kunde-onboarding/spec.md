# Spec: Kunde-onboarding

## Hva

Flyten der RF oppretter et nytt selskap i Regnskapsbruker og inviterer kunden til å logge inn. Dette er startpunktet for all samhandling.

## Flyt

### RF sin flyt

1. RF logger inn i Regnskapsbruker
2. Velger "Legg til ny kunde"
3. Taster inn organisasjonsnummer
4. Systemet henter grunndata fra Brønnøysundregistrene (navn, adresse, selskapstype, styre, daglig leder)
5. RF bekrefter/justerer og legger til:
   - MVA-registrert? (ja/nei)
   - Har ansatte? (ja/nei)
   - Prosessmodell (årsbasert / løpende) - MVP: settes automatisk basert på MVA-status
   - Kontaktperson hos kunden (navn, e-post)
6. Systemet genererer sjekkliste via prosessmotoren
7. RF sender invitasjon til kunden

### Kundens flyt

1. Kunden mottar e-post: "Din regnskapsfører har invitert deg til Regnskapsbruker"
2. Kunden klikker lenke
3. Kunden oppretter konto (e-post + passord, MVP-autentisering)
4. Kunden ser sin sjekkliste umiddelbart

## Brønnøysund-integrasjon (MVP)

For MVP bruker vi offentlig tilgjengelig data fra Brønnøysundregistrene:

**API:** https://data.brreg.no/enhetsregisteret/api/enheter/{orgnr}

**Data vi henter:**
- Navn
- Organisasjonsform (AS, ENK, etc.)
- Forretningsadresse
- Stiftelsesdato
- Daglig leder (hvis registrert)
- Styremedlemmer
- Næringskode (NACE)
- Registrert i MVA-registeret (kan sjekkes)

**Data RF må legge til manuelt:**
- Kontaktperson (hvem skal logge inn)
- Bekrefte/overstyre MVA-status
- Bekrefte ansattstatus

## Datamodell

```
Selskap:
  id: string (UUID)
  orgnr: string (9 siffer)
  navn: string
  selskapstype: "AS" | "ENK" | "NUF"
  adresse: Adresse
  stiftelsesdato: date
  mva_registrert: boolean
  har_ansatte: boolean
  prosessmodell: "aarsbasert" | "loepende"
  naeringskode: string
  opprettet_dato: datetime
  rf_id: string (referanse til RF)

Kontaktperson:
  id: string
  selskap_id: string
  navn: string
  epost: string
  rolle: "daglig_leder" | "styreleder" | "okonomiansvarlig" | "annet"
  bruker_id: string | null (koblet til innlogging)
```

## Validering

- Organisasjonsnummer må være gyldig (9 siffer, MOD11-sjekk)
- E-post til kontaktperson er påkrevd
- Selskapet kan ikke allerede være registrert hos denne RF-en
- Selskapstype må være støttet (MVP: kun AS)

## Avgrensninger

- MVP: Kun manuell opprettelse (ingen bulk-import)
- MVP: Én kontaktperson per selskap
- MVP: Ingen integrasjon med CataCloud for å hente eksisterende kunder
- Senere: Import fra CataCloud-kundeliste, flere kontaktpersoner, BankID-verifisering
