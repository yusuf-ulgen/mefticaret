import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { stockAlertSchema, subscribeStockAlert } from "@/lib/stock-alerts.server";

/**
 * "Stoğa gelince haber ver" kaydı (oturum gerektirmez).
 * E-posta spam'i ve kayıt bombardımanına karşı IP bazlı hız sınırı uygulanır.
 */
export const createStockAlert = createServerFn({ method: "POST" })
  .inputValidator((data) => stockAlertSchema.parse(data))
  .handler(async ({ data }) => {
    const { consumeRateLimit, clientIp, RATE_LIMITS } = await import("@/lib/rate-limit.server");
    const request = getRequest();
    const limit = await consumeRateLimit(
      `stockalert:${data.slug}:${clientIp(request)}`,
      RATE_LIMITS.public_form,
    );
    if (!limit.allowed) throw new Error("Çok fazla istek gönderildi. Lütfen daha sonra deneyin.");

    return subscribeStockAlert(data);
  });
