/**
 * DDoS / ülke / ASN / uç nokta hız katmanı (v2_ddos_protection).
 * fw_settings.enabled kapalıyken hiçbir şey yapmaz. Sayaçlar veritabanında tutulur.
 */
import { clientIp, consumeRateLimit } from "@/lib/rate-limit.server";

type FwSettings = {
  enabled: boolean;
  autoMitigation: boolean;
  thresholds: [number, number, number, number];
  autoBanPerMinute: number;
  autoBanMinutes: number;
  level: number;
  levelChangedAt: string;
};
type CountryRule = { code: string; type: "block" | "allow" | "captcha" | "rate_limit" };
type AsnRule = { asn: number; type: "block" | "captcha" | "rate_limit" };
type EndpointRule = { prefix: string; limit: number; window: number; onExceed: "block" | "captcha" };

const TTL = 30_000;
let cache: { at: number; settings: FwSettings; countries: CountryRule[]; asns: AsnRule[]; endpoints: EndpointRule[]; whitelist: string[] } | null = null;
const passCache = new Map<string, number>();

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export function invalidateFwCache() {
  cache = null;
  passCache.clear();
}

async function load() {
  if (cache && Date.now() - cache.at < TTL) return cache;
  const s = await db();
  const [set, c, a, e, w] = await Promise.all([
    s.from("fw_settings").select("*").maybeSingle(),
    s.from("fw_country_rules").select("country_code, rule_type").eq("is_active", true),
    s.from("fw_asn_rules").select("asn_number, rule_type").eq("is_active", true),
    s.from("fw_endpoint_limits").select("path_prefix, limit_count, window_seconds, on_exceed").eq("is_active", true),
    s.from("sec_ip_rules").select("ip_address").eq("rule_type", "whitelist").eq("is_active", true),
  ]);
  const r = set.data;
  cache = {
    at: Date.now(),
    settings: {
      enabled: !!r?.enabled,
      autoMitigation: r?.auto_mitigation ?? true,
      thresholds: [r?.level1_rpm ?? 60000, r?.level2_rpm ?? 300000, r?.level3_rpm ?? 1200000, r?.level4_rpm ?? 6000000],
      autoBanPerMinute: r?.auto_ban_per_minute ?? 600,
      autoBanMinutes: r?.auto_ban_minutes ?? 60,
      level: r?.current_level ?? 0,
      levelChangedAt: r?.level_changed_at ?? new Date().toISOString(),
    },
    countries: (c.data ?? []).map((x) => ({ code: x.country_code, type: x.rule_type as CountryRule["type"] })),
    asns: (a.data ?? []).map((x) => ({ asn: x.asn_number, type: x.rule_type as AsnRule["type"] })),
    endpoints: (e.data ?? [])
      .map((x) => ({ prefix: x.path_prefix, limit: x.limit_count, window: x.window_seconds, onExceed: x.on_exceed as EndpointRule["onExceed"] }))
      .sort((x, y) => y.prefix.length - x.prefix.length),
    whitelist: (w.data ?? []).map((x) => String(x.ip_address ?? "").replace(/\/32$/, "")).filter(Boolean),
  };
  return cache;
}

async function hasPassed(ip: string) {
  const hit = passCache.get(ip);
  if (hit && hit > Date.now()) return true;
  try {
    const s = await db();
    const { data } = await s.from("fw_captcha_passes").select("expires_at").eq("ip_address", ip).maybeSingle();
    if (data && new Date(data.expires_at).getTime() > Date.now()) {
      passCache.set(ip, new Date(data.expires_at).getTime());
      return true;
    }
  } catch {
    /* yok say */
  }
  return false;
}

function bump(blocked: number, challenged: number, country: string, path: string) {
  void (async () => {
    try {
      const s = await db();
      const minute = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
      await s.rpc("fw_bump_traffic", { _minute: minute, _blocked: blocked, _challenged: challenged, _country: country, _path: path });
    } catch {
      /* sayaç kritik değil */
    }
  })();
}

function recordViolation(ip: string, endpoint: string, hits: number, window: number, limit: number, action: string) {
  void (async () => {
    try {
      const s = await db();
      await s.from("fw_rate_limit_violations").insert({
        ip_address: ip, endpoint: endpoint.slice(0, 200), requests_in_window: hits,
        window_seconds: window, limit_threshold: limit, action_taken: action,
      });
    } catch {
      /* yok say */
    }
  })();
}

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function page(status: number, title: string, body: string) {
  return new Response(
    `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;background:#fff;color:#111;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px}main{max-width:440px;border:1px solid #e5e5e5;border-radius:16px;padding:32px;text-align:center}h1{font-size:22px;margin:0 0 12px}p{color:#555;line-height:1.5}small{color:#7c3aed}</style></head><body><main>${body}</main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}

function countryPage(ip: string, country: string) {
  return page(403, "Erişim Kısıtlı",
    `<h1>Erişim Kısıtlı</h1><p>Üzgünüz, bu hizmet şu anda bulunduğunuz ülkede kullanılamamaktadır.</p><p>Sorry, this service is not available in your country.</p><p><small>IP: ${esc(ip)} · Ülke: ${esc(country)}</small></p><p>Hata mı? destek@mefticaret.com</p>`);
}

function tooMany(retryAfter: number, limit: number, captcha: boolean) {
  return new Response(
    JSON.stringify({ error: "rate_limit_exceeded", message: "Çok fazla istek gönderdiniz.", retry_after: retryAfter, captcha_required: captcha }),
    {
      status: 429,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "retry-after": String(retryAfter),
        "x-ratelimit-limit": String(limit),
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + retryAfter),
        "cache-control": "no-store",
      },
    },
  );
}

function challenge(request: Request, url: URL) {
  const wantsHtml = request.method === "GET" && (request.headers.get("accept") ?? "").includes("text/html");
  if (wantsHtml) {
    const back = `${url.pathname}${url.search}`.slice(0, 500);
    return new Response(null, {
      status: 302,
      headers: { location: `/guvenlik-kontrolu?r=${encodeURIComponent(back)}`, "cache-control": "no-store" },
    });
  }
  return tooMany(60, 0, true);
}

const BAD_BOT = /(curl\/|wget\/|python-requests\/|scrapy\/|nikto\/|sqlmap\/|masscan\/|nmap)/i;
const HIGH_RISK = new Set(["RU", "CN", "KP", "IR", "NG", "UA", "RO", "BG", "BR"]);

/** İstek engellenecekse Response, geçecekse null döner. */
export async function evaluateDdos(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (/\.(js|mjs|css|map|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|txt|xml|json|webmanifest)$/i.test(path)) return null;
  if (path.startsWith("/api/public/cron")) return null;

  const state = await load();
  const s = state.settings;
  if (!s.enabled) return null;

  const ip = clientIp(request);
  const country = (request.headers.get("cf-ipcountry") ?? "").toUpperCase();
  const asn = Number((request as unknown as { cf?: { asn?: number } }).cf?.asn ?? 0);
  const ua = request.headers.get("user-agent") ?? "";
  const challengeExempt = path === "/guvenlik-kontrolu" || path.startsWith("/_serverFn");

  // 1. İzin listesi
  if (state.whitelist.includes(ip)) {
    bump(0, 0, country, path);
    return null;
  }

  // 2. Kötü bot imzaları
  if (BAD_BOT.test(ua)) {
    bump(1, 0, country, path);
    return new Response("Forbidden", { status: 403 });
  }

  const passed = challengeExempt ? true : await hasPassed(ip);
  const countryRule = state.countries.find((r) => r.code === country);

  // 3. Ülke kuralı
  if (countryRule && countryRule.type !== "allow") {
    if (countryRule.type === "block") {
      bump(1, 0, country, path);
      return countryPage(ip, country);
    }
    if (countryRule.type === "captcha" && !passed) {
      bump(0, 1, country, path);
      return challenge(request, url);
    }
    if (countryRule.type === "rate_limit") {
      const r = await consumeRateLimit(`fw:cr:${ip}`, { limit: 30, windowSeconds: 60 });
      if (!r.allowed) {
        bump(1, 0, country, path);
        recordViolation(ip, path, r.hits, 60, 30, "country_rate_limit");
        return tooMany(60, 30, false);
      }
    }
  }

  // 4. ASN kuralı
  const asnRule = asn ? state.asns.find((r) => r.asn === asn) : undefined;
  if (asnRule) {
    if (asnRule.type === "block") {
      bump(1, 0, country, path);
      return new Response("Forbidden", { status: 403 });
    }
    if (asnRule.type === "captcha" && !passed) {
      bump(0, 1, country, path);
      return challenge(request, url);
    }
  }

  // 5. Uç nokta hız limiti
  const ep = state.endpoints.find((r) => path === r.prefix || path.startsWith(`${r.prefix}/`) || path.startsWith(`${r.prefix}?`));
  if (ep && request.method !== "OPTIONS") {
    const r = await consumeRateLimit(`fw:ep:${ep.prefix}:${ip}`, { limit: ep.limit, windowSeconds: ep.window });
    if (!r.allowed) {
      recordViolation(ip, path, r.hits, ep.window, ep.limit, ep.onExceed);
      if (ep.onExceed === "captcha" && !passed) {
        bump(0, 1, country, path);
        return challenge(request, url);
      }
      bump(1, 0, country, path);
      return tooMany(ep.window, ep.limit, false);
    }
  }

  // 6. Tek IP'den aşırı trafik → otomatik ban (seviye 3+ eşik yarıya iner)
  const banLimit = s.level >= 3 ? Math.max(30, Math.floor(s.autoBanPerMinute / 2)) : s.autoBanPerMinute;
  const ipRate = await consumeRateLimit(`fw:ip:${ip}`, { limit: banLimit, windowSeconds: 60 });
  if (!ipRate.allowed) {
    bump(1, 0, country, path);
    recordViolation(ip, path, ipRate.hits, 60, banLimit, "auto_ban");
    if (s.autoMitigation && ip !== "unknown") {
      void (async () => {
        try {
          const d = await db();
          const { data: existing } = await d.from("sec_ip_rules").select("id").eq("ip_address", ip).eq("rule_type", "blacklist").eq("is_active", true).maybeSingle();
          if (!existing) {
            await d.from("sec_ip_rules").insert({
              ip_address: ip, rule_type: "blacklist",
              reason: `Otomatik ban: ${ipRate.hits} istek/dk`,
              expires_at: new Date(Date.now() + s.autoBanMinutes * 60_000).toISOString(),
            });
            const { invalidateSecurityCache } = await import("@/lib/security-firewall.server");
            invalidateSecurityCache();
          }
        } catch {
          /* yok say */
        }
      })();
    }
    return tooMany(60, banLimit, false);
  }

  // 7. Saldırı seviyesine göre doğrulama
  if (!passed && s.autoMitigation) {
    if (s.level >= 4 || (s.level >= 3 && (HIGH_RISK.has(country) || !!asnRule)) || (s.level >= 2 && ua.trim().length < 10)) {
      bump(0, 1, country, path);
      return challenge(request, url);
    }
  }

  bump(0, 0, country, path);
  return null;
}

// ===== Doğrulama (matematik) =====

export async function createCaptcha(request: Request) {
  const ip = clientIp(request);
  const a = 2 + Math.floor(Math.random() * 18);
  const b = 1 + Math.floor(Math.random() * 9);
  const s = await db();
  const { data, error } = await s.from("fw_captcha_challenges").insert({ ip_address: ip, answer: a + b }).select("id").single();
  if (error) throw new Error("Doğrulama oluşturulamadı.");
  return { id: data.id, question: `${a} + ${b} = ?` };
}

export async function solveCaptcha(request: Request, id: string, answer: number) {
  const ip = clientIp(request);
  const s = await db();
  const { data } = await s.from("fw_captcha_challenges").select("*").eq("id", id).maybeSingle();
  if (!data || data.ip_address !== ip || data.status !== "pending") return { ok: false, message: "Doğrulama geçersiz, yenileyin." };
  if (new Date(data.expires_at).getTime() < Date.now()) {
    await s.from("fw_captcha_challenges").update({ status: "expired" }).eq("id", id);
    return { ok: false, message: "Süre doldu, yenileyin." };
  }
  if (data.answer !== answer) {
    const attempts = data.attempts_count + 1;
    await s.from("fw_captcha_challenges").update({ attempts_count: attempts, status: attempts >= 3 ? "failed" : "pending" }).eq("id", id);
    return { ok: false, message: attempts >= 3 ? "Çok fazla hatalı deneme, yenileyin." : "Yanlış cevap." };
  }
  const expires = new Date(Date.now() + 10 * 60_000).toISOString();
  await s.from("fw_captcha_challenges").update({ status: "passed", passed_at: new Date().toISOString() }).eq("id", id);
  await s.from("fw_captcha_passes").upsert({ ip_address: ip, expires_at: expires });
  passCache.set(ip, new Date(expires).getTime());
  return { ok: true, message: "Doğrulandı." };
}

// ===== Dakikalık görev =====

type Counter = Record<string, number>;
const top = (obj: Counter, n = 10) =>
  Object.entries(obj ?? {}).sort((a, b) => b[1] - a[1]).slice(0, n).map(([key, count]) => ({ key, count }));

export async function runFirewallTick() {
  const s = await db();
  const prevMinute = new Date(Math.floor(Date.now() / 60000) * 60000 - 60000).toISOString();
  const [{ data: row }, { data: set }] = await Promise.all([
    s.from("fw_traffic_minutes").select("*").eq("minute", prevMinute).maybeSingle(),
    s.from("fw_settings").select("*").maybeSingle(),
  ]);
  if (!set) return { ok: false };

  const rpm = Number(row?.requests ?? 0);
  const thresholds = [set.level1_rpm, set.level2_rpm, set.level3_rpm, set.level4_rpm];
  let measured = 0;
  thresholds.forEach((t, i) => { if (rpm >= t) measured = i + 1; });

  let level = set.current_level;
  const sinceChange = Date.now() - new Date(set.level_changed_at).getTime();
  if (measured > level) level = measured;
  else if (measured < level && sinceChange >= 5 * 60_000) level = level - 1;

  const topCountries = top((row?.countries ?? {}) as Counter);
  const topPaths = top((row?.paths ?? {}) as Counter);

  if (row) {
    await s.from("fw_traffic_snapshots").insert({
      snapshot_at: prevMinute, requests_total: rpm, requests_blocked: Number(row.blocked),
      requests_challenged: Number(row.challenged), top_countries: topCountries, top_endpoints: topPaths, level,
    });
  }

  if (level !== set.current_level) {
    await s.from("fw_settings").update({ current_level: level, level_changed_at: new Date().toISOString() }).eq("id", true);
    invalidateFwCache();
  }

  const { data: active } = await s.from("fw_ddos_events").select("*").eq("is_active", true).maybeSingle();
  const severity = ["low", "low", "medium", "high", "critical"][level] ?? "low";
  if (level >= 2) {
    if (!active) {
      await s.from("fw_ddos_events").insert({
        severity, peak_level: level, peak_rpm: rpm, total_requests: rpm, blocked_requests: Number(row?.blocked ?? 0),
        source_countries: topCountries, targeted_endpoints: topPaths,
        mitigation_action: set.auto_mitigation ? (level >= 3 ? "rate_limit+captcha" : "captcha") : null,
      });
      const { sendSecurityAlert } = await import("@/lib/security-firewall.server");
      await sendSecurityAlert({
        title: `DDoS seviye ${level} tespit edildi`,
        lines: [`Dakikadaki istek: ${rpm}`, `En çok hedef: ${topPaths.slice(0, 3).map((p) => p.key).join(", ")}`],
      });
    } else {
      await s.from("fw_ddos_events").update({
        peak_level: Math.max(active.peak_level, level), peak_rpm: Math.max(Number(active.peak_rpm), rpm),
        severity: level > active.peak_level ? severity : active.severity,
        total_requests: Number(active.total_requests) + rpm,
        blocked_requests: Number(active.blocked_requests) + Number(row?.blocked ?? 0),
      }).eq("id", active.id);
    }
  } else if (active && level <= 1) {
    await s.from("fw_ddos_events").update({ is_active: false, ended_at: new Date().toISOString() }).eq("id", active.id);
  }

  // Temizlik
  const now = new Date().toISOString();
  await Promise.all([
    s.from("sec_ip_rules").update({ is_active: false }).lt("expires_at", now).eq("is_active", true),
    s.from("fw_traffic_minutes").delete().lt("minute", new Date(Date.now() - 3 * 3600_000).toISOString()),
    s.from("fw_captcha_passes").delete().lt("expires_at", now),
    s.from("fw_captcha_challenges").delete().lt("created_at", new Date(Date.now() - 86400_000).toISOString()),
    s.from("fw_traffic_snapshots").delete().lt("snapshot_at", new Date(Date.now() - 90 * 86400_000).toISOString()),
    s.from("fw_rate_limit_violations").delete().lt("created_at", new Date(Date.now() - 90 * 86400_000).toISOString()),
  ]);
  return { ok: true, rpm, level };
}
