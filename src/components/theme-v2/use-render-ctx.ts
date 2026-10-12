import { useQuery } from "@tanstack/react-query";

import type { V2RenderContext } from "@/components/theme-v2/page-renderer";
import { storeQuery } from "@/lib/store-queries";
import { storefrontQuery } from "@/lib/storefront-queries";

/** Mağazanın gerçek ürün/koleksiyonlarıyla önizleme bağlamı. */
export function useRenderCtx(storeId: string): V2RenderContext & { storeName: string } {
  const { data: store } = useQuery(storeQuery(storeId));
  const { data: storefront } = useQuery({ ...storefrontQuery(store?.slug ?? ""), enabled: Boolean(store?.slug) });
  return {
    storeName: store?.name ?? "",
    storeSlug: store?.slug ?? "",
    currency: store?.currency ?? "TRY",
    products: (storefront?.products ?? []) as V2RenderContext["products"],
    collections: storefront?.collections ?? [],
    blogPages: (storefront?.blogPages ?? []) as NonNullable<V2RenderContext["blogPages"]>,
  };
}
