import { queryOptions } from "@tanstack/react-query";

import { listKolayCustomers } from "@/lib/kolay-customers.functions";
import { getKolayInsights } from "@/lib/kolay-insights.functions";

/** Kolay Panel müşteri ve analitik okuma katmanı. */

export const kolayCustomersQuery = (storeId: string, search = "", page = 0) =>
  queryOptions({
    queryKey: ["kolay-customers", storeId, search, page],
    staleTime: 30_000,
    queryFn: () => listKolayCustomers({ data: { storeId, search, page } }),
  });

export const kolayInsightsQuery = (storeId: string, days = 30) =>
  queryOptions({
    queryKey: ["kolay-insights", storeId, days],
    staleTime: 60_000,
    queryFn: () => getKolayInsights({ data: { storeId, days } }),
  });
