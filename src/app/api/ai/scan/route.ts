import { NextRequest, NextResponse } from "next/server";
import { analyzePrescriptionImage } from "@/lib/ai";
import { sampleDrugs } from "@/lib/sample-data";

export const runtime = "nodejs";

interface ExtractedMedicine {
  name: string;
  genericName?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: "AI vision not configured. Set GROQ_API_KEY." },
        { status: 503 }
      );
    }

    // Convert to base64
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = file.type || "image/jpeg";

    const extractedText = await analyzePrescriptionImage(base64, mimeType);

    // Parse extracted medicines
    let extracted: ExtractedMedicine[] = [];
    try {
      const jsonMatch = extractedText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error("Failed to parse AI response:", extractedText);
    }

    // Match against our database
    const results = [];
    const seen = new Set<string>();

    for (const med of extracted) {
      const nameLower = (med.name || "").toLowerCase();
      const genericLower = (med.genericName || "").toLowerCase();

      const matched = sampleDrugs.find(
        (d) =>
          d.name.toLowerCase().includes(nameLower) ||
          nameLower.includes(d.name.toLowerCase()) ||
          (genericLower && d.genericName.toLowerCase().includes(genericLower)) ||
          (genericLower && genericLower.includes(d.genericName.toLowerCase())) ||
          d.composition.toLowerCase().split(" ").some(
            (word) => word.length > 3 && nameLower.includes(word.toLowerCase())
          )
      );

      if (matched && !seen.has(matched.name)) {
        seen.add(matched.name);

        const alternatives = sampleDrugs.filter(
          (d) =>
            d.genericName === matched.genericName &&
            d.name !== matched.name &&
            d.isGeneric
        );

        results.push({
          extractedName: med.name,
          extractedGeneric: med.genericName || null,
          dosage: med.dosage || null,
          frequency: med.frequency || null,
          duration: med.duration || null,
          matchedDrug: matched,
          alternatives,
          confidence: 0.9,
        });
      } else if (!matched) {
        results.push({
          extractedName: med.name,
          extractedGeneric: med.genericName || null,
          dosage: med.dosage || null,
          frequency: med.frequency || null,
          duration: med.duration || null,
          matchedDrug: null,
          alternatives: [],
          confidence: 0.6,
        });
      }
    }

    return NextResponse.json({
      success: true,
      provider: "groq",
      extracted: extracted.length,
      matched: results.filter((r) => r.matchedDrug).length,
      results,
    });
  } catch (error) {
    console.error("AI scan error:", error);
    return NextResponse.json(
      { error: "Failed to analyze prescription. Please try again." },
      { status: 500 }
    );
  }
}
