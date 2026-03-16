import { NextRequest, NextResponse } from "next/server";
import {
  parseWebhookMessages,
  sendTextMessage,
  downloadMedia,
  getWelcomeMessage,
  type WhatsAppConfig,
  type WhatsAppWebhookPayload,
} from "@/lib/whatsapp";
import { prisma } from "@/lib/db";
import { analyzePrescriptionImage } from "@/lib/ai";
import { formatPrice, calcSavings } from "@/lib/utils";

function getConfig(): WhatsAppConfig {
  return {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "costmini_verify_token",
    webhookUrl: process.env.WHATSAPP_WEBHOOK_URL || "",
  };
}

// GET: Webhook verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const config = getConfig();

  if (mode === "subscribe" && token === config.verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST: Handle incoming messages
export async function POST(req: NextRequest) {
  const config = getConfig();
  if (!config.phoneNumberId || !config.accessToken) {
    return NextResponse.json({ status: "not_configured" });
  }

  try {
    const payload = (await req.json()) as WhatsAppWebhookPayload;
    const messages = parseWebhookMessages(payload);

    for (const msg of messages) {
      if (msg.type === "text" && msg.text) {
        await handleTextMessage(config, msg.from, msg.text);
      } else if (msg.type === "image" && msg.imageId) {
        await handleImageMessage(config, msg.from, msg.imageId);
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

// ─── TEXT MESSAGE HANDLER ────────────────────────────────────────────────────

async function handleTextMessage(config: WhatsAppConfig, from: string, text: string) {
  const lower = text.toLowerCase().trim();

  // Greetings
  if (["hi", "hello", "start", "help", "hey", "menu"].includes(lower)) {
    await sendTextMessage(config, from, getWelcomeMessage());
    return;
  }

  // Quick commands
  if (lower === "cheapest" || lower === "savings") {
    await sendTextMessage(config, from,
      "Send me any medicine name and I'll find the cheapest option!\n\nExamples:\n• Dolo 650\n• Paracetamol\n• Azithromycin 500mg\n• Pan 40"
    );
    return;
  }

  // Search by composition first (more useful for alternatives)
  const compositionResults = await searchByComposition(lower);
  if (compositionResults) {
    await sendTextMessage(config, from, compositionResults);
    return;
  }

  // Fall back to drug name search
  const drugResults = await searchByName(lower);
  if (drugResults) {
    await sendTextMessage(config, from, drugResults);
    return;
  }

  // Nothing found
  await sendTextMessage(config, from,
    `No medicines found for "${text}".\n\n` +
    `Try:\n• Generic name: "Paracetamol"\n• Brand name: "Dolo 650"\n• Salt: "Azithromycin"\n• Or send a prescription photo 📸`
  );
}

// ─── COMPOSITION-BASED SEARCH (core value: same salt, different prices) ──────

async function searchByComposition(query: string): Promise<string | null> {
  // Find composition group matching the query
  const group = await prisma.compositionGroup.findFirst({
    where: {
      OR: [
        { displayName: { contains: query } },
        { primarySalt: { contains: query } },
      ],
    },
    include: {
      drugs: {
        include: {
          prices: { orderBy: { sellingPrice: "asc" }, take: 1 },
          manufacturerRef: { select: { name: true, tier: true } },
        },
        orderBy: { name: "asc" },
        take: 20,
      },
    },
    orderBy: { drugCount: "desc" },
  });

  if (!group || group.drugs.length === 0) return null;

  // Sort by cheapest price
  const withPrices = group.drugs
    .filter(d => d.prices.length > 0 && d.prices[0].sellingPrice > 0)
    .sort((a, b) => a.prices[0].sellingPrice - b.prices[0].sellingPrice);

  if (withPrices.length === 0) return null;

  const cheapest = withPrices[0];
  const expensive = withPrices[withPrices.length - 1];
  const cheapestPrice = cheapest.prices[0].sellingPrice;
  const expensivePrice = expensive.prices[0].sellingPrice;
  const maxSavings = expensivePrice > 0 ? calcSavings(expensivePrice, cheapestPrice) : 0;

  const lines = [
    `💊 *${group.displayName}*`,
    `${group.drugCount} brands available in India`,
    "",
    `💰 *Cheapest: ${formatPrice(cheapestPrice)}* | Most expensive: ${formatPrice(expensivePrice)}`,
    maxSavings > 0 ? `Save up to *${maxSavings}%* by choosing right!\n` : "",
  ];

  // Show top 5 cheapest
  lines.push("*🏆 Top 5 cheapest options:*");
  withPrices.slice(0, 5).forEach((d, i) => {
    const price = d.prices[0].sellingPrice;
    const tier = d.manufacturerRef?.tier;
    const badge = d.isGeneric ? " (Generic)" : "";
    const quality = tier === "premium" ? " ⭐" : tier === "trusted" ? " ✓" : "";
    lines.push(`${i + 1}. *${d.name}*${badge}${quality}`);
    lines.push(`   ${formatPrice(price)} · ${d.manufacturer || "Unknown"} · ${d.packSize}`);
  });

  // Show most expensive for comparison
  if (withPrices.length > 5) {
    lines.push("");
    lines.push(`_Most expensive: ${expensive.name} at ${formatPrice(expensivePrice)}_`);
  }

  lines.push("");
  lines.push(`🔗 Full comparison: costmini.in/medicines/${cheapest.slug}`);
  lines.push("\n_Reply with another medicine name or send a prescription photo_ 📸");

  return lines.join("\n");
}

// ─── NAME-BASED SEARCH ──────────────────────────────────────────────────────

async function searchByName(query: string): Promise<string | null> {
  const matches = await prisma.drug.findMany({
    where: {
      OR: [
        { name: { contains: query } },
        { genericName: { contains: query } },
        { composition: { contains: query } },
      ],
    },
    include: {
      prices: { orderBy: { sellingPrice: "asc" }, take: 3 },
      manufacturerRef: { select: { tier: true } },
      compositionGroup: { select: { id: true, displayName: true, drugCount: true, lowestPrice: true } },
    },
    take: 5,
    orderBy: { name: "asc" },
  });

  if (matches.length === 0) return null;

  const lines: string[] = [];

  for (const drug of matches) {
    const cheapest = drug.prices[0]?.sellingPrice || 0;
    const mrp = drug.prices.length > 0 ? Math.max(...drug.prices.map(p => p.mrp)) : 0;
    const savings = mrp > 0 ? calcSavings(mrp, cheapest) : 0;

    lines.push(`💊 *${drug.name}*`);
    lines.push(`   ${drug.composition || "N/A"} · ${drug.manufacturer || ""}`);

    if (cheapest > 0) {
      lines.push(`   Price: *${formatPrice(cheapest)}*${savings > 0 ? ` (Save ${savings}% off MRP ${formatPrice(mrp)})` : ""}`);
    }

    // Show pharmacy prices
    if (drug.prices.length > 0) {
      const pharmacyPrices = drug.prices.map(p => `${p.source}: ${formatPrice(p.sellingPrice)}`).join(" | ");
      lines.push(`   ${pharmacyPrices}`);
    }

    // Show cheaper alternatives from same composition group
    if (drug.compositionGroup && drug.compositionGroup.lowestPrice && drug.compositionGroup.lowestPrice < cheapest) {
      const saved = calcSavings(cheapest, drug.compositionGroup.lowestPrice);
      lines.push(`   ⚡ *Cheaper alternative available from ${formatPrice(drug.compositionGroup.lowestPrice)}* (${saved}% less)`);
      lines.push(`   _Reply "${drug.compositionGroup.displayName}" to see all brands_`);
    }

    lines.push("");
  }

  lines.push(`🔗 Details: costmini.in/medicines/${matches[0].slug}`);
  lines.push("\n_Send another name or a prescription photo_ 📸");

  return lines.join("\n");
}

// ─── IMAGE/PRESCRIPTION HANDLER ─────────────────────────────────────────────

async function handleImageMessage(config: WhatsAppConfig, from: string, imageId: string) {
  await sendTextMessage(config, from, "📸 Got your prescription! Analyzing... This takes a few seconds.");

  // Check if AI is configured
  if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
    await sendTextMessage(config, from,
      "AI scan is not available right now. Please type the medicine name instead.\n\nExample: \"Dolo 650\""
    );
    return;
  }

  try {
    // Download image from WhatsApp
    const imageBuffer = await downloadMedia(config, imageId);
    if (!imageBuffer) {
      await sendTextMessage(config, from, "Could not download the image. Please try again.");
      return;
    }

    // Analyze with AI
    const base64 = imageBuffer.toString("base64");
    const extractedText = await analyzePrescriptionImage(base64, "image/jpeg");

    // Parse extracted medicines
    interface ExtractedMed { name: string; genericName?: string; dosage?: string }
    let extracted: ExtractedMed[] = [];
    try {
      const jsonMatch = extractedText.match(/\[[\s\S]*\]/);
      if (jsonMatch) extracted = JSON.parse(jsonMatch[0]);
    } catch { /* ignore parse errors */ }

    if (extracted.length === 0) {
      await sendTextMessage(config, from,
        "Could not identify medicines from this image.\n\n" +
        "Tips:\n• Use a clear, well-lit photo\n• Make sure medicine names are readable\n• Or type the medicine name directly"
      );
      return;
    }

    // Look up each medicine in database
    const results: Array<{
      name: string;
      brandPrice: number;
      cheapestPrice: number;
      cheapestName: string;
      composition: string;
      savingsPercent: number;
    }> = [];

    const seen = new Set<string>();

    for (const med of extracted) {
      const nameLower = (med.name || "").toLowerCase();
      if (!nameLower || seen.has(nameLower)) continue;
      seen.add(nameLower);

      // Find in DB
      const matched = await prisma.drug.findFirst({
        where: {
          OR: [
            { name: { contains: nameLower } },
            ...(med.genericName ? [{ genericName: { contains: med.genericName.toLowerCase() } }] : []),
            { composition: { contains: nameLower } },
          ],
        },
        include: {
          prices: { orderBy: { sellingPrice: "asc" }, take: 1 },
          compositionGroup: {
            select: { lowestPrice: true, displayName: true },
          },
        },
      });

      if (matched && matched.prices.length > 0) {
        const brandPrice = matched.prices[0].mrp || matched.prices[0].sellingPrice;
        const cheapestInGroup = matched.compositionGroup?.lowestPrice || matched.prices[0].sellingPrice;

        results.push({
          name: med.name,
          composition: matched.composition || "",
          brandPrice,
          cheapestPrice: cheapestInGroup,
          cheapestName: matched.compositionGroup?.displayName || matched.name,
          savingsPercent: brandPrice > 0 ? calcSavings(brandPrice, cheapestInGroup) : 0,
        });
      }
    }

    if (results.length === 0) {
      await sendTextMessage(config, from,
        `Found ${extracted.length} medicine(s) but none matched our database.\n\n` +
        `Medicines identified: ${extracted.map(m => m.name).join(", ")}\n\n` +
        "Try typing each medicine name for manual search."
      );
      return;
    }

    // Build response
    const totalBrand = results.reduce((s, r) => s + r.brandPrice, 0);
    const totalCheapest = results.reduce((s, r) => s + r.cheapestPrice, 0);
    const totalSaved = totalBrand - totalCheapest;

    const lines = [
      "📋 *Prescription Analysis*",
      `Found ${results.length} medicine(s):\n`,
    ];

    for (const r of results) {
      lines.push(`💊 *${r.name}* (${r.composition})`);
      lines.push(`   MRP: ${formatPrice(r.brandPrice)} → Cheapest: *${formatPrice(r.cheapestPrice)}*`);
      if (r.savingsPercent > 0) {
        lines.push(`   💰 Save *${r.savingsPercent}%* with generic alternative`);
      }
      lines.push("");
    }

    if (totalSaved > 0) {
      lines.push(`━━━━━━━━━━━━━━━`);
      lines.push(`*Total Savings: ${formatPrice(totalSaved)}* (${Math.round((totalSaved / totalBrand) * 100)}% less)`);
      lines.push("");
    }

    lines.push("_Reply with a medicine name to see all brands and pharmacies_");
    lines.push("\n🔗 Full details: costmini.in/scan");

    await sendTextMessage(config, from, lines.join("\n"));

  } catch {
    await sendTextMessage(config, from,
      "Something went wrong analyzing your prescription. Please try again or type the medicine name."
    );
  }
}
