import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Vitrin: hediye kartı bakiye sorgulama (oturum gerektirmez).
 * Kod deneme (brute-force) saldırılarına karşı IP + mağaza bazlı hız sınırı uygulanır.
 */
export const checkGiftCardBalance = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        slug: z.string().trim().min(1).max(80),
        code: z.string().trim().min(4).max(40),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { consumeRateLimit, clientIp, RATE_LIMITS, recordSecurityEvent } = await import(
      "@/lib/rate-limit.server"
    );
    const request = getRequest();
    const ip = clientIp(request);
    const limit = await consumeRateLimit(`giftcard:${data.slug}:${ip}`, RATE_LIMITS.public_form);
    if (!limit.allowed) {
      await recordSecurityEvent({
        kind: "gift_card_lookup_rate_limited",
        severity: "warning",
        request,
        meta: { slug: data.slug },
      });
      return {
        found: false,
        reason: "Çok fazla deneme yapıldı. Lütfen bir süre sonra tekrar deneyin.",
      };
    }

    const { lookupGiftCardBalance } = await import("@/lib/gift-cards-balance.server");
    return lookupGiftCardBalance(data.slug, data.code);
  });
