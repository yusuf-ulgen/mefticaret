import { queryOptions } from "@tanstack/react-query";

import { getAppCatalog, getStoreAppInstallations } from "@/lib/apps.functions";

/** Uygulama mağazası sorguları. */

export const appCatalogQuery = () =>
  queryOptions({
    queryKey: ["app-catalog"],
    queryFn: () => getAppCatalog(),
    staleTime: 300_000,
  });

export const storeAppInstallationsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store", storeId, "app-installations"],
    queryFn: () => getStoreAppInstallations({ data: { storeId } }),
    staleTime: 30_000,
  });
