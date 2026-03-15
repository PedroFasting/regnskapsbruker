# Spec: Godkjenningsflyt

## Hva

Digital godkjenning av årsregnskap og generalforsamlingsprotokoll. Erstatter flyten der RF sender PDF på e-post, kunden printer, signerer, skanner og sender tilbake.

## Flyten

### RF starter godkjenning

1. RF er ferdig med årsregnskap i CataCloud
2. RF går til kunden i Regnskapsbruker
3. RF klikker "Send til godkjenning"
4. RF laster opp dokumentene som skal godkjennes:
   - Årsregnskap (resultat, balanse, noter) som PDF
   - Generalforsamlingsprotokoll som PDF
5. RF legger eventuelt til en melding: "Hei, årsregnskapet for 2025 er klart. Se gjennom og godkjenn."
6. Systemet oppdaterer kundens sjekkliste: oppgavene "Godkjenn årsregnskap" og "Signer protokoll" blir aktive

### Kunden godkjenner

1. Kunden mottar e-post: "Årsregnskapet ditt er klart for gjennomgang"
2. Kunden logger inn
3. Kunden ser oppgavene "Godkjenn årsregnskap" og "Signer protokoll" som aktive
4. Kunden kan lese/laste ned dokumentene
5. To valg:
   - **"Godkjenn":** Kunden bekrefter digitalt. Tidsstempel og bruker-ID logges.
   - **"Har spørsmål":** Kunden skriver en melding som sendes til RF. Oppgaven forblir aktiv.
6. Når begge oppgaver er godkjent, markeres kunden som "Ferdig" i RF-oversikten

### RF mottar respons

- Ved godkjenning: RF ser status endret til "Godkjent" med tidspunkt
- Ved spørsmål: RF mottar e-postnotifikasjon med kundens melding og kan svare

## Godkjenningslogg

Alle godkjenninger logges med:
```
Godkjenning:
  id: string
  selskap_id: string
  dokument_id: string
  godkjent_av: string (bruker_id)
  godkjent_dato: datetime
  ip_adresse: string
  bruker_agent: string
  type: "aarsregnskap" | "generalforsamling"
```

Dette gir en etterprøvbar logg over hvem som godkjente hva og når.

## Digital signatur (MVP vs. fremtid)

**MVP:** Enkel digital godkjenning via innlogget bruker. Ikke juridisk bindende digital signatur, men en bekreftelse med audit trail. Tilstrekkelig for de fleste SMB-kunder som uansett godkjenner via e-post i dag.

**Fremtid:** BankID-signering for juridisk bindende signatur. Integrasjon med signeringstjeneste (f.eks. Signicat, Posten Signering).

## Avgrensninger

- MVP: Kun én godkjenner per selskap (kontaktpersonen)
- MVP: Ingen parallelle godkjenningsløp (styremedlemmer godkjenner individuelt)
- MVP: Spørsmål fra kunden er enveismeldinger (ikke chat)
- MVP: Ingen BankID-signering
- Senere: Flere godkjennere, BankID, styregodkjenning med signatur fra alle styremedlemmer
