# CostMini — India's Healthcare Price Transparency Platform

## Overview
CostMini compares medicine, surgery, and lab test prices across Indian pharmacies and hospitals. It features AI-powered prescription scanning (Gemini vision), Perplexity-style medicine search (Groq LLM), and WhatsApp bot integration for viral distribution.

**Target:** Indian consumers overpaying for branded medicines when identical generics cost 50-90% less.

## Tech Stack
- **Framework:** Next.js 16 (App Router, TypeScript)
- **Styling:** Tailwind CSS v4 with CSS variables (`var(--color-primary)` = teal)
- **Database:** Prisma 7 + SQLite (dev via better-sqlite3 adapter), PostgreSQL (prod)
- **AI Search:** Groq SDK → Llama 3.3 70B (streaming chat)
- **AI Vision:** Google GenAI → Gemini 2.5 Flash (prescription OCR)
- **Scraping:** Cheerio (1mg, PharmEasy, Netmeds, Apollo, JanAushadhi, MedPlus, Flipkart Health, Tata 1mg API)
- **Icons:** Lucide React
- **PWA:** manifest.json + SVG icons

## Commands
```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Production build
npm run seed         # Seed database with 200+ drugs, 25 procedures, 24 diagnostics
npx prisma generate  # Regenerate Prisma client
npx prisma db push   # Push schema to database
```

## Environment Variables
```env
# Required for AI features
GROQ_API_KEY=gsk_...          # Free at console.groq.com
GEMINI_API_KEY=AI...          # Free at aistudio.google.com

# Database
DATABASE_URL=file:./dev.db    # SQLite for dev (used by prisma db push)

# Sync/cron
CRON_SECRET=                  # Secret for /api/cron/sync endpoint

# WhatsApp (optional)
WHATSAPP_TOKEN=               # Meta Business API token
WHATSAPP_VERIFY_TOKEN=        # Webhook verification token
WHATSAPP_PHONE_ID=            # Business phone number ID
```

## Project Structure
```
src/
├── app/
│   ├── page.tsx                    # Homepage with hero, stats, categories
│   ├── layout.tsx                  # Root layout (Navbar, Footer, WhatsApp float)
│   ├── search/page.tsx             # AI-powered Perplexity-style search
│   ├── scan/page.tsx               # Prescription scanner (Gemini vision)
│   ├── medicines/
│   │   ├── page.tsx                # Medicine listing with Agoda-style filters
│   │   ├── [id]/page.tsx           # Drug detail with price comparison
│   │   └── loading.tsx             # Skeleton loader
│   ├── procedures/page.tsx         # Surgery pricing comparison
│   ├── diagnostics/page.tsx        # Lab test pricing
│   ├── api/
│   │   ├── ai/search/route.ts      # Groq streaming search endpoint
│   │   ├── ai/scan/route.ts        # Gemini vision scan endpoint
│   │   ├── drugs/search/route.ts   # Prisma drug search with pagination
│   │   ├── drugs/[id]/route.ts     # Drug detail + stale price refresh
│   │   ├── procedures/route.ts     # Prisma procedures API
│   │   ├── diagnostics/route.ts    # Prisma diagnostics API
│   │   ├── scan/route.ts           # Legacy OCR scan
│   │   ├── scrape/route.ts         # Live pharmacy scraping
│   │   ├── cron/sync/route.ts      # Background price sync (CRON_SECRET)
│   │   ├── cron/status/route.ts    # DB stats and sync status
│   │   └── whatsapp/webhook/       # WhatsApp bot webhook
│   ├── about/page.tsx
│   ├── how-it-works/page.tsx
│   ├── privacy/page.tsx
│   ├── terms/page.tsx
│   ├── disclaimer/page.tsx
│   └── contact/page.tsx
├── components/
│   ├── Navbar.tsx                   # Sticky nav with mobile menu
│   ├── Footer.tsx                   # Site footer
│   └── WhatsAppFloat.tsx            # Floating WhatsApp share button
├── lib/
│   ├── ai.ts                        # Groq + Gemini client, RAG context builder (async Prisma)
│   ├── db.ts                        # Prisma client singleton (better-sqlite3 adapter)
│   ├── constants.ts                  # Category arrays for filter dropdowns
│   ├── utils.ts                     # formatPrice, calcSavings, slugify, whatsapp helpers
│   ├── sync.ts                      # Price sync service (isDrugStale, refreshDrugPrices, fullSync)
│   ├── sample-data.ts               # 203 drugs, 25 procedures, 24 diagnostics (seed source)
│   ├── scrapers/
│   │   ├── base.ts                  # Abstract DrugScraper class
│   │   ├── onemg.ts                 # 1mg.com scraper
│   │   ├── pharmeasy.ts            # PharmEasy scraper
│   │   ├── netmeds.ts              # Netmeds scraper
│   │   ├── apollo.ts               # Apollo Pharmacy scraper
│   │   ├── janaushadhi.ts          # JanAushadhi scraper
│   │   ├── medplus.ts              # MedPlus scraper
│   │   ├── flipkart-health.ts      # Flipkart Health scraper
│   │   ├── tata1mg-api.ts          # Tata 1mg API scraper
│   │   └── index.ts                 # Multi-source aggregator (8 scrapers)
│   └── whatsapp/
│       ├── bot.ts                   # WhatsApp Business API handlers
│       └── index.ts                 # Re-exports
├── prisma/
│   ├── schema.prisma                # 9 models (Drug, Procedure, Diagnostic, SyncLog, etc.)
│   └── seed.ts                      # Database seeder (uses adapter)
└── public/
    ├── manifest.json                # PWA manifest
    ├── icon-192.svg                 # PWA icon small
    └── icon-512.svg                 # PWA icon large
```

## Database (203 drugs across 15 categories)
| Category | Count | Examples |
|---|---|---|
| Pain Relief | 13 | Dolo 650, Combiflam, Voveran SR, Brufen + generics |
| Antibiotics | 16 | Azithral, Augmentin, Zifi, Cipro + generics |
| Diabetes | 13 | Glycomet, Amaryl, Januvia, Jardiance + generics |
| Heart & BP | 19 | Stamlo, Telma, Atorva, Ecosprin + generics |
| Gastro | 13 | Pan 40, Omez, Razo, Domstal + generics |
| Vitamins | 13 | Shelcal, Becosules, Zincovit, Revital H + generics |
| Skin Care | 12 | Betadine, Tenovate, Candid + generics |
| Respiratory | 12 | Asthalin, Montair LC, Cetzine + generics |
| Mental Health | 12 | Nexito, Daxid, Fludac + generics |
| Others | 50+ | Thyroid, Women's Health, Eye/Ear, Anti-allergic, Liver, Kidney |

## Coding Conventions

### Styling
- Brand colors via CSS variables: `var(--color-primary)`, `var(--color-primary-dark)`
- Use Tailwind utility classes, not custom CSS
- Rounded corners: `rounded-xl` for cards, `rounded-2xl` for major containers
- Border style: `border border-gray-200`

### Prisma 7 + better-sqlite3 Adapter
- `src/lib/db.ts` uses `@prisma/adapter-better-sqlite3` with `PrismaBetterSqlite3({ url })`
- Config in `prisma.config.ts` (datasource URL for migrations)
- No `url` property in `schema.prisma` datasource block
- Seed script at `prisma/seed.ts` also uses the adapter directly

### Data Flow
- All API routes query Prisma (`prisma.drug.findMany()`, etc.)
- Frontend pages fetch from `/api/*` endpoints (no direct sample-data imports)
- `sample-data.ts` is only used by `prisma/seed.ts` for database seeding
- `constants.ts` provides category arrays for filter dropdowns

### AI Integration
- Groq for text generation (streaming via `ReadableStream`)
- Gemini for vision/image analysis
- Both degrade gracefully when API keys are missing
- RAG pattern: `buildMedicineContext()` in `ai.ts` queries Prisma DB and feeds to LLM

### Price Sync
- `src/lib/sync.ts` handles price freshness (24h staleness check)
- `/api/drugs/[id]` auto-refreshes stale prices on access (fire-and-forget)
- `/api/cron/sync` runs full database sync (protected by CRON_SECRET)
- 8 pharmacy scrapers run in parallel via `searchAllPharmacies()`

### API Routes
- All in `src/app/api/` using Next.js App Router route handlers
- Streaming responses use `new ReadableStream()` + `TextEncoder`
- Error responses: `NextResponse.json({ error: "..." }, { status: 4xx })`

## Common Tasks

### Add a new medicine
Add to `sampleDrugs` array in `src/lib/sample-data.ts`, then run `npm run seed`.

### Add a new pharmacy scraper
1. Create `src/lib/scrapers/newsite.ts` extending `DrugScraper` from `base.ts`
2. Implement `searchDrugs()` and `getDrugDetails()`
3. Register in `src/lib/scrapers/index.ts`

### Modify AI search behavior
Edit the `SYSTEM_PROMPT` constant in `src/lib/ai.ts`.

### Add a new page
Create `src/app/pagename/page.tsx`. Add to navbar links in `src/components/Navbar.tsx`.

## Deployment
- Vercel (recommended): Set env vars in dashboard, deploys on push
- Docker: Standard Next.js Dockerfile
- Database: Switch to PostgreSQL adapter for production
- Domain: costmini.in (configured in metadata and share URLs)
