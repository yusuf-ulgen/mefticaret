import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Ürün görselleri: dosya yükleme tarayıcıda (store-media kovası, RLS ile
 * mağaza klasörüne kısıtlı) yapılır; kayıt/silme/sıralama burada denetlenir.
 */

export const addProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        productId: z.guid(),
        storagePath: z.string().trim().min(3).max(400),
        alt: z.string().trim().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, store_id, title")
      .eq("id", data.productId)
      .maybeSingle();
    if (productError) throw new Error(productError.message);
    if (!product) throw new Error("Ürün bulunamadı");
    if (!data.storagePath.startsWith(`${product.store_id}/`)) {
      throw new Error("Geçersiz dosya yolu");
    }

    const { count } = await supabase
      .from("product_images")
      .select("id", { count: "exact", head: true })
      .eq("product_id", product.id);
    if ((count ?? 0) >= 12) throw new Error("Bir ürüne en fazla 12 görsel ekleyebilirsiniz.");

    const { data: created, error } = await supabase
      .from("product_images")
      .insert({
        product_id: product.id,
        store_id: product.store_id,
        url: "",
        storage_path: data.storagePath,
        alt: data.alt ?? product.title,
        position: count ?? 0,
      } as never)
      .select("id, storage_path, alt, position")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!created) throw new Error("Görsel kaydedilemedi");
    return created;
  });

export const updateProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        imageId: z.guid(),
        alt: z.string().trim().max(200).optional(),
        position: z.number().int().min(0).max(99).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.alt !== undefined) patch["alt"] = data.alt || null;
    if (data.position !== undefined) patch["position"] = data.position;
    if (Object.keys(patch).length === 0) throw new Error("Güncellenecek alan yok");

    const { data: updated, error } = await context.supabase
      .from("product_images")
      .update(patch as never)
      .eq("id", data.imageId)
      .select("id, alt, position")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Bu görseli güncelleme yetkiniz yok");
    return updated;
  });

export const deleteProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ imageId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: image, error: imageError } = await supabase
      .from("product_images")
      .select("id, storage_path")
      .eq("id", data.imageId)
      .maybeSingle();
    if (imageError) throw new Error(imageError.message);
    if (!image) throw new Error("Görsel bulunamadı");

    const { error } = await supabase.from("product_images").delete().eq("id", image.id);
    if (error) throw new Error(error.message);
    if (image.storage_path) {
      await supabase.storage.from("store-media").remove([image.storage_path]);
    }
    return { ok: true };
  });
