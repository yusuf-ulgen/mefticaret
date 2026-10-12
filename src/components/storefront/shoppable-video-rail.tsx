import { useQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

type VideoRow = {
  id: string;
  title: string;
  video_url: string;
  thumbnail_url: string | null;
  product_id: string | null;
  products: { slug: string; title: string } | null;
};

const rail = (storeId: string, placement: "home" | "pdp") =>
  queryOptions({
    queryKey: ["storefront-video-rail", storeId, placement],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shoppable_videos")
        .select("id, title, video_url, thumbnail_url, product_id, products(slug, title)")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .in("placement", [placement, "both"])
        .order("sort_order", { ascending: true })
        .limit(12);
      if (error) throw error;
      return (data ?? []) as unknown as VideoRow[];
    },
  });

/** Dikey kısa video şeridi — vitrinde kaydırmalı, ürüne tıklanabilir. */
export function ShoppableVideoRail({
  storeId,
  slug,
  placement = "home",
  heading = "Videolu vitrin",
}: {
  storeId: string;
  slug: string;
  placement?: "home" | "pdp";
  heading?: string;
}) {
  const { data } = useQuery(rail(storeId, placement));
  const videos = data ?? [];
  if (videos.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{heading}</h2>
      <div className="flex snap-x gap-3 overflow-x-auto pb-2">
        {videos.map((video) => {
          const card = (
            <div className="w-[9.5rem] shrink-0 snap-start overflow-hidden rounded-xl border bg-card sm:w-44">
              <video
                src={video.video_url}
                poster={video.thumbnail_url ?? undefined}
                muted
                loop
                playsInline
                controls
                preload="metadata"
                className="aspect-[9/16] w-full bg-muted object-cover"
              />
              <p className="line-clamp-2 px-2 py-2 text-xs font-medium">{video.title}</p>
            </div>
          );
          return video.products?.slug ? (
            <Link
              key={video.id}
              to="/s/$slug/p/$productSlug"
              params={{ slug, productSlug: video.products.slug }}
              className="shrink-0"
            >
              {card}
            </Link>
          ) : (
            <div key={video.id} className="shrink-0">
              {card}
            </div>
          );
        })}
      </div>
    </section>
  );
}
