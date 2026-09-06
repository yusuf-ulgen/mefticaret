import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { FB_CONDITIONS } from "@/lib/facebook-marketplace";

/**
 * Facebook Marketplace server function'ları.
 * Erişim anahtarları yalnızca sunucuda işlenir ve hiçbir yanıtla dönmez.
 */

const storeScope = z.object({ storeId: z.guid() });

async function assertStoreAccess(
  supabase: SupabaseClient<Database>,
  storeId: string,
  userId: string,
): Promise<void> {
  const { assertStoreManager } = await import("@/lib/store-access.server");
  await assertStoreManager(supabase, storeId, userId);
}

/** Meta OAuth onay adresini üretir. */
export const getMarketplaceOAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeScope.extend({ redirectUri: z.string().url() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertStoreAccess(context.supabase, data.storeId, context.userId);
    const { buildMarketplaceOAuthUrl, metaMarketplaceConfig } = await import(
      "@/lib/facebook-marketplace.server"
    );
    if (!metaMarketplaceConfig().appId) {
      throw new Error(
        "Meta uygulama bilgileri tanımlı değil. Bağlantıyı sayfa erişim anahtarını girerek de tamamlayabilirsin.",
      );
    }
    return { url: buildMarketplaceOAuthUrl(data.redirectUri, data.storeId) };
  });

/** OAuth kodunu anahtara çevirip sayfayı bağlar. */
export const completeMarketplaceOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    storeScope.extend({ code: z.string().min(4), redirectUri: z.string().url() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStoreAccess(context.supabase, data.storeId, context.userId);
    const [{ supabaseAdmin }, { exchangeMarketplaceCode, upsertMarketplaceAccount }] =
      await Promise.all([
        import("@/integrations/supabase/client.server"),
        import("@/lib/facebook-marketplace.server"),
      ]);
    const page = await exchangeMarketplaceCode(data.code, data.redirectUri);
    const account = await upsertMarketplaceAccount(supabaseAdmin, data.storeId, page);
    return { id: account.id, pageId: account.page_id, pageName: account.page_name };
  });

/** Sayfa erişim anahtarını elle girerek bağlar (uygulama incelemesi öncesi). */
export const connectMarketplaceManually = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    storeScope
      .extend({
        pageId: z.string().trim().min(3),
        pageName: z.string().trim().min(1).nullable().default(null),
        catalogId: z.string().trim().min(3).nullable().default(null),
        partnerId: z.string().trim().min(3).nullable().default(null),
        accessToken: z.string().trim().min(20),
        currency: z.string().trim().length(3).default("TRY"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStoreAccess(context.supabase, data.storeId, context.userId);
    const [{ supabaseAdmin }, { upsertMarketplaceAccount }] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/facebook-marketplace.server"),
    ]);
    const account = await upsertMarketplaceAccount(supabaseAdmin, data.storeId, {
      pageId: data.pageId,
      pageName: data.pageName,
      catalogId: data.catalogId,
      partnerId: data.partnerId,
      accessToken: data.accessToken,
      currency: data.currency.toUpperCase(),
    });
    return { id: account.id, pageId: account.page_id };
  });

/** Marketplace ayarlarını günceller. */
export const updateMarketplaceSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    storeScope
      .extend({
        autoSync: z.boolean(),
        syncIntervalMinutes: z.number().int().min(15).max(1440),
        defaultCondition: z.enum(FB_CONDITIONS),
        defaultCategory: z.string().trim().max(120).nullable().default(null),
        offerShipping: z.boolean(),
        offerLocalPickup: z.boolean(),
        catalogId: z.string().trim().max(64).nullable().default(null),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStoreAccess(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase
      .from("fb_marketplace_accounts")
      .update({
        auto_sync: data.autoSync,
        sync_interval_minutes: data.syncIntervalMinutes,
        default_condition: data.defaultCondition,
        default_category: data.defaultCategory,
        offer_shipping: data.offerShipping,
        offer_local_pickup: data.offerLocalPickup,
        catalog_id: data.catalogId,
      })
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Ürünleri Marketplace ile eşitler. */
export const syncMarketplaceNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeScope.extend({ force: z.boolean().default(false) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertStoreAccess(context.supabase, data.storeId, context.userId);
    const [{ supabaseAdmin }, { syncStoreMarketplace }] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/facebook-marketplace.server"),
    ]);
    return syncStoreMarketplace(supabaseAdmin, data.storeId, {
      trigger: "manual",
      force: data.force,
    });
  });

/** Gönderilecek ilanların önizlemesini (doğrulama uyarılarıyla) verir. */
export const previewMarketplaceItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeScope.parse(data))
  .handler(async ({ data, context }) => {
    await assertStoreAccess(context.supabase, data.storeId, context.userId);
    const [{ supabaseAdmin }, { buildMarketplaceItems }] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/facebook-marketplace.server"),
    ]);
    const { data: account } = await supabaseAdmin
      .from("fb_marketplace_accounts")
      .select("*")
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (!account) throw new Error("Facebook Marketplace hesabı bağlı değil.");
    const items = await buildMarketplaceItems(supabaseAdmin, account);
    return {
      total: items.length,
      invalid: items.filter((entry) => entry.issues.length > 0).length,
      sample: items.slice(0, 12).map((entry) => ({
        retailerId: entry.item.id,
        title: entry.item.title,
        price: entry.item.price,
        currency: entry.item.currency,
        quantity: entry.item.quantity_to_sell_on_facebook,
        availability: entry.item.availability,
        issues: entry.issues,
      })),
    };
  });

/** Tek ilanı Marketplace'ten kaldırır. */
export const removeMarketplaceItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeScope.extend({ listingId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertStoreAccess(context.supabase, data.storeId, context.userId);
    const [{ supabaseAdmin }, { removeMarketplaceListing }] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/facebook-marketplace.server"),
    ]);
    return removeMarketplaceListing(supabaseAdmin, data.storeId, data.listingId);
  });

/** Bağlantıyı kaldırır (anahtarlar da silinir). */
export const disconnectMarketplace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeScope.parse(data))
  .handler(async ({ data, context }) => {
    await assertStoreAccess(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase
      .from("fb_marketplace_accounts")
      .delete()
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
