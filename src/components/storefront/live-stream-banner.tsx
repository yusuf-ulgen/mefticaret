import { useQuery, queryOptions } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Radio } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

type StreamRow = {
  id: string;
  title: string;
  description: string | null;
  stream_url: string | null;
  status: string;
  scheduled_at: string | null;
  live_stream_products: { products: { slug: string; title: string; base_price: number } | null }[];
};

const liveQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["storefront-live-stream", storeId],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_streams")
        .select(
          "id, title, description, stream_url, status, scheduled_at, live_stream_products(products(slug, title, base_price))",
        )
        .eq("store_id", storeId)
        .in("status", ["live", "scheduled"])
        .order("status", { ascending: true })
        .limit(1);
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as unknown as StreamRow | null;
    },
  });

function embedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu")) {
      const id = parsed.searchParams.get("v") ?? parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes("vimeo")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    return url;
  } catch {
    return null;
  }
}

/** Canlı satış yayını kutusu — yayında gösterilen ürünler tıklanabilir. */
export function LiveStreamBanner({ storeId, slug }: { storeId: string; slug: string }) {
  const { data } = useQuery(liveQuery(storeId));
  if (!data) return null;

  const isLive = data.status === "live";
  const player = data.stream_url ? embedUrl(data.stream_url) : null;
  const products = data.live_stream_products
    .map((row) => row.products)
    .filter((product): product is { slug: string; title: string; base_price: number } => Boolean(product));

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <span
          className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
            isLive ? "bg-destructive text-destructive-foreground" : "bg-muted"
          }`}
        >
          <Radio className="size-3" /> {isLive ? "CANLI" : "YAKINDA"}
        </span>
        <p className="text-sm font-semibold">{data.title}</p>
        {!isLive && data.scheduled_at ? (
          <p className="text-xs text-muted-foreground">
            {new Date(data.scheduled_at).toLocaleString("tr-TR")}
          </p>
        ) : null}
      </div>
      {isLive && player ? (
        <iframe
          src={player}
          title={data.title}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="aspect-video w-full"
        />
      ) : data.description ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">{data.description}</p>
      ) : null}
      {products.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto px-4 py-3">
          {products.map((product) => (
            <Link
              key={product.slug}
              to="/s/$slug/p/$productSlug"
              params={{ slug, productSlug: product.slug }}
              className="w-40 shrink-0 rounded-lg border px-3 py-2 text-xs"
            >
              <p className="line-clamp-2 font-medium">{product.title}</p>
              <p className="mt-1 text-muted-foreground">{product.base_price}</p>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
