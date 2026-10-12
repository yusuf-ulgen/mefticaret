import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** İstemci tarafında da kullanılabilen taslak şeması. */
export const blogDraftInputSchema = z.object({
  storeId: z.guid(),
  topic: z.string().trim().min(3).max(200),
  keywords: z.string().trim().max(300).default(""),
  tone: z.enum(["premium", "samimi", "teknik", "minimal"]).default("premium"),
  length: z.enum(["kisa", "orta", "uzun"]).default("orta"),
  includeProducts: z.boolean().default(true),
  audience: z.string().trim().max(200).default(""),
});

/** Panelden AI blog taslağı üretimi (mantık blog-ai.server.ts içinde). */
export const generateBlogDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => blogDraftInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { generateBlogDraftContent } = await import("@/lib/blog-ai.server");
    return generateBlogDraftContent({
      client: context.supabase,
      storeId: data.storeId,
      userId: context.userId,
      input: data,
    });
  });
