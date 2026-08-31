import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { ValuationInput } from "@/lib/valuation";

/** Envanter değerleme verisi: varyant stok/fiyat/maliyet + ürün meta bilgileri. */
export const valuationDataQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["valuation-data", storeId],
    queryFn: async (): Promise<ValuationInput[]> => {
      const [variants, products] = await Promise.all([
        supabase
          .from("product_variants")
          .select("id, product_id, title, sku, stock, price, cost_price")
          .eq("store_id", storeId)
          .limit(4000),
        supabase
          .from("products")
          .select("id, title, vendor, product_type, status")
          .eq("store_id", storeId)
          .limit(3000),
      ]);
      if (variants.error) throw variants.error;
      if (products.error) throw products.error;

      const productMap = new Map(
        (products.data ?? []).map((product) => [String(product.id), product]),
      );

      return (variants.data ?? []).map((variant) => {
        const parent = variant.product_id ? productMap.get(String(variant.product_id)) : undefined;
        const variantTitle = variant.title ? String(variant.title) : "Varsayılan";
        return {
          variantId: String(variant.id),
          productId: variant.product_id ? String(variant.product_id) : null,
          title: parent ? `${String(parent.title ?? "")} — ${variantTitle}` : variantTitle,
          sku: variant.sku ? String(variant.sku) : null,
          vendor: parent?.vendor ? String(parent.vendor) : null,
          productType: parent?.product_type ? String(parent.product_type) : null,
          status: parent?.status ? String(parent.status) : "draft",
          stock: Number(variant.stock ?? 0),
          price: Number(variant.price ?? 0),
          costPrice: variant.cost_price == null ? null : Number(variant.cost_price),
        };
      });
    },
  });
