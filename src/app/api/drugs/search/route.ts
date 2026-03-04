import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase() || "";
  const category = searchParams.get("category");
  const generic = searchParams.get("generic");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (q) {
    where.OR = [
      { name: { contains: q } },
      { genericName: { contains: q } },
      { composition: { contains: q } },
    ];
  }

  if (category) {
    where.category = category;
  }

  if (generic === "true") {
    where.isGeneric = true;
  }

  const [drugs, total] = await Promise.all([
    prisma.drug.findMany({
      where,
      include: { prices: { orderBy: { sellingPrice: "asc" } } },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: "asc" },
    }),
    prisma.drug.count({ where }),
  ]);

  const results = drugs.map((d: { prices: { sellingPrice: number; mrp: number }[] } & Record<string, unknown>) => ({
    ...d,
    lowestPrice: d.prices.length > 0 ? Math.min(...d.prices.map((p) => p.sellingPrice)) : 0,
    highestMrp: d.prices.length > 0 ? Math.max(...d.prices.map((p) => p.mrp)) : 0,
    pharmacyCount: d.prices.length,
  }));

  return NextResponse.json({ results, count: total, page, limit });
}
