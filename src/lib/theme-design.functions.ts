import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveDesignTokens } from "@/lib/theme-design";

/**
 * Tasarım sistemi (design tokens) kaydı. Değerler sunucu tarafında
 * normalize edilir; yetki ve tenant izolasyonu RLS ile zorlanır.
 */
export const saveThemeDesign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        tokens: z.unknown(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const tokens = resolveDesignTokens(data.tokens);
    const { error } = await context.supabase
      .from("store_themes")
      .upsert({ store_id: data.storeId, design_tokens: tokens }, { onConflict: "store_id" });
    if (error) throw new Error(error.message);
    return { ok: true, tokens };
  });
