import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { searchAllPharmacies, type ScraperResult } from "@/lib/scrapers";
import { cache } from "@/lib/cache";
import { computeCostMiniScore, type ScoreInput } from "@/lib/costmini-score";
import { pharmacyProfiles } from "@/lib/pharmacy-profiles";

export const runtime = "nodejs";

// Fuzzy name matching (extracted from sync.ts pattern)
function isNameMatch(dbName: string, scrapedName: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const a = normalize(dbName);
  const b = normalize(scrapedName);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Find the drug
  const drug = await prisma.drug.findFirst({
    where: { OR: [{ slug: id }, { id: id }] },
    include: {
      prices: { orderBy: { sellingPrice: "asc" } },
      manufacturerRef: {
        select: { overallScore: true, tier: true },
      },
    },
  });

  if (!drug) {
    return new Response(JSON.stringify({ error: "Drug not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`)
        );
      };

      try {
        // Step 1: Send cached DB prices immediately
        if (drug.prices.length > 0) {
          for (const price of drug.prices) {
            send("cached", {
              source: price.source,
              mrp: price.mrp,
              sellingPrice: price.sellingPrice,
              inStock: price.inStock,
              sourceUrl: price.sourceUrl,
              lastChecked: price.lastChecked.toISOString(),
            });
          }
        }

        send("status", { message: "Checking live prices from pharmacies..." });

        // Collect all known prices for scoring
        const allPrices: { source: string; sellingPrice: number; mrp: number; inStock: boolean }[] = [];
        for (const price of drug.prices) {
          allPrices.push({
            source: price.source,
            sellingPrice: price.sellingPrice,
            mrp: price.mrp,
            inStock: price.inStock,
          });
        }

        // Step 2: Fire all scrapers in parallel, stream results as they resolve
        const scraperResults: ScraperResult[] = [];
        let completed = 0;
        const total = 8; // Number of scrapers

        const results = await Promise.allSettled(
          [searchAllPharmacies(drug.name)].map((p) => p)
        );

        // searchAllPharmacies already runs in parallel, returns all at once
        // We process results individually
        const allResults =
          results[0].status === "fulfilled" ? results[0].value : [];

        for (const result of allResults) {
          completed++;

          if (result.error) {
            send("error", {
              source: result.source,
              error: result.error,
              progress: completed,
              total,
            });
            continue;
          }

          // Find matching drug in scraper results
          const match = result.drugs.find(
            (d) =>
              isNameMatch(drug.name, d.name) ||
              isNameMatch(drug.genericName, d.genericName)
          );

          if (match && match.sellingPrice > 0) {
            const discount =
              match.mrp > 0
                ? Math.round(
                    ((match.mrp - match.sellingPrice) / match.mrp) * 100
                  )
                : 0;

            // Update price list for scoring
            const existingIdx = allPrices.findIndex((p) => p.source === result.source);
            if (existingIdx >= 0) {
              allPrices[existingIdx] = { source: result.source, sellingPrice: match.sellingPrice, mrp: match.mrp, inStock: match.inStock };
            } else {
              allPrices.push({ source: result.source, sellingPrice: match.sellingPrice, mrp: match.mrp, inStock: match.inStock });
            }

            // Compute CostMini Score
            const sellingPrices = allPrices.map((p) => p.sellingPrice).filter((p) => p > 0);
            const lowestPrice = Math.min(...sellingPrices);
            const highestPrice = Math.max(...sellingPrices);
            const pharmacyProfile = pharmacyProfiles[result.source];

            const scoreInput: ScoreInput = {
              sellingPrice: match.sellingPrice,
              mrp: match.mrp,
              lowestPriceForComposition: lowestPrice,
              highestPriceForComposition: highestPrice,
              manufacturerOverallScore: drug.manufacturerRef?.overallScore ?? 50,
              manufacturerTier: drug.manufacturerRef?.tier ?? "standard",
              pharmacyRating: pharmacyProfile?.rating ?? 3.5,
              inStock: match.inStock,
              isGeneric: drug.isGeneric,
              whoCertified: drug.whoCertified,
              freshnessLevel: "fresh",
            };
            const score = computeCostMiniScore(scoreInput);

            send("price", {
              source: result.source,
              mrp: match.mrp,
              sellingPrice: match.sellingPrice,
              discount,
              inStock: match.inStock,
              sourceUrl: match.sourceUrl || null,
              lastChecked: new Date().toISOString(),
              progress: completed,
              total,
              costminiScore: score.total,
              scoreBadge: score.badge,
              scoreExplanation: score.explanation,
            });

            // Step 4: Upsert into DB in background
            try {
              await prisma.drugPrice.upsert({
                where: {
                  drugId_source: { drugId: drug.id, source: result.source },
                },
                update: {
                  mrp: match.mrp,
                  sellingPrice: match.sellingPrice,
                  discount,
                  inStock: match.inStock,
                  sourceUrl: match.sourceUrl || null,
                  lastChecked: new Date(),
                },
                create: {
                  drugId: drug.id,
                  source: result.source,
                  mrp: match.mrp,
                  sellingPrice: match.sellingPrice,
                  discount,
                  inStock: match.inStock,
                  sourceUrl: match.sourceUrl || null,
                  lastChecked: new Date(),
                },
              });
            } catch {
              // DB upsert failure shouldn't stop streaming
            }

            scraperResults.push(result);
          } else {
            send("no_match", {
              source: result.source,
              progress: completed,
              total,
            });
          }
        }

        // Invalidate cache so next non-streaming request gets fresh data
        cache.invalidate(`drug:${id}`);

        // Step 5: Done
        send("done", {
          total: allResults.length,
          matched: scraperResults.length,
        });
      } catch (err) {
        send("error", {
          source: "system",
          error: err instanceof Error ? err.message : "Streaming failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
