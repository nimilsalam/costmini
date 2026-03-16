/**
 * Harvest drug data from all 8 pharmacy websites.
 * Saves each drug's results as a separate JSON file per pharmacy folder.
 *
 * Usage:
 *   npx tsx scripts/harvest-pharmacies.ts                    # All pharmacies, all drugs
 *   npx tsx scripts/harvest-pharmacies.ts --pharmacy 1mg     # Single pharmacy
 *   npx tsx scripts/harvest-pharmacies.ts --limit 10         # First 10 drugs only
 *   npx tsx scripts/harvest-pharmacies.ts --pharmacy apollo --delay 2000
 */

import { OneMgScraper } from "../src/lib/scrapers/onemg";
import { PharmEasyScraper } from "../src/lib/scrapers/pharmeasy";
import { NetmedsScraper } from "../src/lib/scrapers/netmeds";
import { ApolloScraper } from "../src/lib/scrapers/apollo";
import { FlipkartHealthScraper } from "../src/lib/scrapers/flipkart";
import { TruemedsScraper } from "../src/lib/scrapers/truemeds";
import { MedPlusScraper } from "../src/lib/scrapers/medplus";
import { AmazonPharmacyScraper } from "../src/lib/scrapers/amazon";
import { sampleDrugs } from "../src/lib/sample-data";
import { DrugScraper } from "../src/lib/scrapers/base";
import * as fs from "fs";
import * as path from "path";

// ─── Config ────────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, "..", "data", "harvested");

const ALL_SCRAPERS: Record<string, DrugScraper> = {
  "1mg": new OneMgScraper(),
  pharmeasy: new PharmEasyScraper(),
  netmeds: new NetmedsScraper(),
  apollo: new ApolloScraper(),
  flipkart: new FlipkartHealthScraper(),
  truemeds: new TruemedsScraper(),
  medplus: new MedPlusScraper(),
  amazon: new AmazonPharmacyScraper(),
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ─── Parse CLI args ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const pharmacyFilter = getArg("--pharmacy")?.toLowerCase();
const limitStr = getArg("--limit");
const limit = limitStr ? parseInt(limitStr, 10) : Infinity;
const delayStr = getArg("--delay");
const delay = delayStr ? parseInt(delayStr, 10) : 1500; // ms between requests
const skipExisting = !args.includes("--force");
const concurrency = parseInt(getArg("--concurrency") || "3", 10);

// ─── Get drug list (only medicine drugs, not procedures/diagnostics) ───────────

const drugNames: { name: string; slug: string }[] = sampleDrugs
  .filter((d: any) => !d.cityPrices && !d.labPrices) // exclude procedures & diagnostics
  .map((d: any) => ({ name: d.name, slug: slugify(d.name) }))
  .slice(0, limit);

// ─── Select scrapers ──────────────────────────────────────────────────────────

const scrapers: Record<string, DrugScraper> = {};
if (pharmacyFilter) {
  const key = Object.keys(ALL_SCRAPERS).find(
    (k) => k.toLowerCase() === pharmacyFilter
  );
  if (!key) {
    console.error(
      `Unknown pharmacy: ${pharmacyFilter}. Available: ${Object.keys(ALL_SCRAPERS).join(", ")}`
    );
    process.exit(1);
  }
  scrapers[key] = ALL_SCRAPERS[key];
} else {
  Object.assign(scrapers, ALL_SCRAPERS);
}

// ─── Main harvest loop ────────────────────────────────────────────────────────

async function harvestPharmacy(pharmacyKey: string, scraper: DrugScraper) {
  const pharmacyDir = path.join(DATA_DIR, pharmacyKey);
  ensureDir(pharmacyDir);

  let success = 0;
  let skipped = 0;
  let failed = 0;
  let empty = 0;

  console.log(
    `\n${"=".repeat(60)}\n  ${pharmacyKey.toUpperCase()} — ${drugNames.length} drugs to harvest\n${"=".repeat(60)}`
  );

  // Process in batches for concurrency control
  for (let i = 0; i < drugNames.length; i += concurrency) {
    const batch = drugNames.slice(i, i + concurrency);

    const promises = batch.map(async (drug, batchIdx) => {
      const idx = i + batchIdx;
      const filePath = path.join(pharmacyDir, `${drug.slug}.json`);

      // Skip if already harvested (unless --force)
      if (skipExisting && fs.existsSync(filePath)) {
        const existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        if (existing.drugs && existing.drugs.length > 0) {
          skipped++;
          return;
        }
      }

      try {
        const result = await scraper.searchDrugs(drug.name);

        const output = {
          query: drug.name,
          slug: drug.slug,
          source: result.source,
          scrapedAt: result.scrapedAt.toISOString(),
          drugCount: result.drugs.length,
          error: result.error || null,
          drugs: result.drugs,
        };

        fs.writeFileSync(filePath, JSON.stringify(output, null, 2));

        if (result.drugs.length > 0) {
          success++;
          const tag = result.error ? " (with error)" : "";
          console.log(
            `  [${idx + 1}/${drugNames.length}] ${drug.name} → ${result.drugs.length} results${tag}`
          );
        } else {
          empty++;
          console.log(
            `  [${idx + 1}/${drugNames.length}] ${drug.name} → 0 results${result.error ? ` (${result.error})` : ""}`
          );
        }
      } catch (err: any) {
        failed++;
        // Save error file so we know it was attempted
        const errorOutput = {
          query: drug.name,
          slug: drug.slug,
          source: pharmacyKey,
          scrapedAt: new Date().toISOString(),
          drugCount: 0,
          error: err.message || "Unknown error",
          drugs: [],
        };
        fs.writeFileSync(filePath, JSON.stringify(errorOutput, null, 2));
        console.log(
          `  [${idx + 1}/${drugNames.length}] ${drug.name} → FAILED: ${err.message}`
        );
      }
    });

    await Promise.allSettled(promises);

    // Rate limiting between batches
    if (i + concurrency < drugNames.length) {
      await sleep(delay);
    }
  }

  console.log(
    `\n  ${pharmacyKey} Summary: ${success} harvested, ${empty} empty, ${skipped} skipped, ${failed} failed`
  );

  return { pharmacyKey, success, empty, skipped, failed };
}

async function main() {
  console.log(`\nCostMini Pharmacy Harvester`);
  console.log(`─────────────────────────────────`);
  console.log(`Drugs to search: ${drugNames.length}`);
  console.log(`Pharmacies: ${Object.keys(scrapers).join(", ")}`);
  console.log(`Delay: ${delay}ms between batches`);
  console.log(`Concurrency: ${concurrency} parallel requests`);
  console.log(`Skip existing: ${skipExisting}`);
  console.log(`Output: ${DATA_DIR}`);

  ensureDir(DATA_DIR);

  const results: { pharmacyKey: string; success: number; empty: number; skipped: number; failed: number }[] = [];

  // Process pharmacies sequentially to avoid hammering all at once
  for (const [key, scraper] of Object.entries(scrapers)) {
    const result = await harvestPharmacy(key, scraper);
    results.push(result);
  }

  // ─── Final summary ────────────────────────────────────────────────────────────

  console.log(`\n\n${"=".repeat(60)}`);
  console.log(`  HARVEST COMPLETE`);
  console.log(`${"=".repeat(60)}`);
  console.log(
    `\n  ${"Pharmacy".padEnd(15)} ${"Success".padEnd(10)} ${"Empty".padEnd(10)} ${"Skipped".padEnd(10)} ${"Failed".padEnd(10)}`
  );
  console.log(`  ${"─".repeat(55)}`);

  let totalSuccess = 0,
    totalEmpty = 0,
    totalSkipped = 0,
    totalFailed = 0;

  for (const r of results) {
    console.log(
      `  ${r.pharmacyKey.padEnd(15)} ${String(r.success).padEnd(10)} ${String(r.empty).padEnd(10)} ${String(r.skipped).padEnd(10)} ${String(r.failed).padEnd(10)}`
    );
    totalSuccess += r.success;
    totalEmpty += r.empty;
    totalSkipped += r.skipped;
    totalFailed += r.failed;
  }

  console.log(`  ${"─".repeat(55)}`);
  console.log(
    `  ${"TOTAL".padEnd(15)} ${String(totalSuccess).padEnd(10)} ${String(totalEmpty).padEnd(10)} ${String(totalSkipped).padEnd(10)} ${String(totalFailed).padEnd(10)}`
  );

  // Save summary
  const summaryPath = path.join(DATA_DIR, "_harvest-summary.json");
  fs.writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        harvestedAt: new Date().toISOString(),
        totalDrugs: drugNames.length,
        pharmacies: results,
        totals: {
          success: totalSuccess,
          empty: totalEmpty,
          skipped: totalSkipped,
          failed: totalFailed,
        },
      },
      null,
      2
    )
  );
  console.log(`\n  Summary saved to ${summaryPath}\n`);
}

main().catch(console.error);
