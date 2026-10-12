import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { ReturnAnalyticsInput } from "@/lib/returns-analytics";
import type { ReturnReason, ReturnStatus } from "@/lib/returns-queries";

/** Seçilen dönem için iade talepleri + sipariş özetini getirir. */
export const returnAnalyticsQuery = (storeId: string, windowDays: number) =>
  queryOptions({
    queryKey: ["return-analytics", storeId, windowDays],
    queryFn: async (): Promise<ReturnAnalyticsInput> => {
      const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();
      const [returns, orders] = await Promise.all([
        supabase
          .from("return_requests")
          .select(
            "id, created_at, resolved_at, status, reason, refund_amount, return_items(title, variant_title, quantity, line_total)",
          )
          .eq("store_id", storeId)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(2000),
        supabase
          .from("orders")
          .select("id, placed_at, grand_total")
          .eq("store_id", storeId)
          .gte("placed_at", since)
          .limit(5000),
      ]);
      if (returns.error) throw returns.error;
      if (orders.error) throw orders.error;

      return {
        returns: (returns.data ?? []).map((row) => ({
          id: String(row.id),
          createdAt: String(row.created_at),
          resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
          status: row.status as ReturnStatus,
          reason: row.reason as ReturnReason,
          refundAmount: Number(row.refund_amount ?? 0),
          items: ((row.return_items ?? []) as Array<Record<string, unknown>>).map((item) => ({
            title: String(item["title"] ?? "Ürün"),
            variantTitle: item["variant_title"] ? String(item["variant_title"]) : null,
            quantity: Number(item["quantity"] ?? 0),
            lineTotal: Number(item["line_total"] ?? 0),
          })),
        })),
        orders: (orders.data ?? []).map((row) => ({
          id: String(row.id),
          placedAt: String(row.placed_at),
          grandTotal: Number(row.grand_total ?? 0),
        })),
      };
    },
  });
