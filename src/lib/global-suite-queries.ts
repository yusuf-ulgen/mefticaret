import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Ultra-zengin e-ihracat suite okuma sorguları (RLS ile mağazaya kapalı). */

export type ProductCountryRuleRow = {
  id: string;
  product_id: string;
  mode: "all" | "allow" | "block";
  country_codes: string[];
  note: string | null;
  products: { title: string; slug: string } | null;
};

export type VariantCustomsRow = {
  id: string;
  variant_id: string;
  hs_code: string | null;
  origin_country: string | null;
  weight_grams: number | null;
  description_en: string | null;
  product_variants: { title: string | null; sku: string | null; product_id: string } | null;
};

export type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  provider: "own" | "amazon_fba" | "shipbob" | "third_party";
  country_code: string;
  city: string | null;
  priority: number;
  is_active: boolean;
  credentials_ready: boolean;
  notes: string | null;
};

export const productCountryRulesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["product-country-rules", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_country_rules")
        .select("id, product_id, mode, country_codes, note, products(title, slug)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProductCountryRuleRow[];
    },
  });

export const variantCustomsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["variant-customs", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("variant_customs_profiles")
        .select(
          "id, variant_id, hs_code, origin_country, weight_grams, description_en, product_variants(title, sku, product_id)",
        )
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as VariantCustomsRow[];
    },
  });

export const warehousesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["fulfillment-warehouses", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fulfillment_warehouses")
        .select("id, code, name, provider, country_code, city, priority, is_active, credentials_ready, notes")
        .eq("store_id", storeId)
        .order("priority", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as WarehouseRow[];
    },
  });
