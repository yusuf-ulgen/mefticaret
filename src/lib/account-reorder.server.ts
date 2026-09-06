import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

/**
 * "Yeniden sipariş ver": geçmiş bir siparişin kalemlerini güncel fiyat ve
 * stok bilgisiyle sepete uygun satırlara dönüştürür.
 * Sipariş erişimi RLS altında oturum açmış kullanıcının kendi kayıtlarıyla sınırlıdır.
 */

type Client = SupabaseClient<Database>;

export const reorderSchema = z.object({
  storeId: z.guid(),
  orderId: z.guid(),
});

export type ReorderLine = {
  variantId: string;
  productSlug: string;
  title: string;
  variantTitle: string;
  price: number;
  currency: string;
  quantity: number;
  maxStock: number;
};

export type ReorderResult = {
  lines: ReorderLine[];
  skipped: string[];
};

export async function reorderMyOrder(
  supabase: Client,
  data: z.infer<typeof reorderSchema>,
): Promise<ReorderResult> {
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, currency, order_items(title, variant_title, quantity, variant_id)")
    .eq("id", data.orderId)
    .eq("store_id", data.storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) throw new Error("Sipariş bulunamadı.");

  const items = order.order_items ?? [];
  const variantIds = items.map((item) => item.variant_id).filter((id): id is string => Boolean(id));
  const skipped: string[] = [];
  const lines: ReorderLine[] = [];

  if (variantIds.length) {
    const { data: variants, error: variantError } = await supabase
      .from("product_variants")
      .select("id, title, price, stock, product_id, products(slug, title, currency, status)")
      .in("id", variantIds);
    if (variantError) throw new Error(variantError.message);

    const byId = new Map((variants ?? []).map((row) => [row.id, row]));
    for (const item of items) {
      const variant = item.variant_id ? byId.get(item.variant_id) : undefined;
      const product = variant?.products as
        | { slug: string; title: string; currency: string; status: string }
        | null
        | undefined;
      if (!variant || !product || product.status !== "active" || Number(variant.stock) <= 0) {
        skipped.push(item.title);
        continue;
      }
      const maxStock = Number(variant.stock);
      lines.push({
        variantId: variant.id,
        productSlug: product.slug,
        title: product.title,
        variantTitle: variant.title ?? item.variant_title ?? "",
        price: Number(variant.price),
        currency: product.currency ?? order.currency,
        quantity: Math.min(Number(item.quantity) || 1, maxStock),
        maxStock,
      });
    }
  }

  for (const item of items) {
    if (!item.variant_id) skipped.push(item.title);
  }

  return { lines, skipped };
}
