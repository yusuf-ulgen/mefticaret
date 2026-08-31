import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { AgingInput } from "@/lib/aging";

/** Stok yaşlandırma verisi: stoklu varyantlar + son satış tarihleri. */
export const agingQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["aging", storeId],
    queryFn: async (): Promise<AgingInput[]> => {
      const since = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();

      const [productsRes, variantsRes, itemsRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, title, created_at, status")
          .eq("store_id", storeId)
          .neq("status", "archived")
          .limit(4000),
        supabase
          .from("product_variants")
          .select("id, product_id, sku, stock, price, cost_price")
          .eq("store_id", storeId)
          .limit(8000),
        supabase
          .from("order_items")
          .select("product_id, quantity, created_at")
          .eq("store_id", storeId)
          .gte("created_at", since)
          .limit(10000),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (variantsRes.error) throw variantsRes.error;
      if (itemsRes.error) throw itemsRes.error;

      const cutoff90 = Date.now() - 90 * 24 * 60 * 60 * 1000;
      const lastSale = new Map<string, string>();
      const units90 = new Map<string, number>();
      for (const row of itemsRes.data ?? []) {
        if (!row.product_id) continue;
        const key = String(row.product_id);
        const at = String(row.created_at);
        const current = lastSale.get(key);
        if (!current || at > current) lastSale.set(key, at);
        if (Date.parse(at) >= cutoff90) {
          units90.set(key, (units90.get(key) ?? 0) + Number(row.quantity ?? 0));
        }
      }

      const variantsByProduct = new Map<string, typeof variantsRes.data>();
      for (const variant of variantsRes.data ?? []) {
        const key = String(variant.product_id);
        const list = variantsByProduct.get(key) ?? [];
        list.push(variant);
        variantsByProduct.set(key, list);
      }

      return (productsRes.data ?? []).map((product) => {
        const key = String(product.id);
        const variants = variantsByProduct.get(key) ?? [];
        const stock = variants.reduce((sum, variant) => sum + Number(variant.stock ?? 0), 0);
        const prices = variants.map((variant) => Number(variant.price ?? 0)).filter((value) => value > 0);
        const costs = variants
          .map((variant) => (variant.cost_price === null ? null : Number(variant.cost_price)))
          .filter((value): value is number => value !== null && value > 0);

        return {
          productId: key,
          title: String(product.title ?? "Ürün"),
          sku: variants[0]?.sku ? String(variants[0].sku) : null,
          stock,
          price: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
          costPrice: costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : null,
          createdAt: String(product.created_at),
          lastSaleAt: lastSale.get(key) ?? null,
          units90: units90.get(key) ?? 0,
        } satisfies AgingInput;
      });
    },
    staleTime: 60_000,
  });
