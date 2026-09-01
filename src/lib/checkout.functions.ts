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

export const getCheckoutOptions = createServerFn({ method: "GET" })
  .inputValidator((data) => checkoutOptionsSchema.parse(data))
  .handler(async ({ data }) => loadCheckoutOptions(data));

export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((data) => placeOrderSchema.parse(data))
  .handler(async ({ data }) => createStorefrontOrder(data));

export const getOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((data) => orderStatusSchema.parse(data))
  .handler(async ({ data }) => loadOrderStatus(data));

export const previewCheckoutDiscount = createServerFn({ method: "POST" })
  .inputValidator((data) => previewDiscountSchema.parse(data))
  .handler(async ({ data }) => previewDiscount(data));

/** Kasada gösterilen tüm tutarlar bu fonksiyondan gelir (istemci hesabına güvenilmez). */
export const getCheckoutQuote = createServerFn({ method: "POST" })
  .inputValidator((data) => quoteCheckoutSchema.parse(data))
  .handler(async ({ data }) => quoteCheckout(data));

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
