import { createServerFn } from "@tanstack/react-start";

import { orderCardPaymentSchema } from "@/lib/order-payment.server";

/**
 * Vitrin siparişi için kart ödeme bağlantısı. Herkese açık uçtur:
 * sipariş numarası + e-posta eşleşmesi ve hız sınırı sunucuda uygulanır.
 */
export const startOrderPayment = createServerFn({ method: "POST" })
  .inputValidator((data) => orderCardPaymentSchema.parse(data))
  .handler(async ({ data }) => {
    const { consumeRateLimit } = await import("@/lib/rate-limit.server");
    const limit = await consumeRateLimit(`order_pay:${data.slug}:${data.orderNumber}`, {
      limit: 8,
      windowSeconds: 300,
    });
    if (!limit.allowed) throw new Error("Çok fazla deneme yapıldı, biraz sonra tekrar deneyin.");

    const { startOrderCardPayment } = await import("@/lib/order-payment.server");
    return startOrderCardPayment(data);
  });
