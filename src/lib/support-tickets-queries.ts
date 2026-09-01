import { queryOptions } from "@tanstack/react-query";

import {
  getStoreTickets,
  getSupportDepartments,
  getTicketMessages,
} from "@/lib/support-tickets.functions";

/** Destek talebi sorguları. */

export const supportDepartmentsQuery = () =>
  queryOptions({
    queryKey: ["support-departments"],
    queryFn: () => getSupportDepartments(),
    staleTime: 5 * 60_000,
  });

export const storeTicketsQuery = (storeId: string, status: string) =>
  queryOptions({
    queryKey: ["store", storeId, "tickets", status],
    queryFn: () => getStoreTickets({ data: { storeId, status } }),
    staleTime: 15_000,
  });

export const ticketMessagesQuery = (storeId: string, ticketId: string | null) =>
  queryOptions({
    queryKey: ["store", storeId, "ticket-messages", ticketId ?? "none"],
    queryFn: () => getTicketMessages({ data: { storeId, ticketId: ticketId! } }),
    enabled: Boolean(ticketId),
    staleTime: 5_000,
  });
