import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { TaxClass, TaxRule } from "@/lib/tax-engine";
import type { RateRow } from "@/lib/money";

/** Dil / para birimi / vergi verileri — tenant izolasyonu RLS ile korunur. */

export const taxClassesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["tax-classes", storeId],
    queryFn: async (): Promise<TaxClass[]> => {
      const { data, error } = await supabase
        .from("tax_classes")
        .select("id, name, code, is_default")
        .eq("store_id", storeId)
        .order("is_default", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TaxClass[];
    },
  });

export const taxRulesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["tax-rules", storeId],
    queryFn: async (): Promise<TaxRule[]> => {
      const { data, error } = await supabase
        .from("tax_rules")
        .select("id, name, tax_class_id, country_code, region, rate, priority, is_active")
        .eq("store_id", storeId)
        .order("priority", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TaxRule[];
    },
  });

export const currencyRatesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["currency-rates", storeId],
    queryFn: async (): Promise<RateRow[]> => {
      const { data, error } = await supabase
        .from("currency_rates")
        .select("base_currency, quote_currency, rate, source, fetched_at")
        .eq("store_id", storeId);
      if (error) throw error;
      return (data ?? []) as RateRow[];
    },
  });
