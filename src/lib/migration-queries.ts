import { queryOptions } from "@tanstack/react-query";

import {
  listMigrationIssues,
  listMigrationJobs,
  listMigrationProviders,
  listMigrationSources,
} from "@/lib/migration.functions";

/** Mağaza Taşıma ekranı için sorgu tanımları. */

export const migrationProvidersQuery = () =>
  queryOptions({
    queryKey: ["migration", "providers"],
    queryFn: () => listMigrationProviders(),
    staleTime: 60 * 60 * 1000,
  });

export const migrationSourcesQuery = (storeId: string | undefined) =>
  queryOptions({
    queryKey: ["migration", "sources", storeId],
    queryFn: () => listMigrationSources({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
  });

export const migrationJobsQuery = (storeId: string | undefined) =>
  queryOptions({
    queryKey: ["migration", "jobs", storeId],
    queryFn: () => listMigrationJobs({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
  });

export const migrationIssuesQuery = (storeId: string | undefined, jobId: string | undefined) =>
  queryOptions({
    queryKey: ["migration", "issues", storeId, jobId],
    queryFn: () => listMigrationIssues({ data: { storeId: storeId!, jobId: jobId! } }),
    enabled: Boolean(storeId && jobId),
  });
