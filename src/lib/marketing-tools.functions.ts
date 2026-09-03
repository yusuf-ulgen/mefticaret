import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  deletePopup,
  deleteStory,
  feedIdSchema,
  feedInputSchema,
  popupIdSchema,
  popupInputSchema,
  publishStory,
  rebuildProductFeed,
  rotateFeedToken,
  saveProductFeed,
  slugSchema,
  storyIdSchema,
  storyInputSchema,
  togglePopup,
  togglePopupSchema,
  upsertPopup,
  upsertStory,
} from "@/lib/marketing-tools.server";

export const upsertStorePopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => popupInputSchema.parse(data))
  .handler(async ({ data, context }) => upsertPopup(context.supabase, data));

export const deleteStorePopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => popupIdSchema.parse(data))
  .handler(async ({ data, context }) => deletePopup(context.supabase, data));

export const toggleStorePopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => togglePopupSchema.parse(data))
  .handler(async ({ data, context }) => togglePopup(context.supabase, data));

export const upsertStoreStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storyInputSchema.parse(data))
  .handler(async ({ data, context }) => upsertStory(context.supabase, data));

export const publishStoreStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storyIdSchema.parse(data))
  .handler(async ({ data, context }) => publishStory(context.supabase, data));

export const deleteStoreStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storyIdSchema.parse(data))
  .handler(async ({ data, context }) => deleteStory(context.supabase, data));

export const saveStoreProductFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => feedInputSchema.parse(data))
  .handler(async ({ data, context }) => saveProductFeed(context.supabase, data));

export const rebuildStoreProductFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => feedIdSchema.parse(data))
  .handler(async ({ data, context }) => rebuildProductFeed(context.supabase, data));

export const rotateStoreFeedToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => feedIdSchema.parse(data))
  .handler(async ({ data, context }) => rotateFeedToken(context.supabase, data));

/** Vitrinde gösterilecek aktif popup'ları anon (public) istemciyle getirir. */
export const getActiveStorefrontPopups = createServerFn({ method: "GET" })
  .inputValidator((data) => slugSchema.parse(data))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabase = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (storeError) throw new Error(storeError.message);
    if (!store) return [];

    const now = new Date().toISOString();
    const { data: popups, error } = await supabase
      .from("store_popups")
      .select("*")
      .eq("store_id", store.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);

    return (popups ?? []).filter((popup) => {
      if (popup.starts_at && popup.starts_at > now) return false;
      if (popup.ends_at && popup.ends_at < now) return false;
      return true;
    });
  });

/** Vitrinde bir popup gösterimini / tıklamasını sayaçlara işler. */
export const trackStorefrontPopupEvent = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), kind: z.enum(["impression", "click"]) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const column = data.kind === "impression" ? "impressions" : "clicks";
    const { data: current } = await supabaseAdmin.from("store_popups").select(column).eq("id", data.id).maybeSingle();
    const value = Number((current as Record<string, number> | null)?.[column] ?? 0) + 1;
    await supabaseAdmin.from("store_popups").update({ [column]: value } as never).eq("id", data.id);
    return { ok: true as const };
  });
