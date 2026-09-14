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

export const storeActivityQuery = (storeId: string, limit = 200) =>
  queryOptions({
    queryKey: ["store-activity", storeId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });

/** Panelde "dikkat gerektirenler" kartları için sayaçlar. */
export const storeActionItemsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store-action-items", storeId],
    staleTime: 60_000,
    queryFn: async () => {
      const [pendingOrders, unfulfilled, pendingReturns, pendingReviews, pendingStockAlerts, variants] =
        await Promise.all([
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("store_id", storeId)
            .eq("status", "pending"),
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("store_id", storeId)
            .eq("fulfillment_status", "unfulfilled")
            .in("status", ["pending", "processing"]),
          supabase
            .from("return_requests")
            .select("id", { count: "exact", head: true })
            .eq("store_id", storeId)
            .eq("status", "requested"),
          supabase
            .from("product_reviews")
            .select("id", { count: "exact", head: true })
            .eq("store_id", storeId)
            .eq("status", "pending"),
          supabase
            .from("stock_alerts")
            .select("id", { count: "exact", head: true })
            .eq("store_id", storeId)
            .is("notified_at", null),
          supabase
            .from("product_variants")
            .select("id, stock, low_stock_threshold, products!inner(store_id, status)")
            .eq("products.store_id", storeId)
            .neq("products.status", "archived")
            .limit(1000),
        ]);

      const lowStock = (variants.data ?? []).filter(
        (row) => (row.stock ?? 0) <= (row.low_stock_threshold ?? 0),
      ).length;

      return {
        pendingOrders: pendingOrders.count ?? 0,
        unfulfilled: unfulfilled.count ?? 0,
        pendingReturns: pendingReturns.count ?? 0,
        pendingReviews: pendingReviews.count ?? 0,
        pendingStockAlerts: pendingStockAlerts.count ?? 0,
        lowStock,
      };
    },
  });

/** Mağaza kurulum kontrol listesi: yayına çıkmak için eksik adımlar. */
export const storeSetupChecklistQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store-setup-checklist", storeId],
    staleTime: 60_000,
    queryFn: async () => {
      const [products, payments, rates, theme, domain, settings] = await Promise.all([
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .eq("status", "active"),
        supabase
          .from("store_payment_methods")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .eq("is_active", true),
        supabase
          .from("shipping_rates")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .eq("is_active", true),
        supabase.from("store_themes").select("is_published").eq("store_id", storeId).maybeSingle(),
        supabase
          .from("store_domains")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .eq("status", "verified"),
        supabase.from("store_settings").select("contact_email").eq("store_id", storeId).maybeSingle(),
      ]);

      return {
        hasActiveProduct: (products.count ?? 0) > 0,
        hasPaymentMethod: (payments.count ?? 0) > 0,
        hasShippingRate: (rates.count ?? 0) > 0,
        themePublished: Boolean(theme.data?.is_published),
        hasVerifiedDomain: (domain.count ?? 0) > 0,
        hasContactEmail: Boolean(settings.data?.contact_email),
      };
    },
  });
