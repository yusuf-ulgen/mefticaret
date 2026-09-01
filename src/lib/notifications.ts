import type { Database } from "@/integrations/supabase/types";

export type NotificationKind = Database["public"]["Enums"]["notification_kind"];
export type NotificationChannel = "in_app" | "email" | "push" | "sms" | "whatsapp";

/** Bildirim merkezinde yönetilen türler (öncelik sırasına göre). */
export const NOTIFICATION_KINDS = [
  "order",
  "payment",
  "payment_failed",
  "inventory",
  "customer",
  "subscription",
  "app_update",
  "system",
  "payout",
  "review",
  "question",
  "abandoned_cart",
] as const satisfies readonly NotificationKind[];

export const NOTIFICATION_KIND_META: Record<
  NotificationKind,
  { label: string; description: string }
> = {
  order: { label: "Yeni sipariş", description: "Mağazaya yeni sipariş düştüğünde" },
  payment: { label: "Ödeme", description: "Sipariş ödemesi başarıyla alındığında" },
  payment_failed: { label: "Başarısız ödeme", description: "Ödeme reddedildiğinde veya hata verdiğinde" },
  inventory: { label: "Düşük stok", description: "Varyant kritik stok eşiğine düştüğünde" },
  customer: { label: "Yeni müşteri", description: "Yeni müşteri kaydı oluştuğunda" },
  subscription: { label: "Abonelik", description: "Abonelik başladığında veya durumu değiştiğinde" },
  app_update: { label: "Uygulama güncellemesi", description: "Kurulu uygulamalarda yeni sürüm çıktığında" },
  system: { label: "Sistem bildirimi", description: "Platform duyuruları ve bakım bilgileri" },
  payout: { label: "Hakediş", description: "Satıcı hakediş ödemeleri" },
  review: { label: "Yorum", description: "Ürüne yeni yorum geldiğinde" },
  question: { label: "Soru", description: "Ürüne yeni soru geldiğinde" },
  abandoned_cart: { label: "Terk edilmiş sepet", description: "Sepet tamamlanmadan bırakıldığında" },
};

export const NOTIFICATION_CHANNELS: {
  key: NotificationChannel;
  label: string;
  description: string;
}[] = [
  { key: "in_app", label: "Panel", description: "Bildirim merkezi ve zil ikonu" },
  { key: "email", label: "E-posta", description: "Belirlenen e-posta adresine gönderim" },
  { key: "push", label: "Push", description: "Panel açıkken tarayıcı bildirimi" },
  { key: "sms", label: "SMS", description: "Belirlenen telefon numarasına SMS" },
  { key: "whatsapp", label: "WhatsApp", description: "WhatsApp Business üzerinden mesaj" },
];

export const NOTIFICATION_KIND_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(NOTIFICATION_KIND_META).map(([key, value]) => [key, value.label]),
);

export const NOTIFICATION_CHANNEL_LABELS: Record<string, string> = {
  in_app: "Panel",
  email: "E-posta",
  push: "Push",
  sms: "SMS",
  whatsapp: "WhatsApp",
};

export function defaultNotificationSetting(kind: NotificationKind) {
  const critical: NotificationKind[] = ["order", "payment_failed", "inventory", "system"];
  return {
    kind,
    in_app: true,
    email: critical.includes(kind),
    push: false,
    sms: false,
    whatsapp: false,
    email_to: null as string | null,
    sms_to: null as string | null,
    whatsapp_to: null as string | null,
  };
}
