import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { readAllPages } from "@/lib/read-all-pages";

const schema = z.object({
  storeId: z.guid(),
  search: z.string().trim().max(120).default(""),
  status: z
    .enum([
      "all",
      "pending",
      "awaiting_payment",
      "paid",
      "processing",
      "packed",
      "shipped",
      "delivered",
      "cancelled",
      "returned",
      "refunded",
    ])
    .default("all"),
  page: z.number().int().min(0).default(0),
});
function query(db: SupabaseClient<Database>, input: z.infer<typeof schema>) {
  let result = db
    .from("orders")
    .select("*, order_items(id, quantity)", { count: "exact" })
    .eq("store_id", input.storeId)
    .order("placed_at", { ascending: false })
    .order("id");
  if (input.status !== "all") result = result.eq("status", input.status);
  const term = input.search.replace(/[,()"\\%*:]/g, " ").trim();
  if (term)
    result = result.or(
      `order_number.ilike.%${term}%,customer_name.ilike.%${term}%,customer_email.ilike.%${term}%`,
    );
  return result;
}
export const listStoreOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => schema.parse(data))
  .handler(async ({ data, context }) => {
    const {
      data: rows,
      count,
      error,
    } = await query(context.supabase, data).range(data.page * 50, (data.page + 1) * 50 - 1);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, pageSize: 50 };
  });
export const exportStoreOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    schema.extend({ selectedIds: z.array(z.guid()).max(1000).default([]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const result = await readAllPages((from, to) => {
      let q = query(context.supabase, data);
      if (data.selectedIds.length) q = q.in("id", data.selectedIds);
      return q.range(from, to);
    });
    return result.data ?? [];
  });
export const storeOrderSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: summary, error } = await context.supabase.rpc("store_order_summary", {
      _store_id: data.storeId,
    });
    if (error) throw new Error(error.message);
    return summary as unknown as {
      total: number;
      counts: Record<string, number>;
      awaitingPayment: number;
      paidRevenue: Record<string, number>;
    };
  });
