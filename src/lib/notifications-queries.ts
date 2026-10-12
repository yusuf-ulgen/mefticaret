import { queryOptions } from "@tanstack/react-query";

import {
  getNotificationDeliveries,
  getNotificationSettings,
} from "@/lib/notifications.functions";

export const notificationSettingsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store", storeId, "notification-settings"],
    queryFn: () => getNotificationSettings({ data: { storeId } }),
    staleTime: 30_000,
  });

export const notificationDeliveriesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store", storeId, "notification-deliveries"],
    queryFn: () => getNotificationDeliveries({ data: { storeId } }),
    staleTime: 15_000,
  });
