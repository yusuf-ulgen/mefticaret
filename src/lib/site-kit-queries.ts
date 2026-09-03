import { queryOptions } from "@tanstack/react-query";

import { getStorefrontSiteKit, listStoreSiteKit } from "@/lib/site-kit.functions";

export const storeSiteKitQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["site-kit", storeId],
    queryFn: () => listStoreSiteKit({ data: { storeId } }),
    staleTime: 30_000,
  });

export const storefrontSiteKitQuery = (slug: string) =>
  queryOptions({
    queryKey: ["storefront", slug, "site-kit"],
    queryFn: () => getStorefrontSiteKit({ data: { slug } }),
    staleTime: 5 * 60_000,
  });
