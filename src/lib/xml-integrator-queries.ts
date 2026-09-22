import { queryOptions } from "@tanstack/react-query";

import {
  getXmlIntegratorOverview,
  listXmlCategoryMappings,
} from "@/lib/xml-integrator.functions";

/** XML Entegratör v2 panosu ve kategori eşleme sorguları. */

export const xmlIntegratorOverviewQuery = (storeId: string | undefined) =>
  queryOptions({
    queryKey: ["xml-integrator", "overview", storeId],
    queryFn: () => getXmlIntegratorOverview({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
    refetchInterval: 30_000,
  });

export const xmlCategoryMappingsQuery = (storeId: string | undefined, feedId: string | undefined) =>
  queryOptions({
    queryKey: ["xml-integrator", "categories", storeId, feedId],
    queryFn: () => listXmlCategoryMappings({ data: { storeId: storeId!, feedId: feedId! } }),
    enabled: Boolean(storeId && feedId),
  });
