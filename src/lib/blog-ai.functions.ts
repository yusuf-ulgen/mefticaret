import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Panelden AI blog taslağı üretimi (mantık blog-ai.server.ts içinde). */
export const generateBlogDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(async (data) => {
    const { blogDraftSchema } = await import("@/lib/blog-ai.server");
    return blogDraftSchema.parse(data);
  })
  .handler(async ({ data, context }) => {
    const { generateBlogDraftContent } = await import("@/lib/blog-ai.server");
    return generateBlogDraftContent({
      client: context.supabase,
      storeId: data.storeId,
      userId: context.userId,
      input: data,
    });
  });
