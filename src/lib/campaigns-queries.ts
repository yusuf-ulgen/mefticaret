import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { CampaignInput } from "@/lib/campaigns";

/** Kampanya analizi için dönemsel sipariş + kupon tanımlarını getirir. */
export const campaignAnalyticsQuery = (storeId: string, windowDays: number) =>
  queryOptions({
    queryKey: ["campaign-analytics", storeId, windowDays],
    queryFn: async (): Promise<CampaignInput> => {
      const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();
      const [orders, discounts] = await Promise.all([
        supabase
          .from("orders")
          .select("id, placed_at, grand_total, subtotal, discount_total, discount_code, customer_id, customer_email")
          .eq("store_id", storeId)
          .gte("placed_at", since)
          .order("placed_at", { ascending: false })
          .limit(5000),
        supabase
          .from("discounts")
          .select("id, code, title, type, value, is_active, usage_limit, used_count, starts_at, ends_at")
          .eq("store_id", storeId)
          .limit(500),
      ]);
      if (orders.error) throw orders.error;
      if (discounts.error) throw discounts.error;

      return {
        orders: (orders.data ?? []).map((row) => ({
          id: String(row.id),
          placedAt: String(row.placed_at),
          grandTotal: Number(row.grand_total ?? 0),
          subtotal: Number(row.subtotal ?? 0),
          discountTotal: Number(row.discount_total ?? 0),
          discountCode: row.discount_code ? String(row.discount_code) : null,
          customerKey: row.customer_id
            ? String(row.customer_id)
            : row.customer_email
              ? String(row.customer_email).toLowerCase()
              : null,
        })),
        discounts: (discounts.data ?? []).map((row) => ({
          id: String(row.id),
          code: String(row.code),
          title: row.title ? String(row.title) : null,
          type: String(row.type),
          value: Number(row.value ?? 0),
          isActive: Boolean(row.is_active),
          usageLimit: row.usage_limit === null ? null : Number(row.usage_limit),
          usedCount: Number(row.used_count ?? 0),
          startsAt: String(row.starts_at),
          endsAt: row.ends_at ? String(row.ends_at) : null,
        })),
      };
    },
  });
