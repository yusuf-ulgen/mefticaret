import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createTicket,
  createTicketSchema,
  listDepartments,
  listStoreTickets,
  listTicketMessages,
  listTicketsSchema,
  replySchema,
  replyToTicket,
  storeScopeSchema,
  ticketScopeSchema,
  updateTicket,
  updateTicketSchema,
  signAttachment,
} from "@/lib/support-tickets.server";
import { z } from "zod";

/** Destek talebi server function'ları (tümü oturum doğrulaması ile çalışır). */

function actorEmail(claims: Record<string, unknown>) {
  const email = claims["email"];
  return typeof email === "string" ? email : null;
}

export const getSupportDepartments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listDepartments(context.supabase));

export const getStoreTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => listTicketsSchema.parse(data))
  .handler(async ({ data, context }) => listStoreTickets(context.supabase, data));

export const getTicketMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => ticketScopeSchema.parse(data))
  .handler(async ({ data, context }) => listTicketMessages(context.supabase, data));

export const createStoreTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => createTicketSchema.parse(data))
  .handler(async ({ data, context }) =>
    createTicket(context.supabase, context.userId, actorEmail(context.claims), data),
  );

export const replyStoreTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => replySchema.parse(data))
  .handler(async ({ data, context }) =>
    replyToTicket(context.supabase, context.userId, actorEmail(context.claims), data),
  );

export const updateStoreTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => updateTicketSchema.parse(data))
  .handler(async ({ data, context }) => updateTicket(context.supabase, data));

export const signSupportAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    storeScopeSchema.extend({ path: z.string().trim().min(3).max(400) }).parse(data),
  )
  .handler(async ({ data, context }) =>
    signAttachment(context.supabase, data.path, data.storeId),
  );
