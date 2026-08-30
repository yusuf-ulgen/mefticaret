import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const MEDIA_BUCKET = "store-media";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

/** Tarayıcıdan mağaza klasörüne görsel yükler ve depodaki yolunu döner. */
export async function uploadProductImage(storeId: string, productId: string, file: File) {
  if (!ALLOWED.includes(file.type)) {
    throw new Error("Yalnızca JPG, PNG, WEBP, AVIF veya GIF yükleyebilirsiniz.");
  }
  if (file.size > MAX_BYTES) throw new Error("Dosya boyutu en fazla 10 MB olabilir.");

  const extension = (file.name.split(".").pop() ?? "jpg").toLowerCase().slice(0, 5);
  const path = `${storeId}/products/${productId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

/** Depodaki yolları imzalı görüntüleme adreslerine çevirir. */
export async function signMediaPaths(paths: string[], expiresIn = 60 * 60) {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (!unique.length) return {} as Record<string, string>;
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrls(unique, expiresIn);
  if (error) throw new Error(error.message);
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) map[row.path] = row.signedUrl;
  }
  return map;
}

export type ProductImage = {
  id: string;
  alt: string | null;
  position: number;
  storage_path: string | null;
  url: string;
  displayUrl: string;
};

export const productImagesQuery = (productId: string) =>
  queryOptions({
    queryKey: ["product-images", productId],
    queryFn: async (): Promise<ProductImage[]> => {
      const { data, error } = await supabase
        .from("product_images")
        .select("id, alt, position, storage_path, url")
        .eq("product_id", productId)
        .order("position");
      if (error) throw error;
      const rows = data ?? [];
      const signed = await signMediaPaths(
        rows.map((row) => row.storage_path ?? "").filter(Boolean),
      );
      return rows.map((row) => ({
        ...row,
        displayUrl: row.storage_path ? (signed[row.storage_path] ?? "") : row.url,
      }));
    },
    staleTime: 30_000,
  });
