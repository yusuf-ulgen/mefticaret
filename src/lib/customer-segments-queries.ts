import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Kural tabanlı müşteri segmentleri ve müşteri eşleştirme yardımcıları. */

export type CustomerSegment = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  is_system: boolean;
  min_orders: number;
  min_spent: number;
  inactive_days: number | null;
  new_within_days: number | null;
  required_tags: string[];
  sort_order: number;
};

export type SegmentCustomer = {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  tags: string[];
  notes: string | null;
  orders_count: number;
  total_spent: number;
  created_at: string;
  last_activity_at: string | null;
};

export const SEGMENT_COLOR_CLASSES: Record<string, string> = {
  slate: "bg-muted text-muted-foreground",
  primary: "bg-primary/15 text-primary",
  emerald: "bg-emerald-500/15 text-emerald-600",
  amber: "bg-amber-500/15 text-amber-600",
  sky: "bg-sky-500/15 text-sky-600",
  rose: "bg-rose-500/15 text-rose-600",
};

export const customerSegmentsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["customer-segments", storeId],
    queryFn: async (): Promise<CustomerSegment[]> => {
      const { data, error } = await supabase
        .from("customer_segments")
        .select(
          "id, name, slug, description, color, is_system, min_orders, min_spent, inactive_days, new_within_days, required_tags, sort_order",
        )
        .eq("store_id", storeId)
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data ?? []).map((row) => ({ ...row, min_spent: Number(row.min_spent) }));
    },
  });

/** Segment üyeliği için müşteri özetleri (harcama, sipariş, etiket, son aktivite). */
export const segmentCustomersQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["segment-customers", storeId],
    queryFn: async (): Promise<SegmentCustomer[]> => {
      const { data, error } = await supabase
        .from("customers")
        .select(
          "id, full_name, first_name, last_name, email, phone, tags, notes, orders_count, total_spent, created_at, last_activity_at",
        )
        .eq("store_id", storeId)
        .order("total_spent", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []).map((row) => ({ ...row, total_spent: Number(row.total_spent) }));
    },
  });

function daysSince(iso: string | null) {
  if (!iso) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

/** Müşterinin segment kurallarını karşılayıp karşılamadığını hesaplar. */
export function matchesSegment(customer: SegmentCustomer, segment: CustomerSegment): boolean {
  if (customer.orders_count < segment.min_orders) return false;
  if (customer.total_spent < segment.min_spent) return false;

  if (segment.inactive_days != null) {
    const idle = daysSince(customer.last_activity_at ?? customer.created_at);
    if (idle < segment.inactive_days) return false;
  }

  if (segment.new_within_days != null) {
    if (daysSince(customer.created_at) > segment.new_within_days) return false;
  }

  if (segment.required_tags.length > 0) {
    const tags = (customer.tags ?? []).map((tag) => tag.toLocaleLowerCase("tr"));
    const hasAll = segment.required_tags.every((tag) => tags.includes(tag.toLocaleLowerCase("tr")));
    if (!hasAll) return false;
  }

  return true;
}

export function segmentMembers(customers: SegmentCustomer[], segment: CustomerSegment) {
  return customers.filter((customer) => matchesSegment(customer, segment));
}

export function segmentsForCustomer(customer: SegmentCustomer, segments: CustomerSegment[]) {
  return segments.filter((segment) => matchesSegment(customer, segment));
}
