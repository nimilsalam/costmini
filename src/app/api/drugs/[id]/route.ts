import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isDrugStale, refreshDrugPrices } from "@/lib/sync";
import { cache, TTL } from "@/lib/cache";
import { scoreDrugPrices } from "@/lib/costmini-score";
import { pharmacyProfiles } from "@/lib/pharmacy-profiles";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Check cache first
  const cacheKey = `drug:${id}`;
  const cached = cache.get<Record<string, unknown>>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "X-Cache": "HIT" },
    });
  }

  // Try by slug first, then by cuid
  const drug = await prisma.drug.findFirst({
    where: { OR: [{ slug: id }, { id: id }] },
    include: {
      prices: { orderBy: { sellingPrice: "asc" } },
      manufacturerRef: {
        select: {
          id: true,
          name: true,
          slug: true,
          overallScore: true,
          tier: true,
          usFdaApproved: true,
          whoPrequalified: true,
          eugmpCompliant: true,
        },
      },
      alternatives: {
        include: {
          alternativeDrug: {
            include: { prices: { orderBy: { sellingPrice: "asc" } } },
          },
        },
      },
    },
  });

  if (!drug) {
    return NextResponse.json({ error: "Drug not found" }, { status: 404 });
  }

  // On-demand price refresh: if prices are stale (>24h), fire-and-forget refresh
  let pricesStale = false;
  try {
    pricesStale = await isDrugStale(drug.id);
    if (pricesStale) {
      // Fire-and-forget: don't await, don't block response
      refreshDrugPrices(drug.id).then(() => {
        // Invalidate cache after refresh completes
        cache.invalidate(cacheKey);
      }).catch(() => {});
    }
  } catch {
    // Ignore stale check errors
  }

  const alternatives = drug.alternatives.map((alt: { alternativeDrug: { prices: { sellingPrice: number }[] } & Record<string, unknown>; savingsPercent: number }) => ({
    ...alt.alternativeDrug,
    lowestPrice:
      alt.alternativeDrug.prices.length > 0
        ? Math.min(...alt.alternativeDrug.prices.map((p) => p.sellingPrice))
        : 0,
    savingsPercent: alt.savingsPercent,
  }));

  // Compute CostMini Scores for all prices
  const pharmacyRatings: Record<string, number> = {};
  for (const [source, profile] of Object.entries(pharmacyProfiles)) {
    pharmacyRatings[source] = profile.rating;
  }

  const pricesForScoring = drug.prices.map((p: { source: string; sellingPrice: number; mrp: number; inStock: boolean; lastChecked: Date }) => ({
    source: p.source,
    sellingPrice: p.sellingPrice,
    mrp: p.mrp,
    inStock: p.inStock,
    lastChecked: p.lastChecked.toISOString(),
  }));

  const scoreMap = scoreDrugPrices(drug, pricesForScoring, pharmacyRatings);

  // Convert score map to serializable object
  const scores: Record<string, { total: number; badge: string | null; explanation: string }> = {};
  for (const [source, score] of scoreMap) {
    scores[source] = {
      total: score.total,
      badge: score.badge,
      explanation: score.explanation,
    };
  }

  // Find best-scored option
  let bestOption: { source: string; total: number; badge: string | null; explanation: string } | null = null;
  for (const [source, score] of Object.entries(scores)) {
    if (!bestOption || score.total > bestOption.total) {
      bestOption = { source, ...score };
    }
  }

  const body = {
    drug: {
      ...drug,
      lowestPrice:
        drug.prices.length > 0
          ? Math.min(...drug.prices.map((p: { sellingPrice: number }) => p.sellingPrice))
          : 0,
      highestMrp:
        drug.prices.length > 0
          ? Math.max(...drug.prices.map((p: { mrp: number }) => p.mrp))
          : 0,
    },
    alternatives,
    scores,
    bestOption,
    pricesStale,
    cachedAt: new Date().toISOString(),
  };

  cache.set(cacheKey, body, TTL.DRUG_PRICES);

  return NextResponse.json(body, {
    headers: { "X-Cache": "MISS" },
  });
}
