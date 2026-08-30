import { queryOptions } from "@tanstack/react-query";

import { listAbandonedCarts } from "@/lib/abandoned.functions";

export const abandonedCartsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store", storeId, "abandoned-carts"],
    queryFn: () => listAbandonedCarts({ data: { storeId } }),
    staleTime: 30_000,
  });
