import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cache, TTL } from "@/lib/cache";

/**
 * GET /api/drugs/compare?composition=paracetamol&form=tablet
 * GET /api/drugs/compare?groupId=xxx
 * GET /api/drugs/compare?q=paracetamol+650mg
 *
 * Returns all brands/pharmacies for a composition group,
 * enabling real price comparison across pharmacies.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId");
  const q = searchParams.get("q")?.toLowerCase() || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const cacheKey = `compare:${groupId || q}:${page}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "X-Cache": "HIT", "Cache-Control": "public, max-age=300" },
    });
  }

  // If groupId provided, get that specific group
  if (groupId) {
    const group = await prisma.compositionGroup.findUnique({
      where: { id: groupId },
      include: {
        drugs: {
          include: {
            prices: { orderBy: { sellingPrice: "asc" } },
            manufacturerRef: {
              select: { name: true, tier: true, overallScore: true },
            },
          },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const body = formatGroupResponse(group);
    cache.set(cacheKey, body, TTL.SEARCH_RESULTS);
    return NextResponse.json(body);
  }

  // Search composition groups by query
  if (!q) {
    return NextResponse.json({ error: "Provide q or groupId" }, { status: 400 });
  }

  // Find matching composition groups
  const groups = await prisma.compositionGroup.findMany({
    where: {
      OR: [
        { displayName: { contains: q } },
        { primarySalt: { contains: q } },
        { compositionKey: { contains: q } },
      ],
    },
    include: {
      drugs: {
        include: {
          prices: { orderBy: { sellingPrice: "asc" } },
          manufacturerRef: {
            select: { name: true, tier: true, overallScore: true },
          },
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { drugCount: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  const total = await prisma.compositionGroup.count({
    where: {
      OR: [
        { displayName: { contains: q } },
        { primarySalt: { contains: q } },
        { compositionKey: { contains: q } },
      ],
    },
  });

  const body = {
    groups: groups.map(formatGroupResponse),
    count: total,
    page,
    limit,
  };

  cache.set(cacheKey, body, TTL.SEARCH_RESULTS);
  return NextResponse.json(body);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatGroupResponse(group: any) {
  // Flatten all prices across all drugs in this group
  const allPrices = group.drugs.flatMap(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (d: any) => d.prices.map((p: any) => ({
      drugName: d.name,
      drugSlug: d.slug,
      manufacturer: d.manufacturer,
      manufacturerTier: d.manufacturerRef?.tier || "unknown",
      manufacturerScore: d.manufacturerRef?.overallScore || 0,
      source: p.source,
      sourceUrl: p.sourceUrl,
      mrp: p.mrp,
      sellingPrice: p.sellingPrice,
      discount: p.discount,
      inStock: p.inStock,
    }))
  );

  // Sort by selling price
  allPrices.sort(
    (a: { sellingPrice: number }, b: { sellingPrice: number }) =>
      a.sellingPrice - b.sellingPrice
  );

  const lowestPrice = allPrices.length > 0 ? allPrices[0].sellingPrice : 0;
  const highestPrice = allPrices.length > 0 ? allPrices[allPrices.length - 1].sellingPrice : 0;
  const savingsPercent = highestPrice > 0
    ? Math.round(((highestPrice - lowestPrice) / highestPrice) * 100)
    : 0;

  // Unique pharmacies
  const pharmacies = [...new Set(allPrices.map((p: { source: string }) => p.source))];
  const brands = [...new Set(group.drugs.map((d: { manufacturer: string }) => d.manufacturer))];

  return {
    id: group.id,
    compositionKey: group.compositionKey,
    displayName: group.displayName,
    primarySalt: group.primarySalt,
    strength: group.strength,
    dosageForm: group.dosageForm,
    category: group.category,
    drugCount: group.drugs.length,
    brandCount: brands.length,
    pharmacyCount: pharmacies.length,
    lowestPrice,
    highestPrice,
    savingsPercent,
    pharmacies,
    prices: allPrices,
    cheapest: allPrices[0] || null,
    mostExpensive: allPrices[allPrices.length - 1] || null,
  };
}
