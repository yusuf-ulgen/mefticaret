import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Giriş/çıkış gibi kimlik olaylarını denetim kaydına yazar. */
export const logAuthEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        event: z.enum(["login", "logout"]),
        method: z.enum(["password", "google", "signup"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { recordAudit } = await import("./audit.server");
    await recordAudit(context.supabase, {
      action: data.event === "login" ? "auth.login" : "auth.logout",
      actorId: context.userId,
      entity: "auth.users",
      entityId: context.userId,
      newValue: { method: data.method ?? "password" },
    });
    return { ok: true as const };
  });
