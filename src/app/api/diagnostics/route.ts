import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase() || "";
  const category = searchParams.get("category");
  const homeCollection = searchParams.get("home");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (q) {
    where.OR = [
      { name: { contains: q } },
      { type: { contains: q } },
      { category: { contains: q } },
    ];
  }

  if (category) {
    where.category = category;
  }

  if (homeCollection === "true") {
    where.homeCollection = true;
  }

  const diagnostics = await prisma.diagnostic.findMany({
    where,
    include: { prices: { orderBy: { sellingPrice: "asc" } } },
    orderBy: { name: "asc" },
  });

  const results = diagnostics.map((d: { prices: { sellingPrice: number; mrp: number }[] } & Record<string, unknown>) => ({
    ...d,
    lowestPrice: d.prices.length > 0 ? Math.min(...d.prices.map((p) => p.sellingPrice)) : 0,
    highestMrp: d.prices.length > 0 ? Math.max(...d.prices.map((p) => p.mrp)) : 0,
    labCount: d.prices.length,
  }));

  return NextResponse.json({ results, count: results.length });
}
