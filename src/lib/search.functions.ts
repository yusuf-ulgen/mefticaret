import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SEARCH_KINDS, type SearchHit } from "@/lib/search";

/**
 * Panel geneli hızlı arama (komut paleti). PostgreSQL full text search üzerinden
 * çalışır; sağlayıcı soyutlaması `src/lib/search.server.ts` içindedir.
 * Tenant izolasyonu RLS ile zorlanır.
 */

const searchInput = z.object({
  storeId: z.guid(),
  term: z.string().trim().max(120),
  kinds: z.array(z.enum(SEARCH_KINDS)).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const searchStore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => searchInput.parse(data))
  .handler(async ({ data, context }): Promise<SearchHit[]> => {
    if (data.term.trim().length < 2) return [];
    const { searchProvider } = await import("@/lib/search.server");
    return searchProvider(context.supabase).search({
      storeId: data.storeId,
      term: data.term,
      ...(data.kinds ? { kinds: data.kinds } : {}),
      ...(data.limit ? { limit: data.limit } : {}),
    });
  });
