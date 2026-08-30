import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Müşteri segmentasyonu (RFM-lite) sorguları.
 * RLS ile mağaza izolasyonu korunur; hesaplama istemci tarafında yapılır.
 */

export const segmentOrdersQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["segment-orders", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, customer_id, customer_email, customer_name, grand_total, placed_at, created_at, status")
        .eq("store_id", storeId)
        .order("placed_at", { ascending: false })
        .limit(3000);
      if (error) throw error;
      return data ?? [];
    },
  });

export type SegmentKey = "champion" | "loyal" | "new" | "at_risk" | "lost";

export const SEGMENT_META: Record<SegmentKey, { label: string; description: string; tone: string }> = {
  champion: {
    label: "Şampiyonlar",
    description: "Son 30 günde alışveriş yapan, çok sipariş veren yüksek değerli müşteriler.",
    tone: "bg-primary/15 text-primary",
  },
  loyal: {
    label: "Sadık",
    description: "Tekrar eden siparişleri olan ve son 90 gün içinde aktif müşteriler.",
    tone: "bg-emerald-500/15 text-emerald-600",
  },
  new: {
    label: "Yeni",
    description: "İlk siparişini son 30 gün içinde veren müşteriler.",
    tone: "bg-sky-500/15 text-sky-600",
  },
  at_risk: {
    label: "Riskli",
    description: "90-180 gün arası alışveriş yapmayan, kaybedilme riski olan müşteriler.",
    tone: "bg-amber-500/15 text-amber-600",
  },
  lost: {
    label: "Kayıp",
    description: "180 günden uzun süredir sipariş vermeyen müşteriler.",
    tone: "bg-destructive/15 text-destructive",
  },
};

export type SegmentRow = {
  key: string;
  customerId: string | null;
  name: string;
  email: string;
  orders: number;
  revenue: number;
  average: number;
  lastOrderAt: string | null;
  firstOrderAt: string | null;
  recencyDays: number;
  segment: SegmentKey;
};

type OrderLike = {
  customer_id?: string | null;
  customer_email?: string | null;
  customer_name?: string | null;
  grand_total: number | string | null;
  placed_at: string | null;
  created_at: string;
  status?: string | null;
};

function daysBetween(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

/** Siparişleri müşteri bazında toplar ve RFM eşiklerine göre segmentler. */
export function buildSegments(orders: OrderLike[]): SegmentRow[] {
  const map = new Map<string, SegmentRow>();

  for (const order of orders) {
    if (order.status === "cancelled") continue;
    const email = (order.customer_email ?? "").trim().toLowerCase();
    const key = order.customer_id ? `c:${order.customer_id}` : email ? `e:${email}` : null;
    if (!key) continue;
    const placed = order.placed_at ?? order.created_at;

    const entry =
      map.get(key) ??
      ({
        key,
        customerId: order.customer_id ?? null,
        name: order.customer_name?.trim() || email || "Misafir",
        email,
        orders: 0,
        revenue: 0,
        average: 0,
        lastOrderAt: null,
        firstOrderAt: null,
        recencyDays: 0,
        segment: "new",
      } satisfies SegmentRow);

    entry.orders += 1;
    entry.revenue += Number(order.grand_total ?? 0);
    if (!entry.lastOrderAt || new Date(placed) > new Date(entry.lastOrderAt)) entry.lastOrderAt = placed;
    if (!entry.firstOrderAt || new Date(placed) < new Date(entry.firstOrderAt)) entry.firstOrderAt = placed;
    map.set(key, entry);
  }

  return [...map.values()]
    .map((row) => {
      const recencyDays = row.lastOrderAt ? daysBetween(row.lastOrderAt) : 999;
      const average = row.orders > 0 ? row.revenue / row.orders : 0;
      let segment: SegmentKey;
      if (recencyDays > 180) segment = "lost";
      else if (recencyDays > 90) segment = "at_risk";
      else if (recencyDays <= 30 && row.orders >= 3) segment = "champion";
      else if (row.orders >= 2) segment = "loyal";
      else if (row.firstOrderAt && daysBetween(row.firstOrderAt) <= 30) segment = "new";
      else segment = "loyal";
      return { ...row, recencyDays, average, segment };
    })
    .sort((a, b) => b.revenue - a.revenue);
}
