# Spec: Kundevisning

## Hva

Den oppgavebaserte visningen kunden ser når de logger inn. Kunden skal aldri trenge å forstå regnskap - bare se hva som trengs fra dem, levere det, og se at ting er i orden.

## Designprinsipper

1. **Oppgavebasert, ikke regnskapsbasert.** Kunden ser "Last opp kvitteringer", ikke "Lever primærdokumentasjon iht. bokføringsloven"
2. **Alltid tydelig hva som er neste steg.** Ingen forvirring om hva kunden skal gjøre
3. **Progresjonsindikator.** Kunden ser at de beveger seg fremover: "3 av 7 oppgaver fullført"
4. **Minimal kognitiv belastning.** Maksimalt én skjerm med informasjon, ingen navigasjonsdybde

## Visninger

### Hovedvisning: Oppgavelisten

Kunden ser en enkel liste over oppgaver for gjeldende syklus:

```
Regnskap 2025                                    3 av 7 fullført
─────────────────────────────────────────────────────────────────

[x] Bekreft selskapsinformasjon                        Levert 5. jan
[x] Last opp bankutskrifter                            Levert 12. jan
[x] Bekreft kontoutskrift 31.12                        Levert 12. jan
[ ] Last opp bilag (kvitteringer og fakturaer)         Frist: februar
    "Last opp alle kvitteringer og fakturaer for 2025.
     Tips: Fotografer kvitteringer med mobilen."
    [Last opp filer]
[ ] Last opp låneavtaler                               Frist: februar
[ ] Godkjenn årsregnskap                               Venter på regnskapsfører
[ ] Signer generalforsamlingsprotokoll                 Venter på regnskapsfører
```

### Oppgavedetalj

Når kunden klikker på en oppgave:
- Utvidet beskrivelse av hva som trengs
- Hjelpetekst i klart språk ("Bankutskrift er en oversikt over alle transaksjoner på kontoen din i 2025. Du finner den i nettbanken under 'Kontoutskrift'.")
- Opplastingsområde (drag-and-drop eller filvelger)
- Liste over allerede opplastede filer
- Knapp for å markere som levert

### Godkjenningsvisning

Når RF sender godkjenningsforespørsel:
- Kunden ser dokumentene som skal godkjennes (årsregnskap PDF)
- Enkel "Godkjenn" / "Har spørsmål"-knapp
- "Har spørsmål" åpner en melding til RF

## Statusmodell per oppgave

```
ikke_startet -> levert -> godkjent
                  |
                  v
             trenger_mer (RF ber om tillegg)
                  |
                  v
               levert (kunden leverer på nytt)

For godkjenningsoppgaver:
venter_paa_rf -> klar_for_godkjenning -> godkjent
                                           |
                                           v
                                     har_spoersmaal -> klar_for_godkjenning
```

## Responsivt design

Kundevisningen skal fungere like godt på mobil som desktop. Mange kunder vil bruke mobilen til å fotografere kvitteringer og laste opp.

- Mobil: Én-kolonne layout, store trykkeflater, kameratilgang for bilag
- Desktop: Samme layout, men med mer plass til hjelpetekst og filoversikt

## Avgrensninger

- MVP: Ingen meldingsfunksjon mellom kunde og RF (utenom "Har spørsmål" på godkjenning)
- MVP: Ingen historikk over tidligere år (kun gjeldende syklus)
- MVP: Ingen notifikasjoner inne i appen (kun e-post)
- Senere: Årshistorikk, chat/meldinger, in-app-varsler
