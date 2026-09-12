import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import {
  EMPTY_ENTITLEMENTS,
  isModuleKey,
  type Entitlements,
} from "@/lib/plan-features";

/**
 * Mağazanın paketine göre açık modüller ve limitler.
 * Yalnızca arayüzü yönlendirmek için kullanılır; asıl zorlama sunucu tarafındadır.
 */
export const storeEntitlementsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store-entitlements", storeId],
    staleTime: 60_000,
    queryFn: async (): Promise<Entitlements> => {
      const { data: store, error: storeError } = await supabase
        .from("stores")
        .select("plan_id, plans(id, code, name)")
        .eq("id", storeId)
        .maybeSingle();
      if (storeError) throw storeError;

      const plan = (store as { plans?: { id: string; code: string; name: string } | null } | null)
        ?.plans;
      if (!plan) return EMPTY_ENTITLEMENTS;

      const { data: rows, error } = await supabase
        .from("plan_features")
        .select("metric_key, limit_value, is_enabled")
        .eq("plan_id", plan.id);
      if (error) throw error;

      const modules: Record<string, boolean> = {};
      const limits: Record<string, number | null> = {};
      for (const row of rows ?? []) {
        const key = String(row.metric_key);
        if (isModuleKey(key)) modules[key] = Boolean(row.is_enabled);
        else if (row.is_enabled) limits[key] = row.limit_value === null ? null : Number(row.limit_value);
        else limits[key] = 0;
      }

      return { planId: plan.id, planCode: plan.code, planName: plan.name, modules, limits };
    },
  });
