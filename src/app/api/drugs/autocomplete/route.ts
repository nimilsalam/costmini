import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cache, TTL } from "@/lib/cache";

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q")?.toLowerCase().trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  // Check cache
  const cacheKey = `autocomplete:${q}`;
  const cached = cache.get<unknown[]>(cacheKey);
  if (cached) {
    return NextResponse.json({ results: cached }, {
      headers: { "X-Cache": "HIT" },
    });
  }

  const drugs = await prisma.drug.findMany({
    where: {
      OR: [
        { name: { contains: q } },
        { genericName: { contains: q } },
        { composition: { contains: q } },
      ],
    },
    select: {
      slug: true,
      name: true,
      genericName: true,
      category: true,
      isGeneric: true,
      prices: {
        select: { sellingPrice: true },
        orderBy: { sellingPrice: "asc" },
        take: 1,
      },
    },
    take: 8,
    orderBy: { name: "asc" },
  });

  const results = drugs.map((d) => ({
    slug: d.slug,
    name: d.name,
    genericName: d.genericName,
    category: d.category,
    isGeneric: d.isGeneric,
    lowestPrice: d.prices[0]?.sellingPrice || 0,
  }));

  cache.set(cacheKey, results, TTL.AUTOCOMPLETE);

  return NextResponse.json({ results }, {
    headers: { "X-Cache": "MISS" },
  });
}
