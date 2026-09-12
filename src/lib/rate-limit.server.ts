/**
 * Sunucu tarafı hız sınırlayıcı.
 * Sayaçlar veritabanında tutulur (worker'lar stateless olduğu için bellekte tutulamaz).
 */

export type RateLimitResult = {
  allowed: boolean;
  hits: number;
  limit: number;
  remaining: number;
  resetAt: string;
};

export type RateLimitRule = { limit: number; windowSeconds: number };

export const RATE_LIMITS = {
  api: { limit: 600, windowSeconds: 60 },
  api_write: { limit: 120, windowSeconds: 60 },
  public_form: { limit: 20, windowSeconds: 600 },
  data_request: { limit: 5, windowSeconds: 3600 },
  consent: { limit: 60, windowSeconds: 600 },
  // Panel girişleri: IP başına deneme sınırı (hesap kilidi ile birlikte çalışır).
  admin_login: { limit: 10, windowSeconds: 600 },
  admin_route: { limit: 300, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;

export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/** Sayaç artırır ve limitin aşılıp aşılmadığını döner. Hata durumunda isteği engellemez. */
export async function consumeRateLimit(bucketKey: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const fallback: RateLimitResult = {
    allowed: true,
    hits: 0,
    limit: rule.limit,
    remaining: rule.limit,
    resetAt: new Date(Date.now() + rule.windowSeconds * 1000).toISOString(),
  };

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("consume_rate_limit", {
      _bucket_key: bucketKey.slice(0, 200),
      _limit: rule.limit,
      _window_seconds: rule.windowSeconds,
    });
    if (error || !data) return fallback;
    const payload = data as {
      allowed: boolean;
      hits: number;
      limit: number;
      remaining: number;
      reset_at: string;
    };
    return {
      allowed: payload.allowed,
      hits: payload.hits,
      limit: payload.limit,
      remaining: payload.remaining,
      resetAt: payload.reset_at,
    };
  } catch {
    return fallback;
  }
}

/** Limit aşıldığında dönülecek standart JSON yanıtı. */
export function rateLimitResponse(result: RateLimitResult): Response {
  const retryAfter = Math.max(1, Math.ceil((new Date(result.resetAt).getTime() - Date.now()) / 1000));
  return new Response(
    JSON.stringify({ error: "rate_limited", limit: result.limit, reset_at: result.resetAt }),
    {
      status: 429,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "retry-after": String(retryAfter),
        "x-ratelimit-limit": String(result.limit),
        "x-ratelimit-remaining": "0",
      },
    },
  );
}

/** Güvenlik olayını kalıcı olarak kaydeder (audit/forensics). */
export async function recordSecurityEvent(input: {
  storeId?: string | null;
  userId?: string | null;
  kind: string;
  severity?: "info" | "warning" | "critical";
  request?: Request;
  meta?: Record<string, unknown>;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("security_events").insert({
      store_id: input.storeId ?? null,
      user_id: input.userId ?? null,
      kind: input.kind,
      severity: input.severity ?? "info",
      ip: input.request ? clientIp(input.request) : null,
      user_agent: input.request?.headers.get("user-agent") ?? null,
      meta: (input.meta ?? {}) as never,
    });
  } catch {
    /* kayıt başarısızsa akışı bozmayız */
  }
}
