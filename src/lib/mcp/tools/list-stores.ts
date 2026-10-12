import { defineTool } from "@lovable.dev/mcp-js";
import { NOT_AUTHENTICATED, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_stores",
  title: "Mağazaları listele",
  description: "Oturum açan kullanıcının erişebildiği mağazaları listeler (ad, slug, durum, para birimi).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return NOT_AUTHENTICATED;
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("stores")
      .select("id, name, slug, status, currency, published_at, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { stores: data ?? [] },
    };
  },
});
