import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { ProfitLine } from "@/lib/profit";

/** Kârlılık raporu verileri: RLS ile mağaza izolasyonu korunur. */

function sinceIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export const profitDataQuery = (storeId: string, days: number) =>
  queryOptions({
    queryKey: ["profit-data", storeId, days],
    queryFn: async () => {
      const [items, variants, products] = await Promise.all([
        supabase
          .from("order_items")
          .select("id, title, quantity, line_total, unit_price, product_id, variant_id, created_at")
          .eq("store_id", storeId)
          .gte("created_at", sinceIso(days))
          .limit(5000),
        supabase
          .from("product_variants")
          .select("id, product_id, title, sku, price, cost_price, stock")
          .eq("store_id", storeId)
          .limit(3000),
        supabase
          .from("products")
          .select("id, title, status, base_price")
          .eq("store_id", storeId)
          .limit(2000),
      ]);
      if (items.error) throw items.error;
      if (variants.error) throw variants.error;
      if (products.error) throw products.error;

      const variantRows = (variants.data ?? []).map((variant) => ({
        id: String(variant.id),
        productId: variant.product_id ? String(variant.product_id) : null,
        title: variant.title ? String(variant.title) : "Varsayılan",
        sku: variant.sku ? String(variant.sku) : null,
        price: Number(variant.price ?? 0),
        costPrice: variant.cost_price == null ? null : Number(variant.cost_price),
        stock: Number(variant.stock ?? 0),
      }));

      const costByVariant = new Map(variantRows.map((variant) => [variant.id, variant.costPrice]));
      const costByProduct = new Map<string, number>();
      for (const variant of variantRows) {
        if (variant.productId && variant.costPrice != null && !costByProduct.has(variant.productId)) {
          costByProduct.set(variant.productId, variant.costPrice);
        }
      }

      const lines: ProfitLine[] = (items.data ?? []).map((item) => {
        const variantId = item.variant_id ? String(item.variant_id) : null;
        const productId = item.product_id ? String(item.product_id) : null;
        const fromVariant = variantId ? costByVariant.get(variantId) ?? null : null;
        const unitCost = fromVariant ?? (productId ? costByProduct.get(productId) ?? null : null);
        return {
          productId,
          variantId,
          title: String(item.title),
          quantity: Number(item.quantity ?? 0),
          revenue: Number(item.line_total ?? 0),
          unitCost,
        };
      });

      return {
        lines,
        variants: variantRows,
        products: (products.data ?? []).map((product) => ({
          id: String(product.id),
          title: String(product.title),
          status: String(product.status),
          basePrice: Number(product.base_price ?? 0),
        })),
      };
    },
  });
