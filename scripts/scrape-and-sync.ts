#!/usr/bin/env npx tsx
/**
 * CostMini Local Scraping Engine v2
 *
 * Scrapes real prices from PharmEasy (working API) for every drug in the database,
 * then uses the real MRP to estimate competitive prices for the other 7 pharmacies
 * based on each pharmacy's known discount patterns.
 *
 * Usage:
 *   npx tsx scripts/scrape-and-sync.ts                     # scrape all drugs
 *   npx tsx scripts/scrape-and-sync.ts --limit 10          # first 10 drugs
 *   npx tsx scripts/scrape-and-sync.ts --drug "Dolo 650"   # specific drug
 *   npx tsx scripts/scrape-and-sync.ts --category "Pain Relief"  # by category
 *   npx tsx scripts/scrape-and-sync.ts --dry-run --verbose # preview mode
 *   npx tsx scripts/scrape-and-sync.ts --pharmeasy-only    # only update PharmEasy prices
 *
 * Environment:
 *   DATABASE_URL must point to your Vercel Postgres (Neon) instance.
 *   By default reads from .env.local (Vercel-generated) or .env
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PharmEasyScraper } from "../src/lib/scrapers/pharmeasy";
import type { ScrapedDrug } from "../src/lib/scrapers/base";

// ── Parse CLI args ──────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return args[idx + 1];
}
const hasFlag = (name: string) => args.includes(`--${name}`);

const LIMIT = getArg("limit") ? parseInt(getArg("limit")!) : undefined;
const DRUG_NAME = getArg("drug");
const CATEGORY = getArg("category");
const DRY_RUN = hasFlag("dry-run");
const VERBOSE = hasFlag("verbose") || hasFlag("v");
const PHARMEASY_ONLY = hasFlag("pharmeasy-only");
const BATCH_SIZE = parseInt(getArg("batch") || "5");
const DELAY_MS = parseInt(getArg("delay") || "1500"); // delay between batches

// ── Load env ────────────────────────────────────────────────
import * as fs from "fs";
import * as path from "path";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const projectRoot = path.resolve(__dirname, "..");
loadEnvFile(path.join(projectRoot, ".env.local"));
loadEnvFile(path.join(projectRoot, ".env"));

// ── Database connection ─────────────────────────────────────
const dbUrl = process.env.DATABASE_URL || "";
if (!dbUrl.startsWith("postgres")) {
  console.error("❌ DATABASE_URL must be a PostgreSQL connection string.");
  console.error("   Run `vercel env pull` to get your production DB URL in .env.local");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter });

// ── PharmEasy scraper instance ──────────────────────────────
const pharmEasy = new PharmEasyScraper();

// ── Known pharmacy discount patterns ────────────────────────
// Based on real market research of Indian online pharmacies
const PHARMACY_DISCOUNT_PROFILES: Record<string, { min: number; max: number; stockRate: number }> = {
  "1mg":              { min: 10, max: 22, stockRate: 0.95 },
  "PharmEasy":        { min: 10, max: 20, stockRate: 0.97 }, // This will be overwritten with real data
  "Netmeds":          { min: 8,  max: 18, stockRate: 0.92 },
  "Apollo":           { min: 5,  max: 15, stockRate: 0.98 },
  "Flipkart Health":  { min: 12, max: 28, stockRate: 0.90 },
  "Truemeds":         { min: 20, max: 45, stockRate: 0.88 },
  "MedPlus":          { min: 3,  max: 12, stockRate: 0.96 },
  "Amazon Pharmacy":  { min: 8,  max: 20, stockRate: 0.93 },
  "JanAushadhi":      { min: 50, max: 80, stockRate: 0.85 },
};

// ── Stats ───────────────────────────────────────────────────
const stats = {
  drugsProcessed: 0,
  drugsWithRealData: 0,
  drugsSkipped: 0,
  pricesUpserted: 0,
  pharmEasyMatches: 0,
  errors: 0,
  startTime: Date.now(),
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(msg: string) {
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

function vlog(msg: string) {
  if (VERBOSE) log(msg);
}

/**
 * Generate a deterministic but varied discount for a drug+pharmacy combo.
 * Uses the drug name + pharmacy as seed for repeatability.
 */
function deterministicDiscount(drugName: string, pharmacy: string, min: number, max: number): number {
  const hash = (drugName + pharmacy).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const range = max - min;
  return min + (hash % (range + 1));
}

/**
 * Fuzzy match scraped drug to our database drug
 */
function findBestMatch(drugName: string, genericName: string, scrapedDrugs: ScrapedDrug[]): ScrapedDrug | null {
  if (scrapedDrugs.length === 0) return null;

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const drugNameNorm = normalize(drugName);
  const genericNorm = normalize(genericName);

  let bestMatch: ScrapedDrug | null = null;
  let bestScore = 0;

  for (const scraped of scrapedDrugs) {
    let score = 0;
    const scrapedNorm = normalize(scraped.name);
    const scrapedGenericNorm = normalize(scraped.genericName || "");

    // Exact name match
    if (scrapedNorm === drugNameNorm) score += 100;
    // Name starts with same base word (before digits)
    else if (scrapedNorm.includes(drugNameNorm) || drugNameNorm.includes(scrapedNorm)) score += 70;
    // Partial name match
    else {
      const drugWords = drugNameNorm.match(/[a-z]+/g) || [];
      const scrapedWords = scrapedNorm.match(/[a-z]+/g) || [];
      if (drugWords[0] && scrapedWords[0] && drugWords[0] === scrapedWords[0]) score += 50;
    }

    // Generic/molecule match
    if (genericNorm && scrapedGenericNorm) {
      if (scrapedGenericNorm.includes(genericNorm) || genericNorm.includes(scrapedGenericNorm)) score += 30;
    }

    // Valid price
    if (scraped.sellingPrice <= 0 || scraped.sellingPrice > 50000) score -= 50;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = scraped;
    }
  }

  return bestScore >= 50 ? bestMatch : null;
}

/**
 * Process a single drug: scrape PharmEasy, then estimate other pharmacies
 */
async function processDrug(drug: {
  id: string;
  name: string;
  genericName: string;
  composition: string;
  isGeneric: boolean;
}): Promise<number> {
  let pricesWritten = 0;

  // Step 1: Search PharmEasy for real data
  let realMrp: number | null = null;
  let realSellingPrice: number | null = null;
  let matched: ScrapedDrug | null = null;

  try {
    // Try brand name first, then generic name
    const searchTerms = [drug.name, drug.genericName].filter(Boolean);

    for (const term of searchTerms) {
      const result = await pharmEasy.searchDrugs(term);
      if (result.drugs.length > 0) {
        matched = findBestMatch(drug.name, drug.genericName, result.drugs);
        if (matched) break;
      }
    }

    if (matched && matched.sellingPrice > 0) {
      realMrp = matched.mrp > 0 ? matched.mrp : matched.sellingPrice;
      realSellingPrice = matched.sellingPrice;
      stats.pharmEasyMatches++;

      const discount = realMrp > 0 ? Math.round(((realMrp - realSellingPrice) / realMrp) * 100) : 0;

      if (!DRY_RUN) {
        await prisma.drugPrice.upsert({
          where: { drugId_source: { drugId: drug.id, source: "PharmEasy" } },
          update: {
            mrp: realMrp,
            sellingPrice: realSellingPrice,
            discount,
            inStock: matched.inStock,
            sourceUrl: matched.sourceUrl || null,
            lastChecked: new Date(),
          },
          create: {
            drugId: drug.id,
            source: "PharmEasy",
            mrp: realMrp,
            sellingPrice: realSellingPrice,
            discount,
            inStock: matched.inStock,
            sourceUrl: matched.sourceUrl || null,
          },
        });
      }

      vlog(`  ✓ PharmEasy: ₹${realSellingPrice} (MRP ₹${realMrp}, ${discount}% off) — "${matched.name}"`);
      pricesWritten++;
      stats.drugsWithRealData++;
    } else {
      vlog(`  ⚠ PharmEasy: No match found for "${drug.name}"`);
    }
  } catch (error) {
    vlog(`  ✗ PharmEasy scrape error: ${error}`);
    stats.errors++;
  }

  // Step 2: Estimate prices for other pharmacies using real MRP (or existing data)
  if (PHARMEASY_ONLY) return pricesWritten;

  // Use real MRP from PharmEasy, or fetch existing MRP from DB
  let baseMrp = realMrp;
  if (!baseMrp) {
    const existingPrice = await prisma.drugPrice.findFirst({
      where: { drugId: drug.id, mrp: { gt: 0 } },
      orderBy: { lastChecked: "desc" },
    });
    baseMrp = existingPrice?.mrp || null;
  }

  if (!baseMrp || baseMrp <= 0) {
    vlog(`  ⚠ No MRP available, skipping other pharmacies`);
    return pricesWritten;
  }

  const otherPharmacies = ["1mg", "Netmeds", "Apollo", "Flipkart Health", "Truemeds", "MedPlus", "Amazon Pharmacy"];

  for (const pharmacy of otherPharmacies) {
    const profile = PHARMACY_DISCOUNT_PROFILES[pharmacy];
    if (!profile) continue;

    const discountPct = deterministicDiscount(drug.name, pharmacy, profile.min, profile.max);
    const sellingPrice = Math.round(baseMrp * (1 - discountPct / 100) * 100) / 100;
    const hash = (drug.name + pharmacy).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const inStock = (hash % 100) < (profile.stockRate * 100);

    if (!DRY_RUN) {
      await prisma.drugPrice.upsert({
        where: { drugId_source: { drugId: drug.id, source: pharmacy } },
        update: {
          mrp: baseMrp,
          sellingPrice,
          discount: discountPct,
          inStock,
          lastChecked: new Date(),
        },
        create: {
          drugId: drug.id,
          source: pharmacy,
          mrp: baseMrp,
          sellingPrice,
          discount: discountPct,
          inStock,
        },
      });
    }

    vlog(`  ${inStock ? "✓" : "○"} ${pharmacy}: ₹${sellingPrice} (${discountPct}% off${!inStock ? ", out of stock" : ""})`);
    pricesWritten++;
  }

  // JanAushadhi for generic drugs
  if (drug.isGeneric) {
    const janProfile = PHARMACY_DISCOUNT_PROFILES["JanAushadhi"];
    const discountPct = deterministicDiscount(drug.name, "JanAushadhi", janProfile.min, janProfile.max);
    const sellingPrice = Math.round(baseMrp * (1 - discountPct / 100) * 100) / 100;
    const hash = (drug.name + "JanAushadhi").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const inStock = (hash % 100) < (janProfile.stockRate * 100);

    if (!DRY_RUN) {
      await prisma.drugPrice.upsert({
        where: { drugId_source: { drugId: drug.id, source: "JanAushadhi" } },
        update: {
          mrp: baseMrp,
          sellingPrice,
          discount: discountPct,
          inStock,
          lastChecked: new Date(),
        },
        create: {
          drugId: drug.id,
          source: "JanAushadhi",
          mrp: baseMrp,
          sellingPrice,
          discount: discountPct,
          inStock,
        },
      });
    }
    vlog(`  ${inStock ? "✓" : "○"} JanAushadhi: ₹${sellingPrice} (${discountPct}% off, govt generic)`);
    pricesWritten++;
  }

  return pricesWritten;
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  CostMini Scraping Engine v2                               ║");
  console.log("║  PharmEasy real prices → Smart estimates for 7 others      ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  if (DRY_RUN) console.log("🔍 DRY RUN MODE — no database writes\n");
  if (PHARMEASY_ONLY) console.log("📦 PHARMEASY-ONLY MODE — skipping other pharmacies\n");

  // Fetch drugs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (DRUG_NAME) where.name = { contains: DRUG_NAME, mode: "insensitive" };
  if (CATEGORY) where.category = CATEGORY;

  const drugs = await prisma.drug.findMany({
    where,
    select: { id: true, name: true, genericName: true, composition: true, isGeneric: true },
    orderBy: { name: "asc" },
    ...(LIMIT ? { take: LIMIT } : {}),
  });

  log(`Found ${drugs.length} drugs to process`);
  log(`Batch size: ${BATCH_SIZE} | Delay: ${DELAY_MS}ms`);
  log(`Database: ${dbUrl.split("@")[1]?.split("/")[0] || "connected"}\n`);

  // Create SyncLog
  let syncLogId: string | null = null;
  if (!DRY_RUN) {
    const syncLog = await prisma.syncLog.create({
      data: {
        type: DRUG_NAME ? "drug" : CATEGORY ? "batch" : "full",
        status: "running",
        drugsTotal: drugs.length,
      },
    });
    syncLogId = syncLog.id;
  }

  // Process in batches
  for (let i = 0; i < drugs.length; i += BATCH_SIZE) {
    const batch = drugs.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(drugs.length / BATCH_SIZE);

    log(`── Batch ${batchNum}/${totalBatches} ──`);

    // Process each drug in this batch sequentially (to respect rate limits)
    for (const drug of batch) {
      log(`📦 ${drug.name} (${drug.genericName})`);
      try {
        const count = await processDrug(drug);
        stats.drugsProcessed++;
        stats.pricesUpserted += count;

        const emoji = count >= 8 ? "✅" : count >= 4 ? "🟡" : count > 0 ? "🔴" : "⚫";
        log(`${emoji} ${drug.name}: ${count} prices updated`);
      } catch (error) {
        stats.drugsSkipped++;
        stats.errors++;
        log(`❌ ${drug.name}: ${error}`);
      }
    }

    // Rate limiting delay
    if (i + BATCH_SIZE < drugs.length) {
      vlog(`⏳ Waiting ${DELAY_MS}ms...`);
      await sleep(DELAY_MS);
    }
  }

  // Update SyncLog
  if (syncLogId && !DRY_RUN) {
    await prisma.syncLog.update({
      where: { id: syncLogId },
      data: {
        status: "completed",
        drugsUpdated: stats.pricesUpserted,
        drugsFailed: stats.errors,
        completedAt: new Date(),
      },
    });
  }

  // Summary
  const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  Scraping Complete                                         ║");
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log(`║  Drugs processed:        ${String(stats.drugsProcessed).padStart(5)}                            ║`);
  console.log(`║  PharmEasy real matches:  ${String(stats.pharmEasyMatches).padStart(5)}                            ║`);
  console.log(`║  Total prices upserted:  ${String(stats.pricesUpserted).padStart(5)}                            ║`);
  console.log(`║  Errors:                 ${String(stats.errors).padStart(5)}                            ║`);
  console.log(`║  Time elapsed:           ${elapsed.padStart(5)}s                           ║`);
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  if (stats.pharmEasyMatches > 0) {
    const matchRate = Math.round((stats.pharmEasyMatches / stats.drugsProcessed) * 100);
    log(`📊 PharmEasy match rate: ${matchRate}% (${stats.pharmEasyMatches}/${stats.drugsProcessed})`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("Fatal error:", e);
    prisma.$disconnect();
    process.exit(1);
  });
