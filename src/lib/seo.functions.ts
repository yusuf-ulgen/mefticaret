import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { insertAuditRow } from "./audit.server";

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
        storeId: z.guid(),
        entity: z.enum(["product", "collection", "page"]),
        id: z.guid(),
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

    await insertAuditRow(supabase, {
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
  storeId: z.guid(),
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
  urlStructure: z
    .object({
      product: z.enum(["product", "category-product", "short"]).optional(),
      collection: z.enum(["collection", "short"]).optional(),
      page: z.enum(["page", "short"]).optional(),
      blog: z.enum(["blog", "page"]).optional(),
      htmlExtension: z.boolean().optional(),
      localePrefix: z.boolean().optional(),
    })
    .optional(),
  templates: z.record(z.enum(["product", "collection", "page", "blog"]), z.object({
    title: z.string().trim().max(180).optional(),
    description: z.string().trim().max(400).optional(),
  })).optional(),
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
    if (rest.urlStructure) seo['urlStructure'] = rest.urlStructure;
    if (rest.templates) seo['templates'] = rest.templates;
    if (typeof rest.latitude === "number") seo['latitude'] = rest.latitude;
    if (typeof rest.longitude === "number") seo['longitude'] = rest.longitude;

    const { error } = await supabase
      .from("store_settings")
      .upsert({ store_id: storeId, seo: seo as Json }, { onConflict: "store_id" });
    if (error) throw new Error(error.message);

    await insertAuditRow(supabase, {
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
        storeId: z.guid(),
        pageId: z.guid(),
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

/**
 * Mağaza meta şablonlarını, başlığı veya açıklaması eksik olan ürün, kategori,
 * sayfa ve blog kayıtlarına uygular. Mevcut manuel değerler korunur.
 */
export const applySeoTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        kinds: z.array(z.enum(["product", "collection", "page", "blog"])).min(1),
        overwrite: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { readSeo, readStoreSeo, renderSeoTemplate, plainText } = await import("@/lib/seo");

    const [{ data: store, error: storeError }, { data: settings, error: settingsError }] = await Promise.all([
      supabase.from("stores").select("id, name").eq("id", data.storeId).maybeSingle(),
      supabase.from("store_settings").select("seo").eq("store_id", data.storeId).maybeSingle(),
    ]);
    if (storeError) throw new Error(storeError.message);
    if (settingsError) throw new Error(settingsError.message);
    if (!store) throw new Error("Mağaza bulunamadı.");

    const seoSettings = readStoreSeo(settings?.seo ?? null);
    const templates = seoSettings.templates ?? {};
    const storeName = store.name;
    const overwrite = Boolean(data.overwrite);

    let updated = 0;
    let skipped = 0;

    const applyRow = async (
      table: "products" | "collections" | "store_pages",
      id: string,
      current: unknown,
      title: string | null,
      description: string | null,
      templateKey: "product" | "collection" | "page" | "blog",
      extraTokens: Record<string, string | number | null | undefined>,
    ) => {
      const template = templates[templateKey];
      if (!template) {
        skipped += 1;
        return;
      }
      const existing = readSeo(current);
      const tokens = { store_name: storeName, ...extraTokens };
      const nextTitle = overwrite || !existing.title ? renderSeoTemplate(template.title, tokens) : null;
      const nextDescription =
        overwrite || !existing.description ? renderSeoTemplate(template.description, tokens) : null;

      if (!nextTitle && !nextDescription) {
        skipped += 1;
        return;
      }

      const merged = {
        ...existing,
        ...(nextTitle ? { title: nextTitle.slice(0, 120) } : {}),
        ...(nextDescription ? { description: nextDescription.slice(0, 320) } : {}),
      } as Json;

      const { error } = await supabase
        .from(table)
        .update({ seo: merged } as never)
        .eq("id", id)
        .eq("store_id", data.storeId);
      if (error) throw new Error(error.message);
      updated += 1;
      void title;
      void description;
    };

    if (data.kinds.includes("product")) {
      const { data: rows, error } = await supabase
        .from("products")
        .select("id, title, description, product_type, vendor, base_price, seo")
        .eq("store_id", data.storeId)
        .limit(1000);
      if (error) throw new Error(error.message);
      for (const row of rows ?? []) {
        await applyRow("products", String(row.id), row.seo, row.title, row.description, "product", {
          product_name: row.title,
          product_type: row.product_type ?? "",
          brand_name: row.vendor ?? "",
          price: row.base_price ?? "",
        });
      }
    }

    if (data.kinds.includes("collection")) {
      const { data: rows, error } = await supabase
        .from("collections")
        .select("id, title, description, seo")
        .eq("store_id", data.storeId)
        .limit(500);
      if (error) throw new Error(error.message);
      for (const row of rows ?? []) {
        await applyRow("collections", String(row.id), row.seo, row.title, row.description, "collection", {
          collection_name: row.title,
        });
      }
    }

    const pageKinds = data.kinds.filter((kind) => kind === "page" || kind === "blog");
    if (pageKinds.length) {
      const { data: rows, error } = await supabase
        .from("store_pages")
        .select("id, title, excerpt, body, seo_description, page_kind, author_name, seo")
        .eq("store_id", data.storeId)
        .limit(500);
      if (error) throw new Error(error.message);
      for (const row of rows ?? []) {
        const kind = row.page_kind === "blog" ? "blog" : "page";
        if (!pageKinds.includes(kind)) continue;
        const excerpt = plainText(row.seo_description ?? row.excerpt ?? row.body ?? "").slice(0, 200);
        await applyRow("store_pages", String(row.id), row.seo, row.title, excerpt, kind, {
          page_title: row.title,
          page_excerpt: excerpt,
          author_name: row.author_name ?? "",
        });
      }
    }

    await insertAuditRow(supabase, {
      store_id: data.storeId,
      actor_id: userId,
      action: "seo.templates.apply",
      entity: "store_settings",
      entity_id: data.storeId,
      meta: { kinds: data.kinds, overwrite, updated, skipped } as Json,
    });

    return { updated, skipped };
  });
