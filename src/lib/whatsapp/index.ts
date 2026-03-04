export {
  sendTextMessage,
  sendTemplateMessage,
  sendAlternativesMessage,
  downloadMedia,
  parseWebhookMessages,
  getWelcomeMessage,
  getScanSummaryMessage,
} from "./bot";

export type {
  WhatsAppConfig,
  WhatsAppMessage,
  WhatsAppWebhookPayload,
} from "./bot";
