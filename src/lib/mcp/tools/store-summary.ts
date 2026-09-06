import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { NOT_AUTHENTICATED, supabaseForUser } from "../supabase";

export default defineTool({
  name: "store_summary",
  title: "Mağaza özeti",
  description:
    "Bir mağaza için son X gündeki sipariş sayısı, ciro, aktif ürün sayısı ve bekleyen sipariş sayısını döndürür.",
  inputSchema: {
    store_id: z.guid().describe("Mağaza kimliği."),
    days: z.number().int().min(1).max(365).default(30).optional().describe("Kaç günlük dönem."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ store_id, days }, ctx) => {
    if (!ctx.isAuthenticated()) return NOT_AUTHENTICATED;
    const period = days ?? 30;
    const since = new Date(Date.now() - period * 86_400_000).toISOString();
    const supabase = supabaseForUser(ctx);

    const [store, orders, activeProducts, pending] = await Promise.all([
      supabase.from("stores").select("name, currency").eq("id", store_id).maybeSingle(),
      supabase
        .from("orders")
        .select("grand_total, payment_status")
        .eq("store_id", store_id)
        .gte("placed_at", since),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("store_id", store_id)
        .eq("status", "active"),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("store_id", store_id)
        .eq("fulfillment_status", "unfulfilled"),
    ]);

    if (store.error) return { content: [{ type: "text", text: store.error.message }], isError: true };
    if (!store.data)
      return { content: [{ type: "text", text: "Mağaza bulunamadı veya yetkiniz yok." }], isError: true };
    if (orders.error) return { content: [{ type: "text", text: orders.error.message }], isError: true };

    const rows = orders.data ?? [];
    const paid = rows.filter((row) => row.payment_status === "paid");
    const revenue = paid.reduce((sum, row) => sum + Number(row.grand_total ?? 0), 0);
    const summary = {
      magaza: store.data.name,
      para_birimi: store.data.currency,
      donem_gun: period,
      siparis: rows.length,
      odenmis_siparis: paid.length,
      ciro: Math.round(revenue * 100) / 100,
      ortalama_sepet: paid.length ? Math.round((revenue / paid.length) * 100) / 100 : 0,
      aktif_urun: activeProducts.count ?? 0,
      hazirlanmayan_siparis: pending.count ?? 0,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});
