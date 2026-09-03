import { queryOptions } from "@tanstack/react-query";

import {
  fetchPlatformAnalytics,
  fetchPlatformList,
  fetchPlatformLive,
  fetchPlatformRoles,
  fetchPlatformSettings,
  fetchPlatformSummary,
  fetchPlatformTickets,
  fetchStoreControl,
  fetchTicketMessages,
} from "@/lib/platform-admin.functions";
import type { PlatformDatasetKey } from "@/lib/platform-datasets";

/** Süper admin panelinin sorguları — veriler yalnızca rol doğrulaması yapan server fn üzerinden gelir. */

export const platformListQuery = (dataset: PlatformDatasetKey, search: string, enabled: boolean) =>
  queryOptions({
    queryKey: ["platform-list", dataset, search],
    enabled,
    queryFn: () => fetchPlatformList({ data: { dataset, search: search || undefined, limit: 200 } }),
  });

export const platformSummaryQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ["platform-summary"],
    enabled,
    queryFn: () => fetchPlatformSummary(),
  });

export const platformTicketsQuery = (status: string, enabled: boolean) =>
  queryOptions({
    queryKey: ["platform-tickets", status],
    enabled,
    queryFn: () => fetchPlatformTickets({ data: { status } }),
  });

export const platformTicketMessagesQuery = (ticketId: string | null) =>
  queryOptions({
    queryKey: ["platform-ticket-messages", ticketId],
    enabled: Boolean(ticketId),
    queryFn: () => fetchTicketMessages({ data: { ticketId: ticketId as string } }),
  });

export const platformSettingsQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ["platform-settings"],
    enabled,
    queryFn: () => fetchPlatformSettings(),
  });

export const platformRolesQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ["platform-roles"],
    enabled,
    queryFn: () => fetchPlatformRoles(),
  });

export const platformAnalyticsQuery = (days: number, enabled: boolean) =>
  queryOptions({
    queryKey: ["platform-analytics", days],
    enabled,
    queryFn: () => fetchPlatformAnalytics({ data: { days } }),
  });

export const storeControlQuery = (storeId: string, enabled: boolean) =>
  queryOptions({
    queryKey: ["platform-store-control", storeId],
    enabled,
    queryFn: () => fetchStoreControl({ data: { storeId } }),
  });

export const platformLiveQuery = (minutes: number, enabled: boolean) =>
  queryOptions({
    queryKey: ["platform-live", minutes],
    enabled,
    refetchInterval: 15_000,
    queryFn: () => fetchPlatformLive({ data: { minutes } }),
  });
