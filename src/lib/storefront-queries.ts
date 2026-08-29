import { queryOptions } from "@tanstack/react-query";

import { getCheckoutOptions } from "@/lib/checkout.functions";
import { getStorefront, getStorefrontProduct } from "@/lib/storefront.functions";

export const storefrontQuery = (slug: string) =>
  queryOptions({
    queryKey: ["storefront", slug],
    queryFn: () => getStorefront({ data: { slug } }),
    staleTime: 60_000,
  });

export const storefrontProductQuery = (slug: string, productSlug: string) =>
  queryOptions({
    queryKey: ["storefront", slug, "product", productSlug],
    queryFn: () => getStorefrontProduct({ data: { slug, productSlug } }),
    staleTime: 60_000,
  });

export const checkoutOptionsQuery = (slug: string) =>
  queryOptions({
    queryKey: ["storefront", slug, "checkout-options"],
    queryFn: () => getCheckoutOptions({ data: { slug } }),
    staleTime: 30_000,
  });
