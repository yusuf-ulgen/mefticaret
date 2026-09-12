/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Mefticaret → Mefticaret mağaza aktarımı (yalnızca sunucu).
 *
 * Mevcut bir mağazanın gerçek verilerini (kategori, ürün + varyant/görsel,
 * müşteri + adres, sipariş + kalem, içerik/blog ve tema) yeni bir mağazaya
 * kopyalar. Kaynak veri hiçbir zaman değiştirilmez; hedefe yazım idempotenttir
 * (aynı kaynak kayıt ikinci kez kopyalanmaz), eşleme `migration_records`
 * tablosunda tutulur.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Db = SupabaseClient<Database>;

export type TransferEntity = "category" | "product" | "customer" | "order" | "page" | "theme";

export const TRANSFER_ENTITIES: TransferEntity[] = [
  "category",
  "product",
  "customer",
  "order",
  "page",
  "theme",
];

export const TRANSFER_LABELS: Record<TransferEntity, string> = {
  category: "Kategoriler",
  product: "Ürünler (varyant, görsel, stok)",
  customer: "Müşteriler ve adresleri",
  order: "Siparişler ve kalemleri",
  page: "İçerik sayfaları ve blog",
  theme: "Tema ve vitrin bölümleri",
};

export interface TransferTotals {
  copied: number;
  skipped: number;
  failed: number;
}

export interface TransferReport {
  dryRun: boolean;
  sourceStoreId: string;
  targetStoreId: string;
  totals: Partial<Record<TransferEntity, TransferTotals>>;
  errors: string[];
}

const MAX_ROWS = 5000;
const CHUNK = 200;

const totals = (): TransferTotals => ({ copied: 0, skipped: 0, failed: 0 });

function any(db: Db) {
  return db as unknown as { from: (table: string) => any };
}

function omit(row: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) if (!keys.includes(key)) out[key] = value;
  return out;
}

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += CHUNK) out.push(items.slice(index, index + CHUNK));
  return out;
}

async function fetchRows(db: Db, table: string, storeId: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await any(db)
    .from(table)
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: true })
    .limit(MAX_ROWS);
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

/** Kaynak kayıt kimliği → hedef kayıt kimliği eşlemesi. */
type IdMap = Map<string, string>;

async function loadMap(db: Db, targetStoreId: string, entity: string): Promise<IdMap> {
  const map: IdMap = new Map();
  const { data, error } = await any(db)
    .from("migration_records")
    .select("external_id, local_id")
    .eq("store_id", targetStoreId)
    .eq("entity", entity)
    .not("local_id", "is", null);
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as { external_id: string; local_id: string }[]) {
    map.set(row.external_id, row.local_id);
  }
  return map;
}

async function recordMap(
  db: Db,
  input: { targetStoreId: string; jobId: string | null; entity: string; pairs: [string, string][] },
): Promise<void> {
  if (!input.jobId || input.pairs.length === 0) return;
  for (const batch of chunks(input.pairs)) {
    await any(db)
      .from("migration_records")
      .insert(
        batch.map(([externalId, localId]) => ({
          store_id: input.targetStoreId,
          job_id: input.jobId,
          entity: input.entity,
          external_id: externalId,
          local_id: localId,
          action: "created",
        })),
      );
  }
}

/** Satırları hedef mağazaya ekler ve kaynak kimlik sırasına göre eşleme döner. */
async function insertRows(
  db: Db,
  table: string,
  targetStoreId: string,
  rows: { sourceId: string; payload: Record<string, unknown> }[],
): Promise<{ pairs: [string, string][]; failed: number; errors: string[] }> {
  const pairs: [string, string][] = [];
  const errors: string[] = [];
  let failed = 0;

  for (const batch of chunks(rows)) {
    const { data, error } = await any(db)
      .from(table)
      .insert(batch.map((row) => ({ ...row.payload, store_id: targetStoreId })))
      .select("id");
    if (error) {
      // Toplu ekleme başarısızsa tek tek dener; böylece tek bozuk kayıt tüm partiyi düşürmez.
      for (const row of batch) {
        const single = await any(db)
          .from(table)
          .insert({ ...row.payload, store_id: targetStoreId })
          .select("id")
          .single();
        if (single.error) {
          failed += 1;
          if (errors.length < 20) errors.push(`${table}: ${single.error.message}`);
        } else {
          pairs.push([row.sourceId, single.data.id as string]);
        }
      }
      continue;
    }
    const inserted = (data ?? []) as { id: string }[];
    inserted.forEach((item, index) => {
      const source = batch[index];
      if (source) pairs.push([source.sourceId, item.id]);
    });
  }
  return { pairs, failed, errors };
}

/* ------------------------------------------------------------------ motor */

export async function transferStoreData(
  db: Db,
  input: {
    sourceStoreId: string;
    targetStoreId: string;
    scope: TransferEntity[];
    dryRun: boolean;
    jobId?: string | null;
  },
): Promise<TransferReport> {
  const { sourceStoreId, targetStoreId, dryRun } = input;
  const jobId = input.jobId ?? null;
  const report: TransferReport = {
    dryRun,
    sourceStoreId,
    targetStoreId,
    totals: {},
    errors: [],
  };
  const scope = TRANSFER_ENTITIES.filter((entity) => input.scope.includes(entity));

  const categoryMap = await loadMap(db, targetStoreId, "category");
  const productMap = await loadMap(db, targetStoreId, "product");
  const variantMap = await loadMap(db, targetStoreId, "product_variant");
  const customerMap = await loadMap(db, targetStoreId, "customer");
  const orderMap = await loadMap(db, targetStoreId, "order");
  const pageMap = await loadMap(db, targetStoreId, "page");

  const apply = async (
    entity: TransferEntity,
    handler: (stats: TransferTotals) => Promise<void>,
  ): Promise<void> => {
    const stats = totals();
    report.totals[entity] = stats;
    try {
      await handler(stats);
    } catch (error) {
      stats.failed += 1;
      report.errors.push(`${entity}: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`);
    }
  };

  const collect = (
    stats: TransferTotals,
    result: { pairs: [string, string][]; failed: number; errors: string[] },
    map?: IdMap,
  ) => {
    stats.copied += result.pairs.length;
    stats.failed += result.failed;
    report.errors.push(...result.errors.slice(0, 10));
    if (map) for (const [source, target] of result.pairs) map.set(source, target);
  };

  /* kategoriler */
  if (scope.includes("category")) {
    await apply("category", async (stats) => {
      const rows = await fetchRows(db, "categories", sourceStoreId);
      const pending = rows.filter((row) => !categoryMap.has(String(row["id"])));
      stats.skipped += rows.length - pending.length;
      if (dryRun) {
        stats.copied += pending.length;
        return;
      }
      const result = await insertRows(
        db,
        "categories",
        targetStoreId,
        pending.map((row) => ({
          sourceId: String(row["id"]),
          payload: omit(row, ["id", "store_id", "parent_id", "path", "level", "created_at", "updated_at"]),
        })),
      );
      collect(stats, result, categoryMap);
      await recordMap(db, { targetStoreId, jobId, entity: "category", pairs: result.pairs });

      // üst kategori bağlarını ikinci geçişte kur
      for (const row of rows) {
        const parent = row["parent_id"] ? categoryMap.get(String(row["parent_id"])) : null;
        const local = categoryMap.get(String(row["id"]));
        if (parent && local) {
          await any(db).from("categories").update({ parent_id: parent }).eq("id", local).eq("store_id", targetStoreId);
        }
      }
    });
  }

  /* ürünler + görsel + varyant */
  if (scope.includes("product")) {
    await apply("product", async (stats) => {
      const rows = await fetchRows(db, "products", sourceStoreId);
      const pending = rows.filter((row) => !productMap.has(String(row["id"])));
      stats.skipped += rows.length - pending.length;
      if (dryRun) {
        stats.copied += pending.length;
        return;
      }
      const result = await insertRows(
        db,
        "products",
        targetStoreId,
        pending.map((row) => ({
          sourceId: String(row["id"]),
          payload: {
            ...omit(row, [
              "id",
              "store_id",
              "created_at",
              "updated_at",
              "brand_id",
              "vendor_id",
              "seller_id",
              "tax_class_id",
              "category_id",
              "search_vector",
            ]),
            category_id: row["category_id"] ? categoryMap.get(String(row["category_id"])) ?? null : null,
          },
        })),
      );
      collect(stats, result, productMap);
      await recordMap(db, { targetStoreId, jobId, entity: "product", pairs: result.pairs });

      const copiedIds = new Set(result.pairs.map(([sourceId]) => sourceId));
      if (copiedIds.size === 0) return;

      const images = (await fetchRows(db, "product_images", sourceStoreId)).filter((row) =>
        copiedIds.has(String(row["product_id"])),
      );
      const imageMap: IdMap = new Map();
      if (images.length > 0) {
        const imageResult = await insertRows(
          db,
          "product_images",
          targetStoreId,
          images.map((row) => ({
            sourceId: String(row["id"]),
            payload: {
              ...omit(row, ["id", "store_id", "created_at", "product_id"]),
              product_id: productMap.get(String(row["product_id"])),
            },
          })),
        );
        collect(stats, { ...imageResult, pairs: [] }, undefined);
        for (const [source, target] of imageResult.pairs) imageMap.set(source, target);
      }

      const variants = (await fetchRows(db, "product_variants", sourceStoreId)).filter((row) =>
        copiedIds.has(String(row["product_id"])),
      );
      if (variants.length > 0) {
        const variantResult = await insertRows(
          db,
          "product_variants",
          targetStoreId,
          variants.map((row) => ({
            sourceId: String(row["id"]),
            payload: {
              ...omit(row, ["id", "store_id", "created_at", "updated_at", "product_id", "image_id"]),
              product_id: productMap.get(String(row["product_id"])),
              image_id: row["image_id"] ? imageMap.get(String(row["image_id"])) ?? null : null,
            },
          })),
        );
        collect(stats, { ...variantResult, pairs: [] }, undefined);
        for (const [source, target] of variantResult.pairs) variantMap.set(source, target);
        await recordMap(db, { targetStoreId, jobId, entity: "product_variant", pairs: variantResult.pairs });
      }
    });
  }

  /* müşteriler + adresler */
  if (scope.includes("customer")) {
    await apply("customer", async (stats) => {
      const rows = await fetchRows(db, "customers", sourceStoreId);
      const pending = rows.filter((row) => !customerMap.has(String(row["id"])));
      stats.skipped += rows.length - pending.length;
      if (dryRun) {
        stats.copied += pending.length;
        return;
      }
      const result = await insertRows(
        db,
        "customers",
        targetStoreId,
        pending.map((row) => ({
          sourceId: String(row["id"]),
          payload: omit(row, ["id", "store_id", "created_at", "updated_at", "user_id", "search_vector"]),
        })),
      );
      collect(stats, result, customerMap);
      await recordMap(db, { targetStoreId, jobId, entity: "customer", pairs: result.pairs });

      const copiedIds = new Set(result.pairs.map(([sourceId]) => sourceId));
      const addresses = (await fetchRows(db, "customer_addresses", sourceStoreId)).filter((row) =>
        copiedIds.has(String(row["customer_id"])),
      );
      if (addresses.length > 0) {
        const addressResult = await insertRows(
          db,
          "customer_addresses",
          targetStoreId,
          addresses.map((row) => ({
            sourceId: String(row["id"]),
            payload: {
              ...omit(row, ["id", "store_id", "created_at", "updated_at", "customer_id"]),
              customer_id: customerMap.get(String(row["customer_id"])),
            },
          })),
        );
        collect(stats, { ...addressResult, pairs: [] }, undefined);
      }
    });
  }

  /* siparişler + kalemler */
  if (scope.includes("order")) {
    await apply("order", async (stats) => {
      const rows = await fetchRows(db, "orders", sourceStoreId);
      const pending = rows.filter((row) => !orderMap.has(String(row["id"])));
      stats.skipped += rows.length - pending.length;
      if (dryRun) {
        stats.copied += pending.length;
        return;
      }
      const result = await insertRows(
        db,
        "orders",
        targetStoreId,
        pending.map((row) => ({
          sourceId: String(row["id"]),
          payload: {
            ...omit(row, [
              "id",
              "store_id",
              "created_at",
              "updated_at",
              "customer_id",
              "market_id",
              "search_vector",
            ]),
            customer_id: row["customer_id"] ? customerMap.get(String(row["customer_id"])) ?? null : null,
          },
        })),
      );
      collect(stats, result, orderMap);
      await recordMap(db, { targetStoreId, jobId, entity: "order", pairs: result.pairs });

      const copiedIds = new Set(result.pairs.map(([sourceId]) => sourceId));
      const items = (await fetchRows(db, "order_items", sourceStoreId)).filter((row) =>
        copiedIds.has(String(row["order_id"])),
      );
      if (items.length > 0) {
        const itemResult = await insertRows(
          db,
          "order_items",
          targetStoreId,
          items.map((row) => ({
            sourceId: String(row["id"]),
            payload: {
              ...omit(row, ["id", "store_id", "created_at", "order_id", "product_id", "variant_id"]),
              order_id: orderMap.get(String(row["order_id"])),
              product_id: row["product_id"] ? productMap.get(String(row["product_id"])) ?? null : null,
              variant_id: row["variant_id"] ? variantMap.get(String(row["variant_id"])) ?? null : null,
            },
          })),
        );
        collect(stats, { ...itemResult, pairs: [] }, undefined);
      }
    });
  }

  /* içerik sayfaları ve blog */
  if (scope.includes("page")) {
    await apply("page", async (stats) => {
      const rows = await fetchRows(db, "store_pages", sourceStoreId);
      const pending = rows.filter((row) => !pageMap.has(String(row["id"])));
      stats.skipped += rows.length - pending.length;
      if (dryRun) {
        stats.copied += pending.length;
        return;
      }
      const result = await insertRows(
        db,
        "store_pages",
        targetStoreId,
        pending.map((row) => ({
          sourceId: String(row["id"]),
          payload: omit(row, [
            "id",
            "store_id",
            "created_at",
            "updated_at",
            "author_id",
            "category_id",
            "search_vector",
          ]),
        })),
      );
      collect(stats, result, pageMap);
      await recordMap(db, { targetStoreId, jobId, entity: "page", pairs: result.pairs });
    });
  }

  /* tema + vitrin bölümleri + tema ayarları */
  if (scope.includes("theme")) {
    await apply("theme", async (stats) => {
      const themeRows = await fetchRows(db, "store_themes", sourceStoreId);
      const sections = await fetchRows(db, "store_theme_sections", sourceStoreId);
      const settings = await fetchRows(db, "theme_settings", sourceStoreId);
      if (dryRun) {
        stats.copied += themeRows.length + sections.length + settings.length;
        return;
      }

      const theme = themeRows[0];
      if (theme) {
        const { error } = await any(db)
          .from("store_themes")
          .upsert(
            { ...omit(theme, ["store_id", "created_at", "updated_at"]), store_id: targetStoreId },
            { onConflict: "store_id" },
          );
        if (error) throw new Error(error.message);
        stats.copied += 1;
      }

      if (sections.length > 0) {
        await any(db).from("store_theme_sections").delete().eq("store_id", targetStoreId);
        const result = await insertRows(
          db,
          "store_theme_sections",
          targetStoreId,
          sections.map((row) => ({
            sourceId: String(row["id"]),
            payload: omit(row, ["id", "store_id", "created_at", "updated_at"]),
          })),
        );
        collect(stats, { ...result, pairs: [] }, undefined);
        stats.copied += result.pairs.length;
      }

      for (const row of settings) {
        const { error } = await any(db)
          .from("theme_settings")
          .upsert(
            { ...omit(row, ["id", "store_id", "created_at", "updated_at"]), store_id: targetStoreId },
            { onConflict: "store_id,setting_key" },
          );
        if (error) {
          stats.failed += 1;
          if (report.errors.length < 20) report.errors.push(`theme_settings: ${error.message}`);
        } else {
          stats.copied += 1;
        }
      }
    });
  }

  return report;
}
