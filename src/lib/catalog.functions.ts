import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { compact, slugify } from "@/lib/mefti";

/**
 * Katalog uygulama katmanı. Tenant izolasyonu RLS ile veritabanında zorlanır;
 * burada yalnızca doğrulama, slug üretimi ve audit kaydı yapılır.
 */

const statusEnum = z.enum(["draft", "active", "archived"]);

async function uniqueSlug(
  supabase: { from: (table: "products") => any },
  storeId: string,
  title: string,
) {
  const base = slugify(title) || "urun";
  let slug = base;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data: taken } = await supabase
      .from("products")
      .select("id")
      .eq("store_id", storeId)
      .eq("slug", slug)
      .maybeSingle();
    if (!taken) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return slug;
}

export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        title: z.string().trim().min(2).max(120),
        description: z.string().trim().max(4000).optional(),
        vendor: z.string().trim().max(80).optional(),
        productType: z.string().trim().max(80).optional(),
        basePrice: z.number().min(0).max(9_999_999),
        compareAtPrice: z.number().min(0).max(9_999_999).optional(),
        status: statusEnum.default("draft"),
        stock: z.number().int().min(0).max(1_000_000).default(0),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, currency, plan_id, plans(limits)")
      .eq("id", data.storeId)
      .maybeSingle();
    if (storeError) throw new Error(storeError.message);
    if (!store) throw new Error("Mağaza bulunamadı veya yetkiniz yok");

    const limits = ((store as { plans?: { limits?: Record<string, number> } }).plans?.limits ??
      {}) as { products?: number };
    if (typeof limits.products === "number" && limits.products >= 0) {
      const { count } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("store_id", data.storeId);
      if ((count ?? 0) >= limits.products) {
        throw new Error(`Paket ürün limitine ulaştınız (${limits.products}). Paketi yükseltin.`);
      }
    }

    const slug = await uniqueSlug(supabase as never, data.storeId, data.title);

    const { data: product, error } = await supabase
      .from("products")
      .insert({
        store_id: data.storeId,
        title: data.title,
        slug,
        description: data.description ?? null,
        vendor: data.vendor ?? null,
        product_type: data.productType ?? null,
        base_price: data.basePrice,
        compare_at_price: data.compareAtPrice ?? null,
        currency: store.currency,
        status: data.status,
      })
      .select("*")
      .single();
    if (error || !product) throw new Error(error?.message ?? "Ürün oluşturulamadı");

    await supabase.from("product_variants").insert({
      product_id: product.id,
      store_id: data.storeId,
      title: "Standart",
      price: data.basePrice,
      stock: data.stock,
      position: 1,
    });

    await supabase.from("audit_logs").insert({
      store_id: data.storeId,
      actor_id: userId,
      action: "product.created",
      entity: "products",
      entity_id: product.id,
      new_value: { title: product.title, slug: product.slug } as never,
    });

    return product;
  });

export const updateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        productId: z.string().uuid(),
        patch: z
          .object({
            title: z.string().trim().min(2).max(120).optional(),
            description: z.string().trim().max(4000).optional(),
            vendor: z.string().trim().max(80).optional(),
            product_type: z.string().trim().max(80).optional(),
            base_price: z.number().min(0).max(9_999_999).optional(),
            compare_at_price: z.number().min(0).max(9_999_999).nullable().optional(),
            status: statusEnum.optional(),
            track_inventory: z.boolean().optional(),
          })
          .strict(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch = compact(data.patch);

    const { data: product, error } = await supabase
      .from("products")
      .update(patch as never)
      .eq("id", data.productId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!product) throw new Error("Bu ürünü düzenleme yetkiniz yok");

    await supabase.from("audit_logs").insert({
      store_id: product.store_id,
      actor_id: userId,
      action: "product.updated",
      entity: "products",
      entity_id: product.id,
      new_value: patch as never,
    });

    return product;
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ productId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: product, error } = await supabase
      .from("products")
      .delete()
      .eq("id", data.productId)
      .select("id, store_id, title")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!product) throw new Error("Bu ürünü silme yetkiniz yok");

    await supabase.from("audit_logs").insert({
      store_id: product.store_id,
      actor_id: userId,
      action: "product.deleted",
      entity: "products",
      entity_id: product.id,
      old_value: { title: product.title } as never,
    });
    return { id: product.id };
  });

export const upsertVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        variantId: z.string().uuid().optional(),
        productId: z.string().uuid(),
        title: z.string().trim().min(1).max(80),
        sku: z.string().trim().max(60).optional(),
        price: z.number().min(0).max(9_999_999),
        costPrice: z.number().min(0).max(9_999_999).optional(),
        stock: z.number().int().min(0).max(1_000_000),
        options: z.record(z.string(), z.string()).default({}),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, store_id")
      .eq("id", data.productId)
      .maybeSingle();
    if (productError) throw new Error(productError.message);
    if (!product) throw new Error("Ürün bulunamadı veya yetkiniz yok");

    const payload = {
      product_id: product.id,
      store_id: product.store_id,
      title: data.title,
      sku: data.sku && data.sku.length > 0 ? data.sku : null,
      price: data.price,
      cost_price: data.costPrice ?? null,
      stock: data.stock,
      options: data.options as never,
    };

    const query = data.variantId
      ? supabase.from("product_variants").update(payload).eq("id", data.variantId)
      : supabase.from("product_variants").insert(payload);

    const { data: variant, error } = await query.select("*").maybeSingle();
    if (error) throw new Error(error.message);
    if (!variant) throw new Error("Varyant kaydedilemedi");

    await supabase.from("audit_logs").insert({
      store_id: product.store_id,
      actor_id: userId,
      action: data.variantId ? "variant.updated" : "variant.created",
      entity: "product_variants",
      entity_id: variant.id,
      new_value: { title: variant.title, price: variant.price, stock: variant.stock } as never,
    });

    return variant;
  });

export const deleteVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ variantId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("product_variants").delete().eq("id", data.variantId);
    if (error) throw new Error(error.message);
    return { id: data.variantId };
  });

export const createCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        title: z.string().trim().min(2).max(80),
        description: z.string().trim().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const base = slugify(data.title) || "koleksiyon";
    const { data: collection, error } = await supabase
      .from("collections")
      .insert({
        store_id: data.storeId,
        title: data.title,
        slug: `${base}-${Math.random().toString(36).slice(2, 5)}`,
        description: data.description ?? null,
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!collection) throw new Error("Koleksiyon oluşturulamadı");
    return collection;
  });

export const setProductCollections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        productId: z.string().uuid(),
        collectionIds: z.array(z.string().uuid()).max(50),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error: deleteError } = await supabase
      .from("product_collections")
      .delete()
      .eq("product_id", data.productId);
    if (deleteError) throw new Error(deleteError.message);

    if (data.collectionIds.length > 0) {
      const { error } = await supabase.from("product_collections").insert(
        data.collectionIds.map((collectionId) => ({
          product_id: data.productId,
          collection_id: collectionId,
        })),
      );
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
