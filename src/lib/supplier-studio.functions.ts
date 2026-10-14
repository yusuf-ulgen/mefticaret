import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { productImageSources } from "@/lib/product-image-sources";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Tedarikçi paneli katalog stüdyosu: elle ürün ekle/düzenle, toplu fiyat/stok,
 * katalog görünürlüğü ve satıcı istatistikleri. Her çağrı portal_user_id ile doğrulanır.
 */

const access = async (supabase: unknown, userId: string, supplierId: string) => {
  const { listPortalSuppliers } = await import("@/lib/supplier-portal.server");
  const suppliers = await listPortalSuppliers(supabase as never, userId);
  const supplier = suppliers.find((row: { id: string }) => row.id === supplierId);
  if (!supplier) throw new Error("Bu tedarikçi kaydına erişiminiz yok");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as never as { from: (t: string) => any };
  const { data: row, error: supplierError } = await db.from("suppliers").select("id, store_id, currency, is_public_catalog").eq("id", supplierId).single();
  if (supplierError) throw new Error(supplierError.message);
  if (!row) throw new Error("Tedarikçi bulunamadı");
  return { db, supplier: row as { id: string; store_id: string; currency: string | null; is_public_catalog: boolean } };
};

const propagate = async (db: { from: (t: string) => any }, supplierId: string) => {
  const { propagateToImporters } = await import("@/lib/supplier-catalog.server");
  await propagateToImporters(db, supplierId);
};

export const studioOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ supplierId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, supplier } = await access(context.supabase, context.userId, data.supplierId);
    const sources = await Promise.all([
      db.from("supplier_products").select("id", { count: "exact", head: true }).eq("supplier_id", supplier.id),
      db.from("supplier_products").select("id", { count: "exact", head: true }).eq("supplier_id", supplier.id).eq("catalog_visible", false),
      db.from("supplier_products").select("id", { count: "exact", head: true }).eq("supplier_id", supplier.id).lte("stock", 0),
      db.from("store_supplier_imports").select("store_id, supplier_product_id, product_id").eq("supplier_id", supplier.id).limit(20000),
    ]);
    for (const source of sources) if (source.error) throw new Error(source.error.message);
    const [{ count: total }, { count: hidden }, { count: outOfStock }, { data: links }] = sources;
    if (total == null || hidden == null || outOfStock == null) throw new Error("Katalog sayıları alınamadı");
    const list = (links ?? []) as any[];
    const byProduct = new Map<string, number>();
    for (const l of list) byProduct.set(l.supplier_product_id, (byProduct.get(l.supplier_product_id) ?? 0) + 1);
    const productIds = list.map((l) => l.product_id);
    const sold = new Map<string, { qty: number; revenue: number }>();
    for (let i = 0; i < productIds.length; i += 300) {
      const { data: items, error: itemsError } = await db.from("order_items").select("product_id, quantity, line_total").in("product_id", productIds.slice(i, i + 300)).limit(5000);
      if (itemsError) throw new Error(itemsError.message);
      for (const it of (items ?? []) as any[]) {
        const cur = sold.get(it.product_id) ?? { qty: 0, revenue: 0 };
        cur.qty += Number(it.quantity ?? 0);
        cur.revenue += Number(it.line_total ?? 0);
        sold.set(it.product_id, cur);
      }
    }
    const soldBySp = new Map<string, { qty: number; revenue: number }>();
    for (const l of list) {
      const s = sold.get(l.product_id);
      if (!s) continue;
      const cur = soldBySp.get(l.supplier_product_id) ?? { qty: 0, revenue: 0 };
      cur.qty += s.qty;
      cur.revenue += s.revenue;
      soldBySp.set(l.supplier_product_id, cur);
    }
    const topIds = [...new Set([...[...byProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map((e) => e[0]), ...[...soldBySp.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 10).map((e) => e[0])])];
    const { data: titles, error: titlesError } = topIds.length ? await db.from("supplier_products").select("id, title").in("id", topIds) : { data: [], error: null };
    if (titlesError) throw new Error(titlesError.message);
    const T = new Map(((titles ?? []) as any[]).map((t) => [t.id, t.title]));
    return {
      isPublic: !!supplier.is_public_catalog,
      currency: supplier.currency || "TRY",
      totalProducts: total ?? 0,
      hiddenProducts: hidden ?? 0,
      outOfStock: outOfStock ?? 0,
      stores: new Set(list.map((l) => l.store_id)).size,
      imports: list.length,
      unitsSold: [...soldBySp.values()].reduce((a, b) => a + b.qty, 0),
      revenue: [...soldBySp.values()].reduce((a, b) => a + b.revenue, 0),
      topImported: [...byProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, count]) => ({ id, title: (T.get(id) as string) ?? "—", count })),
      topSold: [...soldBySp.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 10).map(([id, v]) => ({ id, title: (T.get(id) as string) ?? "—", ...v })),
    };
  });

export const studioListProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ supplierId: z.guid(), search: z.string().max(100).default(""), page: z.number().int().min(0).max(1000).default(0), filter: z.enum(["all", "visible", "hidden", "out"]).default("all") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, supplier } = await access(context.supabase, context.userId, data.supplierId);
    const size = 25;
    let q = db
      .from("supplier_products")
      .select("id, title, sku, barcode, brand, category, supplier_price, computed_price, suggested_price, stock, images, raw, catalog_visible, currency", { count: "exact" })
      .eq("supplier_id", supplier.id)
      .order("updated_at", { ascending: false })
      .range(data.page * size, data.page * size + size - 1);
    const term = data.search.trim().replace(/[%,()]/g, " ");
    if (term) q = q.or(`title.ilike.%${term}%,sku.ilike.%${term}%,barcode.ilike.%${term}%`);
    if (data.filter === "visible") q = q.eq("catalog_visible", true);
    if (data.filter === "hidden") q = q.eq("catalog_visible", false);
    if (data.filter === "out") q = q.lte("stock", 0);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return {
      total: count ?? 0,
      pageSize: size,
      items: ((rows ?? []) as any[]).map((r) => ({
        id: r.id as string,
        title: r.title as string,
        sku: r.sku as string | null,
        barcode: r.barcode as string | null,
        brand: r.brand as string | null,
        category: r.category as string | null,
        purchasePrice: Number(r.supplier_price ?? 0),
        salePrice: r.computed_price != null ? Number(r.computed_price) : null,
        suggestedPrice: r.suggested_price != null ? Number(r.suggested_price) : null,
        stock: Number(r.stock ?? 0),
        images: productImageSources(r.images, r.raw),
        visible: r.catalog_visible !== false,
        currency: (r.currency as string) || "TRY",
      })),
    };
  });

export const studioGetProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ supplierId: z.guid(), id: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, supplier } = await access(context.supabase, context.userId, data.supplierId);
    const { data: r } = await db.from("supplier_products").select("id, raw").eq("id", data.id).eq("supplier_id", supplier.id).maybeSingle();
    if (!r) throw new Error("Ürün bulunamadı");
    const lib = await import("@/lib/supplier-catalog.server");
    const variants = lib.parseVariants(r.raw);
    return {
      description: lib.descriptionOf(r.raw),
      taxRate: variants.find((v) => v.taxRate != null)?.taxRate ?? null,
      variants: variants.map((v) => ({ size: v.options["Beden"] ?? "", color: v.options["Renk"] ?? "", barcode: v.barcode ?? "", stock: v.stock, price: v.price })),
    };
  });

const variantSchema = z.object({
  size: z.string().max(60).default(""),
  color: z.string().max(60).default(""),
  barcode: z.string().max(100).default(""),
  stock: z.number().int().min(0).max(10_000_000),
  price: z.number().min(0).max(100_000_000).nullable().default(null),
});

export const studioSaveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        supplierId: z.guid(),
        id: z.guid().nullable().default(null),
        title: z.string().trim().min(2).max(400),
        sku: z.string().trim().min(1).max(100),
        barcode: z.string().max(100).default(""),
        brand: z.string().max(200).default(""),
        category: z.string().max(300).default(""),
        purchasePrice: z.number().min(0).max(100_000_000),
        salePrice: z.number().min(0).max(100_000_000).nullable().default(null),
        suggestedPrice: z.number().min(0).max(100_000_000).nullable().default(null),
        taxRate: z.number().min(0).max(100).nullable().default(null),
        stock: z.number().int().min(0).max(10_000_000),
        images: z.array(z.string().url().max(1000)).max(100).default([]),
        description: z.string().max(200_000).default(""),
        visible: z.boolean().default(true),
        variants: z.array(variantSchema).max(300).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, supplier } = await access(context.supabase, context.userId, data.supplierId);
    const raw: Record<string, unknown> = { description: data.description, source: "manual" };
    data.variants.forEach((v, i) => {
      const k = `UrunSecenek.Secenek[${i}]`;
      if (v.size) raw[`${k}.beden`] = v.size;
      if (v.color) raw[`${k}.renk`] = v.color;
      raw[`${k}.Barkod`] = v.barcode || `${data.sku}-${i + 1}`;
      raw[`${k}.StokKodu`] = data.sku;
      raw[`${k}.StokAdedi`] = String(v.stock);
      raw[`${k}.BayiFiyati`] = String(v.price ?? data.purchasePrice);
      if (data.taxRate != null) raw[`${k}.KdvOrani`] = String(data.taxRate);
    });
    if (!data.variants.length) {
      raw["UrunSecenek.Secenek[0].StokAdedi"] = String(data.stock);
      raw["UrunSecenek.Secenek[0].Barkod"] = data.barcode || data.sku;
      raw["UrunSecenek.Secenek[0].StokKodu"] = data.sku;
      raw["UrunSecenek.Secenek[0].BayiFiyati"] = String(data.purchasePrice);
      if (data.taxRate != null) raw["UrunSecenek.Secenek[0].KdvOrani"] = String(data.taxRate);
    }
    const stock = data.variants.length ? data.variants.reduce((a, v) => a + v.stock, 0) : data.stock;
    const record = {
      store_id: supplier.store_id,
      supplier_id: supplier.id,
      external_id: data.sku,
      sku: data.sku,
      barcode: data.barcode || null,
      title: data.title,
      brand: data.brand || null,
      category: data.category || null,
      supplier_price: data.purchasePrice,
      computed_price: data.salePrice,
      suggested_price: data.suggestedPrice,
      currency: supplier.currency || "TRY",
      stock,
      images: data.images,
      raw,
      catalog_visible: data.visible,
      last_seen_at: new Date().toISOString(),
    };
    if (data.id) {
      const { data: row, error } = await db.from("supplier_products").update(record).eq("id", data.id).eq("supplier_id", supplier.id).select("id").maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) throw new Error("Ürün bulunamadı");
    } else {
      const { data: dup } = await db.from("supplier_products").select("id").eq("supplier_id", supplier.id).eq("external_id", data.sku).maybeSingle();
      if (dup) throw new Error("Bu stok koduyla bir ürün zaten var");
      const { error } = await db.from("supplier_products").insert(record);
      if (error) throw new Error(error.message);
    }
    await propagate(db, supplier.id);
    if (!data.id) {
      const { runAutoImports } = await import("@/lib/supplier-catalog.server");
      await runAutoImports(db, { supplierId: supplier.id });
    }
    return { ok: true };
  });

export const studioBulkUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        supplierId: z.guid(),
        ids: z.array(z.guid()).min(1).max(1000),
        pricePercent: z.number().min(-90).max(1000).optional(),
        setStock: z.number().int().min(0).max(10_000_000).optional(),
        visible: z.boolean().optional(),
        remove: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, supplier } = await access(context.supabase, context.userId, data.supplierId);
    if (data.remove) {
      const { count } = await db.from("store_supplier_imports").select("id", { count: "exact", head: true }).in("supplier_product_id", data.ids);
      if (count) throw new Error(`${count} mağaza bu ürünleri satıyor; silmek yerine katalogdan gizleyin`);
      await db.from("supplier_products").delete().eq("supplier_id", supplier.id).in("id", data.ids);
      return { updated: data.ids.length };
    }
    if (data.visible !== undefined) await db.from("supplier_products").update({ catalog_visible: data.visible }).eq("supplier_id", supplier.id).in("id", data.ids);
    if (data.pricePercent !== undefined || data.setStock !== undefined) {
      const { data: rows } = await db.from("supplier_products").select("id, supplier_price, computed_price, raw").eq("supplier_id", supplier.id).in("id", data.ids);
      const f = 1 + (data.pricePercent ?? 0) / 100;
      const r2 = (n: number) => Math.round(n * 100) / 100;
      for (const r of (rows ?? []) as any[]) {
        const raw = { ...(r.raw ?? {}) } as Record<string, unknown>;
        for (const k of Object.keys(raw)) {
          if (data.pricePercent !== undefined && /\.BayiFiyati$/i.test(k)) raw[k] = String(r2(Number(raw[k] ?? 0) * f));
          if (data.setStock !== undefined && /\.StokAdedi$/i.test(k)) raw[k] = String(data.setStock);
        }
        const patch: Record<string, unknown> = { raw };
        if (data.pricePercent !== undefined) {
          patch["supplier_price"] = r2(Number(r.supplier_price ?? 0) * f);
          if (r.computed_price != null) patch["computed_price"] = r2(Number(r.computed_price) * f);
        }
        if (data.setStock !== undefined) patch["stock"] = data.setStock;
        await db.from("supplier_products").update(patch).eq("id", r.id);
      }
    }
    await propagate(db, supplier.id);
    return { updated: data.ids.length };
  });

export const studioSetCatalogPublic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ supplierId: z.guid(), isPublic: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, supplier } = await access(context.supabase, context.userId, data.supplierId);
    await db.from("suppliers").update({ is_public_catalog: data.isPublic }).eq("id", supplier.id);
    return { ok: true };
  });
