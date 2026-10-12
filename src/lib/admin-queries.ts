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

export const adminGrowthQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ["admin-growth"],
    enabled,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 29);
      since.setHours(0, 0, 0, 0);

      const [orders, stores] = await Promise.all([
        supabase
          .from("orders")
          .select("grand_total, placed_at")
          .gte("placed_at", since.toISOString())
          .limit(5000),
        supabase
          .from("stores")
          .select("created_at")
          .gte("created_at", since.toISOString())
          .limit(2000),
      ]);
      if (orders.error) throw orders.error;
      if (stores.error) throw stores.error;

      const days: { date: string; label: string; revenue: number; orders: number; stores: number }[] = [];
      const index = new Map<string, number>();
      for (let i = 0; i < 30; i += 1) {
        const day = new Date(since);
        day.setDate(since.getDate() + i);
        const key = day.toISOString().slice(0, 10);
        index.set(key, days.length);
        days.push({
          date: key,
          label: day.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" }),
          revenue: 0,
          orders: 0,
          stores: 0,
        });
      }

      for (const row of orders.data ?? []) {
        const slot = index.get(String(row.placed_at).slice(0, 10));
        if (slot === undefined) continue;
        const day = days[slot];
        if (!day) continue;
        day.revenue += Number(row.grand_total ?? 0);
        day.orders += 1;
      }
      for (const row of stores.data ?? []) {
        const slot = index.get(String(row.created_at).slice(0, 10));
        if (slot === undefined) continue;
        const day = days[slot];
        if (!day) continue;
        day.stores += 1;
      }

      return days;
    },
  });
