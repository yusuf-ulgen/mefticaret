import { queryOptions } from "@tanstack/react-query";

import { getCacheStats, getQueueStats, listJobs } from "@/lib/queue.functions";
import type { JobKind, JobStatus } from "@/lib/queue";

export const jobsQuery = (storeId: string, filters: { status?: JobStatus; kind?: JobKind } = {}) =>
  queryOptions({
    queryKey: ["store", storeId, "jobs", filters.status ?? "all", filters.kind ?? "all"],
    queryFn: () =>
      listJobs({
        data: {
          storeId,
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.kind ? { kind: filters.kind } : {}),
        },
      }),
    staleTime: 10_000,
  });

export const queueStatsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store", storeId, "queue-stats"],
    queryFn: () => getQueueStats({ data: { storeId } }),
    staleTime: 10_000,
  });

export const cacheStatsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store", storeId, "cache-stats"],
    queryFn: () => getCacheStats({ data: { storeId } }),
    staleTime: 15_000,
  });
