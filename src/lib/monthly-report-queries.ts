import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { monthRange, previousMonthKey, type ReportItem, type ReportOrder } from "@/lib/monthly-report";

/** Aylık rapor verisi: seçilen ay + karşılaştırma ayı siparişleri ve kalemleri. */
export const monthlyReportQuery = (storeId: string, monthKey: string) =>
  queryOptions({
    queryKey: ["monthly-report", storeId, monthKey],
    queryFn: async () => {
      const current = monthRange(monthKey);
      const previous = monthRange(previousMonthKey(monthKey));

      const orderColumns =
        "id, order_number, placed_at, created_at, grand_total, subtotal, discount_total, shipping_total, status, payment_status, customer_email, discount_code";

      const [currentOrders, previousOrders, currentItems, previousItems] = await Promise.all([
        supabase
          .from("orders")
          .select(orderColumns)
          .eq("store_id", storeId)
          .gte("placed_at", current.start)
          .lt("placed_at", current.end)
          .order("placed_at", { ascending: true })
          .limit(5000),
        supabase
          .from("orders")
          .select(orderColumns)
          .eq("store_id", storeId)
          .gte("placed_at", previous.start)
          .lt("placed_at", previous.end)
          .limit(5000),
        supabase
          .from("order_items")
          .select("title, variant_title, quantity, line_total, product_id")
          .eq("store_id", storeId)
          .gte("created_at", current.start)
          .lt("created_at", current.end)
          .limit(5000),
        supabase
          .from("order_items")
          .select("title, variant_title, quantity, line_total, product_id")
          .eq("store_id", storeId)
          .gte("created_at", previous.start)
          .lt("created_at", previous.end)
          .limit(5000),
      ]);

      if (currentOrders.error) throw currentOrders.error;
      if (previousOrders.error) throw previousOrders.error;
      if (currentItems.error) throw currentItems.error;
      if (previousItems.error) throw previousItems.error;

      return {
        range: current,
        previousRange: previous,
        orders: (currentOrders.data ?? []) as ReportOrder[],
        previousOrders: (previousOrders.data ?? []) as ReportOrder[],
        items: (currentItems.data ?? []) as ReportItem[],
        previousItems: (previousItems.data ?? []) as ReportItem[],
      };
    },
  });
