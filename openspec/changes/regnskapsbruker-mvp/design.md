# Design: Regnskapsbruker MVP

## Overordnet arkitektur

Regnskapsbruker er en webapplikasjon med to brukergrupper (kunde og RF) som deler samme backend, men har separate frontend-visninger.

```
                    ┌─────────────────────────┐
                    │        Frontend         │
                    │  (Next.js / React)      │
                    ├────────────┬────────────┤
                    │ Kundevisning│ RF-visning │
                    └─────┬──────┴─────┬──────┘
                          │            │
                          ▼            ▼
                    ┌─────────────────────────┐
                    │       API-lag           │
                    │   (Next.js API routes)  │
                    ├─────────────────────────┤
                    │    Forretningslogikk    │
                    │  (prosessmotor, regler) │
                    └──────────┬──────────────┘
                               │
                    ┌──────────┼──────────────┐
                    │          │              │
                    ▼          ▼              ▼
              ┌──────────┐ ┌────────┐ ┌───────────┐
              │ Database │ │ Fil-   │ │ Eksterne  │
              │(Postgres)│ │lagring │ │ tjenester │
              └──────────┘ │ (S3)   │ │           │
                           └────────┘ └───────────┘
                                        │
                                  ┌─────┼──────┐
                                  ▼     ▼      ▼
                              Brreg  E-post  (CataCloud
                              API    (Send-   senere)
                                     Grid)
```

## Teknologivalg

### Frontend: Next.js (App Router) + React + Tailwind CSS

**Begrunnelse:**
- Server-side rendering for rask lasting og SEO (invitasjonslenker)
- App Router gir naturlig oppdeling mellom `/kunde/` og `/rf/`-ruter
- React er industristandard med stort komponent-økosystem
- Tailwind gir rask UI-utvikling med konsistent design
- Shadcn/ui som komponentbibliotek for profesjonelle, tilgjengelige komponenter

**Alternativ vurdert:** Separate SPAs for kunde og RF. Forkastet fordi delt kodebase er enklere å vedlikeholde i MVP-fasen.

### Backend: Next.js API Routes + Drizzle ORM

**Begrunnelse:**
- Samme prosjekt for frontend og backend reduserer kompleksitet
- API Routes er tilstrekkelig for MVP-skala
- Drizzle ORM gir typesikker databasetilgang med god DX
- TypeScript end-to-end (frontend + backend + database-skjema)

**Alternativ vurdert:** Separat backend (NestJS, FastAPI). Forkastet for MVP - kan splittes ut senere om nødvendig.

### Database: PostgreSQL (via Supabase eller Neon)

**Begrunnelse:**
- Relasjonsdatabase passer datamodellen (selskap -> oppgaver -> dokumenter)
- Postgres er industristandard med god JSON-støtte for fleksible felter
- Supabase/Neon gir managed hosting med generøst gratisnivå for MVP
- Row Level Security (RLS) i Supabase kan forenkle tilgangskontroll

**Alternativ vurdert:** SQLite (for enkelthet). Forkastet fordi multi-user krever en reell databaseserver.

### Fillagring: S3-kompatibel (Supabase Storage eller AWS S3)

**Begrunnelse:**
- Bilag og dokumenter trenger sikker, skalerbar lagring
- S3 er standardvalg med god integrasjon mot alle plattformer
- Supabase Storage er S3-kompatibelt og integrert med auth
- Presigned URLs for sikker opp- og nedlasting uten å gå via serveren

### Autentisering: NextAuth.js (Auth.js)

**Begrunnelse:**
- Enkel integrasjon med Next.js
- Støtter e-post/passord (MVP) og kan utvides med BankID, Vipps Login senere
- Rollebasert tilgang: brukertype = "kunde" | "rf" | "admin"
- Magic link som alternativ til passord (god UX for kunder som logger inn sjelden)

**MVP-autentisering:**
- RF: E-post + passord
- Kunde: Magic link via e-post (enklest mulig, kunden logger inn sjelden)

**Senere:** BankID for godkjenning/signering, Vipps Login for enklere innlogging.

### E-post: Resend

**Begrunnelse:**
- Moderne e-posttjeneste med god developer experience
- React Email for å bygge e-postmaler i JSX (samme stack som frontend)
- Generøst gratisnivå (3 000 e-poster/mnd)
- God leverbarhet med innebygd SPF/DKIM

**Alternativ vurdert:** SendGrid. Fungerer godt, men Resend har bedre DX for React-prosjekter.

## Databaseskjema (forenklet)

```sql
-- Brukere og autentisering (håndtert av NextAuth)
users (id, email, name, role, created_at)

-- Regnskapsførere
accountants (id, user_id, firm_name)

-- Selskaper
companies (
  id, org_nr, name, company_type,
  vat_registered, has_employees, process_model,
  address, industry_code, founded_date,
  accountant_id, created_at
)

-- Kontaktpersoner (kundens brukere)
contacts (
  id, company_id, user_id,
  name, email, role, created_at
)

-- Sykluser (et regnskapsår)
cycles (
  id, company_id, year, status,
  created_at, completed_at
)

-- Oppgaver (generert av prosessmotoren)
tasks (
  id, cycle_id, title, description,
  type, sort_order, required,
  status, deadline_relative,
  delivered_at, approved_at
)

-- Dokumenter
documents (
  id, task_id, company_id, cycle_id,
  original_filename, stored_path,
  file_type, file_size,
  uploaded_by, uploaded_at,
  status, rejection_reason
)

-- Godkjenninger
approvals (
  id, company_id, cycle_id,
  document_id, type,
  approved_by, approved_at,
  ip_address, user_agent
)

-- Varsler
notifications (
  id, recipient_user_id, recipient_email,
  type, company_id, content,
  sent_at, read_at, channel,
  related_task_id
)
```

## Mappestruktur (prosjekt)

```
regnskapsbruker/
├── src/
│   ├── app/
│   │   ├── (auth)/          # Innlogging, registrering, magic link
│   │   ├── (kunde)/         # Kundevisning
│   │   │   ├── dashboard/   # Oppgaveliste
│   │   │   └── oppgave/     # Enkeltoppgave med opplasting
│   │   ├── (rf)/            # RF-visning
│   │   │   ├── dashboard/   # Kundeoversikt
│   │   │   ├── kunde/       # Drill-down på enkeltkunde
│   │   │   └── ny-kunde/    # Onboarding-flyt
│   │   └── api/             # API-endepunkter
│   ├── components/          # Delte UI-komponenter
│   ├── lib/
│   │   ├── db/              # Databaseskjema og tilkobling (Drizzle)
│   │   ├── prosessmotor/    # Regelmotor og sjekklister
│   │   ├── auth/            # Autentiseringsconfig
│   │   ├── email/           # E-postmaler og sending
│   │   └── brreg/           # Brønnøysund API-klient
│   └── types/               # TypeScript-typer
├── public/                  # Statiske filer
├── rules/                   # Prosessmotorens regelkonfigurasjon (YAML)
│   └── enkelt-as.yaml       # Regler for enkelt AS uten MVA
└── ...config-filer
```

## Integrasjoner

### Brønnøysundregistrene (MVP)

- **API:** `https://data.brreg.no/enhetsregisteret/api/enheter/{orgnr}`
- **Bruk:** Hente selskapsinformasjon ved onboarding
- **Autentisering:** Åpent API, ingen nøkkel nødvendig
- **Rate limit:** Rimelig bruk, ingen dokumentert grense

### CataCloud (fremtidig)

- **API:** GraphQL på `developers.catacloud.com`
- **Mulige integrasjoner:**
  - Synke kundeliste fra CataCloud til Regnskapsbruker
  - Overføre opplastede bilag til CataCloud som bilagsgrunnlag
  - Hente status på årsoppgjør fra CataCloud
- **Ikke i MVP:** Manuell overføring av filer fra Regnskapsbruker til CataCloud

### Intect (fremtidig)

- Lønnsintegrasjon for kunder med ansatte
- Ikke i MVP-scope

## Sikkerhet

- **HTTPS:** Obligatorisk, ingen HTTP
- **Autentisering:** Alle endepunkter krever innlogget bruker
- **Autorisering:** Middleware sjekker at bruker har tilgang til forespurt selskap
  - Kunde kan kun se egne selskap
  - RF kan kun se selskap de er tilknyttet
- **Fillagring:** Presigned URLs med kort levetid (15 min) for nedlasting
- **Opplasting:** Filtyper valideres server-side (ikke bare klient)
- **Input:** Sanitering av all brukerinput
- **GDPR:** Persondata minimeres, slettemulighet for kunde

## Deployment

**MVP: Vercel**
- Null-konfig deployment for Next.js
- Edge-funksjonar for god ytelse i Norge
- Preview-deploys for testing
- Gratis for MVP-skala

**Database:** Supabase (gratis tier) eller Neon
**Fillagring:** Supabase Storage
**E-post:** Resend
**Domene:** regnskapsbruker.no (eller lignende)

## Beslutninger som er tatt

| Beslutning | Valg | Begrunnelse |
|-----------|------|-------------|
| Monorepo vs. separate repos | Monorepo | Ett prosjekt, enklere i MVP |
| SSR vs. SPA | SSR (Next.js) | Raskere førstelasting, bedre for magic links |
| REST vs. GraphQL | REST (API Routes) | Enklere for MVP, GraphQL har overhead |
| Auth-metode for kunde | Magic link | Kunden logger inn sjelden, passord er friksjon |
| Auth-metode for RF | E-post + passord | RF logger inn daglig, trenger rask tilgang |
| Prosessmotor-regler | YAML-konfigurasjon | Kan endres uten kodeendring |
| E-posttjeneste | Resend | Best DX for React/Next.js-stack |
| Hosting | Vercel + Supabase | Minst mulig ops-arbeid for MVP |
