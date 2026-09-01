export const SEARCH_KINDS = ["product", "order", "customer", "blog", "page"] as const;

export type SearchKind = (typeof SEARCH_KINDS)[number];

export type SearchHit = {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string | null;
  rank?: number;
};

export const SEARCH_KIND_LABELS: Record<SearchKind, string> = {
  product: "Ürün",
  order: "Sipariş",
  customer: "Müşteri",
  blog: "Blog",
  page: "Sayfa",
};

export type SearchQuery = {
  storeId: string;
  term: string;
  kinds?: SearchKind[];
  limit?: number;
};

/**
 * Arama sağlayıcı sözleşmesi. İlk aşamada PostgreSQL full text search kullanılır;
 * Meilisearch / Elasticsearch / OpenSearch eklenmek istendiğinde yalnızca bu
 * arayüzü uygulayan yeni bir sağlayıcı yazılır, çağıran kod değişmez.
 */
export type SearchProvider = {
  name: "postgres" | "meilisearch" | "elasticsearch" | "opensearch";
  search: (query: SearchQuery) => Promise<SearchHit[]>;
};

export function isSearchKind(value: string): value is SearchKind {
  return (SEARCH_KINDS as readonly string[]).includes(value);
}
