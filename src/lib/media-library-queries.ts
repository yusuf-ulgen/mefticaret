import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { signMediaPaths } from "@/lib/media";
import type { MediaKind } from "@/lib/media-library";
import type { MediaVariant, StorageProvider } from "@/lib/media-storage";

export type MediaFolder = {
  id: string;
  name: string;
  path: string;
  parent_id: string | null;
  created_at: string;
};

export type MediaAsset = {
  id: string;
  folder_id: string | null;
  file_name: string;
  title: string | null;
  alt: string | null;
  caption: string | null;
  kind: MediaKind;
  mime_type: string;
  extension: string | null;
  size_bytes: number;
  original_size_bytes: number | null;
  width: number | null;
  height: number | null;
  storage_provider: StorageProvider;
  bucket: string;
  storage_path: string;
  optimized: boolean;
  converted_to_webp: boolean;
  variants: MediaVariant[];
  tags: string[];
  created_at: string;
  displayUrl: string;
  variantUrls: Record<string, string>;
};

export const mediaFoldersQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["media-folders", storeId],
    queryFn: async (): Promise<MediaFolder[]> => {
      const { data, error } = await supabase
        .from("media_folders")
        .select("id, name, path, parent_id, created_at")
        .eq("store_id", storeId)
        .order("path");
      if (error) throw error;
      return (data ?? []) as MediaFolder[];
    },
    staleTime: 30_000,
  });

export const mediaAssetsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["media-assets", storeId],
    queryFn: async (): Promise<MediaAsset[]> => {
      const { data, error } = await supabase
        .from("media_assets")
        .select(
          "id, folder_id, file_name, title, alt, caption, kind, mime_type, extension, size_bytes, original_size_bytes, width, height, storage_provider, bucket, storage_path, optimized, converted_to_webp, variants, tags, created_at",
        )
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = (data ?? []) as unknown as Omit<MediaAsset, "displayUrl" | "variantUrls">[];

      const paths = rows.flatMap((row) => [
        row.storage_path,
        ...(Array.isArray(row.variants) ? row.variants.map((variant) => variant.path) : []),
      ]);
      const signed = await signMediaPaths(paths);

      return rows.map((row) => {
        const variants = Array.isArray(row.variants) ? row.variants : [];
        const variantUrls: Record<string, string> = {};
        for (const variant of variants) {
          if (signed[variant.path]) variantUrls[variant.path] = signed[variant.path] as string;
        }
        return {
          ...row,
          variants,
          tags: row.tags ?? [],
          displayUrl: signed[row.storage_path] ?? "",
          variantUrls,
        };
      });
    },
    staleTime: 15_000,
  });
