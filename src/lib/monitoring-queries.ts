import { queryOptions } from "@tanstack/react-query";

import { fetchErrorLogs, fetchInfrastructureHealth } from "@/lib/monitoring.functions";

/** İzleme paneli sorguları. */

export const infrastructureHealthQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ["infrastructure-health"],
    enabled,
    refetchInterval: enabled ? 15_000 : false,
    queryFn: () => fetchInfrastructureHealth(),
  });

export const errorLogsQuery = (
  input: { search: string; severity: "ALL" | "CRITICAL" | "WARNING" | "INFO"; onlyOpen: boolean },
  enabled: boolean,
) =>
  queryOptions({
    queryKey: ["error-logs", input.search, input.severity, input.onlyOpen],
    enabled,
    queryFn: () =>
      fetchErrorLogs({
        data: { search: input.search || undefined, severity: input.severity, onlyOpen: input.onlyOpen, limit: 200 },
      }),
  });
