import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Dropshipping sunucu katmanı: tedarikçi ayarları, sipariş yönlendirme ve
 * tedarikçi portal erişimi. Tenant izolasyonu RLS ile zorlanır.
 */

const storeGuard = async (supabase: any, storeId: string) => {
  const { data, error } = await supabase.from("stores").select("id").eq("id", storeId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Mağaza bulunamadı veya yetkiniz yok");
};

export const saveDropshipSupplierSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        supplierId: z.guid(),
        isDropship: z.boolean(),
        leadTimeDays: z.number().int().min(0).max(180).default(3),
        currency: z.string().trim().min(3).max(3).default("TRY"),
        autoSendOrders: z.boolean().default(false),
        orderEndpoint: z.string().trim().url().max(600).nullish().or(z.literal("")),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("suppliers")
      .update({
        is_dropship: data.isDropship,
        lead_time_days: data.leadTimeDays,
        currency: data.currency.toUpperCase(),
        auto_send_orders: data.autoSendOrders,
        order_endpoint: data.orderEndpoint || null,
      })
      .eq("id", data.supplierId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const dispatchDropshipOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        orderId: z.guid(),
        supplierId: z.guid().nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await storeGuard(supabase, data.storeId);
    const { sendDropshipOrder } = await import("@/lib/dropshipping.server");
    return sendDropshipOrder(supabase as never, data.storeId, data.orderId, data.supplierId ?? null);
  });

export const updateDropshipOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        dropshipOrderId: z.guid(),
        status: z.enum(["pending", "sent", "accepted", "shipped", "cancelled", "failed"]),
        carrier: z.string().trim().max(80).nullish(),
        trackingNumber: z.string().trim().max(80).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("dropship_orders")
      .update({
        status: data.status,
        carrier: data.carrier || null,
        tracking_number: data.trackingNumber || null,
      })
      .eq("id", data.dropshipOrderId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Tedarikçiye kendi paneli için erişim verir/kaldırır (e-posta ile eşleşen hesap). */
export const setSupplierPortalAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        supplierId: z.guid(),
        email: z.string().trim().email().max(200).optional(),
        enabled: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await storeGuard(supabase, data.storeId);

    if (!data.enabled) {
      const { error } = await supabase
        .from("suppliers")
        .update({ portal_enabled: false })
        .eq("id", data.supplierId)
        .eq("store_id", data.storeId);
      if (error) throw new Error(error.message);
      return { ok: true, portalUserId: null as string | null };
    }

    if (!data.email) throw new Error("Portal erişimi için tedarikçi e-postası gerekli");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", data.email)
      .limit(1)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile) {
      throw new Error("Bu e-posta ile kayıtlı kullanıcı yok. Tedarikçi önce üye olmalı.");
    }

    const { error } = await supabase
      .from("suppliers")
      .update({ portal_enabled: true, portal_user_id: profile.id })
      .eq("id", data.supplierId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true, portalUserId: profile.id as string };
  });
