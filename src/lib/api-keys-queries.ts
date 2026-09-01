import { queryOptions } from "@tanstack/react-query";

import { getStoreApiKeys, getStoreApiLogs } from "@/lib/api-keys.functions";

/** API anahtarı ve istek kaydı sorguları. */

export const storeApiKeysQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store", storeId, "api-keys"],
    queryFn: () => getStoreApiKeys({ data: { storeId } }),
    staleTime: 30_000,
  });

export const storeApiLogsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store", storeId, "api-logs"],
    queryFn: () => getStoreApiLogs({ data: { storeId } }),
    staleTime: 15_000,
  });
