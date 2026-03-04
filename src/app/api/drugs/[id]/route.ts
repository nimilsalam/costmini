import { NextRequest, NextResponse } from "next/server";
import { sampleDrugs } from "@/lib/sample-data";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const idx = parseInt(id);
  const drug = sampleDrugs[idx];

  if (!drug) {
    return NextResponse.json({ error: "Drug not found" }, { status: 404 });
  }

  // Find generic alternatives
  const alternatives = sampleDrugs
    .filter(
      (d, i) =>
        i !== idx &&
        d.genericName === drug.genericName
    )
    .map((d) => ({
      ...d,
      lowestPrice: Math.min(...d.prices.map((p) => p.sellingPrice)),
    }));

  return NextResponse.json({
    drug: {
      ...drug,
      lowestPrice: Math.min(...drug.prices.map((p) => p.sellingPrice)),
      highestMrp: Math.max(...drug.prices.map((p) => p.mrp)),
    },
    alternatives,
  });
}
