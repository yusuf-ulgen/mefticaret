import { queryOptions } from "@tanstack/react-query";

import {
  fetchImpersonationSessions,
  fetchPlatformFinance,
  fetchStoreAdminNotes,
  fetchSystemHealth,
} from "@/lib/platform-admin.functions";

/** Finans merkezi ve sistem durumu ekranlarının sorguları. */

export const platformFinanceQuery = (days: number, enabled: boolean) =>
  queryOptions({
    queryKey: ["platform-finance", days],
    enabled,
    queryFn: () => fetchPlatformFinance({ data: { days, limit: 200 } }),
  });

export const systemHealthQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ["platform-system-health"],
    enabled,
    refetchInterval: enabled ? 15_000 : false,
    queryFn: () => fetchSystemHealth(),
  });

export const storeAdminNotesQuery = (storeId: string, enabled: boolean) =>
  queryOptions({
    queryKey: ["platform-store-notes", storeId],
    enabled,
    queryFn: () => fetchStoreAdminNotes({ data: { storeId } }) as Promise<Record<string, any>[]>,
  });

export const impersonationSessionsQuery = (storeId: string, enabled: boolean) =>
  queryOptions({
    queryKey: ["platform-impersonation-sessions", storeId],
    enabled,
    queryFn: () => fetchImpersonationSessions({ data: { storeId } }) as Promise<Record<string, any>[]>,
  });
