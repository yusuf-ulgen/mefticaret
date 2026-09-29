/** Medya Sistemi v2 — paket bayrağı, günlük kota ve filigran ayarları (sunucu). */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Db = { from: (t: string) => any };

async function srv() {
  return import("@/lib/media-v2.server");
}

async function assertManager(supabase: unknown, userId: string, storeId: string) {
  const { assertStoreManager } = await import("@/lib/store-access.server");
  await assertStoreManager(supabase as never, storeId, userId);
}

export const getMediaV2Boot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.storeId);
    const { mediaEntitlement, usedToday } = await srv();
    const ent = await mediaEntitlement(context.supabase, data.storeId);
    if (!ent.enabled) return { enabled: false as const };
    const db = context.supabase as unknown as Db;
    const { data: wm } = await db
      .from("media_watermark_settings")
      .select("*")
      .eq("store_id", data.storeId)
      .maybeSingle();
    return {
      enabled: true as const,
      usedBytes: await usedToday(data.storeId),
      limitBytes: ent.limitBytes,
      watermark: (wm ?? null) as WatermarkSettings | null,
    };
  });

/** Yüklemeden önce kota ön kontrolü (asıl zorlama kayıt anında). */
export const checkMediaQuota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), bytes: z.number().int().nonnegative() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.storeId);
    const { mediaEntitlement, usedToday } = await srv();
    const ent = await mediaEntitlement(context.supabase, data.storeId);
    if (!ent.enabled || ent.limitBytes === null) return { ok: true };
    const used = await usedToday(data.storeId);
    if (used + data.bytes > ent.limitBytes) {
      throw new Error(
        `Günlük yükleme kotası yetmiyor: ${Math.round(used / 1048576)} / ${Math.round(ent.limitBytes / 1048576)} MB kullanıldı.`,
      );
    }
    return { ok: true };
  });

export type WatermarkSettings = {
  store_id: string;
  is_active: boolean;
  watermark_type: "text" | "image";
  text_content: string | null;
  image_path: string | null;
  color: string;
  opacity: number;
  size_percent: number;
  position: string;
  margin_x: number;
  margin_y: number;
  apply_scope: "all" | "products";
};

export const WATERMARK_POSITIONS = [
  "top_left", "top_center", "top_right",
  "center_left", "center", "center_right",
  "bottom_left", "bottom_center", "bottom_right",
] as const;

export const saveWatermarkSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        isActive: z.boolean(),
        type: z.enum(["text", "image"]),
        text: z.string().trim().max(80).nullable(),
        imagePath: z.string().trim().max(400).nullable(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
        opacity: z.number().min(0.05).max(1),
        sizePercent: z.number().int().min(5).max(60),
        position: z.enum([...WATERMARK_POSITIONS, "tile"]),
        marginX: z.number().int().min(0).max(500),
        marginY: z.number().int().min(0).max(500),
        applyScope: z.enum(["all", "products"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.storeId);
    const { mediaEntitlement, usedToday } = await srv();
    const ent = await mediaEntitlement(context.supabase, data.storeId);
    if (!ent.enabled) throw new Error("Medya Sistemi v2 paketinizde kapalı.");
    if (data.imagePath && !data.imagePath.startsWith(`${data.storeId}/`)) throw new Error("Geçersiz logo yolu");
    if (data.type === "text" && data.isActive && !data.text) throw new Error("Filigran metni girin");
    if (data.type === "image" && data.isActive && !data.imagePath) throw new Error("Filigran logosu seçin");
    const db = context.supabase as unknown as Db;
    const { error } = await db.from("media_watermark_settings").upsert(
      {
        store_id: data.storeId,
        is_active: data.isActive,
        watermark_type: data.type,
        text_content: data.text,
        image_path: data.imagePath,
        color: data.color,
        opacity: data.opacity,
        size_percent: data.sizePercent,
        position: data.position,
        margin_x: data.marginX,
        margin_y: data.marginY,
        apply_scope: data.applyScope,
      },
      { onConflict: "store_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
