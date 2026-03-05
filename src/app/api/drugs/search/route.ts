import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cache, TTL } from "@/lib/cache";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase() || "";
  const category = searchParams.get("category");
  const generic = searchParams.get("generic");
  const dosageForm = searchParams.get("dosageForm");
  const mfrTier = searchParams.get("mfrTier");
  const prescriptionReq = searchParams.get("rx");
  const pharmacy = searchParams.get("pharmacy");
  const minDiscount = searchParams.get("minDiscount");
  const sortBy = searchParams.get("sortBy") || "name";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  // Check cache first
  const cacheKey = `search:${q}:${category}:${generic}:${dosageForm}:${mfrTier}:${prescriptionReq}:${pharmacy}:${minDiscount}:${sortBy}:${page}:${limit}`;
  const cached = cache.get<{ results: unknown[]; count: number; page: number; limit: number }>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
        "X-Cache": "HIT",
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { genericName: { contains: q, mode: "insensitive" } },
      { composition: { contains: q, mode: "insensitive" } },
      { manufacturer: { contains: q, mode: "insensitive" } },
    ];
  }

  if (category) where.category = category;
  if (generic === "true") where.isGeneric = true;
  if (dosageForm) where.dosageForm = dosageForm;
  if (prescriptionReq === "true") where.prescriptionReq = true;
  if (prescriptionReq === "false") where.prescriptionReq = false;

  // Filter by manufacturer tier
  if (mfrTier) {
    where.manufacturerRef = { tier: mfrTier };
  }

  // Filter by pharmacy availability
  if (pharmacy) {
    where.prices = { some: { source: pharmacy, inStock: true } };
  }

  // Determine sort order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orderBy: any = { name: "asc" };
  if (sortBy === "price-low" || sortBy === "price-high") {
    // We'll sort client-side for price since it's on related table
    orderBy = { name: "asc" };
  } else if (sortBy === "newest") {
    orderBy = { createdAt: "desc" };
  }

  const [drugs, total] = await Promise.all([
    prisma.drug.findMany({
      where,
      include: {
        prices: { orderBy: { sellingPrice: "asc" } },
        manufacturerRef: {
          select: {
            id: true,
            name: true,
            slug: true,
            overallScore: true,
            tier: true,
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy,
    }),
    prisma.drug.count({ where }),
  ]);

  const results = drugs.map((d: { prices: { sellingPrice: number; mrp: number }[] } & Record<string, unknown>) => {
    const lowestPrice = d.prices.length > 0 ? Math.min(...d.prices.map((p) => p.sellingPrice)) : 0;
    const highestMrp = d.prices.length > 0 ? Math.max(...d.prices.map((p) => p.mrp)) : 0;
    const discount = highestMrp > 0 ? Math.round(((highestMrp - lowestPrice) / highestMrp) * 100) : 0;

    return {
      ...d,
      lowestPrice,
      highestMrp,
      pharmacyCount: d.prices.length,
      maxDiscount: discount,
    };
  });

  // Filter by minimum discount percentage
  let filteredResults = results;
  if (minDiscount) {
    const minDiscountNum = parseInt(minDiscount);
    filteredResults = results.filter((r) => r.maxDiscount >= minDiscountNum);
  }

  const body = { results: filteredResults, count: total, page, limit };
  cache.set(cacheKey, body, TTL.SEARCH_RESULTS);

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      "X-Cache": "MISS",
    },
  });
}
