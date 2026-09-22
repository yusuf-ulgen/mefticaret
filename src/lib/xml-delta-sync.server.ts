import type { SupabaseClient } from "@supabase/supabase-js";

import type { NormalizedProduct } from "./xml-import-engine.server";

type Client = SupabaseClient<never>;

export const DEFAULT_DELTA_HASH_FIELDS = ["price", "stock", "title", "images"] as const;

export type DeltaSyncConfig = {
  enabled: boolean;
  hashFields: string[];
  forceFullSyncHours: number;
};

export const DEFAULT_DELTA_SYNC_CONFIG: DeltaSyncConfig = {
  enabled: true,
  hashFields: [...DEFAULT_DELTA_HASH_FIELDS],
  forceFullSyncHours: 168,
};

const ALLOWED_HASH_FIELDS = new Set([
  "price",
  "compare_at_price",
  "cost_price",
  "stock",
  "title",
  "description",
  "images",
  "barcode",
  "sku",
  "vendor",
  "currency",
  "weight",
  "variants",
]);

/** Veritabanındaki jsonb ayarını güvenli okur; bilinmeyen alanlar atılır. */
export function parseDeltaSyncConfig(raw: unknown): DeltaSyncConfig {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rawFields = Array.isArray(source["hash_fields"])
    ? (source["hash_fields"] as unknown[])
    : Array.isArray(source["hashFields"])
      ? (source["hashFields"] as unknown[])
      : [];
  const fields = rawFields
    .map((item) => String(item).trim().toLowerCase())
    .filter((item) => ALLOWED_HASH_FIELDS.has(item));

  const hours = Number(source["force_full_sync_hours"] ?? source["forceFullSyncHours"]);

  return {
    enabled: source["enabled"] === undefined ? true : Boolean(source["enabled"]),
    hashFields: fields.length ? Array.from(new Set(fields)) : [...DEFAULT_DELTA_HASH_FIELDS],
    forceFullSyncHours:
      Number.isFinite(hours) && hours > 0 ? Math.min(Math.round(hours), 24 * 90) : 168,
  };
}

export function serializeDeltaSyncConfig(config: DeltaSyncConfig) {
  return {
    enabled: config.enabled,
    hash_fields: config.hashFields,
    force_full_sync_hours: config.forceFullSyncHours,
  };
}

function fieldValue(product: NormalizedProduct, field: string): unknown {
  switch (field) {
    case "price":
      return product.price;
    case "compare_at_price":
      return product.compareAtPrice;
    case "cost_price":
      return product.costPrice;
    case "stock":
      return product.stock;
    case "title":
      return product.title;
    case "description":
      return product.description ?? "";
    case "images":
      return product.images;
    case "barcode":
      return product.barcode ?? "";
    case "sku":
      return product.sku ?? "";
    case "vendor":
      return product.vendor ?? "";
    case "currency":
      return product.currency;
    case "weight":
      return product.weightGrams;
    case "variants":
      return product.variants.map((variant) => [
        variant.sku ?? "",
        variant.barcode ?? "",
        variant.price,
        variant.stock,
      ]);
    default:
      return "";
  }
}

/** Ürünün kritik alanlarından SHA-256 özeti üretir. */
export async function generateProductHash(
  product: NormalizedProduct,
  hashFields: string[] = [...DEFAULT_DELTA_HASH_FIELDS],
): Promise<string> {
  const payload: Record<string, unknown> = {};
  for (const field of hashFields) payload[field] = fieldValue(product, field);

  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Beslemeye ait kayıtlı özetleri ürün anahtarına göre okur. */
export async function loadProductHashes(
  admin: Client,
  input: { storeId: string; feedId: string },
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const pageSize = 1000;
  for (let page = 0; page < 60; page += 1) {
    const { data, error } = await admin
      .from("xml_product_hashes")
      .select("product_key, payload_hash")
      .eq("store_id", input.storeId)
      .eq("feed_id", input.feedId)
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) break;
    const rows = (data ?? []) as Array<{ product_key: string; payload_hash: string }>;
    for (const row of rows) out.set(row.product_key, row.payload_hash);
    if (rows.length < pageSize) break;
  }
  return out;
}

export type DeltaFilterResult = {
  /** Yazılacak ürünler (yeni + değişmiş). */
  changed: NormalizedProduct[];
  /** Ürün anahtarı → yeni özet; yazma başarılı olduktan sonra kaydedilir. */
  hashes: Map<string, string>;
  unchangedCount: number;
};

/**
 * Gelen ürünleri kayıtlı özetlerle karşılaştırır; yalnız yeni veya değişmiş
 * ürünleri döner, değişmeyenler sayılır ve veritabanı işlemi atlanır.
 */
export async function filterChangedProducts(
  items: NormalizedProduct[],
  existingHashes: Map<string, string>,
  config: DeltaSyncConfig,
): Promise<DeltaFilterResult> {
  const changed: NormalizedProduct[] = [];
  const hashes = new Map<string, string>();
  let unchangedCount = 0;

  for (const item of items) {
    const key = item.key;
    if (!key) continue;

    const currentHash = await generateProductHash(item, config.hashFields);
    hashes.set(key, currentHash);

    if (existingHashes.get(key) === currentHash) {
      unchangedCount += 1;
      continue;
    }
    changed.push(item);
  }

  return { changed, hashes, unchangedCount };
}

/** Çalışma sonrası özetleri kaydeder (ürün anahtarı başına tek satır). */
export async function saveProductHashes(
  admin: Client,
  input: { storeId: string; feedId: string; hashes: Map<string, string> },
): Promise<void> {
  const rows = Array.from(input.hashes.entries()).map(([productKey, payloadHash]) => ({
    store_id: input.storeId,
    feed_id: input.feedId,
    product_key: productKey,
    payload_hash: payloadHash,
    updated_at: new Date().toISOString(),
  }));
  if (!rows.length) return;

  for (let i = 0; i < rows.length; i += 500) {
    await admin
      .from("xml_product_hashes")
      .upsert(rows.slice(i, i + 500) as never, { onConflict: "feed_id,product_key" });
  }
}

/** Zorunlu tam senkronizasyon zamanı geldi mi? */
export function needsFullSync(
  config: DeltaSyncConfig,
  lastFullSyncAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!config.enabled) return true;
  if (!lastFullSyncAt) return true;
  const last = new Date(lastFullSyncAt).getTime();
  if (!Number.isFinite(last)) return true;
  return now.getTime() - last >= config.forceFullSyncHours * 3600_000;
}
