import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Medya kütüphanesi kayıt katmanı. Dosyaların kendisi tarayıcıdan depoya
 * yüklenir (RLS mağaza klasörüne kısıtlar); meta veri denetimi burada yapılır.
 */

const variantSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  path: z.string().min(3).max(400),
  size_bytes: z.number().int().nonnegative(),
  mime_type: z.string().min(3).max(100),
});

export const registerMediaAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        folderId: z.guid().nullable().optional(),
        fileName: z.string().trim().min(1).max(200),
        mimeType: z.string().trim().min(3).max(100),
        kind: z.enum(["image", "video", "document", "audio", "model", "other"]),
        extension: z.string().trim().max(10).optional(),
        storagePath: z.string().trim().min(3).max(400),
        bucket: z.string().trim().min(1).max(63).default("store-media"),
        storageProvider: z.enum(["supabase", "s3", "r2", "gcs"]).default("supabase"),
        sizeBytes: z.number().int().nonnegative(),
        originalSizeBytes: z.number().int().nonnegative().optional(),
        width: z.number().int().positive().nullable().optional(),
        height: z.number().int().positive().nullable().optional(),
        alt: z.string().trim().max(300).optional(),
        optimized: z.boolean().default(false),
        convertedToWebp: z.boolean().default(false),
        variants: z.array(variantSchema).max(12).default([]),
        v2: z
          .object({
            originalFilename: z.string().max(300),
            originalFormat: z.string().max(20),
            thumbSm: z.string().max(400).nullable(),
            thumbMd: z.string().max(400).nullable(),
            thumbLg: z.string().max(400).nullable(),
            poster: z.string().max(400).nullable(),
            blurhash: z.string().max(100).nullable(),
            dominantColor: z.string().regex(/^#[0-9a-f]{6}$/i).nullable(),
            palette: z.array(z.string().regex(/^#[0-9a-f]{6}$/i)).max(5),
            hasTransparency: z.boolean(),
            isAnimated: z.boolean(),
            metadataStripped: z.boolean(),
            watermarkApplied: z.boolean(),
            durationSeconds: z.number().int().nonnegative().nullable(),
            sourceAssetId: z.guid().nullable().optional(),
            extraBytes: z.number().int().nonnegative(),
          })
          .optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.storagePath.startsWith(`${data.storeId}/`)) {
      throw new Error("Geçersiz dosya yolu");
    }
    const v2 = data.v2;
    const extraPaths = v2 ? [v2.thumbSm, v2.thumbMd, v2.thumbLg, v2.poster] : [];
    if (extraPaths.some((p) => p && !p.startsWith(`${data.storeId}/`))) throw new Error("Geçersiz dosya yolu");
    if (!v2 && !["image", "video", "document"].includes(data.kind)) throw new Error("Bu dosya türü paketinizde kapalı");
    if (v2) {
      const { mediaEntitlement, consumeMediaQuota } = await import("@/lib/media-v2.server");
      const ent = await mediaEntitlement(supabase, data.storeId);
      if (!ent.enabled) throw new Error("Medya Sistemi v2 paketinizde kapalı.");
      const total =
        data.sizeBytes + v2.extraBytes + data.variants.reduce((s, v) => s + v.size_bytes, 0);
      try {
        await consumeMediaQuota(data.storeId, total, ent.limitBytes);
      } catch (error) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.storage
          .from(data.bucket)
          .remove([data.storagePath, ...data.variants.map((v) => v.path), ...(extraPaths.filter(Boolean) as string[])]);
        throw error;
      }
    }
    if (data.folderId) {
      const { data: folder, error } = await supabase
        .from("media_folders")
        .select("id")
        .eq("id", data.folderId)
        .eq("store_id", data.storeId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!folder) throw new Error("Klasör bulunamadı");
    }

    const { data: created, error } = await supabase
      .from("media_assets")
      .insert({
        store_id: data.storeId,
        folder_id: data.folderId ?? null,
        file_name: data.fileName,
        title: data.fileName,
        alt: data.alt ?? null,
        kind: data.kind,
        mime_type: data.mimeType,
        extension: data.extension ?? null,
        size_bytes: data.sizeBytes,
        original_size_bytes: data.originalSizeBytes ?? data.sizeBytes,
        width: data.width ?? null,
        height: data.height ?? null,
        storage_provider: data.storageProvider,
        bucket: data.bucket,
        storage_path: data.storagePath,
        optimized: data.optimized,
        converted_to_webp: data.convertedToWebp,
        variants: data.variants,
        created_by: userId,
        ...(v2
          ? {
              original_filename: v2.originalFilename,
              original_format: v2.originalFormat,
              thumbnail_sm_path: v2.thumbSm,
              thumbnail_md_path: v2.thumbMd,
              thumbnail_lg_path: v2.thumbLg,
              poster_path: v2.poster,
              blurhash: v2.blurhash,
              dominant_color: v2.dominantColor,
              color_palette: v2.palette,
              has_transparency: v2.hasTransparency,
              is_animated: v2.isAnimated,
              metadata_stripped: v2.metadataStripped,
              watermark_applied: v2.watermarkApplied,
              duration_seconds: v2.durationSeconds,
              source_asset_id: v2.sourceAssetId ?? null,
              processing_status: "ready",
            }
          : {}),
      } as never)
      .select("id, file_name")
      .maybeSingle();
    if (error) {
      if (error.code === "23505" || error.message.includes("duplicate")) {
        throw new Error(`${data.fileName}: bu klasörde aynı adlı dosya var`);
      }
      throw new Error(error.message);
    }
    if (!created) throw new Error("Dosya kaydedilemedi");
    return created;
  });

export const updateMediaAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        assetId: z.guid(),
        fileName: z.string().trim().min(1).max(200).optional(),
        title: z.string().trim().max(200).optional(),
        alt: z.string().trim().max(300).optional(),
        caption: z.string().trim().max(500).optional(),
        folderId: z.guid().nullable().optional(),
        tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.fileName !== undefined) patch["file_name"] = data.fileName;
    if (data.title !== undefined) patch["title"] = data.title || null;
    if (data.alt !== undefined) patch["alt"] = data.alt || null;
    if (data.caption !== undefined) patch["caption"] = data.caption || null;
    if (data.folderId !== undefined) patch["folder_id"] = data.folderId;
    if (data.tags !== undefined) patch["tags"] = data.tags;
    if (Object.keys(patch).length === 0) throw new Error("Güncellenecek alan yok");

    const { data: updated, error } = await context.supabase
      .from("media_assets")
      .update(patch as never)
      .eq("id", data.assetId)
      .select("id, file_name, alt, folder_id")
      .maybeSingle();
    if (error) {
      if (error.message.includes("duplicate")) throw new Error("Bu klasörde aynı adlı dosya var");
      throw new Error(error.message);
    }
    if (!updated) throw new Error("Bu dosyayı güncelleme yetkiniz yok");
    return updated;
  });

export const deleteMediaAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ assetIds: z.array(z.guid()).min(1).max(100) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: assets, error: readError } = await supabase
      .from("media_assets")
      .select("id, bucket, storage_path, variants")
      .in("id", data.assetIds);
    if (readError) throw new Error(readError.message);
    if (!assets?.length) throw new Error("Dosya bulunamadı");

    const { error } = await supabase
      .from("media_assets")
      .delete()
      .in(
        "id",
        assets.map((asset) => asset.id),
      );
    if (error) throw new Error(error.message);

    const byBucket = new Map<string, string[]>();
    for (const asset of assets) {
      const variantPaths = Array.isArray(asset.variants)
        ? (asset.variants as { path?: string }[]).map((item) => item.path ?? "").filter(Boolean)
        : [];
      const list = byBucket.get(asset.bucket) ?? [];
      list.push(asset.storage_path, ...variantPaths);
      byBucket.set(asset.bucket, list);
    }
    for (const [bucket, paths] of byBucket) {
      await supabase.storage.from(bucket).remove(paths);
    }
    return { deleted: assets.length };
  });

export const createMediaFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        name: z.string().trim().min(1).max(120),
        parentId: z.guid().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: created, error } = await supabase
      .from("media_folders")
      .insert({
        store_id: data.storeId,
        name: data.name,
        parent_id: data.parentId ?? null,
        created_by: userId,
      } as never)
      .select("id, name, path, parent_id")
      .maybeSingle();
    if (error) {
      if (error.message.includes("duplicate")) throw new Error("Bu adla bir klasör zaten var");
      throw new Error(error.message);
    }
    if (!created) throw new Error("Klasör oluşturulamadı");
    return created;
  });

export const renameMediaFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ folderId: z.guid(), name: z.string().trim().min(1).max(120) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: updated, error } = await context.supabase
      .from("media_folders")
      .update({ name: data.name } as never)
      .eq("id", data.folderId)
      .select("id, name, path")
      .maybeSingle();
    if (error) {
      if (error.message.includes("duplicate")) throw new Error("Bu adla bir klasör zaten var");
      throw new Error(error.message);
    }
    if (!updated) throw new Error("Bu klasörü güncelleme yetkiniz yok");
    return updated;
  });

export const deleteMediaFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ folderId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { count } = await supabase
      .from("media_folders")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", data.folderId);
    if ((count ?? 0) > 0) throw new Error("Önce alt klasörleri silin veya taşıyın");

    const { error } = await supabase.from("media_folders").delete().eq("id", data.folderId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
