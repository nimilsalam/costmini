import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isDrugStale, refreshDrugPrices } from "@/lib/sync";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Try by slug first, then by cuid
  const drug = await prisma.drug.findFirst({
    where: { OR: [{ slug: id }, { id: id }] },
    include: {
      prices: { orderBy: { sellingPrice: "asc" } },
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
      refreshDrugPrices(drug.id).catch(() => {});
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

  return NextResponse.json({
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
    pricesStale,
  });
}
