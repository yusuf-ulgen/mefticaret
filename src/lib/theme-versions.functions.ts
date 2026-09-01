import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Tema sürümleme uygulama katmanı. Yayınlama ve geri yükleme veritabanı
 * fonksiyonlarıyla yapılır; yetki RLS ile zorlanır (app_private.can_manage_store).
 */

export const publishThemeVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        label: z.string().trim().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: versionId, error } = await context.supabase.rpc("publish_theme_version", {
      _store_id: data.storeId,
      ...(data.label ? { _label: data.label } : {}),
    });
    if (error) throw new Error(error.message);
    return { versionId };
  });

export const restoreThemeVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.string().uuid(), versionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("restore_theme_version", {
      _version_id: data.versionId,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteThemeVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.string().uuid(), versionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("store_theme_versions")
      .delete()
      .eq("id", data.versionId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
