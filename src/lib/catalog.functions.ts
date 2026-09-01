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
            sku: z.string().trim().max(60).nullable().optional(),
            barcode: z.string().trim().max(60).nullable().optional(),
            seller_name: z.string().trim().max(80).nullable().optional(),
            video_url: z.string().trim().url().max(500).nullable().optional(),
            cost_price: z.number().min(0).max(9_999_999).nullable().optional(),
            tax_rate: z.number().min(0).max(100).optional(),
            weight_grams: z.number().int().min(0).max(500_000).nullable().optional(),
            length_cm: z.number().min(0).max(1000).nullable().optional(),
            width_cm: z.number().min(0).max(1000).nullable().optional(),
            height_cm: z.number().min(0).max(1000).nullable().optional(),
            tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
            slug: z
              .string()
              .trim()
              .min(2)
              .max(90)
              .regex(/^[a-z0-9-]+$/, "SEO adresi yalnızca küçük harf, sayı ve tire içerebilir")
              .optional(),
            seo: z
              .object({
                title: z.string().trim().max(70).default(""),
                description: z.string().trim().max(180).default(""),
              })
              .strict()
              .optional(),
          })
          .strict(),

      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch = compact(data.patch);

    if (typeof patch['slug'] === "string") {
      const { data: current } = await supabase
        .from("products")
        .select("store_id")
        .eq("id", data.productId)
        .maybeSingle();
      if (current) {
        const { data: clash } = await supabase
          .from("products")
          .select("id")
          .eq("store_id", current.store_id)
          .eq("slug", patch['slug'] as string)
          .neq("id", data.productId)
          .maybeSingle();
        if (clash) throw new Error("Bu SEO adresi başka bir üründe kullanılıyor");
      }
    }

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

const variantOptionsSchema = z
  .array(
    z.object({
      name: z.string().trim().min(1).max(40),
      values: z.array(z.string().trim().min(1).max(60)).max(50),
    }),
  )
  .max(6);

/** Ürün seçenek tanımlarını (Renk, Beden vb.) kaydeder. */
export const setVariantOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ productId: z.string().uuid(), options: variantOptionsSchema }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: product, error } = await supabase
      .from("products")
      .update({ variant_options: data.options as never })
      .eq("id", data.productId)
      .select("id, variant_options")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!product) throw new Error("Bu ürünü düzenleme yetkiniz yok");
    return product;
  });

/**
 * Seçenek değerlerinin tüm kombinasyonlarını üretip eksik varyantları oluşturur.
 * Mevcut kombinasyonlar korunur, yalnızca eksik olanlar eklenir.
 */
export const generateVariants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        productId: z.string().uuid(),
        options: variantOptionsSchema.optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, store_id, base_price, variant_options")
      .eq("id", data.productId)
      .maybeSingle();
    if (productError) throw new Error(productError.message);
    if (!product) throw new Error("Ürün bulunamadı veya yetkiniz yok");

    const groups = (data.options ??
      ((product as { variant_options?: unknown }).variant_options as
        | { name: string; values: string[] }[]
        | undefined) ??
      []) as { name: string; values: string[] }[];
    const usable = groups.filter((group) => group.name.trim() && group.values.length > 0);
    if (!usable.length) throw new Error("Önce en az bir seçenek ve değer tanımlayın");

    let combos: Record<string, string>[] = [{}];
    for (const group of usable) {
      const next: Record<string, string>[] = [];
      for (const combo of combos) {
        for (const value of group.values) next.push({ ...combo, [group.name]: value });
      }
      combos = next;
      if (combos.length > 300) throw new Error("Kombinasyon sayısı 300'ü aşamaz");
    }

    const { data: existing, error: existingError } = await supabase
      .from("product_variants")
      .select("id, options, position")
      .eq("product_id", product.id);
    if (existingError) throw new Error(existingError.message);

    const key = (options: Record<string, string>) =>
      usable.map((group) => `${group.name}=${options[group.name] ?? ""}`).join("|");
    const taken = new Set(
      (existing ?? []).map((row) => key((row.options ?? {}) as Record<string, string>)),
    );

    let position = (existing ?? []).reduce((max, row) => Math.max(max, row.position ?? 0), 0);
    const rows = combos
      .filter((combo) => !taken.has(key(combo)))
      .map((combo) => {
        position += 1;
        return {
          product_id: product.id,
          store_id: product.store_id,
          title: usable.map((group) => combo[group.name]).join(" / "),
          price: product.base_price,
          stock: 0,
          options: combo as never,
          position,
        };
      });

    if (rows.length) {
      const { error } = await supabase.from("product_variants").insert(rows);
      if (error) throw new Error(error.message);
    }

    return { created: rows.length, total: combos.length };
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
        barcode: z.string().trim().max(60).optional(),
        price: z.number().min(0).max(9_999_999),
        compareAtPrice: z.number().min(0).max(9_999_999).nullable().optional(),
        costPrice: z.number().min(0).max(9_999_999).nullable().optional(),
        stock: z.number().int().min(0).max(1_000_000),
        weightGrams: z.number().int().min(0).max(500_000).nullable().optional(),
        imageId: z.string().uuid().nullable().optional(),
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
      barcode: data.barcode && data.barcode.length > 0 ? data.barcode : null,
      price: data.price,
      compare_at_price: data.compareAtPrice ?? null,
      cost_price: data.costPrice ?? null,
      stock: data.stock,
      weight_grams: data.weightGrams ?? null,
      image_id: data.imageId ?? null,
      options: data.options as never,
    };

    const query = data.variantId
      ? supabase.from("product_variants").update(payload).eq("id", data.variantId)
      : supabase.from("product_variants").insert(payload);

    const { data: variant, error } = await query.select("*").maybeSingle();
    if (error) {
      if (error.code === "23505" || /duplicate key/i.test(error.message)) {
        throw new Error("Bu SKU veya barkod başka bir varyantta kullanılıyor");
      }
      throw new Error(error.message);
    }
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
