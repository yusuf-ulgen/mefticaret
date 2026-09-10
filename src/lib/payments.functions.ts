import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { planPriceId } from "@/lib/paddle-plans";

/**
 * Abonelik ödeme kasası (checkout) sunucu fonksiyonları.
 * Fiyat ve paket eşlemesi yalnızca sunucuda yapılır; istemci fiyat belirlemez.
 */

const envSchema = z.enum(["sandbox", "live"]);

/** Okunabilir fiyat kimliğini sağlayıcının dahili fiyat kimliğine çevirir. */
export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z.object({ priceId: z.string().min(2).max(60), environment: envSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    const { gatewayFetch } = await import("@/lib/paddle.server");
    const response = await gatewayFetch(
      data.environment,
      `/prices?external_id=${encodeURIComponent(data.priceId)}`,
    );
    const result = (await response.json()) as { data?: Array<{ id: string }> };
    const id = result.data?.[0]?.id;
    if (!id) throw new Error("Fiyat bulunamadı");
    return id;
  });

/**
 * Mağaza yöneticisinin seçtiği paket için kasa bilgilerini hazırlar.
 * Fiyat kimliği paketin veritabanındaki slug'ından türetilir.
 */
export const preparePlanCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        planId: z.guid(),
        billingInterval: z.enum(["monthly", "yearly"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(supabase, data.storeId, userId);

    const { data: plan, error } = await supabase
      .from("plans")
      .select("id, slug, name, currency, price_monthly, price_yearly, is_active")
      .eq("id", data.planId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!plan || !plan.is_active) throw new Error("Paket bulunamadı");

    const priceId = planPriceId(plan.slug, data.billingInterval);
    if (!priceId) throw new Error("Bu paket için ödeme alınmıyor, lütfen bizimle iletişime geçin");

    const amount = Number(
      (data.billingInterval === "yearly" ? plan.price_yearly : plan.price_monthly) ?? 0,
    );

    return {
      priceId,
      planName: plan.name,
      currency: plan.currency ?? "TRY",
      amount,
      storeId: data.storeId,
      planId: plan.id,
      billingInterval: data.billingInterval,
    };
  });
