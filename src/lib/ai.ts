import Groq from "groq-sdk";

// Groq client — uses GROQ_API_KEY env var
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "",
});

// Google Gemini client — lazy import to avoid bundling issues
async function getGeminiClient() {
  const { GoogleGenAI } = await import("@google/genai");
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
}

// ─── Medicine Knowledge Base ───────────────────────────────────────
import { sampleDrugs, sampleProcedures, sampleDiagnostics } from "./sample-data";
import { formatPrice, calcSavings } from "./utils";

function buildMedicineContext(query: string): string {
  const q = query.toLowerCase();

  // Find relevant drugs
  const matchedDrugs = sampleDrugs.filter(
    (d) =>
      d.name.toLowerCase().includes(q) ||
      d.genericName.toLowerCase().includes(q) ||
      d.composition.toLowerCase().includes(q) ||
      d.category.toLowerCase().includes(q)
  );

  // Find relevant procedures
  const matchedProcedures = sampleProcedures.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
  );

  // Find relevant diagnostics
  const matchedDiagnostics = sampleDiagnostics.filter(
    (d) =>
      d.name.toLowerCase().includes(q) ||
      d.type.toLowerCase().includes(q) ||
      d.category.toLowerCase().includes(q)
  );

  let context = "";

  if (matchedDrugs.length > 0) {
    context += "## Medicine Data:\n";
    for (const drug of matchedDrugs.slice(0, 8)) {
      const cheapest = Math.min(...drug.prices.map((p) => p.sellingPrice));
      const generic = drug.isGeneric ? "GENERIC" : "BRANDED";
      context += `- **${drug.name}** (${generic}): ${drug.composition}, by ${drug.manufacturer}. `;
      context += `Cheapest: ${formatPrice(cheapest)}. Pack: ${drug.packSize}. `;
      context += `Uses: ${drug.uses}. Side effects: ${drug.sideEffects}\n`;

      // Find alternatives
      if (!drug.isGeneric) {
        const alts = sampleDrugs.filter(
          (d) => d.genericName === drug.genericName && d.isGeneric
        );
        if (alts.length > 0) {
          const altCheapest = Math.min(
            ...alts.flatMap((a) => a.prices.map((p) => p.sellingPrice))
          );
          const saving = calcSavings(cheapest, altCheapest);
          context += `  → Generic alternative: ${alts[0].name} at ${formatPrice(altCheapest)} (Save ${saving}%)\n`;
        }
      }
    }
  }

  if (matchedProcedures.length > 0) {
    context += "\n## Procedure Data:\n";
    for (const proc of matchedProcedures.slice(0, 5)) {
      const cheapest = Math.min(...proc.prices.map((p) => p.minPrice));
      const expensive = Math.max(...proc.prices.map((p) => p.maxPrice));
      context += `- **${proc.name}**: ${proc.category}. Duration: ${proc.duration}. Recovery: ${proc.recoveryTime}.\n`;
      context += `  Price range: ${formatPrice(cheapest)} - ${formatPrice(expensive)}\n`;
      for (const p of proc.prices) {
        context += `  → ${p.hospitalName} (${p.city}): ${formatPrice(p.minPrice)} - ${formatPrice(p.maxPrice)}${p.accreditation ? ` [${p.accreditation}]` : ""}\n`;
      }
    }
  }

  if (matchedDiagnostics.length > 0) {
    context += "\n## Diagnostic Data:\n";
    for (const diag of matchedDiagnostics.slice(0, 5)) {
      const cheapest = Math.min(...diag.prices.map((p) => p.sellingPrice));
      context += `- **${diag.name}**: ${diag.type}. ${diag.description}\n`;
      context += `  Cheapest: ${formatPrice(cheapest)}. Report: ${diag.reportTime}. Home collection: ${diag.homeCollection ? "Yes" : "No"}\n`;
      for (const p of diag.prices) {
        context += `  → ${p.labName}: ${formatPrice(p.sellingPrice)}${p.accreditation ? ` [${p.accreditation}]` : ""}\n`;
      }
    }
  }

  return context;
}

const SYSTEM_PROMPT = `You are CostMini AI — India's healthcare price transparency assistant. You help people find affordable medicines, surgeries, and lab tests.

Your personality: helpful, direct, data-driven. You care about saving people money on healthcare.

Rules:
- Always cite specific prices from the data when available
- Compare branded vs generic prices and highlight savings
- Recommend the cheapest quality option (WHO-certified or NABL/NABH accredited)
- For medicines: mention Jan Aushadhi stores as cheapest option
- For surgeries: mention government hospital options alongside private
- Include a brief medical disclaimer when discussing medicines
- Format responses with clear sections, bullet points, and bold prices
- Keep responses concise but comprehensive — like a knowledgeable pharmacist friend
- If you don't have data for a specific query, say so honestly and suggest what to search
- Always mention that users should consult their doctor before switching medicines
- Use INR (₹) for all prices

IMPORTANT: You are NOT a doctor. You provide pricing information and generic alternatives. Always recommend consulting a healthcare professional.`;

// ─── Groq Streaming Chat ───────────────────────────────────────────
export async function streamMedicineSearch(query: string) {
  const context = buildMedicineContext(query);

  const messages: { role: "system" | "user"; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  if (context) {
    messages.push({
      role: "system",
      content: `Here is the relevant CostMini database data for this query:\n\n${context}`,
    });
  }

  messages.push({
    role: "user",
    content: query,
  });

  const stream = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages,
    stream: true,
    temperature: 0.3,
    max_tokens: 2048,
  });

  return stream;
}

// ─── Gemini Vision for Prescription Scanning ───────────────────────
export async function analyzePrescriptionImage(
  imageBase64: string,
  mimeType: string
): Promise<string> {
  const genai = await getGeminiClient();

  const result = await genai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              data: imageBase64,
              mimeType: mimeType,
            },
          },
          {
            text: `You are a medical prescription reader for CostMini, India's healthcare pricing platform.

Analyze this prescription image and extract ALL medicines mentioned. For each medicine found, output a JSON array with this exact format:

[
  {
    "name": "exact medicine name as written",
    "genericName": "generic/salt name if identifiable",
    "dosage": "dosage if visible",
    "frequency": "frequency if visible (e.g., 1-0-1)",
    "duration": "duration if visible"
  }
]

Rules:
- Extract EVERY medicine name visible, even if partially readable
- If you can identify the generic/salt name, include it
- If handwriting is unclear, give your best interpretation with a note
- Return ONLY the JSON array, no other text
- If no medicines are found, return an empty array []`,
          },
        ],
      },
    ],
  });

  return result.text || "[]";
}

// ─── Groq Vision Fallback ──────────────────────────────────────────
export async function analyzePrescriptionGroq(
  imageBase64: string,
  mimeType: string
): Promise<string> {
  const response = await groq.chat.completions.create({
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
            },
          },
          {
            type: "text",
            text: `Extract ALL medicine names from this prescription image. Return a JSON array:
[{"name": "medicine name", "genericName": "generic name if known", "dosage": "dosage", "frequency": "frequency", "duration": "duration"}]
Return ONLY valid JSON. If no medicines found, return [].`,
          },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 1024,
  });

  return response.choices[0]?.message?.content || "[]";
}

export { groq, getGeminiClient };
