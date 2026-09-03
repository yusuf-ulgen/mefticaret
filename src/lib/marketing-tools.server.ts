import { randomBytes } from "crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { FEED_KINDS, POPUP_ANIMATIONS, POPUP_POSITIONS, STORY_CHANNELS } from "@/lib/popups";

type Client = SupabaseClient<Database>;

export const storeIdSchema = z.object({ storeId: z.string().uuid() });

/* ------------------------------- Popups -------------------------------- */

export const popupInputSchema = z.object({
  id: z.string().uuid().optional(),
  storeId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  isActive: z.boolean().default(false),
  animation: z.enum(POPUP_ANIMATIONS).default("fade"),
  position: z.enum(POPUP_POSITIONS).default("center"),
  headline: z.string().trim().max(200).default(""),
  body: z.string().trim().max(2000).default(""),
  ctaLabel: z.string().trim().max(60).optional().nullable(),
  ctaUrl: z.string().trim().max(500).optional().nullable(),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  accentColor: z.string().trim().max(20).optional().nullable(),
  delaySeconds: z.number().int().min(0).max(120).default(3),
  frequency: z.enum(["always", "session", "once"]).default("session"),
  pages: z.array(z.enum(["all", "home", "product", "collection", "cart"])).min(1).default(["all"]),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export async function upsertPopup(supabase: Client, input: z.infer<typeof popupInputSchema>) {
  const payload = {
    store_id: input.storeId,
    name: input.name,
    is_active: input.isActive,
    animation: input.animation,
    position: input.position,
    headline: input.headline,
    body: input.body,
    cta_label: input.ctaLabel || null,
    cta_url: input.ctaUrl || null,
    image_url: input.imageUrl || null,
    accent_color: input.accentColor || null,
    display_rules: { delaySeconds: input.delaySeconds, frequency: input.frequency, pages: input.pages },
    starts_at: input.startsAt || null,
    ends_at: input.endsAt || null,
    sort_order: input.sortOrder,
  };
  const query = input.id
    ? supabase.from("store_popups").update(payload).eq("id", input.id).eq("store_id", input.storeId)
    : supabase.from("store_popups").insert(payload);
  const { data, error } = await query.select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export const popupIdSchema = z.object({ storeId: z.string().uuid(), id: z.string().uuid() });

export async function deletePopup(supabase: Client, input: z.infer<typeof popupIdSchema>) {
  const { error } = await supabase.from("store_popups").delete().eq("id", input.id).eq("store_id", input.storeId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export const togglePopupSchema = z.object({ storeId: z.string().uuid(), id: z.string().uuid(), isActive: z.boolean() });

export async function togglePopup(supabase: Client, input: z.infer<typeof togglePopupSchema>) {
  const { error } = await supabase
    .from("store_popups")
    .update({ is_active: input.isActive })
    .eq("id", input.id)
    .eq("store_id", input.storeId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

/* ------------------------------- Stories -------------------------------- */

export const storyInputSchema = z.object({
  id: z.string().uuid().optional(),
  storeId: z.string().uuid(),
  productId: z.string().uuid().optional().nullable(),
  channel: z.enum(STORY_CHANNELS),
  caption: z.string().trim().max(2200).default(""),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  linkUrl: z.string().trim().max(500).optional().nullable(),
});

export async function upsertStory(supabase: Client, input: z.infer<typeof storyInputSchema>) {
  const payload = {
    store_id: input.storeId,
    product_id: input.productId || null,
    channel: input.channel,
    caption: input.caption,
    image_url: input.imageUrl || null,
    link_url: input.linkUrl || null,
  };
  const query = input.id
    ? supabase.from("store_stories").update(payload).eq("id", input.id).eq("store_id", input.storeId)
    : supabase.from("store_stories").insert({ ...payload, status: "draft" });
  const { data, error } = await query.select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export const storyIdSchema = z.object({ storeId: z.string().uuid(), id: z.string().uuid() });

export async function deleteStory(supabase: Client, input: z.infer<typeof storyIdSchema>) {
  const { error } = await supabase.from("store_stories").delete().eq("id", input.id).eq("store_id", input.storeId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

/**
 * Bir story'yi "yayınlar". Mefticaret şu an hiçbir sosyal medya hesabı için
 * canlı OAuth/API bağlantısı barındırmıyor (store_settings.social yalnızca
 * görüntüleme linki tutar), bu yüzden gerçekte paylaşım YAPILMAZ. Story
 * "queued" durumuna alınır ve kullanıcıya dürüst bir Türkçe mesaj döner;
 * gerçek paylaşım mağaza sahibinin kanal butonlarıyla (wa.me, sharer.php vb.)
 * kendisinin tamamlaması gerekir.
 */
export async function publishStory(supabase: Client, input: z.infer<typeof storyIdSchema>) {
  const { data: story, error: fetchError } = await supabase
    .from("store_stories")
    .select("id, channel")
    .eq("id", input.id)
    .eq("store_id", input.storeId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!story) throw new Error("Paylaşım bulunamadı");

  const { data, error } = await supabase
    .from("store_stories")
    .update({ status: "queued", error: null })
    .eq("id", input.id)
    .eq("store_id", input.storeId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  return {
    story: data,
    message:
      "Bu kanal için bağlı bir sosyal medya hesabı bulunmuyor; paylaşım otomatik gönderilmedi ve 'sırada' olarak işaretlendi. " +
      "Aşağıdaki paylaşım bağlantılarını kullanarak gönderiyi kendiniz tamamlayabilirsiniz.",
  };
}

/* ---------------------------- Product feeds ------------------------------ */

export const feedInputSchema = z.object({
  storeId: z.string().uuid(),
  kind: z.enum(FEED_KINDS),
  isActive: z.boolean().default(true),
  currency: z.string().trim().length(3).default("TRY"),
  includeOutOfStock: z.boolean().default(false),
  categoryMap: z.record(z.string(), z.string()).default({}),
});

export async function saveProductFeed(supabase: Client, input: z.infer<typeof feedInputSchema>) {
  const { data, error } = await supabase
    .from("store_product_feeds")
    .upsert(
      {
        store_id: input.storeId,
        kind: input.kind,
        is_active: input.isActive,
        currency: input.currency.toUpperCase(),
        include_out_of_stock: input.includeOutOfStock,
        category_map: input.categoryMap,
      },
      { onConflict: "store_id,kind" },
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export const feedIdSchema = z.object({ storeId: z.string().uuid(), id: z.string().uuid() });

export async function rebuildProductFeed(supabase: Client, input: z.infer<typeof feedIdSchema>) {
  const { data: feed, error: feedError } = await supabase
    .from("store_product_feeds")
    .select("*")
    .eq("id", input.id)
    .eq("store_id", input.storeId)
    .maybeSingle();
  if (feedError) throw new Error(feedError.message);
  if (!feed) throw new Error("Akış bulunamadı");

  let query = supabase
    .from("products")
    .select("id, product_variants(stock)", { count: "exact", head: false })
    .eq("store_id", input.storeId)
    .eq("status", "active");
  const { data: products, error: productsError } = await query;
  if (productsError) throw new Error(productsError.message);

  const itemCount = (products ?? []).filter((product) => {
    if (feed.include_out_of_stock) return true;
    const variants = (product as { product_variants?: { stock: number | null }[] }).product_variants ?? [];
    if (!variants.length) return true;
    return variants.some((variant) => (variant.stock ?? 0) > 0);
  }).length;

  const { data, error } = await supabase
    .from("store_product_feeds")
    .update({ item_count: itemCount, last_built_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("store_id", input.storeId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function rotateFeedToken(supabase: Client, input: z.infer<typeof feedIdSchema>) {
  const token = randomBytes(16).toString("hex");
  const { data, error } = await supabase
    .from("store_product_feeds")
    .update({ token })
    .eq("id", input.id)
    .eq("store_id", input.storeId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export const slugSchema = z.object({ slug: z.string().trim().min(1).max(120) });
