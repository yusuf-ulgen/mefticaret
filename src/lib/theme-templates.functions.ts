import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { THEME_TEMPLATES } from "@/lib/theme-templates";

/**
 * Tema mağazası şablonunu mağazaya uygular.
 * Tenant izolasyonu ve yetki RLS ile zorlanır (app_private.can_manage_store).
 */

const codes = THEME_TEMPLATES.map((template) => template.code) as [string, ...string[]];

export const applyThemeTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), code: z.enum(codes) }).parse(data))
  .handler(async ({ data, context }) => {
    const { applyTemplateToStore } = await import("@/lib/theme-templates.server");
    return await applyTemplateToStore(context.supabase, data.storeId, data.code);
  });
