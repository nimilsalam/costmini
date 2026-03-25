/**
 * CostMini WhatsApp Bot — India's Medicine Cost AI
 *
 * August AI-style conversational health assistant focused on:
 * - Medicine price comparison across Indian pharmacies
 * - Generic alternative recommendations
 * - Prescription photo scanning with AI
 * - Jan Aushadhi (government generic) recommendations
 * - Hindi + English bilingual support
 *
 * WhatsApp Business API message types used:
 * - Text messages (with formatting)
 * - Interactive buttons (quick actions)
 * - Interactive lists (pharmacy selection, alternatives)
 * - Template messages (onboarding, reminders)
 */

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  verifyToken: string;
  webhookUrl: string;
}

export interface WhatsAppMessage {
  from: string;
  type: "text" | "image" | "document" | "interactive" | "button";
  text?: string;
  imageUrl?: string;
  imageId?: string;
  buttonPayload?: string; // interactive button reply
  listReplyId?: string;   // interactive list selection
  timestamp: number;
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { phone_number_id: string };
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          image?: { id: string; mime_type: string };
          interactive?: {
            type: string;
            button_reply?: { id: string; title: string };
            list_reply?: { id: string; title: string; description?: string };
          };
          button?: { payload: string; text: string };
        }>;
      };
    }>;
  }>;
}

// ─── SESSION MANAGEMENT ─────────────────────────────────────────────────────

interface UserSession {
  lastDrug?: string;          // last searched drug name
  lastComposition?: string;   // last composition group
  lastAction?: string;        // last action taken
  language?: "en" | "hi";     // preferred language
  messageCount: number;        // total messages exchanged
  firstSeen: number;
  lastSeen: number;
}

// In-memory sessions (use Redis in production)
const sessions = new Map<string, UserSession>();

export function getSession(phone: string): UserSession {
  let session = sessions.get(phone);
  if (!session) {
    session = {
      messageCount: 0,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
    };
    sessions.set(phone, session);
  }
  session.lastSeen = Date.now();
  session.messageCount++;
  return session;
}

// Clean old sessions (>24h)
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [phone, session] of sessions) {
    if (session.lastSeen < cutoff) sessions.delete(phone);
  }
}, 60 * 60 * 1000);

// ─── WHATSAPP API HELPERS ───────────────────────────────────────────────────

const WHATSAPP_API = "https://graph.facebook.com/v21.0";

async function sendWhatsAppMessage(config: WhatsAppConfig, to: string, body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`${WHATSAPP_API}/${config.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", to, ...body }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Send a plain text message */
export async function sendTextMessage(config: WhatsAppConfig, to: string, text: string): Promise<boolean> {
  return sendWhatsAppMessage(config, to, { type: "text", text: { body: text } });
}

/** Send an interactive button message (max 3 buttons) */
export async function sendButtonMessage(
  config: WhatsAppConfig,
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
  headerText?: string,
  footerText?: string,
): Promise<boolean> {
  return sendWhatsAppMessage(config, to, {
    type: "interactive",
    interactive: {
      type: "button",
      ...(headerText ? { header: { type: "text", text: headerText } } : {}),
      body: { text: bodyText },
      ...(footerText ? { footer: { text: footerText } } : {}),
      action: {
        buttons: buttons.slice(0, 3).map(b => ({
          type: "reply",
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    },
  });
}

/** Send an interactive list message (up to 10 items per section) */
export async function sendListMessage(
  config: WhatsAppConfig,
  to: string,
  bodyText: string,
  buttonText: string,
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>,
  headerText?: string,
  footerText?: string,
): Promise<boolean> {
  return sendWhatsAppMessage(config, to, {
    type: "interactive",
    interactive: {
      type: "list",
      ...(headerText ? { header: { type: "text", text: headerText } } : {}),
      body: { text: bodyText },
      ...(footerText ? { footer: { text: footerText } } : {}),
      action: {
        button: buttonText.slice(0, 20),
        sections: sections.map(s => ({
          title: s.title.slice(0, 24),
          rows: s.rows.slice(0, 10).map(r => ({
            id: r.id.slice(0, 200),
            title: r.title.slice(0, 24),
            description: r.description?.slice(0, 72),
          })),
        })),
      },
    },
  });
}

/** Send a template message (for onboarding / re-engagement) */
export async function sendTemplateMessage(
  config: WhatsAppConfig,
  to: string,
  templateName: string,
  languageCode: string = "en",
): Promise<boolean> {
  return sendWhatsAppMessage(config, to, {
    type: "template",
    template: { name: templateName, language: { code: languageCode } },
  });
}

/** Mark message as read (shows blue ticks) */
export async function markAsRead(config: WhatsAppConfig, messageId: string): Promise<void> {
  try {
    await fetch(`${WHATSAPP_API}/${config.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    });
  } catch { /* ignore */ }
}

/** Download media (image/document) from WhatsApp */
export async function downloadMedia(config: WhatsAppConfig, mediaId: string): Promise<Buffer | null> {
  try {
    const urlRes = await fetch(`${WHATSAPP_API}/${mediaId}`, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
    });
    if (!urlRes.ok) return null;
    const { url } = (await urlRes.json()) as { url: string };

    const fileRes = await fetch(url, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
    });
    if (!fileRes.ok) return null;

    const arrayBuffer = await fileRes.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

// ─── MESSAGE PARSER ─────────────────────────────────────────────────────────

export function parseWebhookMessages(payload: WhatsAppWebhookPayload): (WhatsAppMessage & { messageId?: string })[] {
  const messages: (WhatsAppMessage & { messageId?: string })[] = [];

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      for (const msg of change.value.messages || []) {
        messages.push({
          from: msg.from,
          type: msg.type as WhatsAppMessage["type"],
          text: msg.text?.body,
          imageId: msg.image?.id,
          buttonPayload: msg.interactive?.button_reply?.id || msg.button?.payload,
          listReplyId: msg.interactive?.list_reply?.id,
          timestamp: parseInt(msg.timestamp) * 1000,
          messageId: msg.id,
        });
      }
    }
  }

  return messages;
}

// ─── INDIA-SPECIFIC MESSAGE TEMPLATES ───────────────────────────────────────

export function getWelcomeMessage(language: "en" | "hi" = "en"): string {
  if (language === "hi") {
    return [
      "🏥 *CostMini में आपका स्वागत है!*",
      "",
      "मैं आपको सस्ती दवाइयाँ ढूंढने में मदद करता हूँ।",
      "",
      "📸 *अपने प्रिस्क्रिप्शन की फोटो भेजें* और तुरंत जानें:",
      "• सस्ते जेनेरिक विकल्प",
      "• सभी फार्मेसी की कीमतें",
      "• कितनी बचत हो सकती है",
      "",
      "या दवाई का नाम टाइप करें (जैसे \"Dolo 650\")",
      "",
      "💰 _वही दवाई, 80% तक सस्ती!_",
      "",
      "Type 'english' for English",
    ].join("\n");
  }

  return [
    "🏥 *Welcome to CostMini!*",
    "_India's Medicine Cost AI_",
    "",
    "I help you find *identical medicines at the lowest price* across Indian pharmacies.",
    "",
    "Here's what I can do:",
    "",
    "📸 *Send a prescription photo* → I'll find cheaper alternatives for every medicine",
    "",
    "💊 *Type a medicine name* → I'll show all brands & prices",
    "  Example: \"Dolo 650\" or \"Paracetamol\"",
    "",
    "🧪 *Type a salt/composition* → I'll show every brand with that formula",
    "  Example: \"Azithromycin 500mg\"",
    "",
    "💰 *Your savings can be 50-90%* by switching to generics!",
    "  Same salt, same quality, WHO-GMP certified.",
    "",
    "━━━━━━━━━━━━━━━",
    "Type *hi* to get started | Type *hindi* for हिंदी",
    "🔗 costmini.in",
  ].join("\n");
}

export function getHelpMessage(): string {
  return [
    "📖 *CostMini — Quick Guide*",
    "",
    "1️⃣ *Search by name*",
    "   → Type: Dolo 650, Crocin, Pan 40",
    "",
    "2️⃣ *Search by salt*",
    "   → Type: Paracetamol, Azithromycin",
    "",
    "3️⃣ *Scan prescription*",
    "   → Send a clear photo of your prescription",
    "",
    "4️⃣ *Compare brands*",
    "   → Type: compare Paracetamol 500mg",
    "",
    "5️⃣ *Jan Aushadhi*",
    "   → Type: janaushadhi Paracetamol",
    "   (Government generic medicines at ₹1-₹10)",
    "",
    "6️⃣ *Quick commands*",
    "   → cheapest, alternatives, nearby",
    "",
    "💡 *Tip:* Always search by salt name for best results!",
  ].join("\n");
}

// Format price in Indian style
export function formatINR(amount: number): string {
  if (!amount || amount <= 0) return "N/A";
  return "₹" + amount.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

// Format savings percentage
export function formatSavings(expensive: number, cheap: number): string {
  if (expensive <= 0 || cheap <= 0 || cheap >= expensive) return "";
  const pct = Math.round(((expensive - cheap) / expensive) * 100);
  return pct > 0 ? `${pct}%` : "";
}

// Generate shareable comparison text for WhatsApp forward
export function getShareText(drugName: string, brandPrice: number, genericPrice: number, savedPct: number): string {
  return [
    `🔥 I saved ${savedPct}% on my medicine using CostMini!`,
    "",
    `💊 ${drugName}`,
    `Brand: ${formatINR(brandPrice)} → Generic: ${formatINR(genericPrice)}`,
    "",
    `Same composition, WHO-certified quality.`,
    "",
    `Try it free on WhatsApp: wa.me/91XXXXXXXXXX`,
    `Or visit: costmini.in`,
  ].join("\n");
}

// ─── RE-EXPORTS ─────────────────────────────────────────────────────────────

export { sendAlternativesMessage };

async function sendAlternativesMessage(
  config: WhatsAppConfig,
  to: string,
  drugName: string,
  brandPrice: number,
  genericName: string,
  genericPrice: number,
  savingsPercent: number,
): Promise<boolean> {
  const body = [
    `💊 *${drugName}*`,
    `Brand Price: ${formatINR(brandPrice)}`,
    ``,
    `✅ *Generic Alternative: ${genericName}*`,
    `Generic Price: ${formatINR(genericPrice)}`,
    `💰 *You Save: ${savingsPercent}%*`,
    ``,
    `Same composition, WHO-GMP certified.`,
  ].join("\n");

  return sendButtonMessage(config, to, body, [
    { id: "view_all_prices", title: "View All Prices" },
    { id: "share_savings", title: "Share Savings" },
    { id: "scan_another", title: "Scan Another" },
  ]);
}
