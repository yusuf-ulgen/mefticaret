import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import {
  checkoutOptionsSchema,
  createStorefrontOrder,
  loadCheckoutOptions,
  loadOrderStatus,
  orderStatusSchema,
  placeOrderSchema,
  previewDiscount,
  previewDiscountSchema,
  quoteCheckout,
  quoteCheckoutSchema,
} from "@/lib/checkout.server";

/**
 * Kasa uçlarında IP bazlı sıkı hız sınırı. Limit aşılırsa istek reddedilir ve
 * güvenlik olayı kaydedilir (bot/kart deneme saldırılarına karşı).
 */
async function guardCheckoutRate(bucket: string, kind: "checkout_quote" | "checkout_order") {
  const { getRequest } = await import("@tanstack/react-start/server");
  const { consumeRateLimit, clientIp, RATE_LIMITS, recordSecurityEvent } = await import(
    "@/lib/rate-limit.server"
  );
  const request = getRequest();
  const ip = clientIp(request);
  const limit = await consumeRateLimit(`${kind}:${bucket}:${ip}`, RATE_LIMITS[kind]);
  if (!limit.allowed) {
    await recordSecurityEvent({
      kind: `rate_limited_${kind}`,
      severity: "warning",
      request,
      meta: { bucket },
    });
    throw new Error("Çok fazla deneme yaptınız. Lütfen birkaç dakika sonra tekrar deneyin.");
  }
}

export const getCheckoutOptions = createServerFn({ method: "GET" })
  .inputValidator((data) => checkoutOptionsSchema.parse(data))
  .handler(async ({ data }) => loadCheckoutOptions(data));

export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((data) => placeOrderSchema.parse(data))
  .handler(async ({ data }) => {
    await guardCheckoutRate(data.slug, "checkout_order");
    return createStorefrontOrder(data);
  });

export const getOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((data) => orderStatusSchema.parse(data))
  .handler(async ({ data }) => loadOrderStatus(data));

export const previewCheckoutDiscount = createServerFn({ method: "POST" })
  .inputValidator((data) => previewDiscountSchema.parse(data))
  .handler(async ({ data }) => previewDiscount(data));

/** Kasada gösterilen tüm tutarlar bu fonksiyondan gelir (istemci hesabına güvenilmez). */
export const getCheckoutQuote = createServerFn({ method: "POST" })
  .inputValidator((data) => quoteCheckoutSchema.parse(data))
  .handler(async ({ data }) => {
    await guardCheckoutRate(data.slug, "checkout_quote");
    return quoteCheckout(data);
  });

/** Üyelikle ödeme: oturum doğrulanır, sipariş müşteri hesabına bağlanır. */
export const placeMemberOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => placeOrderSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: userData } = await context.supabase.auth.getUser();
    const email = userData.user?.email?.trim().toLowerCase();
    if (!email) throw new Error("Hesabınızda e-posta adresi bulunamadı.");
    return createStorefrontOrder({ ...data, customer: { ...data.customer, email } }, {
      userId: context.userId,
      email,
    });
  });
