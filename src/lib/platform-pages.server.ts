import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/** Platform (mefticaret.com) kurumsal içerik sayfaları — yalnızca süper yönetici yazabilir. */

export const platformPageSchema = z.object({
  pageId: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((value) => (value ? value : undefined)),
  excerpt: z.string().trim().max(500).optional(),
  body: z.string().max(50_000).default(""),
  seoDescription: z.string().trim().max(300).optional(),
  isPublished: z.boolean().default(true),
  showInFooter: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export const deletePlatformPageSchema = z.object({ pageId: z.string().uuid() });

const TR_MAP: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  İ: "i",
  ö: "o",
  ş: "s",
  ü: "u",
};

export function slugify(input: string): string {
  return input
    .toLocaleLowerCase("tr")
    .replace(/[çğıİöşü]/g, (char) => TR_MAP[char] ?? char)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export async function listPlatformPages(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase
    .from("platform_pages")
    .select("*")
    .order("sort_order")
    .order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertPlatformPage(
  supabase: SupabaseClient<Database>,
  input: z.infer<typeof platformPageSchema>,
) {
  const slug = slugify(input.slug ?? input.title) || `sayfa-${Date.now()}`;
  const row = {
    title: input.title,
    slug,
    excerpt: input.excerpt ?? null,
    body: input.body,
    seo_description: input.seoDescription ?? null,
    is_published: input.isPublished,
    show_in_footer: input.showInFooter,
    sort_order: input.sortOrder,
  };

  if (input.pageId) {
    const { data, error } = await supabase
      .from("platform_pages")
      .update(row)
      .eq("id", input.pageId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Sayfa bulunamadı");
    return data;
  }

  const { data, error } = await supabase
    .from("platform_pages")
    .insert(row)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deletePlatformPage(
  supabase: SupabaseClient<Database>,
  input: z.infer<typeof deletePlatformPageSchema>,
) {
  const { error } = await supabase.from("platform_pages").delete().eq("id", input.pageId);
  if (error) throw new Error(error.message);
  return { ok: true };
}
