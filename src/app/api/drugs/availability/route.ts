import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFreshness } from "@/lib/freshness";

export async function GET(req: NextRequest) {
  const drugId = new URL(req.url).searchParams.get("drugId");

  if (!drugId) {
    return NextResponse.json({ error: "drugId required" }, { status: 400 });
  }

  const drug = await prisma.drug.findFirst({
    where: { OR: [{ slug: drugId }, { id: drugId }] },
    select: { id: true },
  });

  if (!drug) {
    return NextResponse.json({ error: "Drug not found" }, { status: 404 });
  }

  const prices = await prisma.drugPrice.findMany({
    where: { drugId: drug.id },
    select: {
      source: true,
      inStock: true,
      sellingPrice: true,
      lastChecked: true,
    },
    orderBy: { sellingPrice: "asc" },
  });

  const availability = prices.map((p) => ({
    source: p.source,
    inStock: p.inStock,
    price: p.sellingPrice,
    lastChecked: p.lastChecked.toISOString(),
    fresh: getFreshness(p.lastChecked).level === "fresh",
  }));

  return NextResponse.json({ availability });
}
