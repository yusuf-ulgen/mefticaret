/** Omni-Channel Mesaj Merkezi — sabitler, etiketler ve ortak yardımcılar (izomorfik). */

export const OMNI_CHANNELS = [
  "instagram",
  "tiktok",
  "messenger",
  "telegram",
  "live_chat",
  "email",
  "marketplace",
  "whatsapp",
] as const;

export type OmniChannel = (typeof OMNI_CHANNELS)[number];

export const OMNI_CHANNEL_LABELS: Record<OmniChannel, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  messenger: "Messenger",
  telegram: "Telegram",
  live_chat: "Canlı Destek",
  email: "E-posta",
  marketplace: "Pazaryeri",
  whatsapp: "WhatsApp",
};

/** lucide-react ikon adları — bileşende dinamik map ile eşlenir. */
export const OMNI_CHANNEL_ICONS: Record<OmniChannel, string> = {
  instagram: "Instagram",
  tiktok: "Music2",
  messenger: "MessageCircle",
  telegram: "Send",
  live_chat: "Headset",
  email: "Mail",
  marketplace: "Store",
  whatsapp: "MessageSquare",
};

export const OMNI_CONVERSATION_STATUSES = ["open", "pending", "resolved", "closed"] as const;
export type OmniConversationStatus = (typeof OMNI_CONVERSATION_STATUSES)[number];

export const OMNI_STATUS_LABELS: Record<OmniConversationStatus, string> = {
  open: "Açık",
  pending: "Beklemede",
  resolved: "Çözüldü",
  closed: "Kapalı",
};

export const OMNI_ACCOUNT_STATUSES = ["disconnected", "connected", "error"] as const;
export type OmniAccountStatus = (typeof OMNI_ACCOUNT_STATUSES)[number];

export const OMNI_ACCOUNT_STATUS_LABELS: Record<OmniAccountStatus, string> = {
  disconnected: "Bağlı değil",
  connected: "Bağlı",
  error: "Hata",
};

export const OMNI_TAG_PRESETS = [
  "Yeni Müşteri",
  "VIP",
  "Toptancı",
  "Sorunlu",
  "İade",
  "Tekrar Alışveriş",
] as const;

export const OMNI_AUTO_REPLY_KINDS = ["greeting", "off_hours", "order_status"] as const;
export type OmniAutoReplyKind = (typeof OMNI_AUTO_REPLY_KINDS)[number];

export const OMNI_AUTO_REPLY_KIND_LABELS: Record<OmniAutoReplyKind, string> = {
  greeting: "Karşılama mesajı",
  off_hours: "Mesai dışı",
  order_status: "Sipariş durumu sorgusu",
};

export const OMNI_MESSAGE_STATUSES = ["queued", "sent", "delivered", "read", "failed"] as const;

export function isOmniChannel(value: string): value is OmniChannel {
  return (OMNI_CHANNELS as readonly string[]).includes(value);
}

export function channelLabel(channel: string): string {
  return isOmniChannel(channel) ? OMNI_CHANNEL_LABELS[channel] : channel;
}

export function statusLabel(status: string): string {
  return (OMNI_STATUS_LABELS as Record<string, string>)[status] ?? status;
}
