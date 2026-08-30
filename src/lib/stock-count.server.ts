/**
 * Fiziksel stok sayımı uygulama katmanı.
 * Sayım satırları SKU (veya varyant kimliği) ile eşlenir; her fark için
 * değiştirilemez `count` türünde stok hareketi yazılır.
 */

export type StockCountRow = {
  /** SKU veya varyant kimliği */
  key: string;
  counted: number;
};

export type StockCountLine = {
  key: string;
  variantId: string;
  title: string;
  sku: string | null;
  before: number;
  after: number;
  diff: number;
};

export type StockCountResult = {
  applied: StockCountLine[];
  unchanged: number;
  skipped: { key: string; reason: string }[];
};

type Client = { from: (table: string) => any };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function applyStockCount(
  supabase: Client,
  storeId: string,
  actorId: string,
  rows: StockCountRow[],
  reason: string | null,
): Promise<StockCountResult> {
  const result: StockCountResult = { applied: [], unchanged: 0, skipped: [] };

  for (const row of rows) {
    const key = row.key.trim();
    if (!key) {
      result.skipped.push({ key, reason: "Boş SKU" });
      continue;
    }

    const query = supabase
      .from("product_variants")
      .select("id, product_id, title, sku, stock")
      .eq("store_id", storeId);

    const { data: matches, error } = await (UUID.test(key)
      ? query.eq("id", key).limit(2)
      : query.eq("sku", key).limit(2));

    if (error) {
      result.skipped.push({ key, reason: error.message });
      continue;
    }
    const list = (matches ?? []) as {
      id: string;
      product_id: string;
      title: string;
      sku: string | null;
      stock: number | null;
    }[];
    if (list.length === 0) {
      result.skipped.push({ key, reason: "Varyant bulunamadı" });
      continue;
    }
    if (list.length > 1) {
      result.skipped.push({ key, reason: "Aynı SKU birden fazla varyantta" });
      continue;
    }

    const variant = list[0]!;
    const before = variant.stock ?? 0;
    const after = row.counted;
    if (before === after) {
      result.unchanged += 1;
      continue;
    }

    const { error: updateError } = await supabase
      .from("product_variants")
      .update({ stock: after })
      .eq("id", variant.id);
    if (updateError) {
      result.skipped.push({ key, reason: updateError.message });
      continue;
    }

    const { error: moveError } = await supabase.from("inventory_movements").insert({
      store_id: storeId,
      product_id: variant.product_id,
      variant_id: variant.id,
      kind: "count",
      quantity: after - before,
      stock_before: before,
      stock_after: after,
      reason: reason ?? "Fiziksel sayım",
      actor_id: actorId,
    });
    if (moveError) {
      result.skipped.push({ key, reason: moveError.message });
      continue;
    }

    result.applied.push({
      key,
      variantId: variant.id,
      title: variant.title,
      sku: variant.sku,
      before,
      after,
      diff: after - before,
    });
  }

  return result;
}
