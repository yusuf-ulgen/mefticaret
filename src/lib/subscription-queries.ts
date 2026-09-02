import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { LIVE_METRICS } from "@/lib/subscription";

/** Abonelik sorguları: paket limitleri (plan_features), abonelik, kullanım, faturalama dönemleri ve faturalar. */

export type PlanFeatureRow = {
  id: string;
  plan_id: string;
  metric_key: string;
  label: string;
  unit: string | null;
  limit_value: number | null;
  is_enabled: boolean;
  sort_order: number;
};

export type SubscriptionRow = {
  id: string;
  store_id: string;
  plan_id: string | null;
  status: "trialing" | "active" | "past_due" | "canceled" | "expired";
  billing_interval: "monthly" | "yearly";
  currency: string;
  amount: number;
  trial_ends_at: string | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  started_at: string;
};

export const planFeaturesQuery = () =>
  queryOptions({
    queryKey: ["plan-features"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_features")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PlanFeatureRow[];
    },
    staleTime: 60_000,
  });

export const storeSubscriptionQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store-subscription", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("store_id", storeId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as SubscriptionRow | null;
    },
  });

export const subscriptionItemsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["subscription-items", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_items")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

export const billingCyclesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["billing-cycles", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_cycles")
        .select("*")
        .eq("store_id", storeId)
        .order("period_start", { ascending: false })
        .limit(24);
      if (error) throw error;
      return data ?? [];
    },
  });

export const invoicesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["invoices", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("store_id", storeId)
        .order("issued_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

/** Metrik bazlı kullanım: canlı sayımlar + usage_records toplamı (bu ay). */
export const metricUsageQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["metric-usage", storeId],
    queryFn: async (): Promise<Record<string, number>> => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const periodStart = monthStart.toISOString().slice(0, 10);

      const countOf = async (
        table: "products" | "store_users" | "store_domains" | "store_themes",
      ) => {
        const { count, error } = await supabase
          .from(table)
          .select("store_id", { count: "exact", head: true })
          .eq("store_id", storeId);
        if (error) throw error;
        return count ?? 0;
      };

      const [products, staff, domains, themes, orders, sales, records] = await Promise.all([
        countOf("products"),
        countOf("store_users"),
        countOf("store_domains"),
        countOf("store_themes"),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .gte("placed_at", monthStart.toISOString()),
        supabase
          .from("orders")
          .select("grand_total")
          .eq("store_id", storeId)
          .gte("placed_at", monthStart.toISOString())
          .limit(5000),
        supabase
          .from("usage_records")
          .select("metric_key, quantity")
          .eq("store_id", storeId)
          .eq("period_start", periodStart)
          .limit(5000),
      ]);
      if (orders.error) throw orders.error;
      if (sales.error) throw sales.error;
      if (records.error) throw records.error;

      const usage: Record<string, number> = {
        products,
        staff,
        domains,
        themes,
        orders: orders.count ?? 0,
        monthly_sales: (sales.data ?? []).reduce(
          (sum, row) => sum + Number(row.grand_total ?? 0),
          0,
        ),
      };

      for (const row of records.data ?? []) {
        const key = String(row.metric_key);
        if (LIVE_METRICS.includes(key)) continue;
        usage[key] = (usage[key] ?? 0) + Number(row.quantity ?? 0);
      }

      return usage;
    },
  });
