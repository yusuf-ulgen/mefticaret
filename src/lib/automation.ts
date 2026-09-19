/**
 * Pazarlama otomasyonu için paylaşılan sabitler ve etiketler.
 * Sunucu motoru ve yönetim arayüzü aynı sözlüğü kullanır.
 */

export const AUTOMATION_TRIGGERS = [
  "cart_abandoned",
  "order_placed",
  "order_paid",
  "order_shipped",
  "order_delivered",
  "customer_created",
  "back_in_stock",
  "review_received",
  "manual",
  "browse_abandoned",
  "customer_inactive",
  "ltv_threshold",
  "newsletter_subscribed",
] as const;

export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

export const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  cart_abandoned: "Sepet terk edildi",
  order_placed: "Sipariş verildi",
  order_paid: "Ödeme alındı",
  order_shipped: "Kargoya verildi",
  order_delivered: "Teslim edildi",
  customer_created: "Yeni müşteri",
  back_in_stock: "Ürün stoğa girdi",
  review_received: "Yorum geldi",
  manual: "Manuel başlatma",
  browse_abandoned: "Ürünü inceledi, almadı",
  customer_inactive: "Uzun süre sipariş yok",
  ltv_threshold: "Harcama eşiği aşıldı",
  newsletter_subscribed: "E-bültene abone oldu",
};

export const STEP_KINDS = [
  "wait",
  "email",
  "sms",
  "whatsapp",
  "push",
  "condition",
  "end",
] as const;

export type StepKind = (typeof STEP_KINDS)[number];

export const STEP_LABELS: Record<StepKind, string> = {
  wait: "Bekle",
  email: "E-posta gönder",
  sms: "SMS gönder",
  whatsapp: "WhatsApp gönder",
  push: "Push bildirimi",
  condition: "Koşul",
  end: "Otomasyonu bitir",
};

export const MESSAGE_CHANNELS = ["email", "sms", "whatsapp", "push"] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

export const CHANNEL_LABELS: Record<MessageChannel, string> = {
  email: "E-posta",
  sms: "SMS",
  whatsapp: "WhatsApp",
  push: "Push",
};

export const CONDITIONS = [
  "order_placed",
  "order_paid",
  "email_opened",
  "has_tag",
  "cart_still_active",
  "ltv_above",
  "order_count_above",
  "spent_above",
  "category_interest",
] as const;

export type AutomationCondition = (typeof CONDITIONS)[number];

export const CONDITION_LABELS: Record<AutomationCondition, string> = {
  order_placed: "Sipariş verildi mi?",
  order_paid: "Ödeme yapıldı mı?",
  email_opened: "E-posta açıldı mı?",
  has_tag: "Müşteri etikete sahip mi?",
  cart_still_active: "Sepet hâlâ dolu mu?",
  ltv_above: "Yaşam boyu değer eşiğin üstünde mi?",
  order_count_above: "Sipariş sayısı eşiğin üstünde mi?",
  spent_above: "Toplam harcama eşiğin üstünde mi?",
  category_interest: "Bu kategoriye ilgi var mı?",
};

export const BRANCH_OPTIONS = [
  { value: "continue", label: "Devam et" },
  { value: "end", label: "Otomasyonu bitir" },
] as const;

export const WAIT_PRESETS = [
  { value: 30, label: "30 dakika" },
  { value: 60, label: "1 saat" },
  { value: 360, label: "6 saat" },
  { value: 1440, label: "1 gün" },
  { value: 4320, label: "3 gün" },
] as const;

export function formatWait(minutes: number) {
  if (minutes <= 0) return "hemen";
  if (minutes < 60) return `${minutes} dakika`;
  if (minutes < 1440) {
    const hours = minutes / 60;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} saat`;
  }
  const days = minutes / 1440;
  return `${Number.isInteger(days) ? days : days.toFixed(1)} gün`;
}

/** Şablon içindeki {{degisken}} yer tutucularını doldurur. */
export function renderTemplate(body: string, vars: Record<string, string | number | null>) {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const value = vars[key];
    return value === null || value === undefined ? "" : String(value);
  });
}

export const TEMPLATE_VARIABLES = [
  "musteri_adi",
  "magaza_adi",
  "sepet_tutari",
  "sepet_linki",
  "siparis_no",
  "kargo_takip",
  "indirim_kodu",
] as const;
