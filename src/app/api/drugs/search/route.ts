import { NextRequest, NextResponse } from "next/server";
import { sampleDrugs } from "@/lib/sample-data";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase() || "";
  const category = searchParams.get("category");
  const generic = searchParams.get("generic");

  let drugs = sampleDrugs;

  if (q) {
    drugs = drugs.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.genericName.toLowerCase().includes(q) ||
        d.composition.toLowerCase().includes(q)
    );
  }

  if (category) {
    drugs = drugs.filter((d) => d.category === category);
  }

  if (generic === "true") {
    drugs = drugs.filter((d) => d.isGeneric);
  }

  const results = drugs.map((d) => ({
    ...d,
    lowestPrice: Math.min(...d.prices.map((p) => p.sellingPrice)),
    highestMrp: Math.max(...d.prices.map((p) => p.mrp)),
    pharmacyCount: d.prices.length,
  }));

  return NextResponse.json({ results, count: results.length });
}
