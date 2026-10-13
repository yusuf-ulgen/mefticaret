import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Özel medya dönüşümü imzalanırken belirlenir; token sonradan değiştirilmez. */
export async function signProductImageSizes(
  db: Pick<SupabaseClient<Database>, "storage">,
  paths: string[],
) {
  const unique = [...new Set(paths)].slice(0, 8);
  const result: Record<string, Array<{ width: number; url: string }>> = {};
  for (let index = 0; index < unique.length; index += 4) {
    await Promise.all(
      unique.slice(index, index + 4).map(async (path) => {
        const sources = await Promise.all(
          [480, 960, 1440].map(async (width) => {
            try {
              const signed = await db.storage.from("store-media").createSignedUrl(path, 3600, {
                transform: { width, quality: 72, resize: "contain" },
              });
              return signed.error || !signed.data ? null : { width, url: signed.data.signedUrl };
            } catch {
              return null;
            }
          }),
        );
        result[path] = sources.filter((source): source is { width: number; url: string } =>
          Boolean(source),
        );
      }),
    );
  }
  return result;
}
