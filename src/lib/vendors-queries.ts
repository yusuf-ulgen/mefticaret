import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { VendorReturnInput, VendorSaleInput, VendorStockInput } from "@/lib/vendors";

export type VendorQueryData = {
  sales: VendorSaleInput[];
  stocks: VendorStockInput[];
  returns: VendorReturnInput[];
};

/** Marka (vendor) performansı: satış, stok ve iade verilerini ürün marka bilgisiyle eşler. */
export const vendorsQuery = (storeId: string, days = 90) =>
  queryOptions({
    queryKey: ["vendors", storeId, days],
    queryFn: async (): Promise<VendorQueryData> => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const [productsRes, variantsRes, itemsRes, returnsRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, vendor, base_price")
          .eq("store_id", storeId)
          .limit(5000),
        supabase
          .from("product_variants")
          .select("id, product_id, stock, price, cost_price")
          .eq("store_id", storeId)
          .limit(9000),
        supabase
          .from("order_items")
          .select("product_id, variant_id, quantity, line_total")
          .eq("store_id", storeId)
          .gte("created_at", since)
          .limit(10000),
        supabase
          .from("return_items")
          .select("variant_id, quantity, line_total, created_at")
          .eq("store_id", storeId)
          .gte("created_at", since)
          .limit(5000),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (variantsRes.error) throw variantsRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (returnsRes.error) throw returnsRes.error;

      const vendorByProduct = new Map<string, string>();
      for (const product of productsRes.data ?? []) {
        vendorByProduct.set(String(product.id), String(product.vendor ?? "").trim() || "Belirtilmemiş");
      }

      const productByVariant = new Map<string, string>();
      const costByVariant = new Map<string, number>();
      const priceByVariant = new Map<string, number>();
      const stocks: VendorStockInput[] = [];

      for (const variant of variantsRes.data ?? []) {
        const productId = String(variant.product_id);
        const price = Number(variant.price ?? 0);
        const cost = variant.cost_price === null ? price * 0.6 : Number(variant.cost_price);
        productByVariant.set(String(variant.id), productId);
        costByVariant.set(String(variant.id), cost);
        priceByVariant.set(String(variant.id), price);

        const stock = Number(variant.stock ?? 0);
        if (stock > 0) {
          stocks.push({
            vendor: vendorByProduct.get(productId) ?? "Belirtilmemiş",
            productId,
            stock,
            stockValue: stock * cost,
          });
        }
      }

      const sales: VendorSaleInput[] = [];
      for (const item of itemsRes.data ?? []) {
        const productId = item.product_id
          ? String(item.product_id)
          : item.variant_id
            ? productByVariant.get(String(item.variant_id))
            : undefined;
        if (!productId) continue;
        const quantity = Number(item.quantity ?? 0);
        const lineTotal = Number(item.line_total ?? 0);
        const unitCost = item.variant_id
          ? (costByVariant.get(String(item.variant_id)) ??
            (quantity > 0 ? (lineTotal / quantity) * 0.6 : 0))
          : quantity > 0
            ? (lineTotal / quantity) * 0.6
            : 0;

        sales.push({
          vendor: vendorByProduct.get(productId) ?? "Belirtilmemiş",
          productId,
          units: quantity,
          revenue: lineTotal,
          cost: unitCost * quantity,
        });
      }

      const returns: VendorReturnInput[] = [];
      for (const item of returnsRes.data ?? []) {
        if (!item.variant_id) continue;
        const productId = productByVariant.get(String(item.variant_id));
        if (!productId) continue;
        returns.push({
          vendor: vendorByProduct.get(productId) ?? "Belirtilmemiş",
          units: Number(item.quantity ?? 0),
          amount: Number(item.line_total ?? 0),
        });
      }

      return { sales, stocks, returns };
    },
    staleTime: 60_000,
  });
