import { z } from "zod";

/** Ana sayfa (pazarlama sitesi) bölümlerinin sunucu tarafı yönetimi. */

const itemSchema = z.record(z.string().max(60), z.string().max(2000));

export const sectionSchema = z.object({
  id: z.guid().optional(),
  sectionKey: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Yalnızca küçük harf, sayı ve tire"),
  kind: z.string().trim().min(2).max(30),
  eyebrow: z.string().trim().max(120).nullish(),
  title: z.string().trim().max(200).nullish(),
  subtitle: z.string().trim().max(1200).nullish(),
  primaryLabel: z.string().trim().max(60).nullish(),
  primaryHref: z.string().trim().max(300).nullish(),
  secondaryLabel: z.string().trim().max(60).nullish(),
  secondaryHref: z.string().trim().max(300).nullish(),
  badge: z.string().trim().max(120).nullish(),
  items: z.array(itemSchema).max(60).default([]),
  sortOrder: z.number().int().min(0).max(10000),
  isEnabled: z.boolean(),
});

export const reorderSchema = z.object({
  order: z.array(z.object({ id: z.guid(), sortOrder: z.number().int().min(0).max(10000) })).max(100),
});

export const deleteSchema = z.object({ id: z.guid() });

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as { from: (table: string) => any };
}

export async function listSections() {
  const db = await admin();
  const { data, error } = await db.from("site_sections").select("*").order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertSection(input: z.infer<typeof sectionSchema>) {
  const db = await admin();
  const row = {
    section_key: input.sectionKey,
    kind: input.kind,
    eyebrow: input.eyebrow || null,
    title: input.title || null,
    subtitle: input.subtitle || null,
    primary_label: input.primaryLabel || null,
    primary_href: input.primaryHref || null,
    secondary_label: input.secondaryLabel || null,
    secondary_href: input.secondaryHref || null,
    badge: input.badge || null,
    items: input.items,
    sort_order: input.sortOrder,
    is_enabled: input.isEnabled,
  };
  const { error } = await db.from("site_sections").upsert(row, { onConflict: "section_key" });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function reorderSections(input: z.infer<typeof reorderSchema>) {
  const db = await admin();
  for (const entry of input.order) {
    const { error } = await db.from("site_sections").update({ sort_order: entry.sortOrder }).eq("id", entry.id);
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}

export async function deleteSection(input: z.infer<typeof deleteSchema>) {
  const db = await admin();
  const { error } = await db.from("site_sections").delete().eq("id", input.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}
