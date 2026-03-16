import { NextRequest, NextResponse } from "next/server";
import { analyzePrescriptionImage } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/cache";

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
    // Rate limit: 10 scans per minute per IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed } = rateLimit(`ai-scan:${ip}`, 10, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
    }

    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Validate file size (max 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Image too large (max 10MB)" }, { status: 413 });
    }

    // Validate file type
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Unsupported image format. Use JPEG, PNG, or WebP." }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: "AI vision not configured. Set GROQ_API_KEY." },
        { status: 503 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = file.type;

    const extractedText = await analyzePrescriptionImage(base64, mimeType);

    let extracted: ExtractedMedicine[] = [];
    try {
      const jsonMatch = extractedText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error("Failed to parse AI response:", extractedText);
    }

    // Match against database
    const results = [];
    const seen = new Set<string>();

    for (const med of extracted) {
      const nameLower = (med.name || "").toLowerCase();
      const genericLower = (med.genericName || "").toLowerCase();

      const matched = await prisma.drug.findFirst({
        where: {
          OR: [
            { name: { contains: nameLower } },
            ...(genericLower ? [{ genericName: { contains: genericLower } }] : []),
            { composition: { contains: nameLower } },
          ],
        },
        include: { prices: { orderBy: { sellingPrice: "asc" } } },
      });

      if (matched && !seen.has(matched.name)) {
        seen.add(matched.name);

        const alternatives = await prisma.drug.findMany({
          where: {
            genericName: matched.genericName,
            NOT: { id: matched.id },
            isGeneric: true,
          },
          include: { prices: { orderBy: { sellingPrice: "asc" } } },
        });

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
