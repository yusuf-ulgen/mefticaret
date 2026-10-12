export const WEBHOOK_EVENTS = [
  "order.created",
  "order.paid",
  "order.updated",
  "order.cancelled",
  "order.fulfilled",
  "product.created",
  "product.updated",
  "product.deleted",
  "customer.created",
  "customer.updated",
  "payment.completed",
  "payment.failed",
  "shipment.created",
  "shipment.delivered",
  "inventory.low_stock",
  "payout.paid",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, string> = {
  "order.created": "Sipariş oluşturuldu",
  "order.paid": "Sipariş ödendi",
  "order.updated": "Sipariş güncellendi",
  "order.cancelled": "Sipariş iptal edildi",
  "order.fulfilled": "Sipariş karşılandı",
  "product.created": "Ürün eklendi",
  "product.updated": "Ürün güncellendi",
  "product.deleted": "Ürün silindi",
  "customer.created": "Yeni müşteri",
  "customer.updated": "Müşteri güncellendi",
  "payment.completed": "Ödeme tamamlandı",
  "payment.failed": "Ödeme başarısız",
  "shipment.created": "Sevkiyat oluşturuldu",
  "shipment.delivered": "Sevkiyat teslim edildi",
  "inventory.low_stock": "Kritik stok",
  "payout.paid": "Hakediş ödendi",
};

export const WEBHOOK_EVENT_GROUPS: { label: string; events: WebhookEvent[] }[] = [
  {
    label: "Sipariş",
    events: ["order.created", "order.paid", "order.updated", "order.cancelled", "order.fulfilled"],
  },
  { label: "Ürün", events: ["product.created", "product.updated", "product.deleted"] },
  { label: "Müşteri", events: ["customer.created", "customer.updated"] },
  { label: "Ödeme", events: ["payment.completed", "payment.failed"] },
  { label: "Kargo", events: ["shipment.created", "shipment.delivered"] },
  { label: "Diğer", events: ["inventory.low_stock", "payout.paid"] },
];

/** Başarısız gönderimler için üstel geri çekilme (dakika). */
export const WEBHOOK_RETRY_BACKOFF_MINUTES = [1, 5, 15, 60, 360];

export { NOTIFICATION_KIND_LABELS } from "@/lib/notifications";
