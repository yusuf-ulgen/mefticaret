import { useQuery, queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

type UgcRow = {
  id: string;
  media_url: string;
  permalink: string | null;
  caption: string | null;
  author_handle: string | null;
};

const wallQuery = (storeId: string, productId?: string) =>
  queryOptions({
    queryKey: ["storefront-ugc", storeId, productId ?? "all"],
    queryFn: async () => {
      let request = supabase
        .from("ugc_posts")
        .select("id, media_url, permalink, caption, author_handle")
        .eq("store_id", storeId)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(12);
      if (productId) request = request.eq("product_id", productId);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []) as UgcRow[];
    },
  });

/** Onaylı müşteri fotoğrafları duvarı. */
export function UgcWall({ storeId, productId }: { storeId: string; productId?: string }) {
  const { data } = useQuery(wallQuery(storeId, productId));
  const posts = data ?? [];
  if (posts.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Müşterilerimizden</h2>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {posts.map((post) => {
          const image = (
            <img
              src={post.media_url}
              alt={post.caption ?? post.author_handle ?? "Müşteri paylaşımı"}
              loading="lazy"
              className="aspect-square w-full rounded-lg border object-cover"
            />
          );
          return post.permalink ? (
            <a key={post.id} href={post.permalink} target="_blank" rel="noreferrer noopener">
              {image}
            </a>
          ) : (
            <div key={post.id}>{image}</div>
          );
        })}
      </div>
    </section>
  );
}
