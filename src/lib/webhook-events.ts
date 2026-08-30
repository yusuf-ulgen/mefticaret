export const WEBHOOK_EVENTS = [
  "order.created",
  "order.updated",
  "order.fulfilled",
  "order.cancelled",
  "product.created",
  "product.updated",
  "inventory.low_stock",
  "customer.created",
  "payout.paid",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, string> = {
  "order.created": "Sipariş oluşturuldu",
  "order.updated": "Sipariş güncellendi",
  "order.fulfilled": "Sipariş kargolandı",
  "order.cancelled": "Sipariş iptal edildi",
  "product.created": "Ürün eklendi",
  "product.updated": "Ürün güncellendi",
  "inventory.low_stock": "Kritik stok",
  "customer.created": "Yeni müşteri",
  "payout.paid": "Hakediş ödendi",
};

export const NOTIFICATION_KIND_LABELS: Record<string, string> = {
  order: "Sipariş",
  inventory: "Stok",
  payout: "Hakediş",
  review: "Yorum",
  system: "Sistem",
  abandoned_cart: "Terk sepet",
};
