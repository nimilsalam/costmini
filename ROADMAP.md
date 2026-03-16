# CostMini Roadmap & Agent Build Guide

> This document is the source of truth for all future agents working on CostMini.
> Read this BEFORE starting any feature work.
> Also read `UX-EDGE-CASES.md` for the complete UX edge case audit (90+ cases, prioritized).

---

## Vision

CostMini is a **clinical decision support system for Indian consumers** — not just a price comparison tool. Users upload prescriptions or medicine photos, and CostMini recommends the best alternatives considering price, quality, safety, and patient-specific factors.

**Differentiator:** State-of-the-art drug scoring algorithm that combines pharmacological intelligence with price transparency.

---

## Architecture Overview

```
User Input Methods:
  1. Website: Upload prescription photo     -> /scan page
  2. Website: Upload medicine bottle/pack   -> /scan page (multi-image)
  3. WhatsApp: Send any photo via chat      -> WhatsApp Bot webhook
  4. Website: Text search / AI search       -> /search, /medicines

Processing Pipeline:
  Input -> Gemini Vision OCR -> Drug Identification -> DB Lookup
       -> CostMini Score Algorithm -> Recommendations -> Display

Output:
  - Best Overall recommendation
  - Best Price option
  - Best Quality option
  - Score breakdown with reasoning
  - Generic alternatives
  - Safety alerts (allergies, interactions, contraindications)
```

---

## Phase 1: Foundation (CURRENT)

### 1.1 Database Import [IN PROGRESS]
- Import comprehensive drug database (200+ drugs, expandable)
- Manufacturer data with quality metrics
- Price data from 8 pharmacy scrapers
- Drug composition data (active ingredients, strengths)

### 1.2 UX Polish [DONE]
- Fixed SQLite compatibility (removed `mode: "insensitive"`)
- Single search bar on medicines page
- Error states with retry
- Navbar responsive breakpoints (lg instead of md)
- WhatsApp float repositioned
- Homepage queries pass to AI search
- Footer dead links fixed

### 1.3 shadcn UI Rewrite [NEXT]
- Install shadcn/ui with Tailwind CSS v4
- Replace all hand-rolled components with shadcn primitives
- Key components to use:
  - `Button`, `Input`, `Badge`, `Card` — everywhere
  - `Table` — drug price comparison (mobile-responsive)
  - `Slider` — price range filter
  - `Tabs` — Best Price / Best Quality / Best Overall
  - `Dialog/Sheet` — mobile filters
  - `Skeleton` — loading states
  - `Toast` — notifications
  - `Command` — search autocomplete (cmdk)
  - `DropdownMenu` — sort options
  - `Accordion` — drug info sections
  - `Progress` — SSE streaming progress
  - `Avatar` — pharmacy logos in table
  - `Tooltip` — score explanations
  - `Alert` — safety warnings, stale price warnings

---

## Phase 2: Smart Scan (Multi-Image Upload)

### 2.1 Scan Page Redesign
**Current:** Single image, prescription-only
**Target:** Multi-image, supports prescriptions AND medicine bottles/packs

#### UI Requirements
- Drag-and-drop zone accepting multiple files
- Camera capture button (mobile-first)
- Two modes toggle: "Prescription" vs "Medicine Pack/Bottle"
- Image preview grid with remove option
- Per-image processing status indicator

#### Processing Flow
```
Upload Image(s)
  -> Gemini Vision analyzes each image
  -> For prescriptions: extract drug names, dosages, quantities
  -> For bottles/packs: read label (brand name, composition, mfr, batch, expiry)
  -> Match extracted data against drug database
  -> Run CostMini Score Algorithm on each identified drug
  -> Display grouped results per image
```

#### API Changes
- `POST /api/scan` — accept multiple images (FormData with multiple files)
- Return structured results per image:
  ```json
  {
    "images": [
      {
        "imageId": "...",
        "type": "prescription" | "medicine_pack",
        "extractedDrugs": [
          {
            "name": "Dolo 650",
            "composition": "Paracetamol 650mg",
            "confidence": 0.95,
            "matchedDrugId": "...",
            "recommendations": { ... }
          }
        ]
      }
    ]
  }
  ```

### 2.2 WhatsApp Bot Integration
- User sends photo(s) to CostMini WhatsApp number
- Bot processes via same Gemini Vision pipeline
- Returns formatted comparison + recommendation
- Deep link back to website for full details
- **Viral loop:** "Share this saving with family" CTA in response

#### WhatsApp API Flow
```
User sends image -> /api/whatsapp/webhook
  -> Download media from WhatsApp API
  -> Process through scan pipeline
  -> Format results as WhatsApp message (text + buttons)
  -> Send reply via WhatsApp Business API
  -> Include "View full comparison" link to website
```

---

## Phase 3: CostMini Score Algorithm v2

### 3.1 Score Architecture

The algorithm produces a composite score (0-100) for each drug option, broken into transparent sub-scores.

```
CostMini Score = weighted_sum(
  PriceScore,
  QualityScore,
  SafetyScore,
  EfficacyScore,
  AvailabilityScore
)
```

### 3.2 Price Score (0-100, Weight: 25%)

| Factor | Points | Method |
|--------|--------|--------|
| Absolute price position | 0-40 | Where it falls in min-max range across pharmacies |
| Per-unit cost | 0-30 | Normalize by pack size for fair comparison |
| Price trend | 0-15 | Historical trend (rising = penalty, stable/falling = bonus) |
| Price consistency | 0-15 | Variance across pharmacies (low variance = trustworthy) |

### 3.3 Quality Score (0-100, Weight: 30%)

| Factor | Points | Method |
|--------|--------|--------|
| Manufacturer GMP tier | 0-25 | Premium/Trusted/Standard/Budget scoring |
| Regulatory approvals | 0-25 | US-FDA (+10), WHO-PQ (+10), EU-GMP (+5) |
| Bioequivalence data | 0-20 | Published BE studies = higher score |
| Recall history | 0-15 | Recent recalls = major penalty |
| Market presence | 0-15 | Years in market, global distribution |

### 3.4 Safety Score (0-100, Weight: 25%)

**This is what makes CostMini unique — patient-personalized safety scoring.**

| Factor | Points | Method |
|--------|--------|--------|
| Adverse effect profile | 0-30 | Severity-weighted adverse effect incidence |
| Drug interactions | 0-25 | Cross-check against patient's current medications |
| Allergy cross-reactivity | 0-25 | Flag if patient has known allergies to similar compounds |
| Contraindications | 0-20 | Age, pregnancy, renal/hepatic conditions |

#### Composition-Specific Bases
Different drug compositions have inherently different safety profiles:
- **Minoxidil + Finasteride combo** — higher adverse effect base (sexual side effects, scalp irritation)
- **Paracetamol 500mg** — very low adverse effect base
- **Metformin** — moderate base (GI effects common)
- Each composition gets a **base safety score** that is then modified by patient factors

#### Data Sources for Safety
- Drug monograph data (UpToDate/Lexicomp-style)
- CDSCO adverse event reports (Indian regulatory data)
- Published clinical trial safety data
- WHO adverse reaction database

### 3.5 Efficacy Score (0-100, Weight: 15%)

| Factor | Points | Method |
|--------|--------|--------|
| Active ingredient match | 0-40 | Exact same composition = full score |
| Dosage form suitability | 0-20 | Tablet vs syrup vs injection appropriateness |
| Bioavailability | 0-20 | Known BA differences between formulations |
| Clinical evidence | 0-20 | Head-to-head studies, meta-analyses |

### 3.6 Availability Score (0-100, Weight: 5%)

| Factor | Points | Method |
|--------|--------|--------|
| In-stock status | 0-40 | Available = 40, out of stock = 0 |
| Pharmacy reliability | 0-30 | Based on pharmacy rating (delivery speed, returns) |
| Data freshness | 0-30 | Fresh (<1h) = 30, Stale (>24h) = 0 |

### 3.7 Weight Adjustment by Context

Weights shift based on the drug category:
```
Chronic medication (diabetes, BP):   Quality 35%, Safety 30%, Price 20%, Efficacy 10%, Avail 5%
Acute medication (antibiotics):       Efficacy 30%, Safety 25%, Quality 20%, Price 20%, Avail 5%
OTC / supplements:                    Price 35%, Quality 25%, Safety 15%, Efficacy 15%, Avail 10%
High-risk drugs (chemo, immuno):      Safety 40%, Quality 30%, Efficacy 20%, Price 5%, Avail 5%
```

### 3.8 Output Format

For each drug, the algorithm outputs:
```typescript
interface CostMiniScore {
  total: number;           // 0-100 composite
  badge: "best-value" | "best-price" | "best-quality" | "recommended" | "caution" | null;

  breakdown: {
    price: { score: number; weight: number; details: string };
    quality: { score: number; weight: number; details: string };
    safety: { score: number; weight: number; details: string };
    efficacy: { score: number; weight: number; details: string };
    availability: { score: number; weight: number; details: string };
  };

  alerts: SafetyAlert[];   // Allergies, interactions, contraindications
  explanation: string;      // Human-readable recommendation
}

interface SafetyAlert {
  type: "allergy" | "interaction" | "contraindication" | "adverse_effect";
  severity: "critical" | "warning" | "info";
  message: string;
  source: string;           // Citation
}
```

### 3.9 Recommendation Logic

The algorithm may recommend **different options for different goals**:
```
Best Overall:  Highest composite CostMini Score
Best Price:    Lowest per-unit cost among options with Safety > 60
Best Quality:  Highest Quality + Safety score, regardless of price
```

If Best Price and Best Quality are different drugs, show BOTH as tabs:
```
Tab 1: "Best Overall" — Drug A from PharmEasy (Score: 87)
Tab 2: "Best Price"   — Drug B from Netmeds (Score: 72, saves Rs. 200)
Tab 3: "Best Quality" — Drug C from 1mg (Score: 91, premium manufacturer)
```

---

## Phase 4: Patient Profile System

### 4.1 Patient Information (Anonymous, Local-First)

Users can optionally provide health info to personalize recommendations.
**Privacy-first:** stored in localStorage, never sent to server except for scoring.

```typescript
interface PatientProfile {
  // Demographics
  ageGroup: "child" | "adult" | "elderly";
  sex: "male" | "female" | "other";
  pregnancyStatus?: "pregnant" | "breastfeeding" | "none";

  // Medical
  knownAllergies: string[];         // ["Penicillin", "Sulfa drugs"]
  currentMedications: string[];     // ["Metformin 500mg", "Amlodipine 5mg"]
  conditions: string[];             // ["Diabetes Type 2", "Hypertension"]
  renalFunction?: "normal" | "mild" | "moderate" | "severe";
  hepaticFunction?: "normal" | "mild" | "moderate" | "severe";

  // Preferences
  preferGeneric: boolean;
  maxBudget?: number;               // Monthly medicine budget
  preferredPharmacies?: string[];
}
```

### 4.2 Patient Profile UI
- Settings/Profile page with form
- Optional — algorithm works without it, just with reduced safety scoring
- "Update Health Info" prompt on scan results page
- Data stored in localStorage + optional encrypted cloud sync

---

## Phase 5: Drug Information Database

### 5.1 Comprehensive Drug Monographs

Each drug in the DB needs clinical data beyond price:

```typescript
interface DrugMonograph {
  // Identification
  activeIngredients: { name: string; strength: string; unit: string }[];
  atcCode: string;                    // WHO ATC classification
  scheduleClass: "H" | "X" | "G" | "OTC";  // Indian drug schedule

  // Clinical
  indications: string[];
  contraindications: string[];
  adverseEffects: {
    effect: string;
    frequency: "very_common" | "common" | "uncommon" | "rare" | "very_rare";
    severity: "mild" | "moderate" | "severe";
  }[];
  drugInteractions: {
    drug: string;
    severity: "major" | "moderate" | "minor";
    effect: string;
  }[];

  // Pharmacology
  mechanismOfAction: string;
  pharmacokinetics: {
    bioavailability: string;
    halfLife: string;
    metabolism: string;
    excretion: string;
  };

  // Special Populations
  pediatricUse: string;
  geriatricUse: string;
  pregnancyCategory: "A" | "B" | "C" | "D" | "X";
  renalDosing: string;
  hepaticDosing: string;
}
```

### 5.2 Data Sources
- CDSCO approved drug database (Indian regulatory)
- WHO Essential Medicines List
- Published pharmacopeia data
- OpenFDA adverse event data (US reference)
- Clinical practice guidelines (Indian + international)

### 5.3 Database Schema Additions
New Prisma models needed:
```prisma
model DrugMonograph {
  id              String @id @default(cuid())
  drugId          String @unique
  drug            Drug   @relation(fields: [drugId], references: [id])
  atcCode         String?
  scheduleClass   String?
  mechanismAction String?
  bioavailability String?
  halfLife        String?
  pregnancyCat    String?

  adverseEffects    AdverseEffect[]
  drugInteractions  DrugInteraction[]
  contraindications Contraindication[]
}

model AdverseEffect {
  id           String @id @default(cuid())
  monographId  String
  monograph    DrugMonograph @relation(fields: [monographId], references: [id])
  effect       String
  frequency    String   // very_common, common, uncommon, rare
  severity     String   // mild, moderate, severe
}

model DrugInteraction {
  id           String @id @default(cuid())
  monographId  String
  monograph    DrugMonograph @relation(fields: [monographId], references: [id])
  interactsWith String  // Drug name or class
  severity     String   // major, moderate, minor
  effect       String
  mechanism    String?
}

model Contraindication {
  id           String @id @default(cuid())
  monographId  String
  monograph    DrugMonograph @relation(fields: [monographId], references: [id])
  condition    String
  severity     String   // absolute, relative
  reason       String
}
```

---

## Phase 6: Advanced Features

### 6.1 Price Alerts
- User subscribes to a drug
- Notify via WhatsApp when price drops below threshold
- Weekly digest of price changes for their medications

### 6.2 Medication Tracker
- Track current medications with dosing schedule
- Refill reminders
- Automatic price monitoring for all tracked meds

### 6.3 Doctor/Pharmacist Mode
- Professional view with full monograph data
- Batch prescription analysis
- Formulary comparison tools

### 6.4 Regional Pricing
- Hospital-specific surgery costs
- Lab-specific diagnostic prices
- City-wise price variations

---

## Technical Debt & Notes

### Current Issues
- Schema is `sqlite` for dev — needs dual-provider strategy for prod PostgreSQL
- Price scraping is estimated for 7 of 8 pharmacies (only PharmEasy has real API)
- No rate limiting on API routes
- No authentication system (will need for patient profiles)

### Agent Instructions

**Before building any feature:**
1. Read this ROADMAP.md for context
2. Read CLAUDE.md for codebase conventions
3. Check `prisma/schema.prisma` for current DB state
4. Check `src/lib/costmini-score.ts` for current algorithm

**Key files by feature area:**
- Scan/OCR: `src/app/scan/page.tsx`, `src/app/api/ai/scan/route.ts`, `src/lib/ai.ts`
- Algorithm: `src/lib/costmini-score.ts`, `src/lib/manufacturer-scoring.ts`
- Price data: `src/lib/scrapers/`, `src/lib/sync.ts`
- WhatsApp: `src/lib/whatsapp/`, `src/app/api/whatsapp/`
- Drug detail: `src/app/medicines/[id]/page.tsx`, `src/app/api/drugs/[id]/`
- AI Search: `src/app/search/page.tsx`, `src/app/api/ai/search/route.ts`

**Testing commands:**
```bash
npm run dev              # Dev server
npm run build            # Verify build passes
npm run scrape:test      # Test scrapers
npx prisma db push       # Push schema changes
npx tsx prisma/seed.ts   # Seed database
```
