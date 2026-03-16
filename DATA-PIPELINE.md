# CostMini Data Pipeline — Master Execution Plan

> Source of truth for transforming 440k+ raw pharmacy products into a searchable drug database.
> Created: 2026-03-12

---

## Current State

### Harvest Status (as of 2026-03-12)
| Pharmacy | Source | Products | Target | Status | File |
|----------|--------|----------|--------|--------|------|
| Apollo | Salt search | 95,828 | Done | COMPLETE | `apollo-salts-fast/_products.jsonl` |
| 1mg | Salt search | 53,824 | Done | COMPLETE | `1mg-fast/_products.jsonl` |
| 1mg | Sitemap | ~105k | 665,500 | RUNNING | `1mg-sitemap/_products.jsonl` |
| Netmeds | Sitemap | ~93k | 299,139 | RUNNING | `netmeds-fast/_products.jsonl` |
| PharmEasy | Salt search | 20,417 | Done | COMPLETE | `pharmeasy-fast/_products.jsonl` |
| PharmEasy | Sitemap | ~37k | 233,413 | RUNNING | `pharmeasy-sitemap/_products.jsonl` |
| Truemeds | Sitemap | 655 | 212,336 | BLOCKED (IP 403) | `truemeds-fast/_products.jsonl` |
| MedPlus | — | 0 | Unknown | SKIPPED (SPA) | — |

### DB State
- 203 drugs (from seed), 29 manufacturers
- Schema supports: CompositionGroup, Drug, DrugPrice, Manufacturer, DrugAlternative
- CompositionGroup table: EXISTS but EMPTY

### Key Files Already Built
- `src/lib/composition-matcher.ts` — Composition parsing + normalization
- `scripts/build-composition-groups.js` — Groups drugs by composition (raw SQL)
- `scripts/import-to-db.ts` — Old importer (Postgres-only, reads JSON not JSONL)

---

## Pipeline Architecture

```
Phase 1: HARVEST (running)
  Sitemaps → Product pages → JSONL files (per pharmacy)

Phase 2: NORMALIZE (build now)
  All JSONL files → Unified format → Deduplicated → unified-products.jsonl

Phase 3: IMPORT (build now)
  unified-products.jsonl → SQLite DB:
    → Manufacturers (upsert by name)
    → CompositionGroups (upsert by compositionKey)
    → Drugs (upsert by slug, link to mfr + group)
    → DrugPrices (upsert by drug+source)
    → DrugAlternatives (same compositionGroup = alternatives)

Phase 4: POST-IMPORT
  → Recompute CompositionGroup stats (drugCount, lowestPrice, highestPrice)
  → Link drugs to known Manufacturers (fuzzy match mfr names)
  → Verify search works (case-insensitive)
```

---

## Phase 2: Normalization Rules

### Field Mapping Per Pharmacy

| Field | 1mg Sitemap | Apollo | Netmeds | PharmEasy Sitemap |
|-------|-------------|--------|---------|-------------------|
| name | name | name | name | name |
| composition | composition | composition / searchSalt | composition | composition / molecule |
| manufacturer | manufacturer | (missing - brand only) | manufacturer | manufacturer |
| mrp | mrp | mrp | mrp | mrp |
| sellingPrice | sellingPrice | sellingPrice | sellingPrice | sellingPrice |
| packSize | packInfo | unitSize | (from name) | packSize |
| dosageForm | (from packInfo/name) | (from unitSize/name) | (from name) | dosageForm |
| rxRequired | rxRequired | isPrescription | rxRequired | rxRequired |
| inStock | inStock | inStock | inStock | inStock |
| url | url | (construct from urlKey) | url | url |
| source | "1mg" | "Apollo" | "Netmeds" | "PharmEasy" |

### Composition Normalization
Uses `composition-matcher.ts`:
- `parseComposition()` handles all formats: "Paracetamol(40.0 Mg)", "Paracetamol 500mg", "PARACETAMOL"
- `getMatchingKey()` returns canonical key: `paracetamol-500mg::tablet`
- Salt aliases resolve synonyms: acetaminophen → paracetamol

### Deduplication Strategy
1. **Within pharmacy**: Sitemap harvest supersedes salt-search harvest (has richer data)
2. **Cross pharmacy**: Keep ALL products — different pharmacy = different DrugPrice
3. **Same product key**: `{source}:{slug}` — if duplicate, keep the one with more data

### Manufacturer Normalization
- Uppercase + trim: "ABBOTT HEALTHCARE PVT LTD" → "Abbott Healthcare Pvt Ltd"
- Fuzzy match to existing 29 manufacturers for `manufacturerId` linking
- New manufacturers: create with default scores (tier: "standard", score: 50)

### Category Inference
Uses `inferCategory()` from import-to-db.ts:
- First check `therapy` field (PharmEasy has this)
- Then check `category`/`categoryL2` (Netmeds, Apollo)
- Then check composition for known molecules
- Fallback: "Others"

---

## Phase 3: Import Strategy

### Order of Operations
1. **Manufacturers** — Upsert all unique manufacturer names
2. **CompositionGroups** — Create groups from all unique compositionKeys
3. **Drugs** — Upsert with manufacturer + compositionGroup links
4. **DrugPrices** — One per drug-source combination
5. **DrugAlternatives** — Auto-generate within same compositionGroup

### Scale Considerations
- ~440k products → ~200-300k unique drugs (after dedup within pharmacy)
- ~50k+ unique compositions → ~30-40k composition groups
- ~5,000+ unique manufacturers
- SQLite can handle this but need batch inserts (not one-by-one)
- Use transactions of 500 records for speed

### Incremental Import
- Script supports `--resume` via tracking which slugs are already imported
- Can re-run after more harvest data arrives
- `--fresh` flag to wipe and reimport everything

---

## Phase 4: Post-Import Quality

### Critical Fixes (during/after import)
1. **Case-insensitive search**: Add `COLLATE NOCASE` to Drug name/genericName columns
   OR store `nameLower` column with `@@index`
2. **Zero-price filtering**: Skip drugs with mrp=0 or absurd prices (>100k likely data errors)
3. **Composition coverage**: Track % of drugs with valid compositions

### Verification Queries
```sql
-- Total drugs per source
SELECT source, COUNT(*) FROM DrugPrice GROUP BY source;

-- Composition group coverage
SELECT COUNT(*) as total, COUNT(compositionGroupId) as grouped FROM Drug;

-- Manufacturer link rate
SELECT COUNT(*) as total, COUNT(manufacturerId) as linked FROM Drug;

-- Price sanity
SELECT source, MIN(mrp), AVG(mrp), MAX(mrp) FROM DrugPrice WHERE mrp > 0 GROUP BY source;
```

---

## Execution Checklist

- [ ] Phase 2: Build `scripts/normalize-and-import.js`
  - [ ] Read all JSONL files from all pharmacy harvests
  - [ ] Map to unified schema
  - [ ] Deduplicate (sitemap > salt within same pharmacy)
  - [ ] Parse compositions via composition-matcher
  - [ ] Infer categories, dosage forms
  - [ ] Write unified-products.jsonl

- [ ] Phase 3: Import to SQLite
  - [ ] Upsert manufacturers
  - [ ] Create composition groups
  - [ ] Upsert drugs with links
  - [ ] Upsert drug prices
  - [ ] Auto-generate alternatives

- [ ] Phase 4: Post-import
  - [ ] Fix case-insensitive search
  - [ ] Recompute composition group stats
  - [ ] Verify data quality
  - [ ] Test search, medicines page, drug detail

- [ ] Resume harvests (ongoing)
  - [ ] `node scripts/harvest-1mg-sitemap.js --resume`
  - [ ] `node scripts/harvest-netmeds-fast.js --resume`
  - [ ] `node scripts/harvest-pharmeasy-sitemap.js --resume`
  - [ ] Re-run import after harvest completes for more data
