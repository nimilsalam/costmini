import { NextRequest, NextResponse } from "next/server";
import {
  parseWebhookMessages,
  sendTextMessage,
  sendButtonMessage,
  sendListMessage,
  downloadMedia,
  markAsRead,
  getWelcomeMessage,
  getHelpMessage,
  getSession,
  formatINR,
  formatSavings,
  getShareText,
  type WhatsAppConfig,
  type WhatsAppWebhookPayload,
} from "@/lib/whatsapp";
import { prisma } from "@/lib/db";
import { analyzePrescriptionImage } from "@/lib/ai";
import { rateLimit } from "@/lib/cache";

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
      // Rate limit: 30 messages/min per user
      const { allowed } = rateLimit(`wa:${msg.from}`, 30, 60_000);
      if (!allowed) continue;

      // Mark as read (blue ticks)
      if (msg.messageId) markAsRead(config, msg.messageId);

      // Route by message type
      if (msg.type === "text" && msg.text) {
        await handleTextMessage(config, msg.from, msg.text);
      } else if (msg.type === "image" && msg.imageId) {
        await handleImageMessage(config, msg.from, msg.imageId);
      } else if ((msg.type === "interactive" || msg.type === "button") && (msg.buttonPayload || msg.listReplyId)) {
        await handleInteractiveMessage(config, msg.from, msg.buttonPayload || msg.listReplyId || "");
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
  const session = getSession(from);

  // Language switch
  if (lower === "hindi" || lower === "हिंदी") {
    session.language = "hi";
    await sendTextMessage(config, from, getWelcomeMessage("hi"));
    return;
  }
  if (lower === "english") {
    session.language = "en";
    await sendTextMessage(config, from, getWelcomeMessage("en"));
    return;
  }

  // Greetings → welcome with interactive buttons
  if (["hi", "hello", "hey", "start", "menu", "namaste", "namaskar"].includes(lower)) {
    if (session.messageCount <= 1) {
      // First time user → full welcome
      await sendTextMessage(config, from, getWelcomeMessage(session.language));
    } else {
      // Returning user → quick menu
      await sendButtonMessage(config, from,
        "Welcome back! What would you like to do?",
        [
          { id: "action_search", title: "Search Medicine" },
          { id: "action_scan", title: "Scan Prescription" },
          { id: "action_help", title: "Help" },
        ],
        "CostMini",
        "costmini.in"
      );
    }
    return;
  }

  // Help
  if (["help", "?", "commands", "guide", "madad"].includes(lower)) {
    await sendTextMessage(config, from, getHelpMessage());
    return;
  }

  // Jan Aushadhi query
  if (lower.startsWith("janaushadhi") || lower.startsWith("jan aushadhi") || lower.startsWith("generic")) {
    const salt = lower.replace(/^(janaushadhi|jan aushadhi|generic)\s*/i, "").trim();
    if (salt) {
      await handleJanAushadhiSearch(config, from, salt);
      return;
    }
    await sendTextMessage(config, from,
      "🏛️ *Jan Aushadhi Kendras* sell government-backed generic medicines at 50-90% less.\n\n" +
      "Type: janaushadhi <medicine name>\nExample: janaushadhi paracetamol"
    );
    return;
  }

  // Compare command
  if (lower.startsWith("compare ")) {
    const salt = lower.replace("compare ", "").trim();
    await searchByComposition(config, from, salt, session);
    return;
  }

  // Share last savings
  if (lower === "share" || lower === "share savings") {
    if (session.lastDrug && session.lastComposition) {
      await sendTextMessage(config, from,
        getShareText(session.lastDrug, 100, 20, 80) // TODO: use real prices from session
      );
    } else {
      await sendTextMessage(config, from, "Search for a medicine first, then I'll help you share the savings!");
    }
    return;
  }

  // Main search flow — composition first, then name
  session.lastAction = "search";

  // Try composition group search first (most useful)
  const compResult = await searchByComposition(config, from, lower, session);
  if (compResult) return;

  // Fall back to drug name search
  const nameResult = await searchByName(config, from, lower, session);
  if (nameResult) return;

  // Nothing found → suggest alternatives
  await sendButtonMessage(config, from,
    `No results for "${text}".\n\nTry:\n• Generic salt name (Paracetamol)\n• Brand name (Dolo 650)\n• Send a prescription photo 📸`,
    [
      { id: "action_scan", title: "Scan Prescription" },
      { id: "action_help", title: "Help" },
    ],
    "Not Found"
  );
}

// ─── COMPOSITION-BASED SEARCH ───────────────────────────────────────────────

async function searchByComposition(
  config: WhatsAppConfig, from: string, query: string, session: ReturnType<typeof getSession>
): Promise<boolean> {
  const group = await prisma.compositionGroup.findFirst({
    where: {
      OR: [
        { displayName: { contains: query } },
        { primarySalt: { contains: query } },
        { compositionKey: { contains: query } },
      ],
    },
    include: {
      drugs: {
        where: { prices: { some: { sellingPrice: { gt: 0 } } } },
        include: {
          prices: { orderBy: { sellingPrice: "asc" }, take: 1 },
          manufacturerRef: { select: { name: true, tier: true } },
        },
        orderBy: { name: "asc" },
        take: 30,
      },
    },
    orderBy: { drugCount: "desc" },
  });

  if (!group || group.drugs.length === 0) return false;

  const withPrices = group.drugs
    .filter(d => d.prices.length > 0 && d.prices[0].sellingPrice > 0)
    .sort((a, b) => a.prices[0].sellingPrice - b.prices[0].sellingPrice);

  if (withPrices.length === 0) return false;

  // Update session
  session.lastComposition = group.displayName;
  session.lastDrug = withPrices[0].name;

  const cheapest = withPrices[0];
  const expensive = withPrices[withPrices.length - 1];
  const cheapPrice = cheapest.prices[0].sellingPrice;
  const expPrice = expensive.prices[0].sellingPrice;
  const savings = formatSavings(expPrice, cheapPrice);

  // Build message
  const lines = [
    `💊 *${group.displayName}*`,
    `${group.drugCount} brands available across Indian pharmacies`,
    "",
    `💰 Cheapest: *${formatINR(cheapPrice)}* | Most expensive: ${formatINR(expPrice)}`,
  ];

  if (savings) {
    lines.push(`🔥 Save up to *${savings}* by choosing right!`);
  }
  lines.push("");

  // Top 5 cheapest
  lines.push("*🏆 Cheapest options:*");
  withPrices.slice(0, 5).forEach((d, i) => {
    const price = d.prices[0].sellingPrice;
    const source = d.prices[0].source;
    const tier = d.manufacturerRef?.tier;
    const badge = d.isGeneric ? " ✅Generic" : "";
    const quality = tier === "premium" ? " ⭐" : tier === "trusted" ? " ☑️" : "";
    lines.push(`${i + 1}. *${d.name}*${badge}${quality}`);
    lines.push(`   ${formatINR(price)} on ${source} · ${d.manufacturer || ""}`);
  });

  if (withPrices.length > 5) {
    lines.push(`\n_+${withPrices.length - 5} more brands available_`);
  }

  lines.push(`\n🔗 Full comparison: costmini.in/medicines/${cheapest.slug}`);

  await sendTextMessage(config, from, lines.join("\n"));

  // Follow up with action buttons
  await sendButtonMessage(config, from,
    "What would you like to do next?",
    [
      { id: `buy_${cheapest.slug}`, title: "Buy Cheapest" },
      { id: `all_${group.id}`, title: "See All Brands" },
      { id: "action_scan", title: "Scan Prescription" },
    ]
  );

  return true;
}

// ─── NAME-BASED SEARCH ──────────────────────────────────────────────────────

async function searchByName(
  config: WhatsAppConfig, from: string, query: string, session: ReturnType<typeof getSession>
): Promise<boolean> {
  const matches = await prisma.drug.findMany({
    where: {
      OR: [
        { name: { contains: query } },
        { genericName: { contains: query } },
        { composition: { contains: query } },
      ],
    },
    include: {
      prices: { orderBy: { sellingPrice: "asc" }, take: 4 },
      manufacturerRef: { select: { tier: true } },
      compositionGroup: { select: { id: true, displayName: true, drugCount: true, lowestPrice: true, highestPrice: true } },
    },
    take: 3,
    orderBy: { name: "asc" },
  });

  if (matches.length === 0) return false;

  const drug = matches[0];
  session.lastDrug = drug.name;
  session.lastComposition = drug.composition || "";

  const cheapest = drug.prices[0]?.sellingPrice || 0;
  const mrp = drug.prices.length > 0 ? Math.max(...drug.prices.map(p => p.mrp || 0)) : 0;
  const savingsPct = formatSavings(mrp, cheapest);

  const lines = [
    `💊 *${drug.name}*`,
    `🧪 ${drug.composition || "N/A"}`,
    `🏭 ${drug.manufacturer || "Unknown manufacturer"}`,
    "",
  ];

  // Pharmacy prices
  if (drug.prices.length > 0) {
    lines.push("*Pharmacy Prices:*");
    drug.prices.forEach(p => {
      const stock = p.inStock ? "✅" : "❌";
      lines.push(`${stock} ${p.source}: *${formatINR(p.sellingPrice)}*${p.mrp > p.sellingPrice ? ` (MRP ${formatINR(p.mrp)})` : ""}`);
    });
  }

  // Cheaper alternative from same composition
  if (drug.compositionGroup && drug.compositionGroup.lowestPrice && drug.compositionGroup.lowestPrice < cheapest) {
    const groupSavings = formatSavings(cheapest, drug.compositionGroup.lowestPrice);
    lines.push("");
    lines.push(`⚡ *Cheaper alternative exists!*`);
    lines.push(`Same salt (${drug.compositionGroup.displayName}) from ${formatINR(drug.compositionGroup.lowestPrice)}`);
    lines.push(`${drug.compositionGroup.drugCount} brands available — save ${groupSavings}!`);
  }

  if (savingsPct) {
    lines.push(`\n💰 *Save ${savingsPct} off MRP*`);
  }

  lines.push(`\n🔗 costmini.in/medicines/${drug.slug}`);

  await sendTextMessage(config, from, lines.join("\n"));

  // Action buttons
  const buttons: Array<{ id: string; title: string }> = [];
  if (drug.compositionGroup && drug.compositionGroup.drugCount > 1) {
    buttons.push({ id: `comp_${drug.compositionGroup.displayName}`, title: "See All Brands" });
  }
  buttons.push({ id: "action_scan", title: "Scan Prescription" });
  buttons.push({ id: `share_${drug.slug}`, title: "Share Savings" });

  await sendButtonMessage(config, from, "Quick actions:", buttons);

  return true;
}

// ─── JAN AUSHADHI SEARCH ────────────────────────────────────────────────────

async function handleJanAushadhiSearch(config: WhatsAppConfig, from: string, salt: string) {
  // Find composition group, then look for Jan Aushadhi / government generic drugs
  const drugs = await prisma.drug.findMany({
    where: {
      AND: [
        { composition: { contains: salt } },
        {
          OR: [
            { manufacturer: { contains: "Jan Aushadhi" } },
            { manufacturer: { contains: "PMBJP" } },
            { manufacturer: { contains: "Generic" } },
            { isGeneric: true },
          ],
        },
      ],
    },
    include: { prices: { orderBy: { sellingPrice: "asc" }, take: 1 } },
    take: 5,
    orderBy: { name: "asc" },
  });

  if (drugs.length === 0) {
    // No Jan Aushadhi match — show cheapest generics instead
    const generics = await prisma.drug.findMany({
      where: { composition: { contains: salt }, isGeneric: true },
      include: { prices: { orderBy: { sellingPrice: "asc" }, take: 1 } },
      take: 5,
      orderBy: { name: "asc" },
    });

    if (generics.length === 0) {
      await sendTextMessage(config, from,
        `No Jan Aushadhi or generic found for "${salt}".\n\nTry searching: ${salt}`
      );
      return;
    }

    const lines = [
      `🏛️ *Jan Aushadhi not found for "${salt}"*`,
      `But here are the cheapest generics:\n`,
    ];
    generics.forEach((d, i) => {
      const price = d.prices[0]?.sellingPrice || 0;
      lines.push(`${i + 1}. *${d.name}*`);
      lines.push(`   ${formatINR(price)} · ${d.manufacturer}`);
    });
    lines.push("\n💡 Visit your nearest Jan Aushadhi Kendra for more options.");
    await sendTextMessage(config, from, lines.join("\n"));
    return;
  }

  const lines = [
    `🏛️ *Jan Aushadhi / Government Generics for "${salt}"*\n`,
  ];
  drugs.forEach((d, i) => {
    const price = d.prices[0]?.sellingPrice || 0;
    lines.push(`${i + 1}. *${d.name}*`);
    lines.push(`   ${formatINR(price)} · ${d.manufacturer}`);
  });
  lines.push("\n💡 Jan Aushadhi Kendras are available in most towns.");
  lines.push("Find nearest: janaushadhi.gov.in");

  await sendTextMessage(config, from, lines.join("\n"));
}

// ─── INTERACTIVE MESSAGE HANDLER ────────────────────────────────────────────

async function handleInteractiveMessage(config: WhatsAppConfig, from: string, replyId: string) {
  const session = getSession(from);

  if (replyId === "action_search") {
    await sendTextMessage(config, from,
      "Type any medicine name or salt composition:\n\nExamples:\n• Dolo 650\n• Paracetamol\n• Azithromycin 500mg"
    );
    return;
  }

  if (replyId === "action_scan") {
    await sendTextMessage(config, from,
      "📸 Send me a clear photo of your prescription.\n\nTips:\n• Good lighting\n• All medicine names visible\n• Flat surface, no blur"
    );
    return;
  }

  if (replyId === "action_help") {
    await sendTextMessage(config, from, getHelpMessage());
    return;
  }

  // "See All Brands" for a composition
  if (replyId.startsWith("comp_") || replyId.startsWith("all_")) {
    const query = replyId.replace("comp_", "").replace("all_", "");
    await searchByComposition(config, from, query, session);
    return;
  }

  // "Buy Cheapest" link
  if (replyId.startsWith("buy_")) {
    const slug = replyId.replace("buy_", "");
    await sendTextMessage(config, from,
      `🛒 Buy online:\n\n` +
      `1mg: https://www.1mg.com/search/all?name=${encodeURIComponent(slug)}\n` +
      `PharmEasy: https://pharmeasy.in/search/all?name=${encodeURIComponent(slug)}\n` +
      `Netmeds: https://www.netmeds.com/catalogsearch/result/${encodeURIComponent(slug)}/all\n\n` +
      `🔗 Full details: costmini.in/medicines/${slug}`
    );
    return;
  }

  // Share savings
  if (replyId.startsWith("share_")) {
    await sendTextMessage(config, from,
      getShareText(session.lastDrug || "Medicine", 100, 20, 80)
    );
    return;
  }

  if (replyId === "scan_another") {
    await sendTextMessage(config, from, "📸 Send me another prescription photo!");
    return;
  }

  // Unknown action
  await sendTextMessage(config, from, "Type a medicine name to search, or send a prescription photo 📸");
}

// ─── IMAGE/PRESCRIPTION HANDLER ─────────────────────────────────────────────

async function handleImageMessage(config: WhatsAppConfig, from: string, imageId: string) {
  const session = getSession(from);

  await sendTextMessage(config, from, "📸 Analyzing your prescription... This takes a few seconds ⏳");

  if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
    await sendTextMessage(config, from,
      "AI scan is not available right now.\n\nPlease type the medicine names instead.\nExample: \"Dolo 650\""
    );
    return;
  }

  try {
    const imageBuffer = await downloadMedia(config, imageId);
    if (!imageBuffer) {
      await sendTextMessage(config, from, "Could not download the image. Please try again.");
      return;
    }

    const base64 = imageBuffer.toString("base64");
    const extractedText = await analyzePrescriptionImage(base64, "image/jpeg");

    interface ExtractedMed { name: string; genericName?: string; dosage?: string }
    let extracted: ExtractedMed[] = [];
    try {
      const jsonMatch = extractedText.match(/\[[\s\S]*\]/);
      if (jsonMatch) extracted = JSON.parse(jsonMatch[0]);
    } catch { /* ignore */ }

    if (extracted.length === 0) {
      await sendButtonMessage(config, from,
        "Could not identify medicines from this image.\n\n" +
        "Tips:\n• Use a clear, well-lit photo\n• All medicine names should be readable\n• Flat surface, no blur",
        [
          { id: "action_scan", title: "Try Again" },
          { id: "action_search", title: "Type Medicine" },
        ],
        "Scan Failed"
      );
      return;
    }

    // Look up each medicine
    interface ScanResult {
      name: string; composition: string; brandPrice: number;
      cheapestPrice: number; cheapestName: string; savingsPercent: number;
      pharmacyCount: number;
    }
    const results: ScanResult[] = [];
    const seen = new Set<string>();

    for (const med of extracted.slice(0, 10)) {
      const nameLower = (med.name || "").toLowerCase().slice(0, 200);
      if (!nameLower || nameLower.length < 2 || seen.has(nameLower)) continue;
      seen.add(nameLower);

      const matched = await prisma.drug.findFirst({
        where: {
          OR: [
            { name: { contains: nameLower } },
            ...(med.genericName ? [{ genericName: { contains: med.genericName.toLowerCase().slice(0, 200) } }] : []),
            { composition: { contains: nameLower } },
          ],
        },
        include: {
          prices: { orderBy: { sellingPrice: "asc" }, take: 1 },
          compositionGroup: { select: { lowestPrice: true, displayName: true, drugCount: true } },
        },
      });

      if (matched && matched.prices.length > 0) {
        const brandPrice = matched.prices[0].mrp || matched.prices[0].sellingPrice;
        const cheapestInGroup = matched.compositionGroup?.lowestPrice || matched.prices[0].sellingPrice;
        const savings = brandPrice > 0 ? Math.round(((brandPrice - cheapestInGroup) / brandPrice) * 100) : 0;

        results.push({
          name: med.name,
          composition: matched.composition || "",
          brandPrice,
          cheapestPrice: cheapestInGroup,
          cheapestName: matched.compositionGroup?.displayName || matched.name,
          savingsPercent: savings,
          pharmacyCount: matched.compositionGroup?.drugCount || 1,
        });
      }
    }

    if (results.length === 0) {
      await sendTextMessage(config, from,
        `Found ${extracted.length} medicine(s) but none matched our database.\n\n` +
        `Medicines identified:\n${extracted.map(m => `• ${m.name}`).join("\n")}\n\n` +
        "Try typing each medicine name for manual search."
      );
      return;
    }

    // Build prescription analysis response
    const totalBrand = results.reduce((s, r) => s + r.brandPrice, 0);
    const totalCheapest = results.reduce((s, r) => s + r.cheapestPrice, 0);
    const totalSaved = totalBrand - totalCheapest;
    const totalSavingsPct = totalBrand > 0 ? Math.round((totalSaved / totalBrand) * 100) : 0;

    const lines = [
      "📋 *Prescription Analysis*",
      `Found *${results.length}* medicine(s):\n`,
    ];

    for (const r of results) {
      lines.push(`💊 *${r.name}*`);
      lines.push(`   🧪 ${r.composition}`);
      lines.push(`   MRP: ${formatINR(r.brandPrice)} → Cheapest: *${formatINR(r.cheapestPrice)}*`);
      if (r.savingsPercent > 5) {
        lines.push(`   💰 Save *${r.savingsPercent}%* · ${r.pharmacyCount} brands available`);
      }
      lines.push("");
    }

    if (totalSaved > 0) {
      lines.push("━━━━━━━━━━━━━━━");
      lines.push(`*💰 Total Savings: ${formatINR(totalSaved)} (${totalSavingsPct}% less)*`);
      lines.push("");
    }

    lines.push("_Same salt composition = identical medicine_");
    lines.push("_Ask your doctor about switching to generics!_");
    lines.push("\n🔗 Full details: costmini.in/scan");

    session.lastAction = "scan";

    await sendTextMessage(config, from, lines.join("\n"));

    // Follow-up actions
    await sendButtonMessage(config, from,
      "What would you like to do?",
      [
        { id: "action_search", title: "Search More" },
        { id: "share_savings", title: "Share Savings" },
        { id: "action_scan", title: "Scan Another" },
      ]
    );

  } catch {
    await sendButtonMessage(config, from,
      "Something went wrong analyzing your prescription.",
      [
        { id: "action_scan", title: "Try Again" },
        { id: "action_search", title: "Type Medicine" },
      ],
      "Error"
    );
  }
}
