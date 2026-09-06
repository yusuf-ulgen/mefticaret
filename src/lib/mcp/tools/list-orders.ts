import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { NOT_AUTHENTICATED, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_orders",
  title: "Siparişleri listele",
  description: "Belirtilen mağazanın son siparişlerini listeler; duruma göre filtrelenebilir.",
  inputSchema: {
    store_id: z.string().uuid().describe("Mağaza kimliği."),
    status: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe("Sipariş durumu filtresi (örn. pending, paid, cancelled)."),
    limit: z.number().int().min(1).max(100).default(20).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ store_id, status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return NOT_AUTHENTICATED;
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("orders")
      .select(
        "id, order_number, status, payment_status, fulfillment_status, grand_total, currency, customer_name, placed_at",
      )
      .eq("store_id", store_id)
      .order("placed_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) query = query.eq("status", status as never);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { orders: data ?? [] },
    };
  },
});
