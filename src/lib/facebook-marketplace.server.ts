import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  FB_GRAPH_VERSION,
  FB_MARKETPLACE_SCOPES,
  formatPrice,
  payloadHash,
  plainDescription,
  retailerId,
  validateItem,
  type FbBatchRequest,
  type FbCondition,
  type FbItemPayload,
} from "@/lib/facebook-marketplace";

/**
 * Facebook Marketplace (Partnerships Item API) servis katmanı — yalnızca sunucu.
 *
 * Akış: mağaza ürünleri → Item payload eşlemesi → `items_batch` toplu gönderim
 * → `fb_marketplace_listings` ilan durumu + `fb_marketplace_sync_runs` özeti.
 * Erişim anahtarları `fb_marketplace_credentials` tablosunda tutulur; bu tablonun
 * authenticated politikası yoktur, panel istemcisi anahtarları hiç göremez.
 */

type Admin = SupabaseClient<Database>;
type ListingPayload = Database["public"]["Tables"]["fb_marketplace_listings"]["Row"]["payload"];

const asPayload = (item: FbItemPayload): ListingPayload => item as unknown as ListingPayload;

export type FbAccount = Database["public"]["Tables"]["fb_marketplace_accounts"]["Row"];

const GRAPH = `https://graph.facebook.com/${FB_GRAPH_VERSION}`;
const BATCH_SIZE = 50;

export function metaMarketplaceConfig() {
  return {
    appId: process.env["META_APP_ID"] ?? null,
    appSecret: process.env["META_APP_SECRET"] ?? null,
  };
}

export function buildMarketplaceOAuthUrl(redirectUri: string, state: string): string {
  const { appId } = metaMarketplaceConfig();
  if (!appId) throw new Error("Meta uygulama kimliği (META_APP_ID) tanımlı değil.");
  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", FB_MARKETPLACE_SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  return url.toString();
}

async function graphFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; token: string },
): Promise<T> {
  const method = options.method ?? "GET";
  const url = new URL(`${GRAPH}${path}`);
  const init: RequestInit = { method };
  if (method === "GET") {
    url.searchParams.set("access_token", options.token);
  } else {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify({ ...(options.body as object), access_token: options.token });
  }
  const response = await fetch(url.toString(), init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Facebook API hatası (${response.status}): ${text.slice(0, 400)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/** OAuth kodunu uzun ömürlü kullanıcı anahtarına çevirir ve sayfaları listeler. */
export async function exchangeMarketplaceCode(code: string, redirectUri: string) {
  const { appId, appSecret } = metaMarketplaceConfig();
  if (!appId || !appSecret) throw new Error("Meta uygulama bilgileri tanımlı değil.");

  const tokenUrl = new URL(`${GRAPH}/oauth/access_token`);
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);
  const tokenResponse = await fetch(tokenUrl.toString());
  const tokenText = await tokenResponse.text();
  if (!tokenResponse.ok) {
    throw new Error(`Facebook anahtar değişimi başarısız: ${tokenText.slice(0, 300)}`);
  }
  const { access_token: userToken } = JSON.parse(tokenText) as { access_token: string };

  const pages = await graphFetch<{
    data?: Array<{ id: string; name?: string; access_token?: string }>;
  }>("/me/accounts?fields=id,name,access_token", { token: userToken });

  const page = pages.data?.[0];
  if (!page?.access_token) {
    throw new Error("Bu hesapta yönetebildiğin bir Facebook sayfası bulunamadı.");
  }
  return {
    pageId: page.id,
    pageName: page.name ?? null,
    accessToken: page.access_token,
  };
}

/** Hesabı ve (sunucu-only) erişim anahtarını kaydeder. */
export async function upsertMarketplaceAccount(
  admin: Admin,
  storeId: string,
  input: {
    pageId: string;
    pageName?: string | null;
    catalogId?: string | null;
    partnerId?: string | null;
    accessToken: string;
    currency?: string;
  },
): Promise<FbAccount> {
  const { data: account, error } = await admin
    .from("fb_marketplace_accounts")
    .upsert(
      {
        store_id: storeId,
        page_id: input.pageId,
        page_name: input.pageName ?? null,
        catalog_id: input.catalogId ?? null,
        partner_id: input.partnerId ?? null,
        status: "connected",
        last_error: null,
        ...(input.currency ? { currency: input.currency } : {}),
      },
      { onConflict: "store_id" },
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const { error: credError } = await admin.from("fb_marketplace_credentials").upsert(
    {
      account_id: account.id,
      store_id: storeId,
      access_token: input.accessToken,
      token_type: "page",
    },
    { onConflict: "account_id" },
  );
  if (credError) throw new Error(credError.message);

  return account;
}

async function accountToken(admin: Admin, accountId: string): Promise<string | null> {
  const { data } = await admin
    .from("fb_marketplace_credentials")
    .select("access_token")
    .eq("account_id", accountId)
    .maybeSingle();
  return data?.access_token ?? null;
}

/* ------------------------------------------------------------------ */
/* Ürün → Item eşlemesi                                                */
/* ------------------------------------------------------------------ */

type BuiltItem = { item: FbItemPayload; productId: string; variantId: string | null; issues: string[] };

/** Mağazanın yayınlanabilir ürünlerini Item API payload'larına dönüştürür. */
export async function buildMarketplaceItems(
  admin: Admin,
  account: FbAccount,
): Promise<BuiltItem[]> {
  const [{ data: store }, { data: products }] = await Promise.all([
    admin.from("stores").select("slug, name, currency").eq("id", account.store_id).maybeSingle(),
    admin
      .from("products")
      .select(
        "id, title, slug, description, base_price, currency, status, track_inventory, vendor, product_type",
      )
      .eq("store_id", account.store_id)
      .eq("status", "active")
      .limit(2000),
  ]);
  if (!store || !products || products.length === 0) return [];

  const productIds = products.map((row) => row.id);
  const [{ data: images }, { data: variants }] = await Promise.all([
    admin
      .from("product_images")
      .select("product_id, url, position")
      .in("product_id", productIds)
      .order("position", { ascending: true }),
    admin
      .from("product_variants")
      .select("id, product_id, title, sku, price, stock")
      .in("product_id", productIds),
  ]);

  const imagesByProduct = new Map<string, string[]>();
  for (const image of images ?? []) {
    const list = imagesByProduct.get(image.product_id) ?? [];
    if (image.url) list.push(image.url);
    imagesByProduct.set(image.product_id, list);
  }
  const variantsByProduct = new Map<string, NonNullable<typeof variants>>();
  for (const variant of variants ?? []) {
    const list = variantsByProduct.get(variant.product_id) ?? [];
    list.push(variant);
    variantsByProduct.set(variant.product_id, list as NonNullable<typeof variants>);
  }

  const base = process.env["PUBLIC_SITE_URL"] ?? "https://mefticaret.lovable.app";
  const condition = (account.default_condition as FbCondition) ?? "new";
  const currency = (account.currency || store.currency || "TRY").toUpperCase();

  const built: BuiltItem[] = [];
  for (const product of products) {
    const productImages = imagesByProduct.get(product.id) ?? [];
    const link = `${base}/s/${store.slug}/p/${product.slug}`;
    const description = plainDescription(product.description, `${product.title} — ${store.name}`);
    const productVariants = variantsByProduct.get(product.id) ?? [];
    const rows =
      productVariants.length > 0
        ? productVariants.map((variant) => ({
            variantId: variant.id,
            title: `${product.title} - ${variant.title}`,
            price: Number(variant.price ?? product.base_price ?? 0),
            stock: variant.stock ?? 0,
          }))
        : [
            {
              variantId: null as string | null,
              title: product.title,
              price: Number(product.base_price ?? 0),
              stock: product.track_inventory ? 0 : 999,
            },
          ];

    for (const row of rows) {
      const quantity = product.track_inventory ? Math.max(0, row.stock) : 999;
      const item: FbItemPayload = {
        id: retailerId(product.id, row.variantId),
        title: row.title.slice(0, 150),
        description,
        availability: quantity > 0 ? "in stock" : "out of stock",
        condition,
        price: formatPrice(row.price),
        currency,
        link,
        image_url: productImages[0] ?? "",
        ...(productImages.length > 1 ? { additional_image_urls: productImages.slice(1, 10) } : {}),
        ...(product.vendor ? { brand: product.vendor } : {}),
        ...(account.default_category || product.product_type
          ? { category: account.default_category ?? (product.product_type as string) }
          : {}),
        quantity_to_sell_on_facebook: quantity,
        offer_shipping: account.offer_shipping,
        offer_local_pickup: account.offer_local_pickup,
      };
      built.push({
        item,
        productId: product.id,
        variantId: row.variantId,
        issues: validateItem(item),
      });
    }
  }
  return built;
}

/* ------------------------------------------------------------------ */
/* Toplu gönderim                                                      */
/* ------------------------------------------------------------------ */

async function sendBatch(
  target: string,
  token: string,
  requests: FbBatchRequest[],
): Promise<{ ok: boolean; error: string | null; handles: string[] }> {
  try {
    const result = await graphFetch<{ handles?: string[]; validation_status?: unknown[] }>(
      `/${target}/items_batch`,
      {
        method: "POST",
        token,
        body: {
          item_type: "MARKETPLACE_ITEM",
          allow_upsert: true,
          requests,
        },
      },
    );
    return { ok: true, error: null, handles: result.handles ?? [] };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Bilinmeyen Facebook hatası",
      handles: [],
    };
  }
}

export type SyncSummary = {
  runId: string;
  total: number;
  created: number;
  updated: number;
  failed: number;
  skipped: number;
  error: string | null;
};

/** Mağazanın tüm aktif ürünlerini Marketplace ile eşitler. */
export async function syncStoreMarketplace(
  admin: Admin,
  storeId: string,
  options: { trigger?: string; force?: boolean } = {},
): Promise<SyncSummary> {
  const { data: account } = await admin
    .from("fb_marketplace_accounts")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();
  if (!account) throw new Error("Facebook Marketplace hesabı bağlı değil.");

  const { data: run, error: runError } = await admin
    .from("fb_marketplace_sync_runs")
    .insert({
      store_id: storeId,
      account_id: account.id,
      status: "running",
      trigger_source: options.trigger ?? "manual",
    })
    .select("id")
    .single();
  if (runError) throw new Error(runError.message);

  const summary: SyncSummary = {
    runId: run.id,
    total: 0,
    created: 0,
    updated: 0,
    failed: 0,
    skipped: 0,
    error: null,
  };

  try {
    const token = await accountToken(admin, account.id);
    const target = account.catalog_id ?? account.partner_id ?? account.page_id;
    const built = await buildMarketplaceItems(admin, account);
    summary.total = built.length;

    const { data: existing } = await admin
      .from("fb_marketplace_listings")
      .select("id, retailer_id, payload_hash, fb_item_id")
      .eq("account_id", account.id);
    const existingByRetailer = new Map((existing ?? []).map((row) => [row.retailer_id, row]));

    const pending: BuiltItem[] = [];
    for (const entry of built) {
      const previous = existingByRetailer.get(entry.item.id);
      const hash = payloadHash(entry.item);
      if (entry.issues.length > 0) {
        summary.failed += 1;
        await admin.from("fb_marketplace_listings").upsert(
          {
            store_id: storeId,
            account_id: account.id,
            product_id: entry.productId,
            variant_id: entry.variantId,
            retailer_id: entry.item.id,
            status: "error",
            last_error: entry.issues.join(" "),
            price: Number(entry.item.price),
            quantity: entry.item.quantity_to_sell_on_facebook,
            payload: asPayload(entry.item),
          },
          { onConflict: "account_id,retailer_id" },
        );
        continue;
      }
      if (!options.force && previous?.payload_hash === hash && previous.fb_item_id) {
        summary.skipped += 1;
        continue;
      }
      pending.push(entry);
      if (previous) summary.updated += 1;
      else summary.created += 1;
    }

    for (let index = 0; index < pending.length; index += BATCH_SIZE) {
      const chunk = pending.slice(index, index + BATCH_SIZE);
      const requests: FbBatchRequest[] = chunk.map((entry) => ({
        method: "UPDATE",
        data: entry.item,
      }));
      const result = token
        ? await sendBatch(target, token, requests)
        : { ok: false, error: "Facebook erişim anahtarı tanımlı değil.", handles: [] };

      const rows = chunk.map((entry) => ({
        store_id: storeId,
        account_id: account.id,
        product_id: entry.productId,
        variant_id: entry.variantId,
        retailer_id: entry.item.id,
        status: (result.ok ? "listed" : "error") as Database["public"]["Enums"]["listing_status"],
        payload_hash: result.ok ? payloadHash(entry.item) : null,
        fb_item_id: result.ok ? entry.item.id : null,
        price: Number(entry.item.price),
        quantity: entry.item.quantity_to_sell_on_facebook,
        last_synced_at: new Date().toISOString(),
        last_error: result.error,
        payload: asPayload(entry.item),
      }));
      await admin.from("fb_marketplace_listings").upsert(rows, { onConflict: "account_id,retailer_id" });

      if (!result.ok) {
        summary.failed += chunk.length;
        summary.error = result.error;
      }
    }

    await admin
      .from("fb_marketplace_accounts")
      .update({
        last_sync_at: new Date().toISOString(),
        last_error: summary.error,
        status: summary.error ? "error" : "connected",
      })
      .eq("id", account.id);

    await admin
      .from("fb_marketplace_sync_runs")
      .update({
        status: summary.error ? "failed" : "success",
        total_items: summary.total,
        created_items: summary.created,
        updated_items: summary.updated,
        failed_items: summary.failed,
        error: summary.error,
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id);

    return summary;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Bilinmeyen hata";
    await admin
      .from("fb_marketplace_sync_runs")
      .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
      .eq("id", run.id);
    await admin
      .from("fb_marketplace_accounts")
      .update({ status: "error", last_error: message })
      .eq("id", account.id);
    throw cause;
  }
}

/** Tek bir ilanı Marketplace'ten kaldırır. */
export async function removeMarketplaceListing(
  admin: Admin,
  storeId: string,
  listingId: string,
): Promise<{ removed: boolean; error: string | null }> {
  const { data: listing } = await admin
    .from("fb_marketplace_listings")
    .select("id, account_id, retailer_id")
    .eq("id", listingId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!listing) throw new Error("İlan bulunamadı.");

  const { data: account } = await admin
    .from("fb_marketplace_accounts")
    .select("*")
    .eq("id", listing.account_id)
    .maybeSingle();
  if (!account) throw new Error("Marketplace hesabı bulunamadı.");

  const token = await accountToken(admin, account.id);
  const target = account.catalog_id ?? account.partner_id ?? account.page_id;
  const result = token
    ? await sendBatch(target, token, [{ method: "DELETE", data: { id: listing.retailer_id } }])
    : { ok: false, error: "Facebook erişim anahtarı tanımlı değil.", handles: [] };

  await admin
    .from("fb_marketplace_listings")
    .update({
      status: result.ok ? "removed" : "error",
      last_error: result.error,
      fb_item_id: null,
      payload_hash: null,
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", listing.id);

  return { removed: result.ok, error: result.error };
}

/** Otomatik eşitleme zamanı gelen mağazaları işler (cron worker). */
export async function runDueMarketplaceSyncs(admin: Admin, limit = 10) {
  const { data: accounts } = await admin
    .from("fb_marketplace_accounts")
    .select("store_id, sync_interval_minutes, last_sync_at")
    .eq("auto_sync", true)
    .neq("status", "disconnected")
    .limit(limit);

  const now = Date.now();
  const results: Array<{ storeId: string; ok: boolean; error?: string }> = [];
  for (const account of accounts ?? []) {
    const due =
      !account.last_sync_at ||
      now - new Date(account.last_sync_at).getTime() >= account.sync_interval_minutes * 60_000;
    if (!due) continue;
    try {
      await syncStoreMarketplace(admin, account.store_id, { trigger: "cron" });
      results.push({ storeId: account.store_id, ok: true });
    } catch (cause) {
      results.push({
        storeId: account.store_id,
        ok: false,
        error: cause instanceof Error ? cause.message : "unknown_error",
      });
    }
  }
  return { processed: results.length, results };
}
