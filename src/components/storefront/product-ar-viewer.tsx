import { useQuery, queryOptions } from "@tanstack/react-query";
import { Boxes } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

type ArRow = { model_url: string | null; usdz_url: string | null; poster_url: string | null };

const arQuery = (productId: string) =>
  queryOptions({
    queryKey: ["storefront-ar", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_ar_assets")
        .select("model_url, usdz_url, poster_url")
        .eq("product_id", productId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ArRow | null;
    },
  });

/**
 * 3B / artırılmış gerçeklik görüntüleyici. iPhone'da .usdz Quick Look bağlantısı,
 * Android'de .glb Scene Viewer bağlantısı kullanılır — ek kütüphane gerekmez.
 */
export function ProductArViewer({ productId, title }: { productId: string; title: string }) {
  const { data } = useQuery(arQuery(productId));
  if (!data || (!data.model_url && !data.usdz_url)) return null;

  const sceneViewer = data.model_url
    ? `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(data.model_url)}&mode=ar_preferred&title=${encodeURIComponent(title)}#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;end;`
    : null;

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Boxes className="size-4" /> Ürünü odanızda görün
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Telefonunuzla açarak ürünün gerçek boyutunu kendi ortamınızda inceleyebilirsiniz.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {data.usdz_url ? (
          <a
            href={data.usdz_url}
            rel="ar"
            className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
          >
            iPhone / iPad ile görüntüle
          </a>
        ) : null}
        {sceneViewer ? (
          <a href={sceneViewer} className="rounded-full border px-4 py-2 text-xs font-medium">
            Android ile görüntüle
          </a>
        ) : null}
      </div>
    </div>
  );
}
