import { queryOptions } from "@tanstack/react-query";

import {
  getMyStoreAddresses,
  getMyStoreLoyalty,
  getMyStoreOrders,
  getMyStoreRefunds,
  getMyStoreReturns,
} from "@/lib/account.functions";

export const myLoyaltyQuery = (storeId: string, enabled: boolean) =>
  queryOptions({
    queryKey: ["storefront", storeId, "my-loyalty"],
    queryFn: () => getMyStoreLoyalty({ data: { storeId } }),
    staleTime: 30_000,
    enabled,
  });

export const myOrdersQuery = (storeId: string, enabled: boolean) =>
  queryOptions({
    queryKey: ["storefront", storeId, "my-orders"],
    queryFn: () => getMyStoreOrders({ data: { storeId } }),
    staleTime: 30_000,
    enabled,
  });

export const myAddressesQuery = (storeId: string, enabled: boolean) =>
  queryOptions({
    queryKey: ["storefront", storeId, "my-addresses"],
    queryFn: () => getMyStoreAddresses({ data: { storeId } }),
    staleTime: 30_000,
    enabled,
  });

export const myReturnsQuery = (storeId: string, enabled: boolean) =>
  queryOptions({
    queryKey: ["storefront", storeId, "my-returns"],
    queryFn: () => getMyStoreReturns({ data: { storeId } }),
    staleTime: 30_000,
    enabled,
  });

export const myRefundsQuery = (storeId: string, enabled: boolean) =>
  queryOptions({
    queryKey: ["storefront", storeId, "my-refunds"],
    queryFn: () => getMyStoreRefunds({ data: { storeId } }),
    staleTime: 30_000,
    enabled,
  });
