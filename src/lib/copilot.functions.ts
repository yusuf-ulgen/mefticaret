import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Copilot sunucu fonksiyonları (mantık copilot.server.ts içinde). */

export const sendCopilotMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        conversationId: z.guid().nullish(),
        message: z.string().trim().min(2).max(4000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { sendCopilotTurn } = await import("@/lib/copilot.server");
    return sendCopilotTurn({
      client: context.supabase,
      storeId: data.storeId,
      userId: context.userId,
      message: data.message,
      conversationId: data.conversationId ?? null,
    });
  });

export const getCopilotContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { collectCopilotContext } = await import("@/lib/copilot.server");
    const result = await collectCopilotContext(context.supabase, data.storeId);
    return result.summary;
  });

export const renameCopilotConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        conversationId: z.guid(),
        title: z.string().trim().min(1).max(120),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("copilot_conversations")
      .update({ title: data.title })
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCopilotConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ conversationId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("copilot_conversations")
      .delete()
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
