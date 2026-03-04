import { NextRequest, NextResponse } from "next/server";
import { analyzePrescriptionImage, analyzePrescriptionGroq } from "@/lib/ai";
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

    // Convert to base64
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = file.type || "image/jpeg";

    let extractedText = "[]";

    // Try Gemini first, then Groq fallback
    if (process.env.GEMINI_API_KEY) {
      try {
        extractedText = await analyzePrescriptionImage(base64, mimeType);
      } catch (geminiError) {
        console.error("Gemini vision failed, trying Groq:", geminiError);
        if (process.env.GROQ_API_KEY) {
          extractedText = await analyzePrescriptionGroq(base64, mimeType);
        }
      }
    } else if (process.env.GROQ_API_KEY) {
      extractedText = await analyzePrescriptionGroq(base64, mimeType);
    } else {
      return NextResponse.json(
        { error: "No AI vision API configured. Set GEMINI_API_KEY or GROQ_API_KEY." },
        { status: 503 }
      );
    }

    // Parse extracted medicines
    let extracted: ExtractedMedicine[] = [];
    try {
      // Find JSON array in the response
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

      // Find matching drug
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

        // Find generic alternatives
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
        // Include unmatched medicines too
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
      provider: process.env.GEMINI_API_KEY ? "gemini" : "groq",
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
