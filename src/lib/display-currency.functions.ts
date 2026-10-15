import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const DISPLAY_CURRENCIES = ["TRY", "GEL", "USD"] as const;

/**
 * Vitrin görüntüleme kurları (herkese açık, yalnız kur bilgisi döner).
 * Önce mağazanın kur tablosu, yoksa canlı kur sağlayıcısı kullanılır.
 */
export const getDisplayRates = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().trim().min(1).max(120) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { liveRate } = await import("@/lib/live-fx.server");
    const { data: store } = await supabaseAdmin
      .from("stores")
      .select("id, currency, status")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!store || store.status !== "active") return { base: "TRY", rates: {} as Record<string, number> };
    const base = String(store.currency || "TRY").toUpperCase();
    const { data: rows } = await supabaseAdmin
      .from("currency_rates")
      .select("quote_currency, rate")
      .eq("store_id", store.id)
      .eq("base_currency", base)
      .in("quote_currency", [...DISPLAY_CURRENCIES]);
    const rates: Record<string, number> = { [base]: 1 };
    for (const row of rows ?? []) {
      const rate = Number(row.rate);
      if (Number.isFinite(rate) && rate > 0) rates[String(row.quote_currency).toUpperCase()] = rate;
    }
    await Promise.all(
      DISPLAY_CURRENCIES.filter((code) => !rates[code]).map(async (code) => {
        const rate = await liveRate(base, code);
        if (rate) rates[code] = rate;
      }),
    );
    return { base, rates };
  });
