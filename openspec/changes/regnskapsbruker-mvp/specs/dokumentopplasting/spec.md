# Spec: Dokumentopplasting

## Hva

Kunden laster opp filer (bilag, bankutskrifter, låneavtaler) knyttet til en spesifikk oppgave i sjekklisten. Filene lagres sikkert og tagges med oppgavetype og periode slik at RF enkelt finner dem.

## Brukerflyt

### Opplasting fra desktop
1. Kunden klikker på en oppgave i sjekklisten
2. Kunden drar filer til opplastingsområdet, eller klikker "Velg filer"
3. Systemet viser fremdrift og bekreftelse
4. Filen vises i listen under oppgaven
5. Kunden kan laste opp flere filer til samme oppgave
6. Kunden klikker "Ferdig" for å markere oppgaven som levert

### Opplasting fra mobil
1. Samme flyt, men med tillegg: "Ta bilde" som åpner kameraet direkte
2. Kunden fotograferer en kvittering
3. Bildet lastes opp automatisk
4. Kunden kan ta flere bilder etter hverandre (batch-modus)

## Filhåndtering

**Aksepterte filtyper:**
- PDF (hoveddokument for bankutskrifter, låneavtaler, regnskap)
- JPEG, PNG (fotograferte kvitteringer)
- XLSX, CSV (kontoutskrifter fra nettbank)

**Filstørrelsesgrense:** 25 MB per fil

**Navngiving:** Systemet genererer et standardisert filnavn:
`{orgnr}_{oppgavetype}_{dato}_{løpenr}.{ext}`
Eksempel: `123456789_bilag_2026-01-15_001.pdf`

## Datamodell

```
Dokument:
  id: string (UUID)
  selskap_id: string
  oppgave_id: string
  syklus_id: string
  original_filnavn: string
  lagret_filnavn: string
  filtype: string (mime-type)
  filstørrelse: number (bytes)
  lastet_opp_av: string (bruker_id)
  lastet_opp_dato: datetime
  status: "lastet_opp" | "godkjent_av_rf" | "avvist"
  avvisningsgrunn: string | null
```

## RF sin interaksjon med dokumenter

- RF ser nye opplastinger i sitt dashboard
- RF kan åpne/laste ned dokumenter
- RF kan markere et dokument som "godkjent" eller "trenger mer" med en kommentar
- Hvis RF markerer "trenger mer", får kunden beskjed om å laste opp på nytt

## Lagring

- Filer lagres i skylagring (S3-kompatibel)
- Metadata lagres i databasen
- Filer krypteres at rest
- Tilgang kontrolleres: kun kunden selv og tilknyttet RF kan se filene

## Avgrensninger

- MVP: Ingen forhåndsvisning av bilder i nettleseren (kun nedlasting)
- MVP: Ingen OCR eller automatisk tolking av bilag
- MVP: Ingen versjonering av filer (ny opplasting = nytt dokument)
- Senere: Bildebeskjæring, OCR-tolking, automatisk kategorisering, CataCloud-integrasjon for direkte bilagsimport
