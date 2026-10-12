import { z } from "zod";

export const REFUND_REASONS = [
  "Müşteri vazgeçti",
  "Ürün hasarlı geldi",
  "Yanlış ürün gönderildi",
  "Ürün beklentileri karşılamadı",
  "Diğer",
] as const;

export const REFUND_METHOD_LABELS = {
  original_payment: "Orijinal Ödeme Yöntemi",
  store_credit: "Mağaza Kredisi",
  manual: "Manuel",
} as const;

export const REFUND_STATUS_LABELS: Record<string, string> = {
  pending: "Bekliyor",
  processing: "İşleniyor / sağlayıcı teyidi bekliyor",
  processed: "İade edildi",
  failed: "Başarısız",
  cancelled: "İptal edildi",
};

export const createRefundSchema = z.object({
  storeId: z.guid(),
  orderId: z.guid(),
  lines: z
    .array(
      z.object({
        orderItemId: z.guid(),
        quantity: z.number().int().min(1).max(10_000),
        restock: z.boolean(),
      }),
    )
    .max(200),
  amount: z.number().positive().max(10_000_000),
  method: z.enum(["original_payment", "store_credit", "manual"]),
  reason: z.enum(REFUND_REASONS),
  note: z.string().trim().max(1000).default(""),
  idempotencyKey: z.string().min(8).max(80),
});
