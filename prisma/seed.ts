/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const path = require("path");
const {
  sampleDrugs,
  sampleProcedures,
  sampleDiagnostics,
} = require("../src/lib/sample-data");

const dbPath = path.join(__dirname, "..", "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Clear existing data
  await prisma.syncLog.deleteMany();
  await prisma.scanResult.deleteMany();
  await prisma.prescriptionScan.deleteMany();
  await prisma.drugAlternative.deleteMany();
  await prisma.drugPrice.deleteMany();
  await prisma.drug.deleteMany();
  await prisma.procedurePrice.deleteMany();
  await prisma.procedure.deleteMany();
  await prisma.diagnosticPrice.deleteMany();
  await prisma.diagnostic.deleteMany();

  // Helper to generate slug from name
  function toSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
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

  // Seed drugs
  const drugIds: Record<string, string> = {};
  for (const d of sampleDrugs) {
    const slug = uniqueSlug(d.name, d.slug);
    const drug = await prisma.drug.create({
      data: {
        name: d.name,
        slug,
        genericName: d.genericName,
        brandName: d.brandName,
        manufacturer: d.manufacturer,
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

    // Add prices
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

  // Seed procedures
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

  // Seed diagnostics
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

  console.log("Seeded:");
  console.log(`  - ${sampleDrugs.length} drugs with prices`);
  console.log(`  - ${sampleProcedures.length} procedures with hospital prices`);
  console.log(`  - ${sampleDiagnostics.length} diagnostics with lab prices`);
  console.log("Done!");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e: Error) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
