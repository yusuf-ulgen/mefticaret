import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Herkese açık iletişim formu gönderimi + süper yönetici okuma işlemleri. */

export const sendPlatformContactMessage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data)
  .handler(async ({ data }) => {
    const server = await import("@/lib/platform-contact.server");
    const parsed = server.contactMessageSchema.parse(data);
    const { getRequest } = await import("@tanstack/react-start/server");
    const userAgent = getRequest().headers.get("user-agent");
    return server.insertContactMessage(parsed, userAgent);
  });

export const markPlatformContactMessageRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => data)
  .handler(async ({ data, context }) => {
    const guard = await import("@/lib/platform-admin.server");
    await guard.assertPlatformAdmin(context.supabase, context.userId);
    const server = await import("@/lib/platform-contact.server");
    const input = server.markReadSchema.parse(data);
    const { error } = await context.supabase
      .from("platform_contact_messages")
      .update({ is_read: input.isRead, read_at: input.isRead ? new Date().toISOString() : null })
      .eq("id", input.messageId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
