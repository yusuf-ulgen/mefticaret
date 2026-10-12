import { queryOptions } from "@tanstack/react-query";

import { fetchLoadTestStatus } from "@/lib/loadtest.functions";

/** Yük testi paneli sorgusu (5 saniyede bir yenilenir). */
export const loadTestStatusQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ["load-test-status"],
    enabled,
    refetchInterval: enabled ? 5_000 : false,
    queryFn: () => fetchLoadTestStatus(),
  });
