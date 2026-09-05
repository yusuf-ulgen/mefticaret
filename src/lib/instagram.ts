/**
 * Instagram DM & Social Inbox modülü — izomorfik sabitler ve saf yardımcılar.
 * Bu dosya hem tarayıcıda hem sunucuda güvenle kullanılabilir (sır içermez).
 */

export const INSTAGRAM_GRAPH_VERSION = "v21.0";

/** Meta uygulama incelemesinde talep edilen izinler. */
export const INSTAGRAM_SCOPES = [
  "instagram_basic",
  "instagram_manage_messages",
  "instagram_manage_comments",
  "pages_show_list",
  "pages_manage_metadata",
  "pages_read_engagement",
  "business_management",
] as const;

export const IG_MATCH_TYPES = ["contains", "exact", "starts_with", "any"] as const;
export type IgMatchType = (typeof IG_MATCH_TYPES)[number];

export const IG_MATCH_TYPE_LABELS: Record<IgMatchType, string> = {
  contains: "Kelime geçiyorsa",
  exact: "Yorum tam eşleşiyorsa",
  starts_with: "Yorum kelimeyle başlıyorsa",
  any: "Tüm yorumlarda çalış",
};

export const IG_EVENT_TYPES = ["message", "story_reply", "comment", "mention"] as const;
export type IgEventType = (typeof IG_EVENT_TYPES)[number];

export const IG_EVENT_TYPE_LABELS: Record<IgEventType, string> = {
  message: "Direkt mesaj",
  story_reply: "Hikâye yanıtı",
  comment: "Gönderi yorumu",
  mention: "Etiketleme",
};

export const IG_KEYWORD_PRESETS = [
  "fiyat",
  "kaç para",
  "link",
  "beden",
  "stok",
  "var mı",
  "kargo",
  "indirim",
] as const;

/** Yorum metnini kural anahtar kelimeleriyle karşılaştırır; eşleşen kelimeyi döner. */
export function matchKeyword(
  text: string,
  keywords: readonly string[],
  matchType: IgMatchType,
): string | null {
  const normalized = normalizeText(text);
  if (matchType === "any") return "*";
  for (const keyword of keywords) {
    const needle = normalizeText(keyword);
    if (!needle) continue;
    if (matchType === "exact" && normalized === needle) return keyword;
    if (matchType === "starts_with" && normalized.startsWith(needle)) return keyword;
    if (matchType === "contains" && normalized.includes(needle)) return keyword;
  }
  return null;
}

/** Türkçe karakterleri ve noktalama işaretlerini sadeleştirir. */
export function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/[İIıi]/g, "i")
    .replace(/[şs]/g, "s")
    .replace(/[ğg]/g, "g")
    .replace(/[üu]/g, "u")
    .replace(/[öo]/g, "o")
    .replace(/[çc]/g, "c")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** {{name}} gibi yer tutucuları doldurur. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => vars[key] ?? "");
}

export const IG_INTENTS = [
  "shipping",
  "return",
  "size",
  "stock",
  "price",
  "recommendation",
  "other",
] as const;
export type IgIntent = (typeof IG_INTENTS)[number];

export const IG_INTENT_LABELS: Record<IgIntent, string> = {
  shipping: "Kargo takibi",
  return: "İade / değişim",
  size: "Beden & ölçü",
  stock: "Stok durumu",
  price: "Fiyat & indirim",
  recommendation: "Ürün önerisi",
  other: "Diğer",
};

const INTENT_KEYWORDS: Record<Exclude<IgIntent, "other">, string[]> = {
  shipping: ["kargo", "nerede", "teslim", "takip", "gonderim", "ne zaman gelir"],
  return: ["iade", "degisim", "geri", "iptal", "kusurlu"],
  size: ["beden", "olcu", "kalip", "numara", "boy", "tablo"],
  stock: ["stok", "var mi", "gelecek mi", "tukendi", "mevcut"],
  price: ["fiyat", "kac para", "indirim", "kampanya", "ucret", "kac tl"],
  recommendation: ["oneri", "onerir", "hangisi", "tavsiye", "uygun olur"],
};

/** Basit ama deterministik niyet sınıflandırma; AI yanıtına bağlam verir. */
export function classifyIntent(text: string): { intent: IgIntent; confidence: number } {
  const normalized = normalizeText(text);
  let best: { intent: IgIntent; hits: number } = { intent: "other", hits: 0 };
  for (const [intent, words] of Object.entries(INTENT_KEYWORDS)) {
    const hits = words.filter((word) => normalized.includes(normalizeText(word))).length;
    if (hits > best.hits) best = { intent: intent as IgIntent, hits };
  }
  if (best.hits === 0) return { intent: "other", confidence: 0.3 };
  return { intent: best.intent, confidence: Math.min(0.95, 0.55 + best.hits * 0.2) };
}

export type IgCustomerSegment = "vip" | "loyal" | "new" | "at_risk" | "guest";

export const IG_SEGMENT_LABELS: Record<IgCustomerSegment, string> = {
  vip: "VIP",
  loyal: "Sadık",
  new: "Yeni Müşteri",
  at_risk: "Pasifleşiyor",
  guest: "Kayıtsız Ziyaretçi",
};

/** LTV ve sipariş geçmişinden segment türetir. */
export function deriveSegment(input: {
  ordersCount: number;
  totalSpent: number;
  lastActivityAt: string | null;
}): IgCustomerSegment {
  if (input.ordersCount === 0) return "guest";
  const idleDays = input.lastActivityAt
    ? (Date.now() - new Date(input.lastActivityAt).getTime()) / 86_400_000
    : 999;
  if (input.totalSpent >= 10_000 || input.ordersCount >= 10) return "vip";
  if (idleDays > 120) return "at_risk";
  if (input.ordersCount >= 3) return "loyal";
  return "new";
}
