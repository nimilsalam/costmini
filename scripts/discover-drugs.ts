#!/usr/bin/env npx tsx
/**
 * CostMini Drug Discovery Engine
 *
 * Searches all 8 pharmacies for a given term and discovers new drugs
 * that don't exist in our database yet. Can auto-add them with prices.
 *
 * Usage:
 *   npx tsx scripts/discover-drugs.ts "paracetamol"
 *   npx tsx scripts/discover-drugs.ts "metformin" --add
 *   npx tsx scripts/discover-drugs.ts "blood pressure" --add --category "Heart & BP"
 *
 * The first argument is the search term. Use --add to insert into DB.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { searchAllPharmacies, ScrapedDrug } from "../src/lib/scrapers/index";
import * as fs from "fs";
import * as path from "path";

// ── Load env ────────────────────────────────────────────────
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

// ── CLI args ────────────────────────────────────────────────
const args = process.argv.slice(2);
const searchTerm = args.find((a) => !a.startsWith("--"));
const shouldAdd = args.includes("--add");
const categoryIdx = args.indexOf("--category");
const category = categoryIdx !== -1 ? args[categoryIdx + 1] : undefined;

if (!searchTerm) {
  console.log("Usage: npx tsx scripts/discover-drugs.ts <search-term> [--add] [--category <cat>]");
  console.log("\nExamples:");
  console.log('  npx tsx scripts/discover-drugs.ts "paracetamol"');
  console.log('  npx tsx scripts/discover-drugs.ts "blood pressure" --add --category "Heart & BP"');
  process.exit(1);
}

// ── DB connection ───────────────────────────────────────────
const dbUrl = process.env.DATABASE_URL || "";
if (!dbUrl.startsWith("postgres")) {
  console.error("❌ DATABASE_URL must be PostgreSQL. Run `vercel env pull` first.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter });

// ── Helpers ─────────────────────────────────────────────────
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function inferCategory(drug: ScrapedDrug): string {
  if (category) return category;
  const name = (drug.name + " " + drug.genericName + " " + drug.composition).toLowerCase();
  if (/paracetamol|ibuprofen|diclofenac|pain|analgesic|aceclofenac/.test(name)) return "Pain Relief";
  if (/azithromycin|amoxicillin|cefixime|ciprofloxacin|antibiotic|ofloxacin/.test(name)) return "Antibiotics";
  if (/metformin|glimepiride|insulin|diabetes|sitagliptin|voglibose/.test(name)) return "Diabetes";
  if (/amlodipine|telmisartan|atorvastatin|losartan|ramipril|blood pressure|heart/.test(name)) return "Heart & BP";
  if (/omeprazole|pantoprazole|ranitidine|antacid|gastro/.test(name)) return "Gastro";
  if (/vitamin|calcium|zinc|iron|folic/.test(name)) return "Vitamins";
  if (/cream|ointment|skin|derma|clotrimazole|betamethasone/.test(name)) return "Skin Care";
  if (/salbutamol|montelukast|cetirizine|asthma|inhaler|respiratory/.test(name)) return "Respiratory";
  if (/fluoxetine|sertraline|escitalopram|mental|anxiety|depression/.test(name)) return "Mental Health";
  if (/levothyroxine|thyroid/.test(name)) return "Thyroid";
  return "General";
}

function inferDosageForm(drug: ScrapedDrug): string {
  const name = (drug.name + " " + drug.packSize).toLowerCase();
  if (/tablet|tab/.test(name)) return "Tablet";
  if (/capsule|cap/.test(name)) return "Capsule";
  if (/syrup|suspension|liquid|oral solution/.test(name)) return "Syrup";
  if (/injection|vial|ampoule/.test(name)) return "Injection";
  if (/cream/.test(name)) return "Cream";
  if (/ointment/.test(name)) return "Ointment";
  if (/drop/.test(name)) return "Drops";
  if (/inhaler/.test(name)) return "Inhaler";
  if (/gel/.test(name)) return "Gel";
  if (/powder|sachet/.test(name)) return "Powder";
  return "Tablet";
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔍 Searching all pharmacies for: "${searchTerm}"\n`);

  const results = await searchAllPharmacies(searchTerm!);

  // Collect unique drugs across all sources
  const drugMap = new Map<
    string,
    { drug: ScrapedDrug; sources: Map<string, ScrapedDrug> }
  >();

  for (const result of results) {
    console.log(`  ${result.source}: ${result.drugs.length} results${result.error ? ` (⚠ ${result.error})` : ""}`);

    for (const drug of result.drugs) {
      if (!drug.name || drug.sellingPrice <= 0) continue;

      // Normalize key by removing spaces, special chars
      const key = drug.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 30);

      if (!drugMap.has(key)) {
        drugMap.set(key, { drug, sources: new Map() });
      }
      drugMap.get(key)!.sources.set(result.source, drug);
    }
  }

  console.log(`\n📊 Found ${drugMap.size} unique drugs across all pharmacies\n`);

  // Check which ones already exist in our database
  const existingSlugs = new Set(
    (await prisma.drug.findMany({ select: { slug: true } })).map((d) => d.slug)
  );
  const existingNames = new Set(
    (await prisma.drug.findMany({ select: { name: true } })).map((d) => d.name.toLowerCase())
  );

  const newDrugs: Array<{
    drug: ScrapedDrug;
    sources: Map<string, ScrapedDrug>;
  }> = [];
  const existingDrugs: string[] = [];

  for (const [, entry] of drugMap) {
    const slug = toSlug(entry.drug.name);
    if (existingSlugs.has(slug) || existingNames.has(entry.drug.name.toLowerCase())) {
      existingDrugs.push(entry.drug.name);
    } else {
      newDrugs.push(entry);
    }
  }

  console.log(`  ✓ Already in database: ${existingDrugs.length}`);
  console.log(`  ★ NEW drugs found:     ${newDrugs.length}\n`);

  if (newDrugs.length === 0) {
    console.log("No new drugs to add. Your database already has all matching results! 🎉");
    return;
  }

  // Print new drug details
  console.log("┌────────────────────────────────────────────────────────────────────┐");
  console.log("│ New Drugs Discovered                                              │");
  console.log("├────────────────────────────────────────────────────────────────────┤");

  for (const entry of newDrugs) {
    const { drug, sources } = entry;
    const prices = [...sources.values()].map((s) => s.sellingPrice).filter((p) => p > 0);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    console.log(
      `│ ${drug.name.padEnd(35)} ₹${minPrice}-₹${maxPrice}`.padEnd(69) + "│"
    );
    console.log(
      `│   Generic: ${(drug.genericName || "N/A").padEnd(23)} Sources: ${sources.size}/8`.padEnd(69) + "│"
    );
    console.log(
      `│   Mfr: ${(drug.manufacturer || "N/A").padEnd(26)} Rx: ${drug.prescriptionRequired ? "Yes" : "No"}`.padEnd(69) +
        "│"
    );
  }

  console.log("└────────────────────────────────────────────────────────────────────┘");

  if (!shouldAdd) {
    console.log("\n💡 To add these drugs to the database, run again with --add flag:");
    console.log(`   npx tsx scripts/discover-drugs.ts "${searchTerm}" --add\n`);
    return;
  }

  // Add new drugs to database
  console.log("\n📝 Adding new drugs to database...\n");
  let added = 0;

  for (const entry of newDrugs) {
    const { drug, sources } = entry;
    const slug = toSlug(drug.name);

    // Verify slug uniqueness
    const existingSlug = await prisma.drug.findUnique({ where: { slug } });
    if (existingSlug) {
      console.log(`  ⏭ ${drug.name}: slug "${slug}" already exists, skipping`);
      continue;
    }

    try {
      const newDrug = await prisma.drug.create({
        data: {
          name: drug.name,
          slug,
          genericName: drug.genericName || drug.name,
          brandName: drug.name,
          manufacturer: drug.manufacturer || "Unknown",
          composition: drug.composition || drug.genericName || drug.name,
          category: inferCategory(drug),
          dosageForm: inferDosageForm(drug),
          packSize: drug.packSize || "1 strip",
          prescriptionReq: drug.prescriptionRequired,
          isGeneric: !drug.manufacturer || drug.name.toLowerCase().includes("generic"),
          whoCertified: false,
        },
      });

      // Add prices from all sources
      let priceCount = 0;
      for (const [source, scraped] of sources) {
        if (scraped.sellingPrice <= 0) continue;

        const mrp = scraped.mrp > 0 ? scraped.mrp : scraped.sellingPrice;
        const discount = mrp > 0 ? Math.round(((mrp - scraped.sellingPrice) / mrp) * 100) : 0;

        await prisma.drugPrice.create({
          data: {
            drugId: newDrug.id,
            source,
            mrp,
            sellingPrice: scraped.sellingPrice,
            discount,
            inStock: scraped.inStock,
            sourceUrl: scraped.sourceUrl || null,
          },
        });
        priceCount++;
      }

      console.log(`  ✅ ${drug.name} — ${priceCount} pharmacy prices added`);
      added++;
    } catch (error) {
      console.log(`  ❌ ${drug.name}: ${error}`);
    }
  }

  console.log(`\n🎉 Added ${added} new drugs to the database!\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("Fatal error:", e);
    prisma.$disconnect();
    process.exit(1);
  });
