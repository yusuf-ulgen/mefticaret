import { slugify } from "@/lib/mefti";

export type BulkProductRow = {
  title: string;
  description?: string | undefined;
  sku?: string | undefined;
  vendor?: string | undefined;
  productType?: string | undefined;
  price: number;
  compareAtPrice?: number | undefined;
  stock: number;
  status: "draft" | "active" | "archived";
  tags: string[];
};

export type BulkImportResult = {
  created: number;
  updated: number;
  skipped: { row: number; reason: string }[];
};

type Client = {
  from: (table: string) => any;
};

/**
 * Ürünleri slug bazında eşleyerek toplu ekler veya güncelleyer.
 * Tenant izolasyonu RLS ile zorlanır; burada sadece iş kuralları uygulanır.
 */
export async function importProductRows(
  supabase: Client,
  storeId: string,
  currency: string,
  rows: BulkProductRow[],
  remainingQuota: number | null,
): Promise<BulkImportResult> {
  const result: BulkImportResult = { created: 0, updated: 0, skipped: [] };

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    const slug = slugify(row.title) || `urun-${index + 1}`;

    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("store_id", storeId)
      .eq("slug", slug)
      .maybeSingle();

    const payload = {
      title: row.title,
      description: row.description ?? null,
      vendor: row.vendor ?? null,
      product_type: row.productType ?? null,
      base_price: row.price,
      compare_at_price: row.compareAtPrice ?? null,
      status: row.status,
      tags: row.tags,
    };

    if (existing?.id) {
      const { error } = await supabase.from("products").update(payload).eq("id", existing.id);
      if (error) {
        result.skipped.push({ row: index + 1, reason: error.message });
        continue;
      }
      const { data: variant } = await supabase
        .from("product_variants")
        .select("id")
        .eq("product_id", existing.id)
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (variant?.id) {
        await supabase
          .from("product_variants")
          .update({ price: row.price, stock: row.stock, sku: row.sku ?? null })
          .eq("id", variant.id);
      }
      result.updated += 1;
      continue;
    }

    if (remainingQuota !== null && result.created >= remainingQuota) {
      result.skipped.push({ row: index + 1, reason: "Paket ürün limiti aşıldı" });
      continue;
    }

    const { data: product, error } = await supabase
      .from("products")
      .insert({ ...payload, store_id: storeId, slug, currency })
      .select("id")
      .maybeSingle();
    if (error || !product) {
      result.skipped.push({ row: index + 1, reason: error?.message ?? "Ürün eklenemedi" });
      continue;
    }

    await supabase.from("product_variants").insert({
      product_id: product.id,
      store_id: storeId,
      title: "Standart",
      sku: row.sku ?? null,
      price: row.price,
      stock: row.stock,
      position: 1,
    });
    result.created += 1;
  }

  return result;
}
