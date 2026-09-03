import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Süper admin paneli server fonksiyonları: her çağrıda platform_admin rolü doğrulanır. */

export const fetchPlatformList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => data)
  .handler(async ({ data, context }) => {
    const server = await import("@/lib/platform-admin.server");
    await server.assertPlatformAdmin(context.supabase, context.userId);
    return server.listPlatformRows(server.listInputSchema.parse(data));
  });

export const fetchPlatformSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const server = await import("@/lib/platform-admin.server");
    await server.assertPlatformAdmin(context.supabase, context.userId);
    return server.platformSummary();
  });

export const fetchPlatformTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ status: z.string().max(20).optional() }).parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const server = await import("@/lib/platform-admin.server");
    await server.assertPlatformAdmin(context.supabase, context.userId);
    return server.listTickets(data.status);
  });

export const fetchTicketMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ ticketId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const server = await import("@/lib/platform-admin.server");
    await server.assertPlatformAdmin(context.supabase, context.userId);
    return server.listTicketMessages(data.ticketId);
  });

export const updatePlatformTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => data)
  .handler(async ({ data, context }) => {
    const server = await import("@/lib/platform-admin.server");
    await server.assertPlatformAdmin(context.supabase, context.userId);
    return server.updateTicket(server.ticketUpdateSchema.parse(data), context.userId);
  });

export const replyPlatformTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => data)
  .handler(async ({ data, context }) => {
    const server = await import("@/lib/platform-admin.server");
    await server.assertPlatformAdmin(context.supabase, context.userId);
    const name = (context.claims as { email?: string } | null)?.email ?? null;
    return server.replyTicket(server.ticketReplySchema.parse(data), context.userId, name);
  });

export const fetchPlatformSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const server = await import("@/lib/platform-admin.server");
    await server.assertPlatformAdmin(context.supabase, context.userId);
    return server.listSettings();
  });

export const savePlatformSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => data)
  .handler(async ({ data, context }) => {
    const server = await import("@/lib/platform-admin.server");
    await server.assertPlatformAdmin(context.supabase, context.userId);
    return server.saveSetting(server.settingSchema.parse(data), context.userId);
  });

export const savePlatformSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => data)
  .handler(async ({ data, context }) => {
    const server = await import("@/lib/platform-admin.server");
    await server.assertPlatformAdmin(context.supabase, context.userId);
    return server.saveSettings(server.settingsBulkSchema.parse(data), context.userId);
  });

export const fetchPlatformRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const server = await import("@/lib/platform-admin.server");
    await server.assertPlatformAdmin(context.supabase, context.userId);
    return server.listUserRoles();
  });

export const setPlatformUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => data)
  .handler(async ({ data, context }) => {
    const server = await import("@/lib/platform-admin.server");
    await server.assertPlatformAdmin(context.supabase, context.userId);
    return server.setUserRole(server.roleSchema.parse(data), context.userId);
  });

export const fetchPlatformAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ days: z.number().int().min(7).max(365) }).parse(data ?? { days: 30 }))
  .handler(async ({ data, context }) => {
    const server = await import("@/lib/platform-admin.server");
    await server.assertPlatformAdmin(context.supabase, context.userId);
    return server.platformAnalytics(server.analyticsInputSchema.parse(data));
  });

export const fetchStoreControl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ storeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const server = await import("@/lib/platform-admin.server");
    await server.assertPlatformAdmin(context.supabase, context.userId);
    return server.storeControlCenter(data);
  });

export const setStorePlanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => data)
  .handler(async ({ data, context }) => {
    const server = await import("@/lib/platform-admin.server");
    await server.assertPlatformAdmin(context.supabase, context.userId);
    return server.setStorePlan(server.storePlanSchema.parse(data), context.userId);
  });
