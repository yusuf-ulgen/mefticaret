import { queryOptions } from "@tanstack/react-query";

import {
  fetchPlatformList,
  fetchPlatformRoles,
  fetchPlatformSettings,
  fetchPlatformSummary,
  fetchPlatformTickets,
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
