import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { requireMarketplaceConnector } from "@/lib/marketplace";
import type {
  MarketplaceListingInput,
  MarketplaceRequestSpec,
} from "@/lib/marketplace/types";

/**
 * Pazaryeri taşıyıcı (transport) katmanı.
 *
 * Connector modülleri saf payload üretir; gerçek HTTP çağrısı burada yapılır.
 * Kanal kimlik bilgileri veritabanında tutulmaz: `config_ref` bir secret
 * referansıdır ve karşılık gelen sunucu tarafı sırrı yoksa entegrasyon
 * "kuru çalışma" (dry-run) modunda çalışır — payload üretilir, doğrulanır ve
 * yerel durum güncellenir, ancak dışarıya istek gönderilmez.
 */

type Db = SupabaseClient<Database>;

export type ChannelSyncScope = "full" | "listing" | "price" | "stock" | "orders";

export interface ChannelSyncReport {
  provider: string;
  dryRun: boolean;
  listed: number;
  priceUpdated: number;
  stockUpdated: number;
  ordersFetched: number;
  skipped: string[];
  estimatedCommissionRate: number;
}

function credentialFor(configRef: string | null): string | null {
  if (!configRef) return null;
  const key = `MARKETPLACE_${configRef.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}`;
  return process.env[key] ?? null;
}

async function dispatch(
  baseUrl: string,
  spec: MarketplaceRequestSpec,
  credential: string,
): Promise<void> {
  const url = new URL(baseUrl.replace(/\/$/, "") + spec.path);
  for (const [key, value] of Object.entries(spec.query ?? {})) url.searchParams.set(key, value);
  const response = await fetch(url, {
    method: spec.method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${credential}`,
    },
    ...(spec.body !== undefined ? { body: JSON.stringify(spec.body) } : {}),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sağlayıcı isteği başarısız [${response.status}]: ${text.slice(0, 400)}`);
  }
}

export async function runChannelSync(
  supabase: Db,
  input: { storeId: string; channelId: string; scope: ChannelSyncScope },
): Promise<ChannelSyncReport> {
  const { data: channel, error: channelError } = await supabase
    .from("marketplace_channels")
    .select("id, provider, seller_id, price_markup_rate, config_ref")
    .eq("id", input.channelId)
    .eq("store_id", input.storeId)
    .maybeSingle();
  if (channelError) throw new Error(channelError.message);
  if (!channel) throw new Error("Kanal bulunamadı");

  const connector = requireMarketplaceConnector(channel.provider);
  const credential = credentialFor(channel.config_ref);
  const dryRun = credential === null;

  const report: ChannelSyncReport = {
    provider: connector.code,
    dryRun,
    listed: 0,
    priceUpdated: 0,
    stockUpdated: 0,
    ordersFetched: 0,
    skipped: [],
    estimatedCommissionRate: connector.defaultCommissionRate,
  };

  const wants = (scope: ChannelSyncScope) => input.scope === "full" || input.scope === scope;

  if (wants("listing") || wants("price") || wants("stock")) {
    const { data: listings, error: listingError } = await supabase
      .from("channel_listings")
      .select(
        "id, product_id, status, external_id, price_override, products(id, title, description, sku, barcode, vendor, product_type, base_price, compare_at_price, currency)",
      )
      .eq("channel_id", channel.id)
      .eq("store_id", input.storeId);
    if (listingError) throw new Error(listingError.message);

    const productIds = (listings ?? []).map((row) => row.product_id);
    const stockByProduct = new Map<string, number>();
    if (productIds.length > 0) {
      const { data: variants, error: variantError } = await supabase
        .from("product_variants")
        .select("product_id, stock")
        .in("product_id", productIds);
      if (variantError) throw new Error(variantError.message);
      for (const variant of variants ?? []) {
        stockByProduct.set(
          variant.product_id,
          (stockByProduct.get(variant.product_id) ?? 0) + (variant.stock ?? 0),
        );
      }
    }

    const now = new Date().toISOString();
    for (const listing of listings ?? []) {
      const product = listing.products;
      if (!product) {
        report.skipped.push(listing.id);
        continue;
      }

      const payload: MarketplaceListingInput = {
        productId: product.id,
        title: product.title,
        description: product.description ?? null,
        sku: product.sku ?? null,
        barcode: product.barcode ?? null,
        brand: product.vendor ?? null,
        category: product.product_type ?? null,
        basePrice: Number(product.compare_at_price ?? product.base_price ?? 0),
        salePrice: Number(product.base_price ?? 0),
        currency: product.currency ?? "TRY",
        stock: stockByProduct.get(product.id) ?? 0,
        images: [],
        markupRate: Number(channel.price_markup_rate ?? 0),
        sellerId: channel.seller_id,
      };

      const externalId = listing.external_id ?? connector.externalIdFor(payload);
      const price = Number(listing.price_override ?? connector.computeChannelPrice(payload));

      try {
        if (wants("listing") && listing.status !== "listed") {
          const spec = connector.buildListingRequest(payload);
          if (!dryRun) await dispatch(connector.baseUrl, spec, credential);
          report.listed += 1;
        }
        if (wants("price") && connector.capabilities.includes("price")) {
          const spec = connector.buildPriceRequest({
            externalId,
            price,
            listPrice: payload.basePrice,
            currency: payload.currency,
          });
          if (!dryRun) await dispatch(connector.baseUrl, spec, credential);
          report.priceUpdated += 1;
        }
        if (wants("stock") && connector.capabilities.includes("stock")) {
          const spec = connector.buildStockRequest({ externalId, quantity: payload.stock });
          if (!dryRun) await dispatch(connector.baseUrl, spec, credential);
          report.stockUpdated += 1;
        }

        const { error: updateError } = await supabase
          .from("channel_listings")
          .update({
            status: "listed",
            external_id: externalId,
            last_synced_at: now,
            last_error: null,
          })
          .eq("id", listing.id)
          .eq("store_id", input.storeId);
        if (updateError) throw new Error(updateError.message);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Bilinmeyen hata";
        report.skipped.push(listing.id);
        await supabase
          .from("channel_listings")
          .update({ status: "error", last_error: message.slice(0, 500) })
          .eq("id", listing.id)
          .eq("store_id", input.storeId);
      }
    }
  }

  if (wants("orders") && connector.capabilities.includes("orders") && !dryRun) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const spec = connector.buildOrdersRequest({ sellerId: channel.seller_id, since });
    const url = new URL(connector.baseUrl.replace(/\/$/, "") + spec.path);
    for (const [key, value] of Object.entries(spec.query ?? {})) url.searchParams.set(key, value);
    const response = await fetch(url, {
      method: spec.method,
      headers: { Authorization: `Bearer ${credential}` },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Sipariş çekme başarısız [${response.status}]: ${text.slice(0, 400)}`);
    }
    const raw = (await response.json()) as unknown;
    const rows = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as { content?: unknown }).content)
        ? ((raw as { content: unknown[] }).content)
        : [];
    report.ordersFetched = rows
      .map((row) => connector.normalizeOrder((row ?? {}) as Record<string, unknown>))
      .filter((order) => order.externalId.length > 0).length;
  }

  const nowIso = new Date().toISOString();
  const { error: touchError } = await supabase
    .from("marketplace_channels")
    .update({
      last_sync_at: nowIso,
      status: dryRun ? "paused" : "connected",
      last_error: dryRun ? "Kimlik bilgisi tanımlı değil — kuru çalışma modu" : null,
    })
    .eq("id", channel.id)
    .eq("store_id", input.storeId);
  if (touchError) throw new Error(touchError.message);

  return report;
}
