import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { NOT_AUTHENTICATED, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_products",
  title: "Ürünleri listele",
  description: "Belirtilen mağazanın ürünlerini listeler; başlığa göre arama yapılabilir.",
  inputSchema: {
    store_id: z.guid().describe("Mağaza kimliği (list_stores ile alınır)."),
    search: z.string().trim().min(1).optional().describe("Ürün başlığında geçen metin."),
    limit: z.number().int().min(1).max(100).default(20).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ store_id, search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return NOT_AUTHENTICATED;
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("products")
      .select("id, title, slug, sku, status, base_price, currency, updated_at")
      .eq("store_id", store_id)
      .order("updated_at", { ascending: false })
      .limit(limit ?? 20);
    if (search) query = query.ilike("title", `%${search}%`);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { products: data ?? [] },
    };
  },
});
