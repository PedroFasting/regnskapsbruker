# Spec: Prosessmotor

## Hva

En regelbasert motor som genererer riktig sjekkliste for en kunde basert på selskapets attributter. Motoren er kjernen i Regnskapsbruker - den "vet" hva som trengs og når.

## Regler for MVP

MVP støtter én selskapstype med én prosessmodell:

**Inputattributter:**
- Selskapstype: AS
- MVA-registrert: Nei
- Har ansatte: Nei
- Prosessmodell: Årsbasert

**Output: Sjekkliste for "Enkelt AS, årsbasert"**

Motoren genererer følgende oppgaver for en årssyklus:

| # | Oppgave | Beskrivelse | Frist-relasjon |
|---|---------|-------------|----------------|
| 1 | Last opp bilag | Alle kvitteringer og fakturaer (inn og ut) for regnskapsåret | Januar-februar |
| 2 | Last opp bankutskrifter | Komplett bankutskrift for alle konti, hele året | Januar-februar |
| 3 | Bekreft kontoutskrift 31.12 | Bankbalanse per årsslutt for avstemming | Januar |
| 4 | Last opp låneavtaler | Gjeldende låneavtaler med saldo | Januar-februar |
| 5 | Bekreft selskapsinformasjon | Aksjonærer, styre, vedtekter - stemmer dette fortsatt? | Januar |
| 6 | Godkjenn årsregnskap | Gjennomgå og godkjenn resultat, balanse og noter | Når RF er ferdig (april-mai) |
| 7 | Signer generalforsamlingsprotokoll | Digital signering av protokoll | Innen 30. juni |

**Frister motoren kjenner:**
- 31. mai: Skattemelding
- 30. juni: Generalforsamling
- 31. juli: Årsregnskap til Brønnøysund

## Datamodell

```
SjekklisterType:
  id: string
  navn: string
  selskapstype: "AS" | "ENK" | "NUF" (MVP: kun AS)
  mva_registrert: boolean
  har_ansatte: boolean
  prosessmodell: "aarsbasert" | "loepende" (MVP: kun årsbasert)
  oppgaver: Oppgave[]

Oppgave:
  id: string
  tittel: string
  beskrivelse: string
  type: "dokument_opplasting" | "bekreftelse" | "godkjenning" | "signering"
  frist_relativ: string (f.eks. "januar", "naar_rf_ferdig")
  rekkefølge: number
  paakrevd: boolean
```

## Skaleringsdesign

Motoren skal designes slik at nye regler kan legges til uten kodeendring:

- Regler defineres som konfigurasjon (YAML/JSON), ikke hardkodet
- Nye selskapstyper = ny regelfil
- MVA-registrert = ekstra oppgaver (MVA-melding per termin) + endret frekvens
- Ansatte = ekstra oppgaver (lønnsdokumentasjon, A-melding)
- Kombinasjoner håndteres ved at regler er additive: grunnregler + MVA-regler + lønnsregler

## Avgrensninger

- MVP har kun én regelkonfigurasjon (enkelt AS)
- Ingen dynamiske regler basert på hendelser (f.eks. "selskapet ble MVA-registrert midt i året")
- Frister er relative til regnskapsår, ikke absolutte datoer (beregnes ved opprettelse av syklus)
