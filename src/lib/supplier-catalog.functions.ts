import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { categoryLeaf } from "@/lib/import-category";

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
      const { count } = await db
        .from("supplier_products")
        .select("id", { count: "exact", head: true })
        .eq("supplier_id", s.id);
      if (count) out.push({ id: s.id, name: s.name, count });
    }
    return out;
  });

const SORTS = {
  title: ["title", true],
  price_asc: ["supplier_price", true],
  price_desc: ["supplier_price", false],
  newest: ["created_at", false],
  stock: ["stock", false],
} as const;

export const listCatalogProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        storeId: z.guid(),
        supplierId: z.guid(),
        search: z.string().max(100).default(""),
        page: z.number().int().min(0).max(1000).default(0),
        category: z.string().max(200).default(""),
        brand: z.string().max(200).default(""),
        minPrice: z.number().min(0).nullable().default(null),
        maxPrice: z.number().min(0).nullable().default(null),
        inStock: z.boolean().default(false),
        notImported: z.boolean().default(false),
        sort: z.enum(["title", "price_asc", "price_desc", "newest", "stock"]).default("title"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const { data: sup } = await db
      .from("suppliers")
      .select("id")
      .eq("id", data.supplierId)
      .eq("is_active", true)
      .eq("is_public_catalog", true)
      .maybeSingle();
    if (!sup) throw new Error("Tedarikçi bulunamadı");
    const size = 30;
    const [col, asc] = SORTS[data.sort];
    let q = db
      .from("supplier_products")
      .select(
        "id, title, sku, brand, category, supplier_price, computed_price, suggested_price, currency, stock, images, created_at",
        { count: "exact" },
      )
      .eq("supplier_id", data.supplierId)
      .eq("catalog_visible", true)
      .order(col, { ascending: asc })
      .range(data.page * size, data.page * size + size - 1);
    const term = data.search.trim().replace(/[%,()]/g, " ");
    if (term) q = q.or(`title.ilike.%${term}%,sku.ilike.%${term}%`);
    if (data.category) q = q.eq("category", data.category);
    if (data.brand) q = q.eq("brand", data.brand);
    if (data.minPrice != null) q = q.gte("supplier_price", data.minPrice);
    if (data.maxPrice != null) q = q.lte("supplier_price", data.maxPrice);
    if (data.inStock) q = q.gt("stock", 0);
    if (data.notImported) {
      const { data: have } = await db
        .from("store_supplier_imports")
        .select("supplier_product_id")
        .eq("store_id", data.storeId)
        .eq("supplier_id", data.supplierId)
        .limit(5000);
      const ids = ((have ?? []) as any[]).map((r) => r.supplier_product_id);
      if (ids.length) q = q.not("id", "in", `(${ids.join(",")})`);
    }
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    const ids = ((rows ?? []) as any[]).map((r) => r.id);
    const { data: links } = ids.length
      ? await db
          .from("store_supplier_imports")
          .select("supplier_product_id, product_id")
          .eq("store_id", data.storeId)
          .in("supplier_product_id", ids)
      : { data: [] };
    const linked = new Map(
      ((links ?? []) as any[]).map((l) => [l.supplier_product_id, l.product_id]),
    );
    return {
      total: count ?? 0,
      pageSize: size,
      items: ((rows ?? []) as any[]).map((r) => {
        const price = Number(r.computed_price ?? r.suggested_price ?? r.supplier_price ?? 0);
        const purchasePrice = Number(r.supplier_price ?? 0);
        return {
          id: r.id as string,
          title: r.title as string,
          sku: r.sku as string | null,
          brand: r.brand as string | null,
          category: r.category as string | null,
          price,
          purchasePrice,
          marginPercent:
            purchasePrice > 0 ? Math.round(((price - purchasePrice) / purchasePrice) * 100) : null,
          currency: (r.currency as string) || "TRY",
          stock: Number(r.stock ?? 0),
          image: Array.isArray(r.images) ? ((r.images[0] as string) ?? null) : null,
          isNew: Date.now() - new Date(r.created_at).getTime() < 7 * 86400_000,
          productId: (linked.get(r.id) as string | undefined) ?? null,
        };
      }),
    };
  });

/** Filtre seçenekleri: tedarikçinin kategorileri ve markaları. */
export const listCatalogFacets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: z.guid(), supplierId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const { data: rows } = await db
      .from("supplier_products")
      .select("category, brand")
      .eq("supplier_id", data.supplierId)
      .eq("catalog_visible", true)
      .limit(20000);
    const cats = new Map<string, number>();
    const brands = new Map<string, number>();
    for (const r of (rows ?? []) as any[]) {
      if (r.category) cats.set(r.category, (cats.get(r.category) ?? 0) + 1);
      if (r.brand) brands.set(r.brand, (brands.get(r.brand) ?? 0) + 1);
    }
    const toList = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
    return { categories: toList(cats), brands: toList(brands) };
  });

/* --------------------------- Aktarılanlar ---------------------------- */

export const listStoreImports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        storeId: z.guid(),
        page: z.number().int().min(0).max(1000).default(0),
        supplierId: z.guid().nullable().default(null),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const size = 30;
    let q = db
      .from("store_supplier_imports")
      .select(
        "id, supplier_id, supplier_product_id, product_id, markup_percent, sync_enabled, last_synced_at",
        { count: "exact" },
      )
      .eq("store_id", data.storeId)
      .order("created_at", { ascending: false })
      .range(data.page * size, data.page * size + size - 1);
    if (data.supplierId) q = q.eq("supplier_id", data.supplierId);
    const { data: rows, count } = await q;
    const list = (rows ?? []) as any[];
    const [{ data: prods }, { data: sps }, { data: sups }] = await Promise.all([
      list.length
        ? db
            .from("products")
            .select("id, title, base_price, currency, status")
            .in(
              "id",
              list.map((r) => r.product_id),
            )
        : { data: [] },
      list.length
        ? db
            .from("supplier_products")
            .select("id, supplier_price, stock, images")
            .in(
              "id",
              list.map((r) => r.supplier_product_id),
            )
        : { data: [] },
      list.length
        ? db
            .from("suppliers")
            .select("id, name")
            .in("id", [...new Set(list.map((r) => r.supplier_id))])
        : { data: [] },
    ]);
    const P = new Map(((prods ?? []) as any[]).map((p) => [p.id, p]));
    const S = new Map(((sps ?? []) as any[]).map((p) => [p.id, p]));
    const N = new Map(((sups ?? []) as any[]).map((p) => [p.id, p.name]));
    return {
      total: count ?? 0,
      pageSize: size,
      items: list.map((r) => {
        const p = P.get(r.product_id);
        const sp = S.get(r.supplier_product_id);
        return {
          id: r.id as string,
          productId: r.product_id as string,
          title: (p?.title as string) ?? "—",
          status: (p?.status as string) ?? "active",
          salePrice: Number(p?.base_price ?? 0),
          currency: (p?.currency as string) || "TRY",
          purchasePrice: Number(sp?.supplier_price ?? 0),
          supplierStock: Number(sp?.stock ?? 0),
          image: Array.isArray(sp?.images) ? ((sp.images[0] as string) ?? null) : null,
          supplierName: (N.get(r.supplier_id) as string) ?? "",
          markup: Number(r.markup_percent ?? 0),
          syncEnabled: !!r.sync_enabled,
          lastSyncedAt: r.last_synced_at as string,
        };
      }),
    };
  });

/** Önizleme salt okunurdur; aktarım son adımda yetki ve kotayı tekrar doğrular. */
export const previewCatalogImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        storeId: z.guid(),
        ids: z.array(z.guid()).min(1).max(500),
        markup: z.number().finite().min(0).max(1000).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const ids = [...new Set(data.ids)];
    const queries = await Promise.all([
      db
        .from("supplier_products")
        .select(
          "id, supplier_id, catalog_visible, title, sku, category, raw, supplier_price, computed_price, suggested_price, currency",
        )
        .in("id", ids)
        .eq("catalog_visible", true),
      db
        .from("store_supplier_imports")
        .select("supplier_product_id")
        .eq("store_id", data.storeId)
        .in("supplier_product_id", ids),
      db.from("suppliers").select("id").eq("is_active", true).eq("is_public_catalog", true),
      db
        .from("store_supplier_category_maps")
        .select("supplier_id, source_category, category_id, markup_percent")
        .eq("store_id", data.storeId),
      db.from("categories").select("id, name").eq("store_id", data.storeId),
    ]);
    for (const query of queries) if (query.error) throw new Error(query.error.message);
    const [products, imports, suppliers, maps, categories] = queries;
    const allowed = new Set((suppliers.data ?? []).map((r: { id: string }) => r.id));
    const existing = new Set(
      (imports.data ?? []).map((r: { supplier_product_id: string }) => r.supplier_product_id),
    );
    const library = await import("@/lib/supplier-catalog.server");
    const skuCounts = new Map<string, number>();
    for (const row of products.data ?? [])
      if (row.sku) skuCounts.set(row.sku, (skuCounts.get(row.sku) ?? 0) + 1);
    const items: Array<{ id: string; title: string; sku: string | null; sourceCategory: string | null; targetCategory: string | null; existing: boolean; variants: number; price: number; currency: string; warning: string | null }> = (products.data ?? [])
      .filter((row: { supplier_id: string }) => allowed.has(row.supplier_id))
      .map((row: any) => {
        const mapping = (maps.data ?? []).find(
          (m: any) => m.supplier_id === row.supplier_id && m.source_category === row.category,
        );
        const leaf = categoryLeaf(row.category);
        const category = (categories.data ?? []).find((c: any) =>
          mapping?.category_id
            ? c.id === mapping.category_id
            : c.name?.toLocaleLowerCase("tr") === leaf?.toLocaleLowerCase("tr"),
        );
        return {
          id: String(row.id),
          title: String(row.title),
          sku: row.sku as string | null,
          sourceCategory: row.category as string | null,
          targetCategory: category?.name ?? leaf,
          existing: existing.has(row.id),
          variants: Math.max(1, library.parseVariants(row.raw).length),
          price: library.salePriceOf(
            row,
            data.markup > 0 ? data.markup : Number(mapping?.markup_percent ?? 0),
          ),
          currency: row.currency || "TRY",
          warning:
            (skuCounts.get(row.sku) ?? 0) > 1
              ? "Seçimde aynı SKU birden fazla kaynak üründe var; ayrı ürün olarak aktarılacak."
              : mapping?.category_id && !category
                ? "Kategori eşlemesi artık geçerli değil; aktarım öncesinde düzeltin."
                : !category && leaf
                  ? "Bu kategori aktarım sırasında oluşturulacak."
                  : null,
        };
      });
    return {
      items,
      newCount: items.filter((r: { existing: boolean }) => !r.existing).length,
      existingCount: items.filter((r: { existing: boolean }) => r.existing).length,
      unavailableCount: ids.length - items.length,
      quota: await library.kolayImportQuota(db, data.storeId),
    };
  });

export const updateStoreImports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        storeId: z.guid(),
        ids: z.array(z.guid()).min(1).max(500),
        markup: z.number().min(0).max(1000).optional(),
        syncEnabled: z.boolean().optional(),
        status: z.enum(["active", "draft", "archived"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const patch: Record<string, unknown> = {};
    if (data.markup !== undefined) patch["markup_percent"] = data.markup;
    if (data.syncEnabled !== undefined) patch["sync_enabled"] = data.syncEnabled;
    const { data: rows } = await db
      .from("store_supplier_imports")
      .select("id, supplier_id, product_id")
      .eq("store_id", data.storeId)
      .in("id", data.ids);
    const list = (rows ?? []) as any[];
    if (Object.keys(patch).length)
      await db
        .from("store_supplier_imports")
        .update(patch)
        .eq("store_id", data.storeId)
        .in("id", data.ids);
    if (data.status)
      await db
        .from("products")
        .update({ status: data.status })
        .eq("store_id", data.storeId)
        .in(
          "id",
          list.map((r) => r.product_id),
        );
    if (data.markup !== undefined || data.syncEnabled === true) {
      const { propagateToImporters } = await import("@/lib/supplier-catalog.server");
      for (const sid of new Set(list.map((r) => r.supplier_id)))
        await propagateToImporters(db, sid);
    }
    return { updated: list.length };
  });

export const removeStoreImports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        storeId: z.guid(),
        ids: z.array(z.guid()).min(1).max(500),
        deleteProducts: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const { data: rows } = await db
      .from("store_supplier_imports")
      .select("id, product_id")
      .eq("store_id", data.storeId)
      .in("id", data.ids);
    const list = (rows ?? []) as any[];
    await db
      .from("store_supplier_imports")
      .delete()
      .eq("store_id", data.storeId)
      .in("id", data.ids);
    if (data.deleteProducts && list.length) {
      await db
        .from("products")
        .update({ status: "archived" })
        .eq("store_id", data.storeId)
        .in(
          "id",
          list.map((r) => r.product_id),
        );
    }
    return { removed: list.length };
  });

/* ------------------------ Kategori eşleştirme ------------------------ */

export const getCategoryMaps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: z.guid(), supplierId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const [{ data: sp }, { data: maps }, { data: cats }] = await Promise.all([
      db
        .from("supplier_products")
        .select("category")
        .eq("supplier_id", data.supplierId)
        .limit(20000),
      db
        .from("store_supplier_category_maps")
        .select("source_category, category_id, markup_percent")
        .eq("store_id", data.storeId)
        .eq("supplier_id", data.supplierId),
      db
        .from("categories")
        .select("id, name")
        .eq("store_id", data.storeId)
        .order("name")
        .limit(1000),
    ]);
    const counts = new Map<string, number>();
    for (const r of (sp ?? []) as any[])
      if (r.category) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
    const M = new Map(((maps ?? []) as any[]).map((m) => [m.source_category, m]));
    return {
      storeCategories: ((cats ?? []) as any[]).map((c) => ({
        id: c.id as string,
        name: c.name as string,
      })),
      rows: [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([source, count]) => ({
          source,
          count,
          categoryId: (M.get(source)?.category_id as string | null) ?? null,
          markup:
            M.get(source)?.markup_percent != null ? Number(M.get(source).markup_percent) : null,
        })),
    };
  });

export const saveCategoryMaps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        storeId: z.guid(),
        supplierId: z.guid(),
        rows: z
          .array(
            z.object({
              source: z.string().min(1).max(300),
              categoryId: z.guid().nullable(),
              markup: z.number().min(0).max(1000).nullable(),
            }),
          )
          .max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const catIds = data.rows.map((r) => r.categoryId).filter(Boolean) as string[];
    if (catIds.length) {
      const { data: own } = await db
        .from("categories")
        .select("id")
        .eq("store_id", data.storeId)
        .in("id", catIds);
      if ((own ?? []).length !== new Set(catIds).size)
        throw new Error("Kategori bu mağazaya ait değil");
    }
    const rows = data.rows.map((r) => ({
      store_id: data.storeId,
      supplier_id: data.supplierId,
      source_category: r.source,
      category_id: r.categoryId,
      markup_percent: r.markup,
    }));
    if (rows.length) {
      const { error } = await db
        .from("store_supplier_category_maps")
        .upsert(rows, { onConflict: "store_id,supplier_id,source_category" });
      if (error) throw new Error(error.message);
    }
    return { saved: rows.length };
  });

/* -------------------------- Otomatik aktarım ------------------------- */

export const getAutoImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: z.guid(), supplierId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const { data: row } = await db
      .from("store_supplier_auto_imports")
      .select("enabled, markup_percent, last_run_at, last_result")
      .eq("store_id", data.storeId)
      .eq("supplier_id", data.supplierId)
      .maybeSingle();
    return row
      ? {
          enabled: !!row.enabled,
          markup: Number(row.markup_percent ?? 0),
          lastRunAt: row.last_run_at as string | null,
          lastResult: row.last_result as {
            imported: number;
            failed: number;
            remaining: number;
          } | null,
        }
      : { enabled: false, markup: 0, lastRunAt: null, lastResult: null };
  });

export const saveAutoImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        storeId: z.guid(),
        supplierId: z.guid(),
        enabled: z.boolean(),
        markup: z.number().min(0).max(1000),
        runNow: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const { data: sup } = await db
      .from("suppliers")
      .select("id")
      .eq("id", data.supplierId)
      .eq("is_active", true)
      .eq("is_public_catalog", true)
      .maybeSingle();
    if (!sup) throw new Error("Tedarikçi bulunamadı");
    const { error } = await db
      .from("store_supplier_auto_imports")
      .upsert(
        {
          store_id: data.storeId,
          supplier_id: data.supplierId,
          enabled: data.enabled,
          markup_percent: data.markup,
        },
        { onConflict: "store_id,supplier_id" },
      );
    if (error) throw new Error(error.message);
    if (data.enabled && data.runNow) {
      const { runAutoImports } = await import("@/lib/supplier-catalog.server");
      const [res] = await runAutoImports(db, {
        storeId: data.storeId,
        supplierId: data.supplierId,
      });
      return { imported: res?.imported ?? 0, remaining: res?.remaining ?? 0 };
    }
    return { imported: 0, remaining: 0 };
  });

export const getCatalogProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: z.guid(), id: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const { data: r } = await db
      .from("supplier_products")
      .select(
        "id, supplier_id, title, sku, barcode, brand, category, supplier_price, computed_price, currency, stock, images, raw",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (!r) throw new Error("Ürün bulunamadı");
    const { data: sup } = await db
      .from("suppliers")
      .select("name")
      .eq("id", r.supplier_id)
      .eq("is_active", true)
      .eq("is_public_catalog", true)
      .maybeSingle();
    if (!sup) throw new Error("Ürün bulunamadı");
    const lib = await import("@/lib/supplier-catalog.server");
    const variants = lib.parseVariants(r.raw);
    const { data: link } = await db
      .from("store_supplier_imports")
      .select("product_id")
      .eq("store_id", data.storeId)
      .eq("supplier_product_id", r.id)
      .maybeSingle();
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
      variants: variants.map((v) => ({
        ...v,
        options: Object.entries(v.options)
          .map(([k, val]) => `${k}: ${val}`)
          .join(", "),
      })),
      productId: (link?.product_id as string | undefined) ?? null,
    };
  });

export const getKolayImportQuota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const { kolayImportQuota } = await import("@/lib/supplier-catalog.server");
    return kolayImportQuota(db, data.storeId);
  });

export const importCatalogProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        storeId: z.guid(),
        ids: z.array(z.guid()).min(1).max(200),
        markup: z.number().min(0).max(1000).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const { importToStore } = await import("@/lib/supplier-catalog.server");
    return importToStore(db, data.storeId, data.ids, data.markup);
  });
