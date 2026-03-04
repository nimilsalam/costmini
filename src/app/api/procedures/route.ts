import { NextRequest, NextResponse } from "next/server";
import { sampleProcedures } from "@/lib/sample-data";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase() || "";
  const category = searchParams.get("category");
  const city = searchParams.get("city");

  let procedures = sampleProcedures;

  if (q) {
    procedures = procedures.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }

  if (category) {
    procedures = procedures.filter((p) => p.category === category);
  }

  if (city) {
    procedures = procedures.map((p) => ({
      ...p,
      prices: p.prices.filter(
        (hp) => hp.city.toLowerCase() === city.toLowerCase()
      ),
    })).filter((p) => p.prices.length > 0);
  }

  const results = procedures.map((p) => ({
    ...p,
    minPrice: Math.min(...p.prices.map((hp) => hp.minPrice)),
    maxPrice: Math.max(...p.prices.map((hp) => hp.maxPrice)),
    hospitalCount: p.prices.length,
  }));

  return NextResponse.json({ results, count: results.length });
}
