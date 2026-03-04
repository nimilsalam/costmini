import { NextRequest, NextResponse } from "next/server";
import { sampleDrugs } from "@/lib/sample-data";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json(
        { error: "No text provided" },
        { status: 400 }
      );
    }

    const textLower = text.toLowerCase();
    const matched: Array<{
      extractedName: string;
      drug: (typeof sampleDrugs)[0];
      alternatives: (typeof sampleDrugs)[0][];
      confidence: number;
    }> = [];

    const seen = new Set<string>();

    for (const drug of sampleDrugs) {
      if (
        (textLower.includes(drug.name.toLowerCase()) ||
          textLower.includes(drug.genericName.toLowerCase())) &&
        !seen.has(drug.genericName)
      ) {
        seen.add(drug.genericName);
        const alternatives = sampleDrugs.filter(
          (d) =>
            d.genericName === drug.genericName &&
            d.name !== drug.name &&
            d.isGeneric
        );
        matched.push({
          extractedName: drug.name,
          drug,
          alternatives,
          confidence: 0.85,
        });
      }
    }

    return NextResponse.json({
      results: matched,
      totalFound: matched.length,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
