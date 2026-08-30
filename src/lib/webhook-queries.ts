import { queryOptions } from "@tanstack/react-query";

import {
  getStoreNotifications,
  getStoreWebhookDeliveries,
  getStoreWebhooks,
} from "@/lib/webhooks.functions";

export const storeWebhooksQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store", storeId, "webhooks"],
    queryFn: () => getStoreWebhooks({ data: { storeId } }),
    staleTime: 30_000,
  });

export const webhookDeliveriesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store", storeId, "webhook-deliveries"],
    queryFn: () => getStoreWebhookDeliveries({ data: { storeId } }),
    staleTime: 15_000,
  });

export const storeNotificationsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store", storeId, "notifications"],
    queryFn: () => getStoreNotifications({ data: { storeId } }),
    staleTime: 15_000,
  });
