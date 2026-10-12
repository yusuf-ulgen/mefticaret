/**
 * TikTok DM & Social Inbox modülü — izomorfik sabitler ve saf yardımcılar.
 * Hem tarayıcıda hem sunucuda güvenle kullanılabilir (sır içermez).
 */

export const TIKTOK_API_VERSION = "v2";

/** TikTok for Developers (Business Account) başvurusunda istenen izinler. */
export const TIKTOK_SCOPES = [
  "user.info.basic",
  "user.info.profile",
  "video.list",
  "comment.list",
  "comment.list.manage",
  "biz.creator.info",
  "biz.creator.insights",
] as const;

export const TT_MATCH_TYPES = ["contains", "exact", "starts_with", "any"] as const;
export type TtMatchType = (typeof TT_MATCH_TYPES)[number];

export const TT_MATCH_TYPE_LABELS: Record<TtMatchType, string> = {
  contains: "Kelime geçiyorsa",
  exact: "Yorum tam eşleşiyorsa",
  starts_with: "Yorum kelimeyle başlıyorsa",
  any: "Tüm yorumlarda çalış",
};

/** Kuralın hangi kaynakta çalışacağı. */
export const TT_RULE_SOURCES = ["all", "video", "live"] as const;
export type TtRuleSource = (typeof TT_RULE_SOURCES)[number];

export const TT_RULE_SOURCE_LABELS: Record<TtRuleSource, string> = {
  all: "Video + canlı yayın",
  video: "Yalnızca video yorumları",
  live: "Yalnızca canlı yayın",
};

export const TT_EVENT_TYPES = ["message", "comment", "live_comment", "live_gift", "mention"] as const;
export type TtEventType = (typeof TT_EVENT_TYPES)[number];

export const TT_EVENT_TYPE_LABELS: Record<TtEventType, string> = {
  message: "Direkt mesaj",
  comment: "Video yorumu",
  live_comment: "Canlı yayın yorumu",
  live_gift: "Canlı yayın hediyesi",
  mention: "Etiketleme",
};

export const TT_KEYWORD_PRESETS = [
  "fiyat",
  "kaç para",
  "link",
  "beden",
  "stok",
  "var mı",
  "kargo",
  "indirim",
  "sepet",
] as const;

/** Türkçe karakterleri ve noktalama işaretlerini sadeleştirir. */
export function normalizeTtText(value: string): string {
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

/** Yorum metnini kural anahtar kelimeleriyle karşılaştırır; eşleşen kelimeyi döner. */
export function matchTtKeyword(
  text: string,
  keywords: readonly string[],
  matchType: TtMatchType,
): string | null {
  const normalized = normalizeTtText(text);
  if (matchType === "any") return "*";
  for (const keyword of keywords) {
    const needle = normalizeTtText(keyword);
    if (!needle) continue;
    if (matchType === "exact" && normalized === needle) return keyword;
    if (matchType === "starts_with" && normalized.startsWith(needle)) return keyword;
    if (matchType === "contains" && normalized.includes(needle)) return keyword;
  }
  return null;
}

/** {{name}} gibi yer tutucuları doldurur. */
export function renderTtTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => vars[key] ?? "");
}

export const TT_INTENTS = [
  "shipping",
  "return",
  "size",
  "stock",
  "price",
  "recommendation",
  "other",
] as const;
export type TtIntent = (typeof TT_INTENTS)[number];

export const TT_INTENT_LABELS: Record<TtIntent, string> = {
  shipping: "Kargo takibi",
  return: "İade / değişim",
  size: "Beden & ölçü",
  stock: "Stok durumu",
  price: "Fiyat & indirim",
  recommendation: "Ürün önerisi",
  other: "Diğer",
};

const TT_INTENT_KEYWORDS: Record<Exclude<TtIntent, "other">, string[]> = {
  shipping: ["kargo", "nerede", "teslim", "takip", "gonderim", "ne zaman gelir"],
  return: ["iade", "degisim", "geri", "iptal", "kusurlu"],
  size: ["beden", "olcu", "kalip", "numara", "boy", "tablo"],
  stock: ["stok", "var mi", "gelecek mi", "tukendi", "mevcut"],
  price: ["fiyat", "kac para", "indirim", "kampanya", "ucret", "kac tl"],
  recommendation: ["oneri", "onerir", "hangisi", "tavsiye", "uygun olur"],
};

/** Deterministik niyet sınıflandırma; AI yanıtına bağlam verir. */
export function classifyTtIntent(text: string): { intent: TtIntent; confidence: number } {
  const normalized = normalizeTtText(text);
  let best: { intent: TtIntent; hits: number } = { intent: "other", hits: 0 };
  for (const [intent, words] of Object.entries(TT_INTENT_KEYWORDS)) {
    const hits = words.filter((word) => normalized.includes(normalizeTtText(word))).length;
    if (hits > best.hits) best = { intent: intent as TtIntent, hits };
  }
  if (best.hits === 0) return { intent: "other", confidence: 0.3 };
  return { intent: best.intent, confidence: Math.min(0.95, 0.55 + best.hits * 0.2) };
}

export type TtCustomerSegment = "vip" | "loyal" | "new" | "at_risk" | "guest";

export const TT_SEGMENT_LABELS: Record<TtCustomerSegment, string> = {
  vip: "VIP",
  loyal: "Sadık",
  new: "Yeni Müşteri",
  at_risk: "Pasifleşiyor",
  guest: "Kayıtsız Ziyaretçi",
};

/** LTV ve sipariş geçmişinden segment türetir. */
export function deriveTtSegment(input: {
  ordersCount: number;
  totalSpent: number;
  lastActivityAt: string | null;
}): TtCustomerSegment {
  if (input.ordersCount === 0) return "guest";
  const idleDays = input.lastActivityAt
    ? (Date.now() - new Date(input.lastActivityAt).getTime()) / 86_400_000
    : 999;
  if (input.totalSpent >= 10_000 || input.ordersCount >= 10) return "vip";
  if (idleDays > 120) return "at_risk";
  if (input.ordersCount >= 3) return "loyal";
  return "new";
}
