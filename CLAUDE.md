# CostMini — India's Healthcare Price Transparency Platform

## Overview
CostMini compares medicine, surgery, and lab test prices across Indian pharmacies and hospitals. It features AI-powered prescription scanning (Gemini vision), Perplexity-style medicine search (Groq LLM), and WhatsApp bot integration for viral distribution.

**Target:** Indian consumers overpaying for branded medicines when identical generics cost 50-90% less.

## Tech Stack
- **Framework:** Next.js 16 (App Router, TypeScript)
- **Styling:** Tailwind CSS v4 with CSS variables (`var(--color-primary)` = teal)
- **Database:** Prisma 7 + SQLite (dev), PostgreSQL (prod)
- **AI Search:** Groq SDK → Llama 3.3 70B (streaming chat)
- **AI Vision:** Google GenAI → Gemini 2.5 Flash (prescription OCR)
- **Scraping:** Cheerio (1mg.com, PharmEasy.in)
- **Icons:** Lucide React
- **PWA:** manifest.json + SVG icons

## Commands
```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Production build
npm run seed         # Seed database with sample data
npx prisma generate  # Regenerate Prisma client
npx prisma db push   # Push schema to database
```

## Environment Variables
```env
# Required for AI features
GROQ_API_KEY=gsk_...          # Free at console.groq.com
GEMINI_API_KEY=AI...          # Free at aistudio.google.com

# Database
DATABASE_URL=file:./dev.db    # SQLite for dev

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
│   │   ├── page.tsx                # Medicine listing with filters
│   │   ├── [id]/page.tsx           # Drug detail with price comparison
│   │   └── loading.tsx             # Skeleton loader
│   ├── procedures/page.tsx         # Surgery pricing comparison
│   ├── diagnostics/page.tsx        # Lab test pricing
│   ├── api/
│   │   ├── ai/search/route.ts      # Groq streaming search endpoint
│   │   ├── ai/scan/route.ts        # Gemini vision scan endpoint
│   │   ├── drugs/search/route.ts   # Database drug search
│   │   ├── drugs/[id]/route.ts     # Drug detail API
│   │   ├── procedures/route.ts     # Procedures API
│   │   ├── diagnostics/route.ts    # Diagnostics API
│   │   ├── scan/route.ts           # Legacy OCR scan
│   │   ├── scrape/route.ts         # Live pharmacy scraping
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
│   ├── ai.ts                        # Groq + Gemini client, RAG context builder
│   ├── db.ts                        # Prisma client singleton (uses require())
│   ├── utils.ts                     # formatPrice, calcSavings, slugify, whatsapp helpers
│   ├── sample-data.ts               # 11 drugs, 5 procedures, 6 diagnostics with prices
│   ├── scrapers/
│   │   ├── base.ts                  # Abstract DrugScraper class
│   │   ├── onemg.ts                 # 1mg.com scraper
│   │   ├── pharmeasy.ts            # PharmEasy scraper
│   │   └── index.ts                 # Multi-source aggregator
│   └── whatsapp/
│       ├── bot.ts                   # WhatsApp Business API handlers
│       └── index.ts                 # Re-exports
├── prisma/
│   ├── schema.prisma                # 9 models (Drug, Procedure, Diagnostic, etc.)
│   └── seed.ts                      # Database seeder
└── public/
    ├── manifest.json                # PWA manifest
    ├── icon-192.svg                 # PWA icon small
    └── icon-512.svg                 # PWA icon large
```

## Coding Conventions

### Styling
- Brand colors via CSS variables: `var(--color-primary)`, `var(--color-primary-dark)`
- Use Tailwind utility classes, not custom CSS
- Rounded corners: `rounded-xl` for cards, `rounded-2xl` for major containers
- Border style: `border border-gray-200`

### Prisma 7 Quirks
- Import via `require()`: `const { PrismaClient } = require("@prisma/client")`
- Config in `prisma.config.ts` (not in schema.prisma)
- No `url` property in schema datasource block

### Data Pattern
- Sample data in `src/lib/sample-data.ts` for development/demo
- Each drug has: `name`, `genericName`, `manufacturer`, `composition`, `category`, `prices[]`
- Prices array: `{ source, mrp, sellingPrice, inStock }`
- Generic alternatives linked by matching `genericName`

### AI Integration
- Groq for text generation (streaming via `ReadableStream`)
- Gemini for vision/image analysis
- Both degrade gracefully when API keys are missing
- RAG pattern: `buildMedicineContext()` in `ai.ts` searches sample data and feeds to LLM

### API Routes
- All in `src/app/api/` using Next.js App Router route handlers
- Streaming responses use `new ReadableStream()` + `TextEncoder`
- Error responses: `NextResponse.json({ error: "..." }, { status: 4xx })`

## Common Tasks

### Add a new medicine
Add to `sampleDrugs` array in `src/lib/sample-data.ts`. Include branded + generic variants with matching `genericName`. The AI search will automatically pick it up via `buildMedicineContext()`.

### Add a new pharmacy scraper
1. Create `src/lib/scrapers/newsite.ts` extending `DrugScraper` from `base.ts`
2. Implement `searchDrugs()` and `getDrugDetails()`
3. Register in `src/lib/scrapers/index.ts`

### Modify AI search behavior
Edit the `SYSTEM_PROMPT` constant in `src/lib/ai.ts`. The prompt controls personality, formatting rules, and disclaimer behavior.

### Add a new page
Create `src/app/pagename/page.tsx`. Add to navbar links array in `src/components/Navbar.tsx`. Add loading skeleton at `src/app/pagename/loading.tsx`.

## Deployment
- Vercel (recommended): Set env vars in dashboard, deploys on push
- Docker: Standard Next.js Dockerfile
- Database: Switch `DATABASE_URL` to PostgreSQL for production
- Domain: costmini.in (configured in metadata and share URLs)
