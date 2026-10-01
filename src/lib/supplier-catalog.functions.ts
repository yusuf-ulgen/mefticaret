import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Satıcı panelindeki Tedarikçi Kataloğu. Mağaza yetkisi her çağrıda sunucuda doğrulanır. */

const guard = async (supabase: unknown, storeId: string, userId: string) => {
  const { assertStoreManager } = await import("@/lib/store-access.server");
  await assertStoreManager(supabase as never, storeId, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as never as { from: (t: string) => any };
};

export const listCatalogSuppliers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const { data: rows } = await db
      .from("suppliers")
      .select("id, name")
      .eq("is_active", true)
      .eq("is_public_catalog", true)
      .order("name");
    const out: { id: string; name: string; count: number }[] = [];
    for (const s of (rows ?? []) as any[]) {
      const { count } = await db.from("supplier_products").select("id", { count: "exact", head: true }).eq("supplier_id", s.id);
      if (count) out.push({ id: s.id, name: s.name, count });
    }
    return out;
  });

export const listCatalogProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ storeId: z.guid(), supplierId: z.guid(), search: z.string().max(100).default(""), page: z.number().int().min(0).max(1000).default(0) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const { data: sup } = await db.from("suppliers").select("id").eq("id", data.supplierId).eq("is_active", true).eq("is_public_catalog", true).maybeSingle();
    if (!sup) throw new Error("Tedarikçi bulunamadı");
    const size = 30;
    let q = db
      .from("supplier_products")
      .select("id, title, sku, brand, category, supplier_price, computed_price, currency, stock, images", { count: "exact" })
      .eq("supplier_id", data.supplierId)
      .order("title")
      .range(data.page * size, data.page * size + size - 1);
    const term = data.search.trim().replace(/[%,()]/g, " ");
    if (term) q = q.or(`title.ilike.%${term}%,sku.ilike.%${term}%`);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    const ids = ((rows ?? []) as any[]).map((r) => r.id);
    const { data: links } = ids.length
      ? await db.from("store_supplier_imports").select("supplier_product_id, product_id").eq("store_id", data.storeId).in("supplier_product_id", ids)
      : { data: [] };
    const linked = new Map(((links ?? []) as any[]).map((l) => [l.supplier_product_id, l.product_id]));
    return {
      total: count ?? 0,
      pageSize: size,
      items: ((rows ?? []) as any[]).map((r) => ({
        id: r.id as string,
        title: r.title as string,
        sku: r.sku as string | null,
        brand: r.brand as string | null,
        category: r.category as string | null,
        price: Number(r.computed_price ?? r.supplier_price ?? 0),
        purchasePrice: Number(r.supplier_price ?? 0),
        currency: (r.currency as string) || "TRY",
        stock: Number(r.stock ?? 0),
        image: Array.isArray(r.images) ? ((r.images[0] as string) ?? null) : null,
        productId: (linked.get(r.id) as string | undefined) ?? null,
      })),
    };
  });

export const getCatalogProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: z.guid(), id: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const { data: r } = await db
      .from("supplier_products")
      .select("id, supplier_id, title, sku, barcode, brand, category, supplier_price, computed_price, currency, stock, images, raw")
      .eq("id", data.id)
      .maybeSingle();
    if (!r) throw new Error("Ürün bulunamadı");
    const { data: sup } = await db.from("suppliers").select("name").eq("id", r.supplier_id).eq("is_active", true).eq("is_public_catalog", true).maybeSingle();
    if (!sup) throw new Error("Ürün bulunamadı");
    const lib = await import("@/lib/supplier-catalog.server");
    const variants = lib.parseVariants(r.raw);
    const { data: link } = await db.from("store_supplier_imports").select("product_id").eq("store_id", data.storeId).eq("supplier_product_id", r.id).maybeSingle();
    return {
      id: r.id as string,
      supplierName: sup.name as string,
      title: r.title as string,
      sku: r.sku as string | null,
      barcode: r.barcode as string | null,
      brand: r.brand as string | null,
      category: r.category as string | null,
      price: Number(r.computed_price ?? r.supplier_price ?? 0),
      purchasePrice: Number(r.supplier_price ?? 0),
      currency: (r.currency as string) || "TRY",
      stock: Number(r.stock ?? 0),
      images: (Array.isArray(r.images) ? r.images : []) as string[],
      description: lib.descriptionOf(r.raw),
      taxRate: variants.find((v) => v.taxRate != null)?.taxRate ?? null,
      variants: variants.map((v) => ({ ...v, options: Object.entries(v.options).map(([k, val]) => `${k}: ${val}`).join(", ") })),
      productId: (link?.product_id as string | undefined) ?? null,
    };
  });

export const importCatalogProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ storeId: z.guid(), ids: z.array(z.guid()).min(1).max(200), markup: z.number().min(0).max(1000).default(0) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const { importToStore } = await import("@/lib/supplier-catalog.server");
    return importToStore(db, data.storeId, data.ids, data.markup);
  });
