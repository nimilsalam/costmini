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
│   ├── page.tsx                    # Homepage with real DB stats, autocomplete search
│   ├── layout.tsx                  # Root layout (Navbar, Footer, WhatsApp float)
│   ├── search/page.tsx             # AI-powered Perplexity-style search
│   ├── scan/page.tsx               # Prescription scanner (Gemini vision)
│   ├── medicines/
│   │   ├── page.tsx                # Medicine listing with infinite scroll + autocomplete + tier dots
│   │   ├── [id]/page.tsx           # Drug detail with SSE streaming, CostMini Score, manufacturer badge
│   │   └── loading.tsx             # Skeleton loader
│   ├── manufacturers/
│   │   ├── page.tsx                # Manufacturer directory with quality scores & tier badges
│   │   └── [slug]/page.tsx         # Individual manufacturer detail + drugs list
│   ├── pharmacies/
│   │   ├── page.tsx                # Pharmacy directory (8 online pharmacies)
│   │   └── [slug]/page.tsx         # Individual pharmacy + available drugs
│   ├── procedures/page.tsx         # Surgery pricing comparison
│   ├── diagnostics/page.tsx        # Lab test pricing
│   ├── api/
│   │   ├── ai/search/route.ts      # Groq streaming search endpoint
│   │   ├── ai/scan/route.ts        # Gemini vision scan endpoint
│   │   ├── drugs/search/route.ts   # Cached Prisma drug search
│   │   ├── drugs/[id]/route.ts     # Cached drug detail + stale price refresh
│   │   ├── drugs/[id]/stream/route.ts  # SSE real-time price streaming
│   │   ├── drugs/[id]/history/route.ts # 30-day price history + trends
│   │   ├── drugs/autocomplete/route.ts # Fast typeahead search (cached)
│   │   ├── drugs/availability/route.ts # Quick stock status check
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
│   ├── WhatsAppFloat.tsx            # Floating WhatsApp share button
│   └── SearchAutocomplete.tsx       # Reusable typeahead with 150ms debounce
├── hooks/
│   └── usePriceStream.ts           # SSE hook for EventSource price streaming
├── lib/
│   ├── ai.ts                        # Groq + Gemini client, RAG context builder (includes mfr quality)
│   ├── cache.ts                     # In-memory LRU cache (Map + TTL, globalThis singleton)
│   ├── costmini-score.ts            # CostMini Score algorithm (0-100, price+quality+availability)
│   ├── freshness.ts                 # Price freshness labels (fresh/recent/stale)
│   ├── manufacturer-data.ts         # Seed data for 29 Indian pharma companies with aliases
│   ├── manufacturer-scoring.ts      # Manufacturer scoring (regulatory, market presence, tiers)
│   ├── pharmacy-profiles.ts         # Static metadata for 8 pharmacy scrapers
│   ├── db.ts                        # Prisma client singleton (better-sqlite3 adapter)
│   ├── constants.ts                  # Category arrays for filter dropdowns
│   ├── utils.ts                     # formatPrice, calcSavings, slugify, whatsapp helpers
│   ├── sync.ts                      # Price sync + history recording
│   ├── sample-data.ts               # 203 drugs, 25 procedures, 24 diagnostics (seed source)
│   ├── scrapers/
│   │   ├── base.ts                  # Abstract DrugScraper class
│   │   ├── onemg.ts                 # 1mg.com scraper
│   │   ├── pharmeasy.ts            # PharmEasy scraper
│   │   ├── netmeds.ts              # Netmeds scraper
│   │   ├── apollo.ts               # Apollo Pharmacy scraper
│   │   ├── medplus.ts              # MedPlus scraper
│   │   ├── flipkart.ts             # Flipkart Health scraper
│   │   ├── truemeds.ts             # Truemeds scraper
│   │   ├── amazon.ts               # Amazon Pharmacy scraper
│   │   └── index.ts                 # Multi-source aggregator (8 scrapers)
│   └── whatsapp/
│       ├── bot.ts                   # WhatsApp Business API handlers
│       └── index.ts                 # Re-exports
├── prisma/
│   ├── schema.prisma                # 11 models (Drug, Manufacturer, PriceHistory, Procedure, etc.)
│   └── seed.ts                      # Database seeder (uses adapter)
├── vercel.json                      # Cron: sync every 6 hours
└── public/
    ├── manifest.json                # PWA manifest
    ├── icon-192.svg                 # PWA icon small
    ├── icon-512.svg                 # PWA icon large
    └── pharmacies/                  # 8 SVG pharmacy logos (1mg, pharmeasy, etc.)
```

## Database (11 models, 203 drugs, 29 manufacturers across 15 categories)
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

## Manufacturer Rating System
29 Indian pharma companies rated algorithmically. `Manufacturer` model linked to `Drug` via `manufacturerId`.

### Scoring Weights
- **Regulatory Quality (40%):** FDA +35, WHO +35, EU-GMP +30 → max 100
- **Market Presence (25%):** Global rank + market cap scaled
- **Product Range (15%):** Drug count in DB (normalized)
- **Pricing Fairness (10%):** Average discount across drugs
- **Data Freshness (10%):** % of drugs with recent price data

### Tiers
| Tier | Score | Color | Examples |
|------|-------|-------|---------|
| Premium | 85-100 | Gold (#D97706) | Sun Pharma, Cipla, Dr. Reddy's, Lupin, Zydus |
| Trusted | 65-84 | Blue (#2563EB) | Torrent, Glenmark, Alkem, Abbott India |
| Standard | 40-64 | Gray (#6B7280) | Micro Labs, Aristo, USV |
| Government | Special | Green (#059669) | Jan Aushadhi (flat score 75) |

## CostMini Score (Best-Choice Algorithm)
Composite 0-100 score for each drug-pharmacy combination. **Computed on-the-fly, NOT stored in DB.**

### Score Components
| Factor | Points | How |
|--------|--------|-----|
| Price Value | 0-35 | Position in price range (cheapest = 35) |
| Manufacturer Quality | 0-25 | Maps manufacturer score (0-100) to 0-25 |
| Availability | 0-15 | In stock +12, pharmacy rating ≥4.0 +3 |
| Trust Signals | 0-15 | Generic +5, WHO-certified +5, premium mfr +5 |
| Data Freshness | 0-10 | Fresh (<1h) = 10, recent (<24h) = 5, stale = 0 |

### Badges
- **Best Value** (≥80): Green badge, highlighted row
- **Recommended** (≥65): Blue badge
- **Good Option** (≥50): Gray badge

### Integration Points
- Drug detail page: Recommendation card + score column in price table
- SSE stream: Live scores in price events
- Drug detail API: Pre-computed scores in response
- AI search: Manufacturer quality context in RAG

## Pharmacy Profiles
Static TypeScript map (`pharmacy-profiles.ts`) for 8 online pharmacies:
- 1mg, PharmEasy, Netmeds, Apollo, Flipkart Health, Truemeds, MedPlus, Amazon Pharmacy
- Each has: brand colors, shipping info, return policy, COD availability, editorial rating (1-5)
- SVG logos in `public/pharmacies/`

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

### Data Flow (Real-Time Agoda-Style)
```
User → SearchAutocomplete → /api/drugs/autocomplete (cached, <50ms)
User → Drug Detail → /api/drugs/[id] (cached 15min) → SSE /stream (live scrapers)
User → Medicines List → /api/drugs/search (cached 5min) → infinite scroll
Homepage → Server Component → prisma.drug.count() (real DB stats)
```
- In-memory cache (`src/lib/cache.ts`) with TTL: prices 15min, search 5min, autocomplete 10min
- SSE streaming: prices appear pharmacy-by-pharmacy via `EventSource` + `usePriceStream` hook
- Freshness indicators on every price (green <1h, yellow <24h, red >24h)
- Cache invalidation after price refresh completes

### AI Integration
- Groq for text generation (streaming via `ReadableStream`)
- Gemini for vision/image analysis
- Both degrade gracefully when API keys are missing
- RAG pattern: `buildMedicineContext()` in `ai.ts` queries Prisma DB and feeds to LLM

### Price Sync + History
- `src/lib/sync.ts` handles price freshness (24h staleness check)
- Every upsert also records to `PriceHistory` for 30-day trend tracking
- `/api/drugs/[id]` auto-refreshes stale prices on access (fire-and-forget)
- `/api/drugs/[id]/stream` fires all 8 scrapers live, streams results via SSE
- `/api/cron/sync` runs full database sync every 6h (Vercel cron via `vercel.json`)
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
