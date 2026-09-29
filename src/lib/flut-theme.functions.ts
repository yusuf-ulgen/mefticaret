import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Flüt teması ürün sayfası ekleri: son 30 gündeki gerçek alıcı sayısı ve
 * kombin için benzer ürünlerin satın alınabilir ilk varyantı. Yalnız aktif
 * mağazanın aktif ürünleri; müşteri verisi döndürülmez.
 */
export const getFlutProductExtras = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({
      slug: z.string().trim().min(1).max(120),
      productId: z.string().uuid(),
      relatedIds: z.array(z.string().uuid()).max(3),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: store } = await supabaseAdmin.from("stores").select("id, status").eq("slug", data.slug).maybeSingle();
    if (!store || store.status !== "active") return { monthlyBuyers: 0, bundle: [] as BundleItem[] };

    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("order_id, orders!inner(payment_status)")
      .eq("store_id", store.id)
      .eq("product_id", data.productId)
      .eq("orders.payment_status", "paid")
      .gte("created_at", since)
      .limit(2000);
    const monthlyBuyers = new Set((items ?? []).map((r) => r.order_id)).size;

    const bundle: BundleItem[] = [];
    if (data.relatedIds.length) {
      const { data: prods } = await supabaseAdmin
        .from("products")
        .select("id, title, slug, currency")
        .eq("store_id", store.id)
        .eq("status", "active")
        .in("id", data.relatedIds);
      const { data: vars } = await supabaseAdmin
        .from("product_variants")
        .select("id, product_id, title, price, stock, position")
        .in("product_id", data.relatedIds)
        .gt("stock", 0)
        .order("position");
      for (const p of prods ?? []) {
        const v = (vars ?? []).find((x) => x.product_id === p.id);
        if (v) bundle.push({ productId: p.id, title: p.title, slug: p.slug, currency: p.currency, variantId: v.id, variantTitle: v.title, price: Number(v.price), stock: v.stock });
      }
    }
    return { monthlyBuyers, bundle };
  });

export type BundleItem = {
  productId: string; title: string; slug: string; currency: string;
  variantId: string; variantTitle: string; price: number; stock: number;
};
