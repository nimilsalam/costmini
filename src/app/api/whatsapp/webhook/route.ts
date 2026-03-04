import { NextRequest, NextResponse } from "next/server";
import {
  parseWebhookMessages,
  sendTextMessage,
  getWelcomeMessage,
  getScanSummaryMessage,
  type WhatsAppConfig,
  type WhatsAppWebhookPayload,
} from "@/lib/whatsapp";
import { sampleDrugs } from "@/lib/sample-data";

function getConfig(): WhatsAppConfig {
  return {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "costmini_verify_token",
    webhookUrl: process.env.WHATSAPP_WEBHOOK_URL || "",
  };
}

/**
 * GET /api/whatsapp/webhook
 * Webhook verification (Meta sends a GET to verify your endpoint)
 */
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

/**
 * POST /api/whatsapp/webhook
 * Receives incoming messages from WhatsApp users
 */
export async function POST(req: NextRequest) {
  const config = getConfig();

  if (!config.phoneNumberId || !config.accessToken) {
    // WhatsApp not configured — log and acknowledge
    return NextResponse.json({ status: "not_configured" });
  }

  try {
    const payload = (await req.json()) as WhatsAppWebhookPayload;
    const messages = parseWebhookMessages(payload);

    for (const msg of messages) {
      if (msg.type === "text" && msg.text) {
        await handleTextMessage(config, msg.from, msg.text);
      } else if (msg.type === "image" && msg.imageId) {
        // For image processing, send acknowledgment first
        await sendTextMessage(
          config,
          msg.from,
          "📸 Got your prescription! Analyzing... This takes a few seconds."
        );
        // In production: download image, run OCR, match drugs
        // For now, send demo results
        await handleDemoImageScan(config, msg.from);
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

async function handleTextMessage(
  config: WhatsAppConfig,
  from: string,
  text: string
) {
  const lower = text.toLowerCase().trim();

  // Welcome / help commands
  if (["hi", "hello", "start", "help", "hey"].includes(lower)) {
    await sendTextMessage(config, from, getWelcomeMessage());
    return;
  }

  // Search for medicine by name
  const matches = sampleDrugs.filter(
    (d) =>
      d.name.toLowerCase().includes(lower) ||
      d.genericName.toLowerCase().includes(lower) ||
      d.composition.toLowerCase().includes(lower)
  );

  if (matches.length === 0) {
    await sendTextMessage(
      config,
      from,
      `❌ No medicines found for "${text}".\n\nTry searching by generic name (e.g. "Paracetamol") or send a photo of your prescription.`
    );
    return;
  }

  // Build response with found medicines
  const lines = [`🔍 *Results for "${text}":*`, ""];

  for (const drug of matches.slice(0, 5)) {
    const cheapest = Math.min(...drug.prices.map((p) => p.sellingPrice));
    const mrp = Math.max(...drug.prices.map((p) => p.mrp));
    const savings =
      mrp > 0 ? Math.round(((mrp - cheapest) / mrp) * 100) : 0;

    lines.push(`💊 *${drug.name}*`);
    lines.push(`   ${drug.composition} | ${drug.manufacturer}`);
    lines.push(
      `   Price: ₹${cheapest}${savings > 0 ? ` (Save ${savings}%)` : ""}`
    );
    lines.push(
      `   ${drug.isGeneric ? "✅ Generic" : "🏷️ Branded"}${drug.whoCertified ? " | WHO-GMP" : ""}`
    );
    lines.push("");
  }

  // Suggest generics if searching for a branded drug
  const branded = matches.find((d) => !d.isGeneric);
  if (branded) {
    const generics = sampleDrugs.filter(
      (d) => d.genericName === branded.genericName && d.isGeneric
    );
    if (generics.length > 0) {
      const gen = generics[0];
      const genPrice = Math.min(...gen.prices.map((p) => p.sellingPrice));
      lines.push(`💡 *Cheaper Alternative:* ${gen.name} — ₹${genPrice}`);
      lines.push("");
    }
  }

  lines.push("🔗 Full details: costmini.in/medicines");

  await sendTextMessage(config, from, lines.join("\n"));
}

async function handleDemoImageScan(config: WhatsAppConfig, from: string) {
  // Demo scan results (in production, this would use OCR + drug matching)
  const demoResults = [
    {
      drugName: "Dolo 650 (Paracetamol)",
      brandPrice: 30,
      genericPrice: 6,
      savingsPercent: 80,
    },
    {
      drugName: "Azithral 500 (Azithromycin)",
      brandPrice: 109,
      genericPrice: 23,
      savingsPercent: 79,
    },
    {
      drugName: "Pan 40 (Pantoprazole)",
      brandPrice: 124,
      genericPrice: 14,
      savingsPercent: 89,
    },
  ];

  const summary = getScanSummaryMessage(demoResults);
  await sendTextMessage(config, from, summary);
}
