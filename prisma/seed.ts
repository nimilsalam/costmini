/* eslint-disable @typescript-eslint/no-require-imports */
const dotenv = require("dotenv");
// Load .env explicitly (NOT .env.local which has remote Neon DB)
dotenv.config({ path: ".env" });

const { PrismaClient } = require("@prisma/client");
const path = require("path");
const fs = require("fs");
const {
  sampleDrugs,
  sampleProcedures,
  sampleDiagnostics,
} = require("../src/lib/sample-data");
const { manufacturerSeedData } = require("../src/lib/manufacturer-data");
const { computeManufacturerScores } = require("../src/lib/manufacturer-scoring");

// Support both SQLite (local dev) and PostgreSQL (production)
const url = process.env.DATABASE_URL || "";
let prisma: InstanceType<typeof PrismaClient>;

if (url.startsWith("file:") || url.endsWith(".db")) {
  const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
  const dbFile = url.startsWith("file:") ? url.replace("file:", "").replace("./", "") : url;
  const dbPath = path.isAbsolute(dbFile) ? dbFile : path.join(process.cwd(), dbFile);
  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
  prisma = new PrismaClient({ adapter });
} else if (url.startsWith("postgres")) {
  const { PrismaPg } = require("@prisma/adapter-pg");
  const adapter = new PrismaPg({ connectionString: url });
  prisma = new PrismaClient({ adapter });
} else {
  prisma = new PrismaClient();
}

// --- Category & form inference for harvested data ---

function inferCategory(p: Record<string, unknown>): string {
  const t = String(p.category || "").toUpperCase();
  const c = String(p.composition || p.genericName || "").toUpperCase();
  const n = String(p.name || "").toUpperCase();
  if (t.includes("ANTI-DIABETIC") || t.includes("DIABETES")) return "Diabetes";
  if (t.includes("ANTI-HYPERTENSIVE") || t.includes("CARDIAC") || t.includes("CARDIOVASCULAR")) return "Heart & BP";
  if (t.includes("ANTIBIOTIC") || t.includes("ANTI-INFECTIVE")) return "Antibiotics";
  if (t.includes("ANALGESIC") || t.includes("ANTI-INFLAMMATORY") || t.includes("NSAID")) return "Pain Relief";
  if (t.includes("ANTACID") || t.includes("GASTRO") || t.includes("PPI")) return "Gastro";
  if (t.includes("RESPIRATORY") || t.includes("ANTI-ASTHMA")) return "Respiratory";
  if (t.includes("PSYCHIATRIC") || t.includes("ANTI-DEPRESSANT") || t.includes("ANXIOLYTIC")) return "Mental Health";
  if (t.includes("DERMAT") || t.includes("SKIN")) return "Skin Care";
  if (t.includes("VITAMIN") || t.includes("SUPPLEMENT")) return "Vitamins";
  if (t.includes("THYROID")) return "Thyroid";
  if (t.includes("OPHTHAL") || t.includes("EYE")) return "Eye Care";
  if (t.includes("ANTI-ALLERG")) return "Anti-Allergic";
  if (t.includes("HORMONAL") || t.includes("GYNAEC")) return "Women's Health";
  if (t.includes("HEPATO") || t.includes("LIVER")) return "Liver Care";
  if (t.includes("ONCOLOG")) return "Oncology";
  if (t.includes("ANTI-EPILEPTIC")) return "Neurology";
  if (c.includes("PARACETAMOL") || c.includes("IBUPROFEN") || c.includes("DICLOFENAC")) return "Pain Relief";
  if (c.includes("AMOXICILLIN") || c.includes("AZITHROMYCIN") || c.includes("CEFIXIME")) return "Antibiotics";
  if (c.includes("METFORMIN") || c.includes("GLIMEPIRIDE")) return "Diabetes";
  if (c.includes("AMLODIPINE") || c.includes("TELMISARTAN") || c.includes("ATORVASTATIN")) return "Heart & BP";
  if (c.includes("OMEPRAZOLE") || c.includes("PANTOPRAZOLE")) return "Gastro";
  if (c.includes("CETIRIZINE") || c.includes("MONTELUKAST") || c.includes("SALBUTAMOL")) return "Respiratory";
  if (c.includes("ESCITALOPRAM") || c.includes("FLUOXETINE")) return "Mental Health";
  if (c.includes("VITAMIN") || c.includes("CALCIUM")) return "Vitamins";
  if (c.includes("LEVOTHYROXINE")) return "Thyroid";
  if (n.includes("CREAM") || n.includes("OINTMENT") || n.includes("LOTION")) return "Skin Care";
  return "Others";
}

function inferForm(p: Record<string, unknown>): string {
  const n = String(p.name || "").toUpperCase();
  const f = String(p.dosageForm || "").toUpperCase();
  if (f.includes("TABLET") || n.includes("TABLET") || /\bTAB\b/.test(n)) return "Tablet";
  if (f.includes("CAPSULE") || n.includes("CAPSULE") || /\bCAP\b/.test(n)) return "Capsule";
  if (f.includes("SYRUP") || n.includes("SYRUP")) return "Syrup";
  if (f.includes("INJECTION") || n.includes("INJECTION") || /\bINJ\b/.test(n)) return "Injection";
  if (n.includes("CREAM")) return "Cream";
  if (n.includes("OINTMENT")) return "Ointment";
  if (/\bGEL\b/.test(n)) return "Gel";
  if (n.includes("DROP")) return "Drops";
  if (n.includes("SUSP")) return "Suspension";
  if (n.includes("INHALER")) return "Inhaler";
  if (n.includes("SPRAY")) return "Spray";
  if (n.includes("POWDER") || n.includes("SACHET")) return "Powder";
  return "Other";
}

// --- Load harvested data from local JSON files ---

function loadHarvestedDrugs(): Map<string, Record<string, unknown>> {
  const allProducts = new Map<string, Record<string, unknown>>();
  const files = ["tmp_harvested_drugs.json", "tmp_collected_drugs.json"];

  for (const file of files) {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      try {
        const products = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        console.log(`  Loaded ${products.length} products from ${file}`);
        for (const p of products) {
          const key = String(p.name).toLowerCase().trim();
          if (!allProducts.has(key) && p.sellingPrice > 0) {
            allProducts.set(key, p);
          }
        }
      } catch (e) {
        console.log(`  Skipping ${file}: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      console.log(`  ${file} not found (optional)`);
    }
  }

  return allProducts;
}

async function main() {
  console.log("Seeding database...");
  console.log(`  DB: ${url.substring(0, 30)}...`);

  // Clear existing data
  await prisma.syncLog.deleteMany();
  await prisma.scanResult.deleteMany();
  await prisma.prescriptionScan.deleteMany();
  await prisma.drugAlternative.deleteMany();
  await prisma.drugPrice.deleteMany();
  await prisma.drug.deleteMany();
  await prisma.manufacturer.deleteMany();
  await prisma.procedurePrice.deleteMany();
  await prisma.procedure.deleteMany();
  await prisma.diagnosticPrice.deleteMany();
  await prisma.diagnostic.deleteMany();

  // Seed manufacturers
  const mfrIds: Record<string, string> = {};
  const mfrAliasMap: { id: string; aliases: string[] }[] = [];
  for (const mfr of manufacturerSeedData) {
    const scores = computeManufacturerScores(mfr);
    const created = await prisma.manufacturer.create({
      data: {
        name: mfr.name,
        slug: mfr.slug,
        headquarters: mfr.headquarters || null,
        foundedYear: mfr.foundedYear || null,
        marketCapBillion: mfr.marketCapBillion || null,
        globalRank: mfr.globalRank || null,
        usFdaApproved: mfr.usFdaApproved,
        whoPrequalified: mfr.whoPrequalified,
        eugmpCompliant: mfr.eugmpCompliant,
        qualityScore: scores.qualityScore,
        reliabilityScore: scores.reliabilityScore,
        overallScore: scores.overallScore,
        tier: scores.tier,
        description: mfr.description || null,
        websiteUrl: mfr.websiteUrl || null,
      },
    });
    mfrIds[mfr.name] = created.id;
    mfrAliasMap.push({ id: created.id, aliases: mfr.aliases });
  }
  console.log(`  - ${manufacturerSeedData.length} manufacturers with scores`);

  // Helper: fuzzy-match drug manufacturer string to Manufacturer ID
  function findManufacturerId(drugMfr: string): string | null {
    const normalized = drugMfr.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const entry of mfrAliasMap) {
      for (const alias of entry.aliases) {
        const normAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (normalized.includes(normAlias) || normAlias.includes(normalized)) {
          return entry.id;
        }
      }
    }
    return null;
  }

  // Helper to generate slug from name
  function toSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 200);
  }

  // Track used slugs to avoid duplicates
  const usedSlugs = new Set<string>();
  function uniqueSlug(name: string, existingSlug?: string): string {
    let slug = existingSlug || toSlug(name);
    if (usedSlugs.has(slug)) {
      let i = 2;
      while (usedSlugs.has(`${slug}-${i}`)) i++;
      slug = `${slug}-${i}`;
    }
    usedSlugs.add(slug);
    return slug;
  }

  // ==========================================
  // PART 1: Seed curated sample drugs (203)
  // ==========================================
  const drugIds: Record<string, string> = {};
  let linkedCount = 0;
  let totalPriceCount = 0;
  for (const d of sampleDrugs) {
    const slug = uniqueSlug(d.name, d.slug);
    const mfrId = findManufacturerId(d.manufacturer);
    if (mfrId) linkedCount++;
    const drug = await prisma.drug.create({
      data: {
        name: d.name,
        slug,
        genericName: d.genericName,
        brandName: d.brandName,
        manufacturer: d.manufacturer,
        manufacturerId: mfrId,
        composition: d.composition,
        category: d.category,
        dosageForm: d.dosageForm,
        packSize: d.packSize,
        prescriptionReq: d.prescriptionReq,
        isGeneric: d.isGeneric,
        whoCertified: d.whoCertified,
        description: d.description || null,
        uses: d.uses || null,
        sideEffects: d.sideEffects || null,
      },
    });
    drugIds[d.name] = drug.id;

    // Add prices from sample data
    for (const p of d.prices) {
      await prisma.drugPrice.create({
        data: {
          drugId: drug.id,
          source: p.source,
          mrp: p.mrp,
          sellingPrice: p.sellingPrice,
          discount:
            p.mrp > 0
              ? Math.round(((p.mrp - p.sellingPrice) / p.mrp) * 100)
              : 0,
          inStock: p.inStock,
        },
      });
      totalPriceCount++;
    }

    // Auto-fill prices for pharmacies not in sample data
    const ALL_PHARMACIES = [
      { name: "1mg", minDiscount: 10, maxDiscount: 20 },
      { name: "PharmEasy", minDiscount: 12, maxDiscount: 22 },
      { name: "Netmeds", minDiscount: 8, maxDiscount: 18 },
      { name: "Apollo", minDiscount: 5, maxDiscount: 15 },
      { name: "Flipkart Health", minDiscount: 15, maxDiscount: 25 },
      { name: "Truemeds", minDiscount: 20, maxDiscount: 40 },
      { name: "MedPlus", minDiscount: 5, maxDiscount: 12 },
      { name: "Amazon Pharmacy", minDiscount: 10, maxDiscount: 20 },
    ];

    const existingSources = new Set(d.prices.map((p: { source: string }) => p.source));
    const baseMrp = d.prices[0]?.mrp || 100;

    for (const pharmacy of ALL_PHARMACIES) {
      if (existingSources.has(pharmacy.name)) continue;

      const hash = (d.name + pharmacy.name).split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
      const discountRange = pharmacy.maxDiscount - pharmacy.minDiscount;
      const discount = pharmacy.minDiscount + (hash % (discountRange + 1));
      const sellingPrice = Math.round(baseMrp * (1 - discount / 100) * 100) / 100;
      const inStock = (hash % 20) !== 0;

      await prisma.drugPrice.create({
        data: {
          drugId: drug.id,
          source: pharmacy.name,
          mrp: baseMrp,
          sellingPrice,
          discount,
          inStock,
        },
      });
      totalPriceCount++;
    }

    // Add JanAushadhi for generic drugs
    if (d.isGeneric && !existingSources.has("JanAushadhi")) {
      const hash = (d.name + "JanAushadhi").split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
      const discount = 50 + (hash % 31);
      const sellingPrice = Math.round(baseMrp * (1 - discount / 100) * 100) / 100;

      await prisma.drugPrice.create({
        data: {
          drugId: drug.id,
          source: "JanAushadhi",
          mrp: baseMrp,
          sellingPrice,
          discount,
          inStock: true,
        },
      });
      totalPriceCount++;
    }
  }

  // Create drug alternatives (generic <-> branded)
  for (const d of sampleDrugs) {
    if (!d.isGeneric) continue;
    const brandedVersions = sampleDrugs.filter(
      (other: { genericName: string; isGeneric: boolean; name: string }) =>
        other.genericName === d.genericName && !other.isGeneric && other.name !== d.name
    );
    for (const branded of brandedVersions) {
      const brandedPrice = Math.min(...branded.prices.map((p: { mrp: number }) => p.mrp));
      const genericPrice = Math.min(...d.prices.map((p: { sellingPrice: number }) => p.sellingPrice));
      const savings = brandedPrice > 0 ? Math.round(((brandedPrice - genericPrice) / brandedPrice) * 100) : 0;

      await prisma.drugAlternative.create({
        data: {
          originalDrugId: drugIds[branded.name],
          alternativeDrugId: drugIds[d.name],
          savingsPercent: savings,
        },
      });
    }
  }

  console.log(`  - ${sampleDrugs.length} curated drugs with ${totalPriceCount} prices (${linkedCount} linked to manufacturers)`);

  // ==========================================
  // PART 2: Import harvested drugs from JSON
  // ==========================================
  console.log("\nImporting harvested pharmacy data...");
  const harvested = loadHarvestedDrugs();

  // Filter out drugs already seeded from sample data
  const sampleSlugs = new Set<string>();
  for (const d of sampleDrugs) {
    sampleSlugs.add(toSlug(d.name));
  }

  let harvestedCount = 0;
  let harvestedPrices = 0;
  let harvestedLinked = 0;
  let harvestedErrors = 0;

  const harvestedProducts = Array.from(harvested.values());
  const BATCH_LOG = 2000;

  for (let i = 0; i < harvestedProducts.length; i++) {
    const p = harvestedProducts[i];
    const name = String(p.name);
    const baseSlug = toSlug(name);

    // Skip if already seeded from sample data
    if (sampleSlugs.has(baseSlug)) continue;

    try {
      const slug = uniqueSlug(name);
      const category = inferCategory(p);
      const dosageForm = inferForm(p);
      const genericName = String(p.genericName || "").split("+")[0]?.trim() ||
        String(p.composition || "").split("+")[0]?.trim() || "";
      const manufacturer = String(p.manufacturer || "Unknown");
      const mfrId = findManufacturerId(manufacturer);
      if (mfrId) harvestedLinked++;

      const drug = await prisma.drug.create({
        data: {
          name,
          slug,
          genericName,
          brandName: name.split(" ")[0],
          manufacturer,
          manufacturerId: mfrId,
          composition: String(p.composition || genericName || "Unknown"),
          category,
          dosageForm,
          packSize: String(p.packSize || ""),
          prescriptionReq: Boolean(p.prescriptionRequired),
          isGeneric: false,
          whoCertified: false,
        },
      });

      // Add the real price from the source pharmacy
      const source = String(p.source || "PharmEasy");
      const mrp = Number(p.mrp) || 0;
      const selling = Number(p.sellingPrice) || 0;
      const discount = mrp > 0 ? Math.max(0, Math.round((mrp - selling) / mrp * 100)) : 0;

      await prisma.drugPrice.create({
        data: {
          drugId: drug.id,
          source,
          sourceUrl: String(p.sourceUrl || "") || null,
          mrp,
          sellingPrice: selling,
          discount,
          inStock: p.inStock !== false,
          lastChecked: new Date(),
        },
      });
      harvestedPrices++;
      harvestedCount++;

    } catch (err) {
      harvestedErrors++;
      if (harvestedErrors <= 5) {
        console.log(`  Error [${i}] "${name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if ((i + 1) % BATCH_LOG === 0 || i === harvestedProducts.length - 1) {
      console.log(`  Progress: ${i + 1}/${harvestedProducts.length} (${harvestedCount} added, ${harvestedErrors} errors)`);
    }
  }

  console.log(`  - ${harvestedCount} harvested drugs with ${harvestedPrices} real prices (${harvestedLinked} linked to manufacturers)`);
  if (harvestedErrors > 0) console.log(`  - ${harvestedErrors} errors (duplicates/invalid data)`);

  // ==========================================
  // PART 3: Seed procedures & diagnostics
  // ==========================================
  for (const p of sampleProcedures) {
    const proc = await prisma.procedure.create({
      data: {
        name: p.name,
        slug: p.slug,
        category: p.category,
        description: p.description || null,
        duration: p.duration || null,
        recoveryTime: p.recoveryTime || null,
        anesthesia: p.anesthesia || null,
      },
    });

    for (const hp of p.prices) {
      await prisma.procedurePrice.create({
        data: {
          procedureId: proc.id,
          hospitalName: hp.hospitalName,
          city: hp.city,
          minPrice: hp.minPrice,
          maxPrice: hp.maxPrice,
          avgPrice: hp.avgPrice,
          includesStay: hp.includesStay,
          accreditation: hp.accreditation || null,
          rating: hp.rating || null,
        },
      });
    }
  }

  for (const d of sampleDiagnostics) {
    const diag = await prisma.diagnostic.create({
      data: {
        name: d.name,
        slug: d.slug,
        category: d.category,
        type: d.type,
        description: d.description || null,
        preparation: d.preparation || null,
        reportTime: d.reportTime || null,
        homeCollection: d.homeCollection,
      },
    });

    for (const lp of d.prices) {
      await prisma.diagnosticPrice.create({
        data: {
          diagnosticId: diag.id,
          labName: lp.labName,
          city: lp.city,
          mrp: lp.mrp,
          sellingPrice: lp.sellingPrice,
          homeCollection: lp.homeCollection,
          accreditation: lp.accreditation || null,
        },
      });
    }
  }

  // Final counts
  const drugCount = await prisma.drug.count();
  const priceCount = await prisma.drugPrice.count();

  console.log("\n" + "=".repeat(60));
  console.log("SEED COMPLETE");
  console.log(`  Total drugs: ${drugCount} (${sampleDrugs.length} curated + ${harvestedCount} harvested)`);
  console.log(`  Total prices: ${priceCount}`);
  console.log(`  Manufacturers: ${manufacturerSeedData.length} (${linkedCount + harvestedLinked} drugs linked)`);
  console.log(`  Procedures: ${sampleProcedures.length}`);
  console.log(`  Diagnostics: ${sampleDiagnostics.length}`);
  console.log("=".repeat(60));
}

main()
  .then(() => prisma.$disconnect())
  .catch((e: Error) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
