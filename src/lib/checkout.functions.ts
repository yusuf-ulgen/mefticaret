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
    requirePolicyAcceptance(data.policyAccepted);
    const result = await createStorefrontOrder(data);
    await logAcceptance(data.slug, result.orderNumber, data.customer.email, null);
    return result;
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
    await guardCheckoutRate(data.slug, "checkout_order");
    const { data: userData } = await context.supabase.auth.getUser();
    const email = userData.user?.email?.trim().toLowerCase();
    if (!email) throw new Error("Hesabınızda e-posta adresi bulunamadı.");
    requirePolicyAcceptance(data.policyAccepted);
    const result = await createStorefrontOrder({ ...data, customer: { ...data.customer, email } }, {
      userId: context.userId,
      email,
    });
    await logAcceptance(data.slug, result.orderNumber, email, context.userId);
    return result;
  });

function requirePolicyAcceptance(accepted: boolean | undefined) {
  if (accepted !== true) throw new Error("Siparişi tamamlamak için Gizlilik Politikası ve Mesafeli Satış Sözleşmesi'ni onaylamanız gerekir.");
}

/** Onay kaydı başarısız olsa bile sipariş geri alınmaz; hata kaydedilir. */
async function logAcceptance(slug: string, orderNumber: string, email: string, userId: string | null) {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { recordCheckoutAcceptances } = await import("@/lib/policies.server");
    await recordCheckoutAcceptances({ slug, orderNumber, email, userId, request: getRequest() ?? null });
  } catch (error) {
    console.error("policy acceptance log failed", error);
  }
}
