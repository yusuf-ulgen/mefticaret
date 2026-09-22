/**
 * Dışa aktarım motoru — mağaza ürünlerinden pazaryeri XML'i üretir,
 * dosyayı depoya yazar ve çalışma kaydını tutar.
 *
 * Yalnızca sunucuda çalışır (service_role istemcisi ile çağrılır).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  generateExportXml,
  type ExportProduct,
  type GeneratedExport,
} from "@/lib/xml-export-generators";
import type { XmlPlatform } from "@/lib/xml-integrator";

export const EXPORT_BUCKET = "store-media";
const MAX_PRODUCTS = 5_000;

export type ExportFeedRecord = {
  id: string;
  storeId: string;
  platform: XmlPlatform;
  currency: string | null;
  priceMarkup: number | null;
  outputFilename: string | null;
  exportToken: string | null;
  filterRules?: unknown;
};

export type ExportRunResult = {
  included: number;
  skipped: number;
  fileSizeBytes: number;
  issues: Array<{ productId: string; title: string; reason: string }>;
  storagePath: string;
  publicUrl: string | null;
  xml: string;
};

const publicBase = () => process.env["PUBLIC_SITE_URL"] ?? "https://mefticaret.com";

/** Depodaki görsel yolunu herkese açık HTTPS adresine çevirir. */
export const publicImageUrl = (storagePath: string) =>
  `${publicBase()}/api/public/product-image/${storagePath.split("/").map(encodeURIComponent).join("/")}`;

/** Dışa aktarım beslemesinin herkese açık besleme adresi. */
export const feedPublicUrl = (token: string) => `${publicBase()}/api/public/xml-feed/${token}`;

const httpsOnly = (url: string | null | undefined) =>
  url && /^https:\/\//i.test(url) ? url : null;

/** Mağazanın yayına uygun ürünlerini dışa aktarım biçimine çevirir. */
export async function collectExportProducts(
  admin: SupabaseClient,
  storeId: string,
  options: { priceMarkup?: number | null; currency?: string | null } = {},
): Promise<{ products: ExportProduct[]; storeName: string; storeUrl: string | null; currency: string }> {
  const [{ data: store }, { data: productRows, error }] = await Promise.all([
    admin.from("stores").select("id, name, slug, currency").eq("id", storeId).maybeSingle(),
    admin
      .from("products")
      .select(
        "id, title, slug, description, sku, barcode, base_price, compare_at_price, currency, tax_rate, weight_grams, vendor, product_type, variant_options, category_id, track_inventory",
      )
      .eq("store_id", storeId)
      .eq("status", "active")
      .limit(MAX_PRODUCTS),
  ]);
  if (error) throw new Error(error.message);
  if (!store) throw new Error("Mağaza bulunamadı");

  const products = productRows ?? [];
  const ids = products.map((row) => String((row as Record<string, unknown>)["id"]));
  const categoryIds = Array.from(
    new Set(
      products
        .map((row) => (row as Record<string, unknown>)["category_id"])
        .filter((value): value is string => typeof value === "string"),
    ),
  );

  const [{ data: images }, { data: variants }, { data: categories }] = await Promise.all([
    ids.length
      ? admin
          .from("product_images")
          .select("product_id, url, storage_path, position")
          .in("product_id", ids)
          .order("position", { ascending: true })
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    ids.length
      ? admin
          .from("product_variants")
          .select("id, product_id, title, sku, barcode, price, stock, weight_grams, options")
          .in("product_id", ids)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    categoryIds.length
      ? admin.from("categories").select("id, name").in("id", categoryIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const imagesByProduct = new Map<string, string[]>();
  for (const row of (images ?? []) as Array<Record<string, unknown>>) {
    const productId = String(row["product_id"]);
    const storagePath = row["storage_path"] as string | null;
    const url = storagePath ? publicImageUrl(storagePath) : httpsOnly(row["url"] as string | null);
    if (!url) continue;
    const list = imagesByProduct.get(productId) ?? [];
    list.push(url);
    imagesByProduct.set(productId, list);
  }

  const variantsByProduct = new Map<string, Array<Record<string, unknown>>>();
  for (const row of (variants ?? []) as Array<Record<string, unknown>>) {
    const productId = String(row["product_id"]);
    const list = variantsByProduct.get(productId) ?? [];
    list.push(row);
    variantsByProduct.set(productId, list);
  }

  const categoryNames = new Map<string, string>();
  for (const row of (categories ?? []) as Array<Record<string, unknown>>) {
    categoryNames.set(String(row["id"]), String(row["name"] ?? ""));
  }

  const markup = options.priceMarkup ?? null;
  const applyMarkup = (price: number) => (markup === null ? price : price * (1 + markup / 100));
  const storeCurrency = (options.currency || (store as Record<string, unknown>)["currency"] || "TRY") as string;
  const storeSlug = String((store as Record<string, unknown>)["slug"] ?? "");
  const storeUrl = storeSlug ? `${publicBase()}/s/${storeSlug}` : null;

  const optionsOf = (value: unknown): Record<string, string> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const result: Record<string, string> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (typeof raw === "string" || typeof raw === "number") result[key] = String(raw);
    }
    return result;
  };

  const list: ExportProduct[] = [];
  for (const raw of products as Array<Record<string, unknown>>) {
    const productId = String(raw["id"]);
    const basePrice = Number(raw["base_price"] ?? 0);
    const productImages = imagesByProduct.get(productId) ?? [];
    const categoryName = categoryNames.get(String(raw["category_id"] ?? "")) ?? (raw["product_type"] as string | null);
    const productSlug = String(raw["slug"] ?? "");
    const productUrl = storeUrl && productSlug ? `${storeUrl}/p/${productSlug}` : null;
    const rows = variantsByProduct.get(productId) ?? [];

    const common = {
      description: (raw["description"] as string | null) ?? null,
      brand: (raw["vendor"] as string | null) ?? null,
      categoryName: categoryName ?? null,
      currency: String(raw["currency"] ?? storeCurrency).toUpperCase(),
      taxRate: Number(raw["tax_rate"] ?? 20),
      images: productImages,
      productUrl,
    };

    if (rows.length === 0) {
      list.push({
        id: productId,
        sku: (raw["sku"] as string | null) ?? null,
        barcode: (raw["barcode"] as string | null) ?? null,
        title: String(raw["title"] ?? ""),
        price: applyMarkup(basePrice),
        compareAtPrice: raw["compare_at_price"] === null ? null : applyMarkup(Number(raw["compare_at_price"])),
        stock: raw["track_inventory"] ? 0 : 999,
        weightGrams: raw["weight_grams"] === null ? null : Number(raw["weight_grams"]),
        options: optionsOf(raw["variant_options"]),
        ...common,
      });
      continue;
    }

    for (const variant of rows) {
      const variantTitle = String(variant["title"] ?? "").trim();
      list.push({
        id: String(variant["id"]),
        sku: (variant["sku"] as string | null) ?? (raw["sku"] as string | null) ?? null,
        barcode: (variant["barcode"] as string | null) ?? (raw["barcode"] as string | null) ?? null,
        title: variantTitle ? `${String(raw["title"])} - ${variantTitle}` : String(raw["title"] ?? ""),
        price: applyMarkup(Number(variant["price"] ?? basePrice)),
        compareAtPrice: raw["compare_at_price"] === null ? null : applyMarkup(Number(raw["compare_at_price"])),
        stock: Math.max(0, Number(variant["stock"] ?? 0)),
        weightGrams:
          variant["weight_grams"] === null || variant["weight_grams"] === undefined
            ? raw["weight_grams"] === null
              ? null
              : Number(raw["weight_grams"])
            : Number(variant["weight_grams"]),
        options: optionsOf(variant["options"]),
        ...common,
      });
    }
  }

  return {
    products: list,
    storeName: String((store as Record<string, unknown>)["name"] ?? "Mağaza"),
    storeUrl,
    currency: storeCurrency.toUpperCase(),
  };
}

/** Beslemenin XML'ini üretir (depoya yazmadan). */
export async function buildExportXml(
  admin: SupabaseClient,
  feed: ExportFeedRecord,
): Promise<GeneratedExport & { storeName: string }> {
  const { products, storeName, storeUrl, currency } = await collectExportProducts(admin, feed.storeId, {
    priceMarkup: feed.priceMarkup,
    currency: feed.currency,
  });

  const generated = generateExportXml(feed.platform, products, {
    storeName,
    storeUrl,
    currency,
    generatedAt: new Date().toISOString(),
  });

  return { ...generated, storeName };
}

const safeFilename = (name: string | null, platform: string) => {
  const base = (name ?? `${platform}-feed.xml`).replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 80);
  return base.toLowerCase().endsWith(".xml") ? base : `${base}.xml`;
};

/**
 * Beslemeyi çalıştırır: XML üretir, depoya yazar, çalışma kaydını ve
 * beslemenin durumunu güncelller.
 */
export async function runExportFeed(
  admin: SupabaseClient,
  feed: ExportFeedRecord,
  options: { trigger: "manual" | "scheduled" | "api"; nextRunAt?: string | null },
): Promise<ExportRunResult> {
  const startedAt = new Date();
  const { data: logRow, error: logError } = await admin
    .from("xml_export_logs")
    .insert({
      store_id: feed.storeId,
      feed_id: feed.id,
      status: "running",
      trigger: options.trigger,
      started_at: startedAt.toISOString(),
    })
    .select("id")
    .single();
  if (logError) throw new Error(logError.message);
  const logId = String((logRow as Record<string, unknown>)["id"]);

  const finish = async (
    status: "success" | "partial" | "failed",
    payload: Record<string, unknown>,
  ) => {
    const finishedAt = new Date();
    await admin
      .from("xml_export_logs")
      .update({
        status,
        finished_at: finishedAt.toISOString(),
        duration_seconds: (finishedAt.getTime() - startedAt.getTime()) / 1000,
        ...payload,
      })
      .eq("id", logId);
    await admin
      .from("xml_feeds")
      .update({
        last_run_at: finishedAt.toISOString(),
        last_status: status,
        last_error: (payload["error_message"] as string | null) ?? null,
        next_run_at: options.nextRunAt ?? null,
      })
      .eq("id", feed.id);
  };

  try {
    const generated = await buildExportXml(admin, feed);
    const filename = safeFilename(feed.outputFilename, feed.platform);
    const storagePath = `${feed.storeId}/xml-exports/${feed.id}/${filename}`;
    const bytes = new TextEncoder().encode(generated.xml);

    const { error: uploadError } = await admin.storage.from(EXPORT_BUCKET).upload(storagePath, bytes, {
      contentType: "application/xml; charset=utf-8",
      cacheControl: "300",
      upsert: true,
    });
    if (uploadError) throw new Error(`Dosya depoya yazılamadı: ${uploadError.message}`);

    const publicUrl = feed.exportToken ? feedPublicUrl(feed.exportToken) : null;
    const status = generated.skipped > 0 ? "partial" : "success";

    await finish(status, {
      exported_count: generated.included,
      failed_count: generated.skipped,
      file_size_bytes: bytes.byteLength,
      output_url: publicUrl,
      issues: generated.issues.slice(0, 50),
      error_message: null,
    });

    return {
      included: generated.included,
      skipped: generated.skipped,
      fileSizeBytes: bytes.byteLength,
      issues: generated.issues,
      storagePath,
      publicUrl,
      xml: generated.xml,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    await finish("failed", { exported_count: 0, failed_count: 0, error_message: message.slice(0, 500) });
    throw error;
  }
}
