import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase() || "";
  const category = searchParams.get("category");
  const city = searchParams.get("city");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (q) {
    where.OR = [
      { name: { contains: q } },
      { category: { contains: q } },
    ];
  }

  if (category) {
    where.category = category;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priceWhere: any = city ? { city: { contains: city } } : undefined;

  const procedures = await prisma.procedure.findMany({
    where,
    include: {
      prices: priceWhere ? { where: priceWhere } : true,
    },
    orderBy: { name: "asc" },
  });

  const results = procedures
    .filter((p: { prices: unknown[] }) => p.prices.length > 0)
    .map((p: { prices: { minPrice: number; maxPrice: number }[] } & Record<string, unknown>) => ({
      ...p,
      minPrice: Math.min(...p.prices.map((hp) => hp.minPrice)),
      maxPrice: Math.max(...p.prices.map((hp) => hp.maxPrice)),
      hospitalCount: p.prices.length,
    }));

  return NextResponse.json({ results, count: results.length });
}
