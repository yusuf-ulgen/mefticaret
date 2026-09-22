import { queryOptions } from "@tanstack/react-query";

import {
  getXmlIntegratorOverview,
  getXmlIntegratorStats,
  listXmlCategoryMappings,
  listXmlFieldSchema,
} from "@/lib/xml-integrator.functions";


/** XmlIntegrator panosu ve alan envanteri sorguları. */

export const xmlIntegratorOverviewQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["xml-integrator", storeId, "overview"],
    queryFn: () => getXmlIntegratorOverview({ data: { storeId } }),
    staleTime: 15_000,
  });

export const xmlFieldSchemaQuery = (storeId: string, feedId: string | null) =>
  queryOptions({
    queryKey: ["xml-integrator", storeId, "fields", feedId],
    queryFn: () => listXmlFieldSchema({ data: { storeId, feedId: feedId! } }),
    enabled: Boolean(feedId),
    staleTime: 60_000,
  });

export const xmlIntegratorStatsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["xml-integrator", storeId, "stats"],
    queryFn: () => getXmlIntegratorStats({ data: { storeId } }),
    staleTime: 30_000,
  });
