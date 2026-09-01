/**
 * Sunucu tarafı önbellek soyutlaması.
 *
 * Sürücüler:
 *  - `redis`    → Upstash uyumlu REST API (UPSTASH_REDIS_REST_URL + _TOKEN)
 *  - `postgres` → `cache_entries` tablosu (varsayılan, Redis bağlanana kadar)
 *
 * Uygulama kodu yalnızca `cacheGet/cacheSet/cached/invalidate*` fonksiyonlarını
 * kullanır; Redis bağlandığında tek satır ortam değişkeni ile sürücü değişir.
 */

export const CACHE_NAMESPACES = {
  storeSettings: "store-settings",
  catalog: "catalog",
  categories: "categories",
  session: "session",
  rateLimit: "rate-limit",
  analytics: "analytics",
  query: "query",
} as const;

export type CacheNamespace = (typeof CACHE_NAMESPACES)[keyof typeof CACHE_NAMESPACES];

/** Ad alanı bazlı varsayılan TTL değerleri (saniye). */
export const CACHE_TTL: Record<CacheNamespace, number> = {
  "store-settings": 300,
  catalog: 120,
  categories: 600,
  session: 900,
  "rate-limit": 60,
  analytics: 300,
  query: 60,
};

export type CacheDriver = "redis" | "postgres";

export function cacheDriver(): CacheDriver {
  return process.env["UPSTASH_REDIS_REST_URL"] && process.env["UPSTASH_REDIS_REST_TOKEN"]
    ? "redis"
    : "postgres";
}

export function cacheKey(
  namespace: CacheNamespace,
  storeId: string | null,
  ...parts: (string | number | null | undefined)[]
) {
  return [namespace, storeId ?? "global", ...parts.filter((p) => p !== null && p !== undefined)]
    .join(":")
    .slice(0, 400);
}

async function redisCommand<T>(command: (string | number)[]): Promise<T | null> {
  const url = process.env["UPSTASH_REDIS_REST_URL"];
  const token = process.env["UPSTASH_REDIS_REST_TOKEN"];
  if (!url || !token) return null;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(command),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { result?: T };
    return json.result ?? null;
  } catch {
    return null;
  }
}

/** Önbellekten okur; anahtar yok ya da süresi geçmişse `null`. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (cacheDriver() === "redis") {
    const raw = await redisCommand<string>(["GET", key]);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("cache_get", { _key: key });
    if (error || data === null || data === undefined) return null;
    return data as T;
  } catch {
    return null;
  }
}

/** Önbelleğe yazar. Hata durumunda sessizce geçer (cache asla akışı bozmaz). */
export async function cacheSet<T>(
  key: string,
  namespace: CacheNamespace,
  value: T,
  options: { ttlSeconds?: number; storeId?: string | null } = {},
): Promise<void> {
  const ttl = Math.max(1, options.ttlSeconds ?? CACHE_TTL[namespace]);

  if (cacheDriver() === "redis") {
    await redisCommand(["SET", key, JSON.stringify(value), "EX", ttl]);
    if (options.storeId) {
      await redisCommand(["SADD", `tag:${namespace}:${options.storeId}`, key]);
    }
    return;
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("cache_set", {
      _key: key,
      _namespace: namespace,
      _value: value as never,
      _ttl_seconds: ttl,
      ...(options.storeId ? { _store_id: options.storeId } : {}),
    });
  } catch {
    /* önbellek yazımı başarısızsa istek normal devam eder */
  }
}

/** Ad alanı / mağaza / anahtar öneki bazlı geçersiz kılma. */
export async function cacheInvalidate(options: {
  namespace?: CacheNamespace;
  storeId?: string | null;
  prefix?: string;
} = {}): Promise<number> {
  if (cacheDriver() === "redis") {
    if (options.namespace && options.storeId) {
      const tag = `tag:${options.namespace}:${options.storeId}`;
      const keys = (await redisCommand<string[]>(["SMEMBERS", tag])) ?? [];
      for (const key of keys) await redisCommand(["DEL", key]);
      await redisCommand(["DEL", tag]);
      return keys.length;
    }
    if (options.prefix) {
      const keys = (await redisCommand<string[]>(["KEYS", `${options.prefix}*`])) ?? [];
      for (const key of keys) await redisCommand(["DEL", key]);
      return keys.length;
    }
    return 0;
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.rpc("cache_invalidate", {
      ...(options.namespace ? { _namespace: options.namespace } : {}),
      ...(options.storeId ? { _store_id: options.storeId } : {}),
      ...(options.prefix ? { _prefix: options.prefix } : {}),
    });
    return typeof data === "number" ? data : 0;
  } catch {
    return 0;
  }
}

/** Bir mağazanın tüm önbelleğini temizler (veri değişimi sonrası). */
export function invalidateStoreCache(storeId: string) {
  return cacheInvalidate({ storeId });
}

/** Katalog/kategori önbelleğini temizler. */
export async function invalidateCatalogCache(storeId: string) {
  await cacheInvalidate({ namespace: CACHE_NAMESPACES.catalog, storeId });
  await cacheInvalidate({ namespace: CACHE_NAMESPACES.categories, storeId });
  await cacheInvalidate({ namespace: CACHE_NAMESPACES.query, storeId });
}

/**
 * Read-through yardımcı: önbellekte varsa döner, yoksa üretir ve yazar.
 */
export async function cached<T>(
  key: string,
  namespace: CacheNamespace,
  producer: () => Promise<T>,
  options: { ttlSeconds?: number; storeId?: string | null } = {},
): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;
  const value = await producer();
  await cacheSet(key, namespace, value, options);
  return value;
}
