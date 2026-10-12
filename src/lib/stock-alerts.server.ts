import { z } from "zod";

/**
 * "Stoğa gelince haber ver" kayıtları. Ziyaretçi yazımı doğrudan RLS ile
 * engellidir; kayıt yalnızca burada, mağazanın yayınlanmış ve ürünün aktif
 * olduğu doğrulandıktan sonra servis anahtarıyla oluşturulur.
 */

export const stockAlertSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  productSlug: z.string().trim().min(1).max(160),
  variantId: z.guid().optional(),
  email: z.string().trim().email().max(180),
});

export type StockAlertInput = z.infer<typeof stockAlertSchema>;

export async function subscribeStockAlert(input: StockAlertInput) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: store, error: storeError } = await supabaseAdmin
    .from("stores")
    .select("id, status")
    .eq("slug", input.slug)
    .maybeSingle();
  if (storeError) throw new Error(storeError.message);
  if (!store || store.status !== "active") throw new Error("Mağaza bulunamadı");

  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select("id, status")
    .eq("store_id", store.id)
    .eq("slug", input.productSlug)
    .maybeSingle();
  if (productError) throw new Error(productError.message);
  if (!product || product.status !== "active") throw new Error("Ürün bulunamadı");

  let variantId: string | null = null;
  if (input.variantId) {
    const { data: variant, error: variantError } = await supabaseAdmin
      .from("product_variants")
      .select("id")
      .eq("id", input.variantId)
      .eq("product_id", product.id)
      .maybeSingle();
    if (variantError) throw new Error(variantError.message);
    variantId = variant?.id ?? null;
  }

  const email = input.email.trim().toLowerCase();

  const { data: existing } = await supabaseAdmin
    .from("stock_alerts")
    .select("id")
    .eq("store_id", store.id)
    .eq("product_id", product.id)
    .eq("email", email)
    .is("notified_at", null)
    .limit(1)
    .maybeSingle();

  if (existing) return { ok: true, duplicate: true as const };

  const { error: insertError } = await supabaseAdmin.from("stock_alerts").insert({
    store_id: store.id,
    product_id: product.id,
    variant_id: variantId,
    email,
  });
  if (insertError) throw new Error(insertError.message);

  return { ok: true, duplicate: false as const };
}
