import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type PlanRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  commission_rate: number;
  trial_days: number;
  limits: Record<string, number>;
  is_active: boolean;
  sort_order: number;
};

/** Platform konsolu sorguları — tümü platform_admin rolü ile RLS üzerinden korunur. */

export const adminPlansQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ["admin-plans"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PlanRow[];
    },
  });

export const adminOverviewQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ["admin-overview"],
    enabled,
    queryFn: async () => {
      const [orders, ledger, customers] = await Promise.all([
        supabase.from("orders").select("grand_total, currency, placed_at").limit(2000),
        supabase.from("ledger_entries").select("kind, direction, amount").limit(4000),
        supabase.from("customers").select("id").limit(2000),
      ]);
      if (orders.error) throw orders.error;
      if (ledger.error) throw ledger.error;
      if (customers.error) throw customers.error;

      const gmv = (orders.data ?? []).reduce((sum, row) => sum + Number(row.grand_total ?? 0), 0);
      const fees = (ledger.data ?? [])
        .filter((row) => row.kind === "platform_fee")
        .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

      return {
        gmv,
        fees,
        ordersCount: (orders.data ?? []).length,
        customersCount: (customers.data ?? []).length,
      };
    },
  });
