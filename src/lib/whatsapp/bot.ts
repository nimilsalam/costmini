/**
 * WhatsApp Business API Integration Module
 *
 * This module handles:
 * 1. Receiving prescription images via WhatsApp
 * 2. Processing them with OCR
 * 3. Finding cheaper alternatives
 * 4. Sending results back to the user
 *
 * Setup:
 * - Register on Meta Business Suite (business.facebook.com)
 * - Create a WhatsApp Business App
 * - Get your Phone Number ID and Access Token
 * - Set the webhook URL to: https://yourdomain.com/api/whatsapp/webhook
 *
 * Providers: You can also use AiSensy, MSG91, or Infobip as BSPs
 * for easier integration in India.
 */

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  verifyToken: string;
  webhookUrl: string;
}

export interface WhatsAppMessage {
  from: string; // sender phone number
  type: "text" | "image" | "document";
  text?: string;
  imageUrl?: string;
  imageId?: string;
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
        }>;
      };
    }>;
  }>;
}

const WHATSAPP_API = "https://graph.facebook.com/v18.0";

/**
 * Send a text message via WhatsApp Business API
 */
export async function sendTextMessage(
  config: WhatsAppConfig,
  to: string,
  text: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `${WHATSAPP_API}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text },
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Send a template message (for initiating conversations)
 */
export async function sendTemplateMessage(
  config: WhatsAppConfig,
  to: string,
  templateName: string,
  languageCode: string = "en"
): Promise<boolean> {
  try {
    const res = await fetch(
      `${WHATSAPP_API}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: templateName,
            language: { code: languageCode },
          },
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Download media (image) from WhatsApp to process with OCR
 */
export async function downloadMedia(
  config: WhatsAppConfig,
  mediaId: string
): Promise<Buffer | null> {
  try {
    // Step 1: Get the media URL
    const urlRes = await fetch(`${WHATSAPP_API}/${mediaId}`, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
    });
    if (!urlRes.ok) return null;
    const { url } = (await urlRes.json()) as { url: string };

    // Step 2: Download the actual file
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

/**
 * Send interactive button message for medicine alternatives
 */
export async function sendAlternativesMessage(
  config: WhatsAppConfig,
  to: string,
  drugName: string,
  brandPrice: number,
  genericName: string,
  genericPrice: number,
  savingsPercent: number
): Promise<boolean> {
  const body = [
    `💊 *${drugName}*`,
    `Brand Price: ₹${brandPrice}`,
    ``,
    `✅ *Generic Alternative: ${genericName}*`,
    `Generic Price: ₹${genericPrice}`,
    `💰 *You Save: ${savingsPercent}%*`,
    ``,
    `Same composition, WHO-GMP certified.`,
  ].join("\n");

  try {
    const res = await fetch(
      `${WHATSAPP_API}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "interactive",
          interactive: {
            type: "button",
            body: { text: body },
            action: {
              buttons: [
                {
                  type: "reply",
                  reply: { id: "view_more", title: "View All Prices" },
                },
                {
                  type: "reply",
                  reply: { id: "scan_another", title: "Scan Another" },
                },
              ],
            },
          },
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Parse incoming webhook payload into structured messages
 */
export function parseWebhookMessages(
  payload: WhatsAppWebhookPayload
): WhatsAppMessage[] {
  const messages: WhatsAppMessage[] = [];

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      for (const msg of change.value.messages || []) {
        messages.push({
          from: msg.from,
          type: msg.type as WhatsAppMessage["type"],
          text: msg.text?.body,
          imageId: msg.image?.id,
          timestamp: parseInt(msg.timestamp) * 1000,
        });
      }
    }
  }

  return messages;
}

/**
 * Generate the welcome message for new users
 */
export function getWelcomeMessage(): string {
  return [
    "🏥 *Welcome to CostMini!*",
    "",
    "I help you find cheaper medicine alternatives.",
    "",
    "📸 *Send me a photo of your prescription* and I'll instantly show you:",
    "• Cheaper generic alternatives",
    "• Price comparison across pharmacies",
    "• How much you can save",
    "",
    "Or type a medicine name to search (e.g. \"Dolo 650\")",
    "",
    "💡 _Same quality medicines, up to 80% cheaper!_",
  ].join("\n");
}

/**
 * Generate a summary message for scan results
 */
export function getScanSummaryMessage(
  results: Array<{
    drugName: string;
    brandPrice: number;
    genericPrice: number;
    savingsPercent: number;
  }>
): string {
  if (results.length === 0) {
    return "❌ Could not identify medicines from this image. Please try a clearer photo or type the medicine name.";
  }

  const totalBrand = results.reduce((s, r) => s + r.brandPrice, 0);
  const totalGeneric = results.reduce((s, r) => s + r.genericPrice, 0);
  const totalSaved = totalBrand - totalGeneric;

  const lines = [
    "📋 *Prescription Scan Results*",
    "",
    ...results.map(
      (r) =>
        `• *${r.drugName}*: ₹${r.brandPrice} → ₹${r.genericPrice} (Save ${r.savingsPercent}%)`
    ),
    "",
    `💰 *Total Savings: ₹${totalSaved}* (${Math.round((totalSaved / totalBrand) * 100)}% less)`,
    "",
    "All alternatives are WHO-GMP certified. Ask your doctor about switching to generics!",
    "",
    "🔗 View full details: costmini.in/scan",
  ];

  return lines.join("\n");
}
