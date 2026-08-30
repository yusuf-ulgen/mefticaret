import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Pazaryeri kanal katmanı. Tenant izolasyonu ve yetki RLS ile zorlanır
 * (is_store_member / can_manage_store). Sağlayıcı API anahtarları
 * veritabanında tutulmaz; yalnızca `config_ref` referansı saklanır.
 */

export const connectChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        provider: z.string().trim().min(2).max(40),
        name: z.string().trim().min(2).max(80),
        sellerId: z.string().trim().max(80).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("marketplace_channels")
      .insert({
        store_id: data.storeId,
        provider: data.provider,
        name: data.name,
        seller_id: data.sellerId || null,
        status: data.sellerId ? "connected" : "disconnected",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const updateChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        channelId: z.string().uuid(),
        name: z.string().trim().min(2).max(80).optional(),
        sellerId: z.string().trim().max(80).nullish(),
        isActive: z.boolean().optional(),
        autoSync: z.boolean().optional(),
        priceMarkupRate: z.number().min(-0.5).max(2).optional(),
        status: z.enum(["disconnected", "connected", "error", "paused"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const patch = {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.sellerId !== undefined ? { seller_id: data.sellerId || null } : {}),
      ...(data.isActive !== undefined ? { is_active: data.isActive } : {}),
      ...(data.autoSync !== undefined ? { auto_sync: data.autoSync } : {}),
      ...(data.priceMarkupRate !== undefined ? { price_markup_rate: data.priceMarkupRate } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    };
    const { error } = await context.supabase
      .from("marketplace_channels")
      .update(patch)
      .eq("id", data.channelId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.string().uuid(), channelId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("marketplace_channels")
      .delete()
      .eq("id", data.channelId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setChannelListings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        channelId: z.string().uuid(),
        productIds: z.array(z.string().uuid()).max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (data.productIds.length > 0) {
      const { error } = await context.supabase.from("channel_listings").upsert(
        data.productIds.map((productId) => ({
          store_id: data.storeId,
          channel_id: data.channelId,
          product_id: productId,
          status: "queued" as const,
        })),
        { onConflict: "channel_id,product_id", ignoreDuplicates: true },
      );
      if (error) throw new Error(error.message);
    }
    return { ok: true, queued: data.productIds.length };
  });

export const removeChannelListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.string().uuid(), listingId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("channel_listings")
      .delete()
      .eq("id", data.listingId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Senkronizasyon simülasyonu: gerçek pazaryeri API çağrıları connector
 * kimlik bilgileri girildiğinde bu noktadan tetiklenir. Şimdilik kuyruktaki
 * kayıtları "listed" durumuna taşır ve dış kimlik üretir.
 */
export const syncChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.string().uuid(), channelId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: channel, error: channelError } = await context.supabase
      .from("marketplace_channels")
      .select("id, provider, seller_id")
      .eq("id", data.channelId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (channelError) throw new Error(channelError.message);
    if (!channel) throw new Error("Kanal bulunamadı");
    if (!channel.seller_id) throw new Error("Senkronizasyon için satıcı kimliği gerekli");

    const { data: listings, error: listingError } = await context.supabase
      .from("channel_listings")
      .select("id, product_id")
      .eq("channel_id", data.channelId)
      .eq("store_id", data.storeId)
      .in("status", ["draft", "queued", "error"]);
    if (listingError) throw new Error(listingError.message);

    const now = new Date().toISOString();
    for (const listing of listings ?? []) {
      const { error } = await context.supabase
        .from("channel_listings")
        .update({
          status: "listed",
          external_id: `${channel.provider}-${listing.product_id.slice(0, 8)}`,
          last_synced_at: now,
          last_error: null,
        })
        .eq("id", listing.id);
      if (error) throw new Error(error.message);
    }

    const { error: touchError } = await context.supabase
      .from("marketplace_channels")
      .update({ last_sync_at: now, status: "connected", last_error: null })
      .eq("id", data.channelId);
    if (touchError) throw new Error(touchError.message);

    return { ok: true, synced: (listings ?? []).length };
  });
