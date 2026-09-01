import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

/**
 * SEO editörü yazma işlemleri: ürün, koleksiyon, sayfa/blog ve mağaza
 * düzeyinde SEO alanları. Tenant izolasyonu RLS ile zorlanır.
 */

const seoFields = z.object({
  title: z.string().trim().max(120).optional(),
  description: z.string().trim().max(400).optional(),
  keywords: z.string().trim().max(300).optional(),
  canonical: z.string().trim().max(400).optional(),
  ogImage: z.string().trim().max(600).optional(),
  noindex: z.boolean().optional(),
});

/** Boş alanları temizleyip JSONB'ye yazılacak nesneyi üretir. */
function cleanSeo(input: z.infer<typeof seoFields>) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
    if (typeof value === "boolean" && value) out[key] = true;
  }
  return out;
}

export const saveEntitySeo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        entity: z.enum(["product", "collection", "page"]),
        id: z.string().uuid(),
        seo: seoFields,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const seo = cleanSeo(data.seo) as Json;

    const table =
      data.entity === "product" ? "products" : data.entity === "collection" ? "collections" : "store_pages";

    const { data: row, error } = await supabase
      .from(table)
      .update({ seo } as never)
      .eq("id", data.id)
      .eq("store_id", data.storeId)
      .select("id, title, slug, seo")
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("audit_logs").insert({
      store_id: data.storeId,
      actor_id: userId,
      action: "seo.entity_updated",
      entity: data.entity,
      entity_id: data.id,
      new_value: { seo } as Json,
    });

    return row;
  });

const storeSeoInput = z.object({
  storeId: z.string().uuid(),
  homeTitle: z.string().trim().max(120).optional(),
  homeDescription: z.string().trim().max(400).optional(),
  keywords: z.string().trim().max(300).optional(),
  defaultOgImage: z.string().trim().max(600).optional(),
  noindexStore: z.boolean().optional(),
  robotsExtra: z.string().trim().max(2000).optional(),
  organizationSameAs: z.array(z.string().trim().max(300)).max(12).optional(),
  localBusinessEnabled: z.boolean().optional(),
  businessType: z.string().trim().max(60).optional(),
  priceRange: z.string().trim().max(20).optional(),
  openingHours: z.array(z.string().trim().max(120)).max(14).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  faq: z
    .array(z.object({ question: z.string().trim().max(300), answer: z.string().trim().max(1500) }))
    .max(30)
    .optional(),
});

export const saveStoreSeo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeSeoInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { storeId, ...rest } = data;

    const seo: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rest)) {
      if (value === undefined || value === null) continue;
      if (typeof value === "string" && !value.trim()) continue;
      if (Array.isArray(value) && value.length === 0) continue;
      if (typeof value === "boolean" && !value) continue;
      seo[key] = typeof value === "string" ? value.trim() : value;
    }
    if (rest.faq) {
      seo['faq'] = rest.faq.filter((entry) => entry.question.trim() && entry.answer.trim());
    }
    if (typeof rest.latitude === "number") seo['latitude'] = rest.latitude;
    if (typeof rest.longitude === "number") seo['longitude'] = rest.longitude;

    const { error } = await supabase
      .from("store_settings")
      .upsert({ store_id: storeId, seo: seo as Json }, { onConflict: "store_id" });
    if (error) throw new Error(error.message);

    await supabase.from("audit_logs").insert({
      store_id: storeId,
      actor_id: userId,
      action: "seo.store_updated",
      entity: "store_settings",
      entity_id: storeId,
      new_value: { keys: Object.keys(seo) } as Json,
    });

    return { ok: true };
  });

export const savePageSeoMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        pageId: z.string().uuid(),
        pageKind: z.enum(["page", "blog"]),
        authorName: z.string().trim().max(120).optional(),
        publishedAt: z.string().trim().max(40).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("store_pages")
      .update({
        page_kind: data.pageKind,
        author_name: data.authorName?.trim() || null,
        published_at: data.publishedAt ? new Date(data.publishedAt).toISOString() : null,
      })
      .eq("id", data.pageId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
