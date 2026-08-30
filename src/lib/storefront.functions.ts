import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

type StorefrontProductCard = Pick<
  Database["public"]["Tables"]["products"]["Row"],
  "id" | "title" | "slug" | "description" | "base_price" | "compare_at_price" | "currency" | "product_type" | "tags"
>;

/**
 * Halka açık vitrin okumaları. Yayınlanmış mağazalar için anon SELECT
 * politikaları üzerinden okunur; servis anahtarı KULLANILMAZ.
 */
function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const slugInput = (data: unknown) => z.object({ slug: z.string().trim().min(1).max(120) }).parse(data);

export const getStorefront = createServerFn({ method: "GET" })
  .inputValidator(slugInput)
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: store, error } = await supabase
      .from("stores")
      .select("id, name, slug, currency, locale, industry, logo_url")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!store) return null;

    const [themeRes, productsRes, collectionsRes, pagesRes] = await Promise.all([
      supabase.from("store_themes").select("*").eq("store_id", store.id).maybeSingle(),
      supabase
        .from("products")
        .select("id, title, slug, description, base_price, compare_at_price, currency, product_type, tags")
        .eq("store_id", store.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("collections")
        .select("id, title, slug, description")
        .eq("store_id", store.id)
        .order("sort_order"),
      supabase
        .from("store_pages")
        .select("title, slug")
        .eq("store_id", store.id)
        .eq("is_published", true)
        .eq("show_in_footer", true)
        .order("sort_order"),
    ]);
    if (themeRes.error) throw new Error(themeRes.error.message);
    if (productsRes.error) throw new Error(productsRes.error.message);
    if (collectionsRes.error) throw new Error(collectionsRes.error.message);
    if (pagesRes.error) throw new Error(pagesRes.error.message);

    // Ürün kartları için kapak görselleri (imzalı adres).
    const products = productsRes.data ?? [];
    const coverByProduct: Record<string, string> = {};
    if (products.length) {
      const { data: coverRows } = await supabase
        .from("product_images")
        .select("product_id, url, storage_path, position")
        .in(
          "product_id",
          products.map((product) => product.id),
        )
        .order("position");
      const paths = (coverRows ?? []).map((row) => row.storage_path ?? "").filter(Boolean);
      const signed: Record<string, string> = {};
      if (paths.length) {
        const { data: signedData } = await supabase.storage
          .from("store-media")
          .createSignedUrls(Array.from(new Set(paths)), 60 * 60);
        for (const row of signedData ?? []) {
          if (row.path && row.signedUrl) signed[row.path] = row.signedUrl;
        }
      }
      for (const row of coverRows ?? []) {
        if (coverByProduct[row.product_id]) continue;
        const url = row.storage_path ? (signed[row.storage_path] ?? row.url) : row.url;
        if (url) coverByProduct[row.product_id] = url;
      }
    }

    return {
      store,
      theme: themeRes.data,
      products: products.map((product) => ({ ...product, coverUrl: coverByProduct[product.id] ?? null })),
      collections: collectionsRes.data ?? [],
      footerPages: pagesRes.data ?? [],
    };

  });

export const getStorefrontProduct = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z.object({ slug: z.string().trim().min(1), productSlug: z.string().trim().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: store, error } = await supabase
      .from("stores")
      .select("id, name, slug, currency")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!store) return null;

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, title, slug, description, base_price, compare_at_price, currency, product_type, tags, seo")
      .eq("store_id", store.id)
      .eq("slug", data.productSlug)
      .eq("status", "active")
      .maybeSingle();
    if (productError) throw new Error(productError.message);
    if (!product) return null;

    const [themeRes, variantsRes, imagesRes, reviewsRes] = await Promise.all([
      supabase.from("store_themes").select("*").eq("store_id", store.id).maybeSingle(),
      supabase
        .from("product_variants")
        .select("id, title, sku, price, stock, options, position")
        .eq("product_id", product.id)
        .order("position"),
      supabase
        .from("product_images")
        .select("id, url, alt, position, storage_path")
        .eq("product_id", product.id)
        .order("position"),
      supabase
        .from("product_reviews")
        .select("id, author_name, rating, title, body, is_verified_purchase, reply, created_at")
        .eq("product_id", product.id)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (themeRes.error) throw new Error(themeRes.error.message);
    if (variantsRes.error) throw new Error(variantsRes.error.message);
    if (imagesRes.error) throw new Error(imagesRes.error.message);
    if (reviewsRes.error) throw new Error(reviewsRes.error.message);

    // Özel medya kovasındaki görseller için kısa süreli imzalı adres üret.
    const imageRows = imagesRes.data ?? [];
    const storedPaths = imageRows.map((row) => row.storage_path ?? "").filter(Boolean);
    let signed: Record<string, string> = {};
    if (storedPaths.length) {
      const { data: signedData } = await supabase.storage
        .from("store-media")
        .createSignedUrls(Array.from(new Set(storedPaths)), 60 * 60);
      for (const row of signedData ?? []) {
        if (row.path && row.signedUrl) signed[row.path] = row.signedUrl;
      }
    }
    const images = imageRows.map((row) => ({
      id: row.id,
      alt: row.alt,
      position: row.position,
      url: row.storage_path ? (signed[row.storage_path] ?? row.url) : row.url,
    }));

    const reviews = reviewsRes.data ?? [];
    const ratingAverage = reviews.length
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;

    // İlgili ürünler: önce aynı türden, yetmezse en yeni ürünlerle tamamla.
    const relatedMap = new Map<string, StorefrontProductCard>();
    const pushRelated = (rows: StorefrontProductCard[] | null) => {
      for (const row of rows ?? []) {
        if (row.id === product.id || relatedMap.has(row.id)) continue;
        if (relatedMap.size < 8) relatedMap.set(row.id, row);
      }
    };
    const relatedSelect =
      "id, title, slug, description, base_price, compare_at_price, currency, product_type, tags";
    if (product.product_type) {
      const { data: sameType } = await supabase
        .from("products")
        .select(relatedSelect)
        .eq("store_id", store.id)
        .eq("status", "active")
        .eq("product_type", product.product_type)
        .neq("id", product.id)
        .order("created_at", { ascending: false })
        .limit(9);
      pushRelated(sameType);
    }
    if (relatedMap.size < 4) {
      const { data: latest } = await supabase
        .from("products")
        .select(relatedSelect)
        .eq("store_id", store.id)
        .eq("status", "active")
        .neq("id", product.id)
        .order("created_at", { ascending: false })
        .limit(9);
      pushRelated(latest);
    }
    const relatedRows = Array.from(relatedMap.values());
    const relatedCovers: Record<string, string> = {};
    if (relatedRows.length) {
      const { data: coverRows } = await supabase
        .from("product_images")
        .select("product_id, url, storage_path, position")
        .in(
          "product_id",
          relatedRows.map((row) => row.id),
        )
        .order("position");
      const paths = (coverRows ?? []).map((row) => row.storage_path ?? "").filter(Boolean);
      let relatedSigned: Record<string, string> = {};
      if (paths.length) {
        const { data: signedData } = await supabase.storage
          .from("store-media")
          .createSignedUrls(Array.from(new Set(paths)), 60 * 60);
        for (const row of signedData ?? []) {
          if (row.path && row.signedUrl) relatedSigned[row.path] = row.signedUrl;
        }
      }
      for (const row of coverRows ?? []) {
        if (relatedCovers[row.product_id]) continue;
        const url = row.storage_path ? (relatedSigned[row.storage_path] ?? row.url) : row.url;
        if (url) relatedCovers[row.product_id] = url;
      }
    }

    return {
      store,
      theme: themeRes.data,
      product,
      variants: variantsRes.data ?? [],
      images,
      reviews,
      ratingAverage,
      related: relatedRows.map((row) => ({ ...row, coverUrl: relatedCovers[row.id] ?? null })),
    };

  });

export const getStorefrontCollection = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z.object({ slug: z.string().trim().min(1), collectionSlug: z.string().trim().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: store, error } = await supabase
      .from("stores")
      .select("id, name, slug, currency")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!store) return null;

    const { data: collection, error: collectionError } = await supabase
      .from("collections")
      .select("id, title, slug, description")
      .eq("store_id", store.id)
      .eq("slug", data.collectionSlug)
      .maybeSingle();
    if (collectionError) throw new Error(collectionError.message);
    if (!collection) return null;

    const [themeRes, linksRes] = await Promise.all([
      supabase.from("store_themes").select("*").eq("store_id", store.id).maybeSingle(),
      supabase.from("product_collections").select("product_id").eq("collection_id", collection.id),
    ]);
    if (themeRes.error) throw new Error(themeRes.error.message);
    if (linksRes.error) throw new Error(linksRes.error.message);

    const ids = (linksRes.data ?? []).map((l) => l.product_id);
    let products: StorefrontProductCard[] = [];
    if (ids.length) {
      const { data: rows, error: productsError } = await supabase
        .from("products")
        .select("id, title, slug, description, base_price, compare_at_price, currency, product_type, tags")
        .in("id", ids)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (productsError) throw new Error(productsError.message);
      products = rows ?? [];
    }

    return { store, theme: themeRes.data, collection, products };
  });

/** Yayınlanmış vitrin içerik sayfası (CMS). */
export const getStorefrontPage = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z.object({ slug: z.string().trim().min(1), pageSlug: z.string().trim().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: store, error } = await supabase
      .from("stores")
      .select("id, name, slug")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!store) return null;

    const [pageRes, themeRes, footerRes] = await Promise.all([
      supabase
        .from("store_pages")
        .select("id, title, slug, excerpt, body, seo_description, updated_at")
        .eq("store_id", store.id)
        .eq("slug", data.pageSlug)
        .eq("is_published", true)
        .maybeSingle(),
      supabase.from("store_themes").select("*").eq("store_id", store.id).maybeSingle(),
      supabase
        .from("store_pages")
        .select("title, slug")
        .eq("store_id", store.id)
        .eq("is_published", true)
        .eq("show_in_footer", true)
        .order("sort_order"),
    ]);
    if (pageRes.error) throw new Error(pageRes.error.message);
    if (themeRes.error) throw new Error(themeRes.error.message);
    if (footerRes.error) throw new Error(footerRes.error.message);
    if (!pageRes.data) return null;

    return { store, theme: themeRes.data, page: pageRes.data, footerPages: footerRes.data ?? [] };
  });
