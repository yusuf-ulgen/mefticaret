import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/**
 * Platform SEO paneli: ana sayfa ve platform içerik sayfaları/blog yazıları için
 * meta başlık, açıklama, canonical ve index durumunun tek yerden yönetimi.
 */

const BASE_URL = "https://mefticaret.com";
export const TITLE_MAX = 70;
export const DESC_MAX = 160;

export type SeoTargetKind = "home" | "page" | "post";

export type SeoTarget = {
  kind: SeoTargetKind;
  id: string | null;
  label: string;
  url: string;
  published: boolean;
  metaTitle: string;
  description: string;
  canonicalUrl: string;
  noindex: boolean;
  /** Alan boşsa otomatik hesaplanan (sorgudan gelen) etiketler. */
  effectiveTitle: string;
  effectiveDescription: string;
  effectiveCanonical: string;
};

export const savePlatformSeoSchema = z.object({
  kind: z.enum(["home", "page", "post"]),
  id: z.string().uuid().nullable().optional(),
  metaTitle: z.string().trim().max(TITLE_MAX).default(""),
  description: z.string().trim().max(320).default(""),
  canonicalUrl: z
    .string()
    .trim()
    .max(400)
    .default("")
    .refine((v) => !v || /^https?:\/\//.test(v), "Canonical adresi http(s) ile başlamalı"),
  noindex: z.boolean().default(false),
});

export function clamp(value: string, max: number) {
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/[\s,;.:-]+$/, "")}…`;
}

/** Gövde/özet metninden otomatik açıklama üretir. */
export function autoDescription(excerpt: string | null, body: string | null, fallback: string) {
  const source =
    (excerpt ?? "").trim() ||
    (body ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/[#*_>`|\-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  return clamp(source || fallback, DESC_MAX);
}

export async function listPlatformSeoTargets(
  supabase: SupabaseClient<Database>,
): Promise<SeoTarget[]> {
  const [{ data: home }, { data: pages }, { data: posts }] = await Promise.all([
    supabase
      .from("site_sections")
      .select("id, title, subtitle")
      .eq("section_key", "platform-home-seo")
      .maybeSingle(),
    supabase
      .from("platform_pages")
      .select("id, title, slug, excerpt, body, meta_title, seo_description, canonical_url, noindex, is_published")
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("platform_posts")
      .select("id, title, slug, excerpt, body, meta_title, seo_description, canonical_url, noindex, status")
      .order("created_at", { ascending: false }),
  ]);

  const targets: SeoTarget[] = [];

  const homeTitle = String(home?.title ?? "");
  const homeDesc = String(home?.subtitle ?? "");
  const homeFallbackTitle = "Mefticaret — E-Ticaret Altyapısı ve Mağaza Yönetimi";
  const homeFallbackDesc =
    "Türkiye'nin kapsamlı SaaS e-ticaret altyapısı. Dakikalar içinde mağazanı aç; stok, sipariş, kargo ve pazaryeri entegrasyonlarını tek panelden yönet.";
  targets.push({
    kind: "home",
    id: null,
    label: "Ana sayfa",
    url: `${BASE_URL}/`,
    published: true,
    metaTitle: homeTitle,
    description: homeDesc,
    canonicalUrl: `${BASE_URL}/`,
    noindex: false,
    effectiveTitle: homeTitle || homeFallbackTitle,
    effectiveDescription: homeDesc || homeFallbackDesc,
    effectiveCanonical: `${BASE_URL}/`,
  });

  for (const row of pages ?? []) {
    const url = `${BASE_URL}/sayfa/${row.slug}`;
    targets.push({
      kind: "page",
      id: row.id,
      label: row.title,
      url,
      published: row.is_published,
      metaTitle: row.meta_title ?? "",
      description: row.seo_description ?? "",
      canonicalUrl: row.canonical_url ?? "",
      noindex: row.noindex ?? false,
      effectiveTitle: clamp(row.meta_title || `${row.title} — Mefticaret`, TITLE_MAX),
      effectiveDescription: autoDescription(
        row.seo_description ?? row.excerpt,
        row.body,
        "Mefticaret kurumsal bilgilendirme sayfası.",
      ),
      effectiveCanonical: row.canonical_url || url,
    });
  }

  for (const row of posts ?? []) {
    const url = `${BASE_URL}/blog/${row.slug}`;
    targets.push({
      kind: "post",
      id: row.id,
      label: row.title,
      url,
      published: row.status === "published",
      metaTitle: row.meta_title ?? "",
      description: row.seo_description ?? "",
      canonicalUrl: row.canonical_url ?? "",
      noindex: row.noindex ?? false,
      effectiveTitle: clamp(row.meta_title || `${row.title} — Mefticaret Blog`, TITLE_MAX),
      effectiveDescription: autoDescription(
        row.seo_description ?? row.excerpt,
        row.body,
        "Mefticaret blogunda e-ticaret, pazaryeri ve büyüme rehberleri.",
      ),
      effectiveCanonical: row.canonical_url || url,
    });
  }

  return targets;
}

export async function savePlatformSeoTarget(
  supabase: SupabaseClient<Database>,
  input: z.infer<typeof savePlatformSeoSchema>,
) {
  const metaTitle = input.metaTitle ? clamp(input.metaTitle, TITLE_MAX) : null;
  const description = input.description ? clamp(input.description, 320) : null;
  const canonical = input.canonicalUrl || null;

  if (input.kind === "home") {
    const { error } = await supabase.from("site_sections").upsert(
      {
        section_key: "platform-home-seo",
        kind: "seo",
        title: metaTitle,
        subtitle: description,
        items: [],
        sort_order: 9999,
        is_enabled: false,
      },
      { onConflict: "section_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  }

  if (!input.id) throw new Error("Kayıt bulunamadı");
  const table = input.kind === "page" ? "platform_pages" : "platform_posts";
  const { error } = await supabase
    .from(table)
    .update({
      meta_title: metaTitle,
      seo_description: description,
      canonical_url: canonical,
      noindex: input.noindex,
    })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}
