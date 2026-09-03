import { queryOptions } from "@tanstack/react-query";

import { getCheckoutOptions } from "@/lib/checkout.functions";
import {
  getStorefront,
  getStorefrontCollection,
  getStorefrontPages,
  getStorefrontProduct,
} from "@/lib/storefront.functions";

export const storefrontQuery = (slug: string) =>
  queryOptions({
    queryKey: ["storefront", slug],
    queryFn: () => getStorefront({ data: { slug } }),
    // Panel fiyat/stok değişimleri vitrine hızlı yansısın.
    staleTime: 15_000,
    refetchOnMount: "always" as const,
  });

export const storefrontCollectionQuery = (slug: string, collectionSlug: string) =>
  queryOptions({
    queryKey: ["storefront", slug, "collection", collectionSlug],
    queryFn: () => getStorefrontCollection({ data: { slug, collectionSlug } }),
    staleTime: 60_000,
  });

export const storefrontProductQuery = (slug: string, productSlug: string) =>
  queryOptions({
    queryKey: ["storefront", slug, "product", productSlug],
    queryFn: () => getStorefrontProduct({ data: { slug, productSlug } }),
    staleTime: 15_000,
    refetchOnMount: "always" as const,
  });

export const checkoutOptionsQuery = (slug: string) =>
  queryOptions({
    queryKey: ["storefront", slug, "checkout-options"],
    queryFn: () => getCheckoutOptions({ data: { slug } }),
    staleTime: 30_000,
  });

export const storefrontPagesQuery = (slug: string) =>
  queryOptions({
    queryKey: ["storefront", slug, "pages"],
    queryFn: () => getStorefrontPages({ data: { slug } }),
    staleTime: 60_000,
  });
