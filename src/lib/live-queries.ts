import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Canlı izleme (Live View) sorguları: son dakikalardaki vitrin olayları ve
 * bugünün siparişleri. RLS mağaza izolasyonunu korur.
 */

export type LiveAnalyticsEvent = {
  id: string;
  kind: "page_view" | "product_view" | "add_to_cart" | "checkout" | "purchase";
  visitor_id: string;
  session_id: string;
  path: string | null;
  product_id: string | null;
  value: number | string;
  quantity: number;
  currency: string;
  source: string | null;
  medium: string | null;
  referrer_host: string | null;
  device: string | null;
  country: string | null;
  created_at: string;
};

const LIVE_COLUMNS =
  "id, kind, visitor_id, session_id, path, product_id, value, quantity, currency, source, medium, referrer_host, device, country, created_at";

/** Son `minutes` dakikadaki vitrin olayları (varsayılan 60 dk). */
export const liveEventsQuery = (storeId: string, minutes = 60) =>
  queryOptions({
    queryKey: ["live-events", storeId, minutes],
    refetchInterval: 15_000,
    queryFn: async (): Promise<LiveAnalyticsEvent[]> => {
      const since = new Date(Date.now() - minutes * 60_000).toISOString();
      const { data, error } = await supabase
        .from("analytics_events")
        .select(LIVE_COLUMNS)
        .eq("store_id", storeId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as LiveAnalyticsEvent[];
    },
  });

export type LiveOrder = {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_email: string | null;
  grand_total: number | string;
  currency: string;
  status: string;
  payment_status: string;
  placed_at: string | null;
  created_at: string;
};

/** Bugünün siparişleri (yerel gün başlangıcından itibaren). */
export const liveOrdersQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["live-orders", storeId],
    refetchInterval: 20_000,
    queryFn: async (): Promise<LiveOrder[]> => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_number, customer_name, customer_email, grand_total, currency, status, payment_status, placed_at, created_at",
        )
        .eq("store_id", storeId)
        .gte("created_at", start.toISOString())
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as LiveOrder[];
    },
  });

/** Şu anda aktif (son 5 dk) sepetler. */
export const liveCartsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["live-carts", storeId],
    refetchInterval: 20_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 60_000).toISOString();
      const { data, error } = await supabase
        .from("carts")
        .select("id, updated_at, item_count, grand_total, currency, status")
        .eq("store_id", storeId)
        .gte("updated_at", since)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

/** Olay listesinden aktif ziyaretçi/oturum ve dönüşüm özetini çıkarır. */
export function summarizeLive(events: LiveAnalyticsEvent[], windowMinutes = 5) {
  const cutoff = Date.now() - windowMinutes * 60_000;
  const recent = events.filter((event) => new Date(event.created_at).getTime() >= cutoff);
  const visitors = new Set(recent.map((event) => event.visitor_id)).size;
  const sessions = new Set(recent.map((event) => event.session_id)).size;

  const byKind = (kind: LiveAnalyticsEvent["kind"], list = events) =>
    list.filter((event) => event.kind === kind).length;

  const sessionSet = (kind: LiveAnalyticsEvent["kind"]) =>
    new Set(events.filter((event) => event.kind === kind).map((event) => event.session_id)).size;

  const viewSessions = sessionSet("page_view") + sessionSet("product_view");
  const purchaseSessions = sessionSet("purchase");

  return {
    visitors,
    sessions,
    pageViews: byKind("page_view"),
    productViews: byKind("product_view"),
    addToCart: byKind("add_to_cart"),
    checkouts: byKind("checkout"),
    purchases: byKind("purchase"),
    conversionRate: viewSessions > 0 ? (purchaseSessions / viewSessions) * 100 : 0,
    activeVisitorIds: Array.from(new Set(recent.map((event) => event.visitor_id))),
  };
}

/** Belirli bir alana göre en çok tekrar edenleri sayar. */
export function topBy<K extends keyof LiveAnalyticsEvent>(
  events: LiveAnalyticsEvent[],
  key: K,
  limit = 6,
): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    const raw = event[key];
    const label = raw == null || raw === "" ? "Bilinmiyor" : String(raw);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Son 60 dakikayı dakika bazlı ziyaretçi kovalarına böler. */
export function minuteBuckets(events: LiveAnalyticsEvent[], minutes = 60) {
  const now = Date.now();
  const buckets: { minute: number; count: number }[] = [];
  for (let i = minutes - 1; i >= 0; i -= 1) {
    const from = now - (i + 1) * 60_000;
    const to = now - i * 60_000;
    const count = new Set(
      events
        .filter((event) => {
          const at = new Date(event.created_at).getTime();
          return at >= from && at < to;
        })
        .map((event) => event.visitor_id),
    ).size;
    buckets.push({ minute: minutes - i, count });
  }
  return buckets;
}
