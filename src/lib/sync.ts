import { prisma } from "./db";
import { searchAllPharmacies } from "./scrapers";

// Check if a drug's prices are stale (>24h old)
export async function isDrugStale(drugId: string): Promise<boolean> {
  const latest = await prisma.drugPrice.findFirst({
    where: { drugId },
    orderBy: { lastChecked: "desc" },
  });
  if (!latest) return true;
  const age = Date.now() - latest.lastChecked.getTime();
  return age > 24 * 60 * 60 * 1000;
}

// Fuzzy name matching between DB drug name and scraped result
function isNameMatch(dbName: string, scrapedName: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const a = normalize(dbName);
  const b = normalize(scrapedName);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

// Refresh prices for a single drug from all scraper sources
export async function refreshDrugPrices(
  drugId: string
): Promise<{ updated: number; errors: string[] }> {
  const drug = await prisma.drug.findUnique({ where: { id: drugId } });
  if (!drug) return { updated: 0, errors: ["Drug not found"] };

  const results = await searchAllPharmacies(drug.name);
  let updated = 0;
  const errors: string[] = [];

  for (const result of results) {
    if (result.error) {
      errors.push(`${result.source}: ${result.error}`);
      continue;
    }

    const match = result.drugs.find(
      (d) =>
        isNameMatch(drug.name, d.name) ||
        isNameMatch(drug.genericName, d.genericName)
    );

    if (match && match.sellingPrice > 0) {
      try {
        await prisma.drugPrice.upsert({
          where: {
            drugId_source: { drugId: drug.id, source: result.source },
          },
          update: {
            mrp: match.mrp,
            sellingPrice: match.sellingPrice,
            discount:
              match.mrp > 0
                ? Math.round(
                    ((match.mrp - match.sellingPrice) / match.mrp) * 100
                  )
                : 0,
            inStock: match.inStock,
            sourceUrl: match.sourceUrl || null,
            lastChecked: new Date(),
          },
          create: {
            drugId: drug.id,
            source: result.source,
            mrp: match.mrp,
            sellingPrice: match.sellingPrice,
            discount:
              match.mrp > 0
                ? Math.round(
                    ((match.mrp - match.sellingPrice) / match.mrp) * 100
                  )
                : 0,
            inStock: match.inStock,
            sourceUrl: match.sourceUrl || null,
            lastChecked: new Date(),
          },
        });

        // Record price history for trend tracking
        await prisma.priceHistory.create({
          data: {
            drugId: drug.id,
            source: result.source,
            sellingPrice: match.sellingPrice,
            mrp: match.mrp,
          },
        }).catch(() => {}); // Don't fail sync if history recording fails

        updated++;
      } catch (err) {
        errors.push(
          `${result.source}: Upsert failed - ${err instanceof Error ? err.message : "unknown"}`
        );
      }
    }
  }

  return { updated, errors };
}

// Full sync - iterate all drugs with rate limiting
export async function fullSync(
  batchSize = 5
): Promise<{
  total: number;
  updated: number;
  failed: number;
  errors: string[];
}> {
  const drugs = await prisma.drug.findMany({
    select: { id: true, name: true },
  });
  let updated = 0;
  let failed = 0;
  const allErrors: string[] = [];

  for (let i = 0; i < drugs.length; i += batchSize) {
    const batch = drugs.slice(i, i + batchSize);

    for (const drug of batch) {
      try {
        const result = await refreshDrugPrices(drug.id);
        if (result.updated > 0) updated++;
        else failed++;
        allErrors.push(...result.errors);
      } catch (err) {
        failed++;
        allErrors.push(
          `${drug.name}: ${err instanceof Error ? err.message : "unknown"}`
        );
      }

      // Rate limiting: 2s delay between requests
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  return { total: drugs.length, updated, failed, errors: allErrors };
}
