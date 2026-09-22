/**
 * XML Entegratör v2 — dışa aktarım (EXPORT) motoru.
 *
 * Mağaza ürünlerini pazaryeri XML formatlarına çevirir, çalıştırma kaydı tutar
 * ve çıktıyı genel akış adresi üzerinden sunar. Tenant izolasyonu çağıranın
 * RLS bağlamıyla (veya cron için service_role + store_id filtresi) sağlanır.
 */

import {
  buildMarketplaceXml,
  resolveOutputFilename,
  type ExportPlatform,
  type ExportProduct,
  type ExportResult,
} from "@/lib/xml-export";
import { applyFieldTransforms, type TransformRules } from "@/lib/xml-transform";

type Client = { from: (table: string) => any };

export type ExportFeedRow = {
  id: string;
  store_id: string;
  name: string;
  platform: string;
  direction: string;
  output_filename: string | null;
  output_target: string;
  transform_rules: TransformRules | null;
  category_map: Record<string, string> | null;
  filter_rules: { only_in_stock?: boolean; min_price?: number; max_price?: number; categories?: string[] } | null;
  export_token: string;
  schedule: string;
};

const PLATFORMS: ExportPlatform[] = ["trendyol", "hepsiburada", "n11", "amazon", "xml_generic"];

export const normalizePlatform = (value: string): ExportPlatform =>
  (PLATFORMS as string[]).includes(value) ? (value as ExportPlatform) : "xml_generic";

/** Mağaza ürünlerini dışa aktarım modeline çevirir. */
export async function loadExportProducts(
  supabase: Client,
  input: {
    storeId: string;
    storeSlug: string;
    origin: string;
    currency: string;
    categoryMap: Record<string, string>;
    transformRules: TransformRules | null;
    filters: ExportFeedRow["filter_rules"];
    limit?: number;
  },
): Promise<ExportProduct[]> {
  const { data: products, error } = await supabase
    .from("products")
    .select(
      "id, title, slug, description, sku, barcode, vendor, base_price, compare_at_price, currency, tax_rate, weight_grams, category_id, categories(name), product_variants(id, title, sku, barcode, price, compare_at_price, stock, options)",
    )
    .eq("store_id", input.storeId)
    .eq("status", "active")
    .limit(Math.min(input.limit ?? 5000, 5000));
  if (error) throw new Error(error.message);

  const rows = (products ?? []) as Array<Record<string, any>>;
  const ids = rows.map((row) => String(row["id"]));
  const images: Record<string, string[]> = {};
  if (ids.length) {
    const { data: imageRows } = await supabase
      .from("product_images")
      .select("product_id, url, position")
      .in("product_id", ids)
      .order("position");
    for (const image of (imageRows ?? []) as Array<{ product_id: string; url: string | null }>) {
      if (!image.url) continue;
      (images[image.product_id] ??= []).push(image.url);
    }
  }

  const filters = input.filters ?? {};
  const out: ExportProduct[] = [];

  for (const row of rows) {
    const variantRows = (row["product_variants"] ?? []) as Array<Record<string, any>>;
    const stock = variantRows.length
      ? variantRows.reduce((sum, variant) => sum + Number(variant["stock"] ?? 0), 0)
      : 0;
    const price = Number(row["base_price"] ?? 0);
    const categoryName = (row["categories"]?.name as string | undefined) ?? "";

    if (filters.only_in_stock && stock <= 0) continue;
    if (filters.min_price !== undefined && price < filters.min_price) continue;
    if (filters.max_price !== undefined && price > filters.max_price) continue;
    if (filters.categories?.length && !filters.categories.includes(String(row["category_id"] ?? ""))) continue;

    const base: ExportProduct = {
      id: String(row["id"]),
      title: String(row["title"] ?? ""),
      sku: (row["sku"] as string | null) ?? null,
      barcode: (row["barcode"] as string | null) ?? null,
      description: String(row["description"] ?? row["title"] ?? "").slice(0, 8000),
      brand: (row["vendor"] as string | null) ?? null,
      category: categoryName,
      categoryId: input.categoryMap[String(row["category_id"] ?? "")] ?? null,
      price,
      listPrice: row["compare_at_price"] ? Number(row["compare_at_price"]) : null,
      currency: String(row["currency"] ?? input.currency ?? "TRY"),
      taxRate: row["tax_rate"] === null || row["tax_rate"] === undefined ? null : Number(row["tax_rate"]),
      stock,
      link: `${input.origin}/s/${input.storeSlug}/p/${String(row["slug"] ?? "")}`,
      images: images[String(row["id"])] ?? [],
      weight: row["weight_grams"] ? Number(row["weight_grams"]) / 1000 : null,
      variants: variantRows.map((variant) => {
        const options = variant["options"];
        const optionPairs: Array<{ name: string; value: string }> = options && typeof options === "object" && !Array.isArray(options)
          ? Object.entries(options as Record<string, unknown>).map(([name, value]) => ({ name, value: String(value) }))
          : [];
        return {
          sku: String(variant["sku"] ?? `${row["sku"] ?? row["id"]}-${variant["id"]}`),
          barcode: (variant["barcode"] as string | null) ?? null,
          title: String(variant["title"] ?? ""),
          price: Number(variant["price"] ?? price),
          listPrice: variant["compare_at_price"] ? Number(variant["compare_at_price"]) : null,
          stock: Number(variant["stock"] ?? 0),
          options: optionPairs,
        };
      }),
    };

    // Alan bazlı dönüşüm kuralları (başlık kısaltma, KDV, şablon vb.)
    const transformed = input.transformRules
      ? (applyFieldTransforms(base as unknown as Record<string, unknown>, input.transformRules) as unknown as ExportProduct)
      : base;
    transformed.price = Number(transformed.price) || 0;
    transformed.stock = Math.max(0, Math.round(Number(transformed.stock) || 0));
    out.push(transformed);
  }

  return out;
}

/** Bir dışa aktarım beslemesini üretir (kayıt tutmadan). */
export async function generateExportXml(
  supabase: Client,
  feed: ExportFeedRow,
  context: { storeName: string; storeSlug: string; storeCurrency: string; origin: string; limit?: number },
): Promise<ExportResult & { filename: string; platform: ExportPlatform }> {
  const platform = normalizePlatform(feed.platform);
  const products = await loadExportProducts(supabase, {
    storeId: feed.store_id,
    storeSlug: context.storeSlug,
    origin: context.origin,
    currency: context.storeCurrency,
    categoryMap: feed.category_map ?? {},
    transformRules: feed.transform_rules ?? null,
    filters: feed.filter_rules ?? null,
    ...(context.limit === undefined ? {} : { limit: context.limit }),
  });

  const result = buildMarketplaceXml(platform, products, {
    storeName: context.storeName,
    storeUrl: `${context.origin}/s/${context.storeSlug}`,
  });

  return { ...result, filename: resolveOutputFilename(feed.output_filename, platform), platform };
}

/** Dışa aktarımı çalıştırır, çalıştırma kaydı ve besleme özetini günceller. */
export async function runExportFeed(
  supabase: Client,
  feed: ExportFeedRow,
  context: { storeName: string; storeSlug: string; storeCurrency: string; origin: string },
  trigger: "manual" | "scheduled" = "manual",
): Promise<{ runId: string; exported: number; failed: number; outputUrl: string; xml: string }> {
  const startedAt = Date.now();
  const { data: run, error: runError } = await supabase
    .from("supplier_feed_runs")
    .insert({
      store_id: feed.store_id,
      feed_id: feed.id,
      status: "running",
      trigger,
      direction: "export",
    })
    .select("id")
    .single();
  if (runError) throw new Error(runError.message);
  const runId = String((run as { id: string }).id);

  try {
    const result = await generateExportXml(supabase, feed, context);
    const bytes = new TextEncoder().encode(result.xml).length;
    const outputUrl = `${context.origin}/api/public/xml-export/${context.storeSlug}/${feed.id}?token=${feed.export_token}`;
    const durationSeconds = Number(((Date.now() - startedAt) / 1000).toFixed(2));

    await supabase
      .from("supplier_feed_runs")
      .update({
        status: result.failed && !result.exported ? "failed" : "success",
        totals: { total: result.exported + result.failed, exported: result.exported, failed: result.failed },
        errors: result.issues.slice(0, 200),
        output_url: outputUrl,
        file_size_bytes: bytes,
        duration_seconds: durationSeconds,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);

    await supabase
      .from("supplier_feeds")
      .update({
        last_run_at: new Date().toISOString(),
        last_status: result.failed && !result.exported ? "failed" : "success",
        last_error: result.failed ? `${result.failed} ürün doğrulamadan geçemedi` : null,
        stats: { exported: result.exported, failed: result.failed, bytes },
      })
      .eq("id", feed.id);

    return { runId, exported: result.exported, failed: result.failed, outputUrl, xml: result.xml };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    await supabase
      .from("supplier_feed_runs")
      .update({
        status: "failed",
        error: message,
        duration_seconds: Number(((Date.now() - startedAt) / 1000).toFixed(2)),
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
    await supabase
      .from("supplier_feeds")
      .update({ last_run_at: new Date().toISOString(), last_status: "failed", last_error: message })
      .eq("id", feed.id);
    throw error;
  }
}
