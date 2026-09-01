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
        storeId: z.string().uuid(),
        folderId: z.string().uuid().nullable().optional(),
        fileName: z.string().trim().min(1).max(200),
        mimeType: z.string().trim().min(3).max(100),
        kind: z.enum(["image", "video", "document"]),
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
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.storagePath.startsWith(`${data.storeId}/`)) {
      throw new Error("Geçersiz dosya yolu");
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
        assetId: z.string().uuid(),
        fileName: z.string().trim().min(1).max(200).optional(),
        title: z.string().trim().max(200).optional(),
        alt: z.string().trim().max(300).optional(),
        caption: z.string().trim().max(500).optional(),
        folderId: z.string().uuid().nullable().optional(),
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
    z.object({ assetIds: z.array(z.string().uuid()).min(1).max(100) }).parse(data),
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
        storeId: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
        parentId: z.string().uuid().nullable().optional(),
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
      .object({ folderId: z.string().uuid(), name: z.string().trim().min(1).max(120) })
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
  .inputValidator((data) => z.object({ folderId: z.string().uuid() }).parse(data))
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
