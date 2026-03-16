/**
 * Import collected drugs into the Neon Postgres database
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

function inferCategory(p: Record<string, unknown>): string {
  const therapy = String(p.category || "").toUpperCase();
  const comp = String(p.composition || p.genericName || "").toUpperCase();
  const name = String(p.name || "").toUpperCase();

  if (therapy.includes("ANTI-DIABETIC") || therapy.includes("DIABETES")) return "Diabetes";
  if (therapy.includes("ANTI-HYPERTENSIVE") || therapy.includes("CARDIAC") || therapy.includes("CARDIOVASCULAR")) return "Heart & BP";
  if (therapy.includes("ANTIBIOTIC") || therapy.includes("ANTI-INFECTIVE")) return "Antibiotics";
  if (therapy.includes("ANALGESIC") || therapy.includes("ANTI-INFLAMMATORY") || therapy.includes("NSAID")) return "Pain Relief";
  if (therapy.includes("ANTACID") || therapy.includes("GASTRO") || therapy.includes("PPI")) return "Gastro";
  if (therapy.includes("RESPIRATORY") || therapy.includes("ANTI-ASTHMA")) return "Respiratory";
  if (therapy.includes("PSYCHIATRIC") || therapy.includes("NEURO") || therapy.includes("ANTI-DEPRESSANT") || therapy.includes("ANXIOLYTIC")) return "Mental Health";
  if (therapy.includes("DERMAT") || therapy.includes("SKIN")) return "Skin Care";
  if (therapy.includes("VITAMIN") || therapy.includes("SUPPLEMENT")) return "Vitamins";
  if (therapy.includes("THYROID")) return "Thyroid";
  if (therapy.includes("OPHTHAL") || therapy.includes("EYE")) return "Eye Care";
  if (therapy.includes("ANTI-ALLERG") || therapy.includes("ANTIHISTAMINE")) return "Anti-Allergic";
  if (therapy.includes("HORMONAL") || therapy.includes("GYNAEC")) return "Women's Health";
  if (therapy.includes("HEPATO") || therapy.includes("LIVER")) return "Liver Care";
  if (therapy.includes("ONCOLOG")) return "Oncology";
  if (therapy.includes("ANTI-EPILEPTIC")) return "Neurology";

  if (comp.includes("PARACETAMOL") || comp.includes("IBUPROFEN") || comp.includes("DICLOFENAC") || comp.includes("ACECLOFENAC")) return "Pain Relief";
  if (comp.includes("AMOXICILLIN") || comp.includes("AZITHROMYCIN") || comp.includes("CEFIXIME") || comp.includes("CIPROFLOXACIN")) return "Antibiotics";
  if (comp.includes("METFORMIN") || comp.includes("GLIMEPIRIDE") || comp.includes("INSULIN")) return "Diabetes";
  if (comp.includes("AMLODIPINE") || comp.includes("TELMISARTAN") || comp.includes("ATORVASTATIN") || comp.includes("LOSARTAN")) return "Heart & BP";
  if (comp.includes("OMEPRAZOLE") || comp.includes("PANTOPRAZOLE") || comp.includes("RANITIDINE")) return "Gastro";
  if (comp.includes("CETIRIZINE") || comp.includes("MONTELUKAST") || comp.includes("SALBUTAMOL")) return "Respiratory";
  if (comp.includes("ESCITALOPRAM") || comp.includes("FLUOXETINE") || comp.includes("SERTRALINE")) return "Mental Health";
  if (comp.includes("VITAMIN") || comp.includes("CALCIUM") || comp.includes("FOLIC ACID") || comp.includes("ZINC")) return "Vitamins";
  if (comp.includes("LEVOTHYROXINE")) return "Thyroid";

  if (name.includes("CREAM") || name.includes("OINTMENT") || name.includes("LOTION")) return "Skin Care";

  return "Others";
}

function inferDosageForm(p: Record<string, unknown>): string {
  const form = String(p.dosageForm || "").toUpperCase();
  const pack = String(p.packSize || "").toUpperCase();
  const name = String(p.name || "").toUpperCase();

  if (form.includes("TABLET") || pack.includes("TABLET") || name.includes("TABLET") || name.match(/\bTAB\b/)) return "Tablet";
  if (form.includes("CAPSULE") || pack.includes("CAPSULE") || name.includes("CAPSULE") || name.match(/\bCAP\b/)) return "Capsule";
  if (form.includes("SYRUP") || name.includes("SYRUP")) return "Syrup";
  if (form.includes("INJECTION") || name.includes("INJECTION") || name.match(/\bINJ\b/)) return "Injection";
  if (form.includes("CREAM") || name.includes("CREAM")) return "Cream";
  if (form.includes("OINTMENT") || name.includes("OINTMENT")) return "Ointment";
  if (form.includes("GEL") || name.match(/\bGEL\b/)) return "Gel";
  if (form.includes("DROP") || name.includes("DROP")) return "Drops";
  if (form.includes("SUSPENSION") || name.includes("SUSPENSION") || name.includes("SUSP")) return "Suspension";
  if (form.includes("INHALER") || name.includes("INHALER")) return "Inhaler";
  if (form.includes("SPRAY") || name.includes("SPRAY")) return "Spray";
  if (form.includes("POWDER") || name.includes("POWDER") || name.includes("SACHET")) return "Powder";
  if (form.includes("LOTION") || name.includes("LOTION")) return "Lotion";
  if (form.includes("STRIP")) return "Tablet";

  return "Other";
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").substring(0, 200);
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  Import Collected Drugs to Neon Postgres                ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const dbUrl = process.env.DATABASE_URL || "";
  console.log(`DB: ${dbUrl.substring(0, 50)}...`);

  // Create prisma client with pg adapter
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaPg } = require("@prisma/adapter-pg");
  const adapter = new PrismaPg({ connectionString: dbUrl });
  const prisma = new PrismaClient({ adapter });

  // Load data
  const allProducts = new Map<string, Record<string, unknown>>();

  for (const file of ["tmp_collected_drugs.json", "tmp_harvested_drugs.json"]) {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      const products = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      console.log(`Loaded ${products.length} products from ${file}`);
      for (const p of products) {
        const key = String(p.name).toLowerCase().trim();
        if (!allProducts.has(key) && p.sellingPrice > 0) {
          allProducts.set(key, p);
        }
      }
    }
  }

  console.log(`Total unique products with price: ${allProducts.size}\n`);

  const existingDrugs = await prisma.drug.count();
  const existingPrices = await prisma.drugPrice.count();
  console.log(`Existing: ${existingDrugs} drugs, ${existingPrices} prices\n`);

  let drugsUpserted = 0;
  let pricesUpserted = 0;
  let errors = 0;

  const products = Array.from(allProducts.values());

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const name = String(p.name);
    const slug = slugify(name);

    try {
      const category = inferCategory(p);
      const dosageForm = inferDosageForm(p);
      const genericName = String(p.genericName || "").split("+")[0]?.trim() ||
        String(p.composition || "").split("+")[0]?.trim() || "";

      const drug = await prisma.drug.upsert({
        where: { slug },
        create: {
          name,
          slug,
          genericName,
          brandName: name.split(" ")[0],
          manufacturer: String(p.manufacturer || "Unknown"),
          composition: String(p.composition || genericName || "Unknown"),
          category,
          dosageForm,
          packSize: String(p.packSize || ""),
          prescriptionReq: Boolean(p.prescriptionRequired),
          isGeneric: false,
          imageUrl: String(p.imageUrl || "") || null,
        },
        update: {
          ...(p.manufacturer ? { manufacturer: String(p.manufacturer) } : {}),
          ...(p.composition ? { composition: String(p.composition) } : {}),
          ...(genericName ? { genericName } : {}),
          ...(p.imageUrl ? { imageUrl: String(p.imageUrl) } : {}),
        },
      });

      const source = String(p.source || "PharmEasy");
      const mrp = Number(p.mrp) || 0;
      const selling = Number(p.sellingPrice) || 0;
      const discount = mrp > 0 ? Math.round((mrp - selling) / mrp * 100) : 0;

      await prisma.drugPrice.upsert({
        where: { drugId_source: { drugId: drug.id, source } },
        create: {
          drugId: drug.id,
          source,
          sourceUrl: String(p.sourceUrl || "") || null,
          mrp,
          sellingPrice: selling,
          discount: Math.max(0, discount),
          inStock: p.inStock !== false,
          lastChecked: new Date(),
        },
        update: {
          mrp,
          sellingPrice: selling,
          discount: Math.max(0, discount),
          inStock: p.inStock !== false,
          sourceUrl: String(p.sourceUrl || "") || null,
          lastChecked: new Date(),
        },
      });

      drugsUpserted++;
      pricesUpserted++;

      if ((i + 1) % 500 === 0) {
        console.log(`Progress: ${i + 1}/${products.length} (${drugsUpserted} drugs, ${errors} errors)`);
      }
    } catch (err) {
      errors++;
      if (errors <= 10) {
        console.error(`Error [${i}] "${name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  const finalDrugs = await prisma.drug.count();
  const finalPrices = await prisma.drugPrice.count();

  console.log("\n" + "=".repeat(60));
  console.log("IMPORT COMPLETE");
  console.log(`  Drugs upserted: ${drugsUpserted}`);
  console.log(`  Prices upserted: ${pricesUpserted}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  DB Drugs: ${existingDrugs} → ${finalDrugs} (+${finalDrugs - existingDrugs})`);
  console.log(`  DB Prices: ${existingPrices} → ${finalPrices} (+${finalPrices - existingPrices})`);
  console.log("=".repeat(60));

  await prisma.$disconnect();
}

main().catch(console.error);
