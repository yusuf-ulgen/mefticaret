import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type StoreRow = {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  currency: string;
  locale: string;
  status: "draft" | "active" | "suspended" | "archived";
  owner_id: string | null;
  plan_id: string | null;
  onboarding_step: number;
  onboarding_completed: boolean;
  is_demo: boolean;
  created_at: string;
  published_at: string | null;
};

export const plansQuery = () =>
  queryOptions({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const myStoresQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["my-stores", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data: memberships, error: membershipError } = await supabase
        .from("store_users")
        .select("store_id, role")
        .eq("user_id", userId!);
      if (membershipError) throw membershipError;

      const ids = (memberships ?? []).map((row) => row.store_id);
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .or(`owner_id.eq.${userId}${ids.length ? `,id.in.(${ids.join(",")})` : ""}`)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const roleByStore = new Map((memberships ?? []).map((row) => [row.store_id, row.role]));
      return (data ?? []).map((store) => ({
        ...(store as StoreRow),
        myRole: store.owner_id === userId ? "owner" : (roleByStore.get(store.id) ?? "staff"),
      }));
    },
  });

export const demoStoreQuery = () =>
  queryOptions({
    queryKey: ["demo-store"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("is_demo", true)
        .maybeSingle();
      if (error) throw error;
      return data as StoreRow | null;
    },
    staleTime: 5 * 60 * 1000,
  });

export const storeQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*, plans(name, code, limits)")
        .eq("id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const storeStatsQuery = (storeId: string, days: number) =>
  queryOptions({
    queryKey: ["store-stats", storeId, days],
    queryFn: async () => {
      const from = new Date();
      from.setDate(from.getDate() - (days - 1));
      const { data, error } = await supabase
        .from("store_daily_stats")
        .select("*")
        .eq("store_id", storeId)
        .gte("stat_date", from.toISOString().slice(0, 10))
        .order("stat_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

export const storeSettingsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store-settings", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("*")
        .eq("store_id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const storeDomainsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store-domains", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_domains")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

export const storeMembersQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store-members", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_users")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

export const storeAuditQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store-audit", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

export const adminStoresQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ["admin-stores"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*, plans(name, code)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

export const adminAuditQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ["admin-audit"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
