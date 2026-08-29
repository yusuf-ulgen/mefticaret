import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

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

    const [themeRes, productsRes, collectionsRes] = await Promise.all([
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
    ]);
    if (themeRes.error) throw new Error(themeRes.error.message);
    if (productsRes.error) throw new Error(productsRes.error.message);
    if (collectionsRes.error) throw new Error(collectionsRes.error.message);

    return {
      store,
      theme: themeRes.data,
      products: productsRes.data ?? [],
      collections: collectionsRes.data ?? [],
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

    const [themeRes, variantsRes, imagesRes] = await Promise.all([
      supabase.from("store_themes").select("*").eq("store_id", store.id).maybeSingle(),
      supabase
        .from("product_variants")
        .select("id, title, sku, price, stock, options, position")
        .eq("product_id", product.id)
        .order("position"),
      supabase
        .from("product_images")
        .select("id, url, alt, position")
        .eq("product_id", product.id)
        .order("position"),
    ]);
    if (themeRes.error) throw new Error(themeRes.error.message);
    if (variantsRes.error) throw new Error(variantsRes.error.message);
    if (imagesRes.error) throw new Error(imagesRes.error.message);

    return {
      store,
      theme: themeRes.data,
      product,
      variants: variantsRes.data ?? [],
      images: imagesRes.data ?? [],
    };
  });
