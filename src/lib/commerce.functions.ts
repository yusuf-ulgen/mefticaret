import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Ödeme ve kargo connector uygulama katmanı. Tenant izolasyonu ve yetki
 * kontrolü RLS tarafından zorlanır (can_manage_store).
 * Not: Sağlayıcı API anahtarları veritabanında tutulmaz; yalnızca
 * `config_ref` referansı saklanır (gerçek sırlar sunucu tarafı secret store'da).
 */

export const enablePaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        connectorId: z.guid(),
        displayName: z.string().trim().min(2).max(80),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("store_payment_methods").insert({
      store_id: data.storeId,
      connector_id: data.connectorId,
      display_name: data.displayName,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updatePaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        methodId: z.guid(),
        displayName: z.string().trim().min(2).max(80).optional(),
        instructions: z.string().trim().max(600).nullish(),
        isActive: z.boolean().optional(),
        testMode: z.boolean().optional(),
        installmentsEnabled: z.boolean().optional(),
        extraFeeRate: z.number().min(0).max(1).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const patch = {
      ...(data.displayName !== undefined ? { display_name: data.displayName } : {}),
      ...(data.instructions !== undefined
        ? { instructions: data.instructions || null }
        : {}),
      ...(data.isActive !== undefined ? { is_active: data.isActive } : {}),
      ...(data.testMode !== undefined ? { test_mode: data.testMode } : {}),
      ...(data.installmentsEnabled !== undefined
        ? { installments_enabled: data.installmentsEnabled }
        : {}),
      ...(data.extraFeeRate !== undefined ? { extra_fee_rate: data.extraFeeRate } : {}),
    };


    const { error } = await context.supabase
      .from("store_payment_methods")
      .update(patch)
      .eq("id", data.methodId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), methodId: z.guid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("store_payment_methods")
      .delete()
      .eq("id", data.methodId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertShippingZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        zoneId: z.guid().optional(),
        name: z.string().trim().min(2).max(80),
        countries: z.array(z.string().trim().min(2).max(2)).max(50).default([]),
        cities: z.array(z.string().trim().min(2).max(60)).max(80).default([]),
        isActive: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      store_id: data.storeId,
      name: data.name,
      countries: data.countries.map((code) => code.toUpperCase()),
      cities: data.cities,
      is_active: data.isActive,
    };
    if (data.zoneId) {
      const { error } = await context.supabase
        .from("shipping_zones")
        .update(payload)
        .eq("id", data.zoneId)
        .eq("store_id", data.storeId);
      if (error) throw new Error(error.message);
      return { id: data.zoneId };
    }
    const { data: zone, error } = await context.supabase
      .from("shipping_zones")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: zone.id };
  });

export const deleteShippingZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), zoneId: z.guid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("shipping_zones")
      .delete()
      .eq("id", data.zoneId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertShippingRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        zoneId: z.guid(),
        rateId: z.guid().optional(),
        connectorId: z.guid().nullish(),
        title: z.string().trim().min(2).max(80),
        price: z.number().min(0).max(999_999),
        freeOver: z.number().min(0).max(9_999_999).nullish(),
        etaDays: z.number().int().min(0).max(120).nullish(),
        isActive: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      store_id: data.storeId,
      zone_id: data.zoneId,
      connector_id: data.connectorId ?? null,
      title: data.title,
      price: data.price,
      free_over: data.freeOver ?? null,
      eta_days: data.etaDays ?? null,
      is_active: data.isActive,
    };
    if (data.rateId) {
      const { error } = await context.supabase
        .from("shipping_rates")
        .update(payload)
        .eq("id", data.rateId)
        .eq("store_id", data.storeId);
      if (error) throw new Error(error.message);
      return { id: data.rateId };
    }
    const { data: rate, error } = await context.supabase
      .from("shipping_rates")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: rate.id };
  });

export const deleteShippingRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), rateId: z.guid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("shipping_rates")
      .delete()
      .eq("id", data.rateId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
