import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  PREVIEW_KEYS,
  parsePreviewSettings,
  sanitizePreviewValue,
  type PreviewKey,
  type PreviewSettings,
} from "@/lib/theme-preview";

const PREVIEW_TTL_SECONDS = 7200;

const uuid = z.string().uuid();

const keySchema = z.enum(PREVIEW_KEYS as unknown as [PreviewKey, ...PreviewKey[]]);

/** Oturum sahibi mağazayı yönetebiliyor mu? (RLS de aynı kuralı uygular.) */
async function assertManager(
  supabase: Parameters<typeof parsePreviewSettings> extends never ? never : any,
  storeId: string,
  userId: string,
) {
  const { assertStoreManager } = await import("@/lib/store-access.server");
  await assertStoreManager(supabase, storeId, userId);
}

/** Yeni önizleme oturumu: 2 saat geçerli, tahmin edilemez anahtar. */
export const startThemePreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, data.storeId, userId);

    const expiresAt = new Date(Date.now() + PREVIEW_TTL_SECONDS * 1000).toISOString();
    const { data: row, error } = await supabase
      .from("theme_preview_sessions")
      .insert({ store_id: data.storeId, created_by: userId, settings: {}, expires_at: expiresAt })
      .select("token, expires_at")
      .single();
    if (error) throw new Error(error.message);

    return { previewToken: row.token as string, expiresAt: row.expires_at as string };
  });

/** Tek ayarı geçici oturuma yazar; yayınlanmış temaya dokunmaz. */
export const patchThemePreviewSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: uuid,
        token: uuid,
        key: keySchema,
        value: z.union([z.string(), z.number(), z.boolean()]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, data.storeId, userId);

    const value = sanitizePreviewValue(data.key, data.value);
    if (value === null) throw new Error("Geçersiz ayar değeri");

    const { data: session, error } = await supabase
      .from("theme_preview_sessions")
      .select("id, settings, expires_at")
      .eq("token", data.token)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!session) throw new Error("Önizleme oturumu bulunamadı");
    if (new Date(session.expires_at).getTime() < Date.now()) throw new Error("Önizleme oturumu süresi doldu");

    const next: PreviewSettings = { ...parsePreviewSettings(session.settings), [data.key]: value };
    const { error: updateError } = await supabase
      .from("theme_preview_sessions")
      .update({ settings: next })
      .eq("id", session.id);
    if (updateError) throw new Error(updateError.message);

    return { ok: true as const, settings: next };
  });

/** Geçici ayarları yayınlanmış temaya yazar. */
export const publishThemePreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: uuid, token: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, data.storeId, userId);

    const { data: session, error } = await supabase
      .from("theme_preview_sessions")
      .select("id, settings, expires_at")
      .eq("token", data.token)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!session) throw new Error("Önizleme oturumu bulunamadı");

    const settings = parsePreviewSettings(session.settings);
    const keys = Object.keys(settings);
    if (keys.length === 0) throw new Error("Yayınlanacak değişiklik yok");

    const patch: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined) patch[key] = value;
    }

    const { error: upsertError } = await supabase
      .from("store_themes")
      .upsert({ store_id: data.storeId, ...patch } as never, { onConflict: "store_id" });
    if (upsertError) throw new Error(upsertError.message);

    await supabase.from("theme_preview_sessions").update({ settings: {} }).eq("id", session.id);

    const { invalidateStoreCache } = await import("@/lib/cache.server");
    await invalidateStoreCache(data.storeId);

    return { ok: true as const, applied: keys.length };
  });

/** Geçici ayarları siler; vitrin yayınlanmış temaya döner. */
export const discardThemePreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: uuid, token: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, data.storeId, userId);

    const { error } = await supabase
      .from("theme_preview_sessions")
      .delete()
      .eq("token", data.token)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);

    return { ok: true as const };
  });

/**
 * Vitrin tarafı okuma: yalnızca gizli önizleme anahtarıyla, yalnızca geçici
 * ayarları döner. Süresi geçmiş oturumlarda boş ayar döner.
 */
export const getThemePreviewSettings = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ token: uuid, storeId: uuid }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session } = await supabaseAdmin
      .from("theme_preview_sessions")
      .select("settings, expires_at, store_id")
      .eq("token", data.token)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (!session) return { settings: {} as PreviewSettings };
    if (new Date(session.expires_at).getTime() < Date.now()) return { settings: {} as PreviewSettings };
    return { settings: parsePreviewSettings(session.settings) };
  });
