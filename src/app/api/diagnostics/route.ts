import { NextRequest, NextResponse } from "next/server";
import { sampleDiagnostics } from "@/lib/sample-data";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase() || "";
  const category = searchParams.get("category");
  const homeCollection = searchParams.get("home");

  let diagnostics = sampleDiagnostics;

  if (q) {
    diagnostics = diagnostics.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.type.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
    );
  }

  if (category) {
    diagnostics = diagnostics.filter((d) => d.category === category);
  }

  if (homeCollection === "true") {
    diagnostics = diagnostics.filter((d) => d.homeCollection);
  }

  const results = diagnostics.map((d) => ({
    ...d,
    lowestPrice: Math.min(...d.prices.map((p) => p.sellingPrice)),
    highestMrp: Math.max(...d.prices.map((p) => p.mrp)),
    labCount: d.prices.length,
  }));

  return NextResponse.json({ results, count: results.length });
}
