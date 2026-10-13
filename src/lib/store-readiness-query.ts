import { queryOptions } from "@tanstack/react-query";
import { getStoreReadiness } from "@/lib/store-readiness.functions";

export const storeReadinessQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store-readiness", storeId],
    queryFn: () => getStoreReadiness({ data: { storeId } }),
    staleTime: 30_000,
  });
