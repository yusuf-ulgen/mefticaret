import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { NOT_AUTHENTICATED, supabaseForUser } from "../supabase";

export default defineTool({
  name: "update_product",
  title: "Ürünü güncelle",
  description: "Bir ürünün fiyatını ve/veya yayın durumunu günceller. RLS mağaza yetkisini doğrular.",
  inputSchema: {
    product_id: z.string().uuid().describe("Güncellenecek ürünün kimliği."),
    base_price: z.number().min(0).optional().describe("Yeni satış fiyatı."),
    status: z
      .enum(["draft", "active", "archived"])
      .optional()
      .describe("Yeni ürün durumu."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ product_id, base_price, status }, ctx) => {
    if (!ctx.isAuthenticated()) return NOT_AUTHENTICATED;
    if (base_price === undefined && !status) {
      return {
        content: [{ type: "text", text: "En az bir alan gönderin: base_price veya status." }],
        isError: true,
      };
    }
    const supabase = supabaseForUser(ctx);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (base_price !== undefined) patch["base_price"] = base_price;
    if (status) patch["status"] = status;

    const { data, error } = await supabase
      .from("products")
      .update(patch as never)
      .eq("id", product_id)
      .select("id, title, base_price, status")
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data)
      return { content: [{ type: "text", text: "Ürün bulunamadı veya yetkiniz yok." }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { product: data },
    };
  },
});
