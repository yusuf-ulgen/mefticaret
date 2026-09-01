import { queryOptions } from "@tanstack/react-query";

import {
  getConsentRecords,
  getDataRequests,
  getProcessingRecords,
  getSecurityEvents,
} from "@/lib/compliance.functions";

export const consentRecordsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store", storeId, "consent-records"],
    queryFn: () => getConsentRecords({ data: { storeId } }),
    staleTime: 30_000,
  });

export const securityEventsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store", storeId, "security-events"],
    queryFn: () => getSecurityEvents({ data: { storeId } }),
    staleTime: 30_000,
  });

export const processingRecordsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store", storeId, "processing-records"],
    queryFn: () => getProcessingRecords({ data: { storeId } }),
    staleTime: 60_000,
  });

export const dataRequestsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store", storeId, "data-requests"],
    queryFn: () => getDataRequests({ data: { storeId } }),
    staleTime: 30_000,
  });
