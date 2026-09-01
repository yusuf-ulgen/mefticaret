import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { isSearchKind, type SearchHit, type SearchQuery, type SearchProvider } from "@/lib/search";

type Client = SupabaseClient<Database>;

/**
 * PostgreSQL full text search sağlayıcısı. `search_store(...)` fonksiyonu
 * ürün, sipariş, müşteri, blog ve sayfa GIN indekslerini tek sorguda tarar;
 * tenant izolasyonu RLS ve `_store_id` parametresi ile zorlanır.
 */
export function postgresSearchProvider(supabase: Client): SearchProvider {
  return {
    name: "postgres",
    search: async (query: SearchQuery): Promise<SearchHit[]> => {
      const term = query.term.trim();
      if (term.length < 2) return [];

      const { data, error } = await supabase.rpc("search_store", {
        _store_id: query.storeId,
        _term: term,
        _limit: Math.min(Math.max(query.limit ?? 20, 1), 50),
        ...(query.kinds && query.kinds.length > 0 ? { _kinds: query.kinds } : {}),
      });
      if (error) throw new Error(error.message);

      return (data ?? [])
        .filter((row) => isSearchKind(row.kind))
        .map((row) => ({
          kind: row.kind as SearchHit["kind"],
          id: row.id,
          title: row.title,
          subtitle: row.subtitle,
          rank: row.rank,
        }));
    },
  };
}

/** Aktif arama sağlayıcısını döner (gelecekte ortam değişkeni ile seçilir). */
export function searchProvider(supabase: Client): SearchProvider {
  return postgresSearchProvider(supabase);
}
