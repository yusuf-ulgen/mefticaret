import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { compact, slugify } from "@/lib/mefti";
import { insertAuditRow } from "./audit.server";

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
        storeId: z.guid(),
        title: z.string().trim().min(2).max(120),
        description: z.string().trim().max(200_000).optional(),
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
      .select("id, slug, currency, plan_id")
      .eq("id", data.storeId)
      .maybeSingle();
    if (storeError) throw new Error(storeError.message);
    if (!store) throw new Error("Mağaza bulunamadı veya yetkiniz yok");

    // Paket kotası veritabanındaki plan_features üzerinden zorlanır.
    const { requirePlanQuota } = await import("@/lib/entitlements.server");
    await requirePlanQuota(
      supabase as never,
      data.storeId,
      "products",
      async () => {
        const { count } = await supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("store_id", data.storeId);
        return count ?? 0;
      },
      "Paket ürün",
    );

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

    await insertAuditRow(supabase, {
      store_id: data.storeId,
      actor_id: userId,
      action: "product.created",
      entity: "products",
      entity_id: product.id,
      new_value: { title: product.title, slug: product.slug } as never,
    });

    // Yeni yayınlanan ürün hızlı indekslemeye bildirilir (hata kayıt akışını durdurmaz).
    if (product.status === "active") {
      const [{ pingProductIndexNow }, { getRequest }] = await Promise.all([
        import("@/lib/indexnow.server"),
        import("@tanstack/react-start/server"),
      ]);
      try {
        await pingProductIndexNow(
          new URL(getRequest().url).origin,
          String(store.slug),
          String(product.slug),
        );
      } catch {
        /* bildirim başarısız olsa da ürün oluşturulmuş sayılır */
      }
    }

    return product;
  });

export const updateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        productId: z.guid(),
        patch: z
          .object({
            title: z.string().trim().min(2).max(120).optional(),
            description: z.string().trim().max(200_000).optional(),
            vendor: z.string().trim().max(80).optional(),
            product_type: z.string().trim().max(80).optional(),
            base_price: z.number().min(0).max(9_999_999).optional(),
            compare_at_price: z.number().min(0).max(9_999_999).nullable().optional(),
            status: statusEnum.optional(),
            track_inventory: z.boolean().optional(),
            // Kolay Panel: sipariş üzerine üretim ve müşteri notu
            made_to_order: z.boolean().optional(),
            prep_days: z.number().int().min(0).max(90).optional(),
            custom_note_enabled: z.boolean().optional(),
            custom_note_label: z.string().trim().max(80).nullable().optional(),
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

    await insertAuditRow(supabase, {
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
  .inputValidator((data) => z.object({ productId: z.guid() }).parse(data))
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

    await insertAuditRow(supabase, {
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
    z.object({ productId: z.guid(), options: variantOptionsSchema }).parse(data),
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
        productId: z.guid(),
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
        variantId: z.guid().optional(),
        productId: z.guid(),
        title: z.string().trim().min(1).max(80),
        sku: z.string().trim().max(60).optional(),
        barcode: z.string().trim().max(60).optional(),
        price: z.number().min(0).max(9_999_999),
        compareAtPrice: z.number().min(0).max(9_999_999).nullable().optional(),
        costPrice: z.number().min(0).max(9_999_999).nullable().optional(),
        stock: z.number().int().min(0).max(1_000_000),
        weightGrams: z.number().int().min(0).max(500_000).nullable().optional(),
        imageId: z.guid().nullable().optional(),
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

    await insertAuditRow(supabase, {
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
  .inputValidator((data) => z.object({ variantId: z.guid() }).parse(data))
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
        storeId: z.guid(),
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
        productId: z.guid(),
        collectionIds: z.array(z.guid()).max(50),
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

/**
 * Shopify tarzı tek adımlı ürün oluşturma: temel bilgiler, fiyatlandırma,
 * envanter, kargo, SEO, seçenek grupları, varyant matrisi ve konum bazlı stok
 * aynı istekte kaydedilir. Tüm doğrulama ve limit kontrolü sunucudadır.
 */
export const createProductAdvanced = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        title: z.string().trim().min(2).max(120),
        description: z.string().trim().max(200_000).optional(),
        vendor: z.string().trim().max(80).optional(),
        productType: z.string().trim().max(80).optional(),
        status: statusEnum.default("draft"),
        basePrice: z.number().min(0).max(9_999_999),
        compareAtPrice: z.number().min(0).max(9_999_999).nullable().optional(),
        costPrice: z.number().min(0).max(9_999_999).nullable().optional(),
        taxRate: z.number().min(0).max(100).optional(),
        sku: z.string().trim().max(60).optional(),
        barcode: z.string().trim().max(60).optional(),
        trackInventory: z.boolean().default(true),
        weightGrams: z.number().int().min(0).max(500_000).nullable().optional(),
        lengthCm: z.number().min(0).max(1000).nullable().optional(),
        widthCm: z.number().min(0).max(1000).nullable().optional(),
        heightCm: z.number().min(0).max(1000).nullable().optional(),
        tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
        slug: z
          .string()
          .trim()
          .min(2)
          .max(90)
          .regex(/^[a-z0-9-]+$/)
          .optional(),
        seo: z
          .object({
            title: z.string().trim().max(70).default(""),
            description: z.string().trim().max(180).default(""),
          })
          .optional(),
        options: variantOptionsSchema.default([]),
        variants: z
          .array(
            z.object({
              title: z.string().trim().min(1).max(120),
              options: z.record(z.string(), z.string()).default({}),
              sku: z.string().trim().max(60).optional(),
              barcode: z.string().trim().max(60).optional(),
              price: z.number().min(0).max(9_999_999),
              stock: z.number().int().min(0).max(1_000_000).default(0),
            }),
          )
          .max(300)
          .default([]),
        stock: z.number().int().min(0).max(1_000_000).default(0),
        warehouseId: z.guid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, slug, currency, plan_id, plans(limits)")
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

    let slug = data.slug ?? "";
    if (slug) {
      const { data: clash } = await supabase
        .from("products")
        .select("id")
        .eq("store_id", data.storeId)
        .eq("slug", slug)
        .maybeSingle();
      if (clash) throw new Error("Bu SEO adresi başka bir üründe kullanılıyor");
    } else {
      slug = await uniqueSlug(supabase as never, data.storeId, data.title);
    }

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
        cost_price: data.costPrice ?? null,
        ...(typeof data.taxRate === "number" ? { tax_rate: data.taxRate } : {}),
        sku: data.sku && data.sku.length ? data.sku : null,
        barcode: data.barcode && data.barcode.length ? data.barcode : null,
        track_inventory: data.trackInventory,
        weight_grams: data.weightGrams ?? null,
        length_cm: data.lengthCm ?? null,
        width_cm: data.widthCm ?? null,
        height_cm: data.heightCm ?? null,
        tags: data.tags,
        currency: store.currency,
        status: data.status,
        variant_options: data.options as never,
        ...(data.seo ? { seo: data.seo as never } : {}),
      })
      .select("*")
      .single();
    if (error || !product) throw new Error(error?.message ?? "Ürün oluşturulamadı");

    const rows =
      data.variants.length > 0
        ? data.variants.map((variant, index) => ({
            product_id: product.id,
            store_id: data.storeId,
            title: variant.title,
            sku: variant.sku && variant.sku.length ? variant.sku : null,
            barcode: variant.barcode && variant.barcode.length ? variant.barcode : null,
            price: variant.price,
            stock: variant.stock,
            options: variant.options as never,
            position: index + 1,
          }))
        : [
            {
              product_id: product.id,
              store_id: data.storeId,
              title: "Standart",
              sku: data.sku && data.sku.length ? data.sku : null,
              barcode: data.barcode && data.barcode.length ? data.barcode : null,
              price: data.basePrice,
              stock: data.stock,
              options: {} as never,
              position: 1,
            },
          ];

    const { data: variants, error: variantError } = await supabase
      .from("product_variants")
      .insert(rows)
      .select("id, stock");
    if (variantError) {
      if (/duplicate key/i.test(variantError.message)) {
        throw new Error("Aynı SKU veya barkod birden fazla varyantta kullanılamaz");
      }
      throw new Error(variantError.message);
    }

    if (data.warehouseId && variants?.length) {
      const { error: levelError } = await supabase.from("inventory_levels").insert(
        variants.map((variant) => ({
          store_id: data.storeId,
          warehouse_id: data.warehouseId!,
          variant_id: variant.id,
          product_id: product.id,
          on_hand: variant.stock ?? 0,
        })),
      );
      if (levelError) throw new Error(levelError.message);
    }

    await insertAuditRow(supabase, {
      store_id: data.storeId,
      actor_id: userId,
      action: "product.created",
      entity: "products",
      entity_id: product.id,
      new_value: {
        title: product.title,
        slug: product.slug,
        variants: rows.length,
      } as never,
    });

    // Yeni yayınlanan ürün hızlı indekslemeye bildirilir (hata kayıt akışını durdurmaz).
    if (product.status === "active") {
      const [{ pingProductIndexNow }, { getRequest }] = await Promise.all([
        import("@/lib/indexnow.server"),
        import("@tanstack/react-start/server"),
      ]);
      try {
        await pingProductIndexNow(
          new URL(getRequest().url).origin,
          String(store.slug),
          String(product.slug),
        );
      } catch {
        /* bildirim başarısız olsa da ürün oluşturulmuş sayılır */
      }
    }

    return product;
  });
