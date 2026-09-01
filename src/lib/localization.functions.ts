import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Dil, para birimi (ana/görüntüleme, kur) ve vergi motoru yönetimi.
 * Doğrulama sunucuda yapılır; tenant izolasyonu RLS ile zorlanır.
 */

const CURRENCIES = ["TRY", "USD", "EUR", "GBP", "AED", "SAR"] as const;
const LOCALES = ["tr", "en", "de", "fr", "es", "ar"] as const;

export const saveLocalizationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        defaultLocale: z.enum(LOCALES),
        supportedLocales: z.array(z.enum(LOCALES)).min(1),
        baseCurrency: z.enum(CURRENCIES),
        displayCurrencies: z.array(z.enum(CURRENCIES)).min(1),
        autoCurrencyRates: z.boolean(),
        defaultTaxRate: z.number().min(0).max(100),
        taxIncludedPrices: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.supportedLocales.includes(data.defaultLocale)) {
      throw new Error("Varsayılan dil desteklenen diller arasında olmalı");
    }
    if (!data.displayCurrencies.includes(data.baseCurrency)) {
      throw new Error("Ana para birimi görüntüleme para birimleri arasında olmalı");
    }

    const payload = {
      store_id: data.storeId,
      default_locale: data.defaultLocale,
      supported_locales: data.supportedLocales,
      base_currency: data.baseCurrency,
      display_currencies: data.displayCurrencies,
      auto_currency_rates: data.autoCurrencyRates,
      default_tax_rate: data.defaultTaxRate,
      tax_included_prices: data.taxIncludedPrices,
    };

    const { data: row, error } = await supabase
      .from("store_settings")
      .upsert(payload, { onConflict: "store_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("audit_logs").insert({
      store_id: data.storeId,
      actor_id: userId,
      action: "localization.updated",
      entity: "store_settings",
      entity_id: data.storeId,
      new_value: payload,
    });

    return row;
  });

export const saveCurrencyRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        baseCurrency: z.enum(CURRENCIES),
        quoteCurrency: z.enum(CURRENCIES),
        rate: z.number().positive().max(1_000_000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (data.baseCurrency === data.quoteCurrency) {
      throw new Error("Ana ve hedef para birimi aynı olamaz");
    }
    const { data: row, error } = await context.supabase
      .from("currency_rates")
      .upsert(
        {
          store_id: data.storeId,
          base_currency: data.baseCurrency,
          quote_currency: data.quoteCurrency,
          rate: data.rate,
          source: "manual",
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "store_id,base_currency,quote_currency" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Otomatik dönüşüm: dış servisten güncel kurlar çekilip mağazaya yazılır. */
export const refreshCurrencyRates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        baseCurrency: z.enum(CURRENCIES),
        quoteCurrencies: z.array(z.enum(CURRENCIES)).min(1),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const response = await fetch(`https://open.er-api.com/v6/latest/${data.baseCurrency}`);
    if (!response.ok) {
      throw new Error(`Kur servisi yanıt vermedi (${response.status})`);
    }
    const payload = (await response.json()) as { result?: string; rates?: Record<string, number> };
    if (payload.result !== "success" || !payload.rates) {
      throw new Error("Kur servisinden geçerli veri alınamadı");
    }

    const now = new Date().toISOString();
    const rows = data.quoteCurrencies
      .filter((quote) => quote !== data.baseCurrency)
      .map((quote) => ({
        store_id: data.storeId,
        base_currency: data.baseCurrency,
        quote_currency: quote,
        rate: Number(payload.rates![quote]),
        source: "auto",
        fetched_at: now,
      }))
      .filter((row) => Number.isFinite(row.rate) && row.rate > 0);

    if (rows.length === 0) throw new Error("Güncellenecek kur bulunamadı");

    const { error } = await context.supabase
      .from("currency_rates")
      .upsert(rows, { onConflict: "store_id,base_currency,quote_currency" });
    if (error) throw new Error(error.message);

    return { updated: rows.length, fetchedAt: now };
  });

export const saveTaxClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        classId: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(60),
        code: z
          .string()
          .trim()
          .min(1)
          .max(40)
          .regex(/^[a-z0-9_-]+$/, "Kod yalnızca küçük harf, rakam, - ve _ içerebilir"),
        isDefault: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const payload = {
      store_id: data.storeId,
      name: data.name,
      code: data.code,
      is_default: data.isDefault,
    };

    const query = data.classId
      ? supabase
          .from("tax_classes")
          .update(payload)
          .eq("id", data.classId)
          .eq("store_id", data.storeId)
      : supabase.from("tax_classes").insert(payload);

    const { data: row, error } = await query.select("*").single();
    if (error) throw new Error(error.message);

    if (data.isDefault) {
      await supabase
        .from("tax_classes")
        .update({ is_default: false })
        .eq("store_id", data.storeId)
        .neq("id", row.id);
    }

    return row;
  });

export const deleteTaxClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.string().uuid(), classId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tax_classes")
      .delete()
      .eq("id", data.classId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveTaxRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        ruleId: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(80),
        taxClassId: z.string().uuid().nullable().default(null),
        countryCode: z.string().trim().max(2).nullable().default(null),
        region: z.string().trim().max(80).nullable().default(null),
        rate: z.number().min(0).max(100),
        priority: z.number().int().min(0).max(999).default(0),
        isActive: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const payload = {
      store_id: data.storeId,
      name: data.name,
      tax_class_id: data.taxClassId,
      country_code: data.countryCode ? data.countryCode.toUpperCase() : null,
      region: data.region || null,
      rate: data.rate,
      priority: data.priority,
      is_active: data.isActive,
    };

    const query = data.ruleId
      ? supabase.from("tax_rules").update(payload).eq("id", data.ruleId).eq("store_id", data.storeId)
      : supabase.from("tax_rules").insert(payload);

    const { data: row, error } = await query.select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteTaxRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.string().uuid(), ruleId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tax_rules")
      .delete()
      .eq("id", data.ruleId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
