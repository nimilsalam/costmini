import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const drug = await prisma.drug.findFirst({
    where: { OR: [{ slug: id }, { id: id }] },
    select: { id: true },
  });

  if (!drug) {
    return NextResponse.json({ error: "Drug not found" }, { status: 404 });
  }

  // Last 30 days of price history grouped by source
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const history = await prisma.priceHistory.findMany({
    where: {
      drugId: drug.id,
      recordedAt: { gte: thirtyDaysAgo },
    },
    orderBy: { recordedAt: "asc" },
    select: {
      source: true,
      sellingPrice: true,
      mrp: true,
      recordedAt: true,
    },
  });

  // Group by source
  const bySource: Record<string, { price: number; date: string }[]> = {};
  for (const entry of history) {
    if (!bySource[entry.source]) bySource[entry.source] = [];
    bySource[entry.source].push({
      price: entry.sellingPrice,
      date: entry.recordedAt.toISOString(),
    });
  }

  // Compute trends per source
  const trends: Record<string, { change: number; direction: "up" | "down" | "stable" }> = {};
  for (const [source, entries] of Object.entries(bySource)) {
    if (entries.length < 2) {
      trends[source] = { change: 0, direction: "stable" };
      continue;
    }
    const oldest = entries[0].price;
    const newest = entries[entries.length - 1].price;
    const change = oldest > 0 ? Math.round(((newest - oldest) / oldest) * 100) : 0;
    trends[source] = {
      change: Math.abs(change),
      direction: change > 0 ? "up" : change < 0 ? "down" : "stable",
    };
  }

  return NextResponse.json({ history: bySource, trends });
}
