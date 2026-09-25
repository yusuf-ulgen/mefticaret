/**
 * Güvenlik duvarı (WAF) sunucu motoru.
 * Katmanlar: IP itibarı/kara liste → ülke engeli → hız limiti → WAF desenleri →
 * bot tespiti → kaba kuvvet kilidi. Ayarlar veritabanındadır ve varsayılan kapalıdır.
 */

import { clientIp, consumeRateLimit } from "@/lib/rate-limit.server";
import type { AttackType, SecAction, Severity, WafMode } from "@/lib/security-firewall";

type Settings = {
  firewallEnabled: boolean;
  botDetectionEnabled: boolean;
  countryBlockEnabled: boolean;
  rateLimitEnabled: boolean;
  fraudDetectionEnabled: boolean;
  wafMode: WafMode;
  maxBodyBytes: number;
  bruteForceMaxAttempts: number;
  bruteForceLockMinutes: number;
  bruteForceIpBanAttempts: number;
  alertWebhookUrl: string | null;
  alertEmail: string | null;
};

type WafRule = {
  id: string;
  ruleName: string;
  ruleType: string;
  pattern: string;
  action: "block" | "log" | "captcha";
  severity: Severity;
};

type IpRule = {
  id: string;
  ruleType: "whitelist" | "blacklist" | "rate_limit";
  ipAddress: string | null;
  ipRange: string | null;
  rateLimitPerMinute: number | null;
  storeId: string | null;
};

const CACHE_TTL_MS = 60_000;
type Cache<T> = { value: T; at: number };

let settingsCache: Cache<Settings> | null = null;
let wafCache: Cache<WafRule[]> | null = null;
let ipCache: Cache<IpRule[]> | null = null;
let countryCache: Cache<string[]> | null = null;

const DEFAULT_SETTINGS: Settings = {
  firewallEnabled: false,
  botDetectionEnabled: false,
  countryBlockEnabled: false,
  rateLimitEnabled: false,
  fraudDetectionEnabled: false,
  wafMode: "active",
  maxBodyBytes: 10 * 1024 * 1024,
  bruteForceMaxAttempts: 5,
  bruteForceLockMinutes: 15,
  bruteForceIpBanAttempts: 20,
  alertWebhookUrl: null,
  alertEmail: null,
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Platform geneli güvenlik ayarları (60 sn önbellekli). */
export async function getSecuritySettings(): Promise<Settings> {
  if (settingsCache && Date.now() - settingsCache.at < CACHE_TTL_MS) return settingsCache.value;
  try {
    const db = await admin();
    const { data } = await db
      .from("sec_settings")
      .select("*")
      .is("store_id", null)
      .maybeSingle();
    const value: Settings = data
      ? {
          firewallEnabled: data.firewall_enabled,
          botDetectionEnabled: data.bot_detection_enabled,
          countryBlockEnabled: data.country_block_enabled,
          rateLimitEnabled: data.rate_limit_enabled,
          fraudDetectionEnabled: data.fraud_detection_enabled,
          wafMode: (data.waf_mode ?? "active") as WafMode,
          maxBodyBytes: data.max_body_bytes ?? DEFAULT_SETTINGS.maxBodyBytes,
          bruteForceMaxAttempts: data.brute_force_max_attempts,
          bruteForceLockMinutes: data.brute_force_lock_minutes,
          bruteForceIpBanAttempts: data.brute_force_ip_ban_attempts,
          alertWebhookUrl: data.alert_webhook_url,
          alertEmail: data.alert_email,
        }
      : DEFAULT_SETTINGS;
    settingsCache = { value, at: Date.now() };
    return value;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function invalidateSecurityCache() {
  settingsCache = null;
  wafCache = null;
  ipCache = null;
  countryCache = null;
}

async function getWafRules(): Promise<WafRule[]> {
  if (wafCache && Date.now() - wafCache.at < CACHE_TTL_MS) return wafCache.value;
  try {
    const db = await admin();
    const { data } = await db
      .from("sec_waf_rules")
      .select("id, rule_name, rule_type, pattern, action, severity")
      .eq("is_active", true);
    const value = (data ?? []).map((r) => ({
      id: r.id,
      ruleName: r.rule_name,
      ruleType: r.rule_type,
      pattern: r.pattern,
      action: r.action as WafRule["action"],
      severity: r.severity as Severity,
    }));
    wafCache = { value, at: Date.now() };
    return value;
  } catch {
    return [];
  }
}

async function getIpRules(): Promise<IpRule[]> {
  if (ipCache && Date.now() - ipCache.at < CACHE_TTL_MS) return ipCache.value;
  try {
    const db = await admin();
    const nowIso = new Date().toISOString();
    const { data } = await db
      .from("sec_ip_rules")
      .select("id, rule_type, ip_address, ip_range, rate_limit_per_minute, store_id, expires_at")
      .eq("is_active", true);
    const value = (data ?? [])
      .filter((r) => !r.expires_at || r.expires_at > nowIso)
      .map((r) => ({
        id: r.id,
        ruleType: r.rule_type as IpRule["ruleType"],
        ipAddress: r.ip_address as string | null,
        ipRange: r.ip_range as string | null,
        rateLimitPerMinute: r.rate_limit_per_minute,
        storeId: r.store_id,
      }));
    ipCache = { value, at: Date.now() };
    return value;
  } catch {
    return [];
  }
}

async function getBlockedCountries(): Promise<string[]> {
  if (countryCache && Date.now() - countryCache.at < CACHE_TTL_MS) return countryCache.value;
  try {
    const db = await admin();
    const { data } = await db
      .from("sec_blocked_countries")
      .select("country_code")
      .eq("is_active", true);
    const value = (data ?? []).map((r) => r.country_code.toUpperCase());
    countryCache = { value, at: Date.now() };
    return value;
  } catch {
    return [];
  }
}

/** IPv4 adresinin CIDR bloğunda olup olmadığını hesaplar. */
export function ipInCidr(ip: string, cidr: string): boolean {
  const [range, bitsRaw] = cidr.split("/");
  if (!range) return false;
  const bits = Number(bitsRaw ?? 32);
  const toInt = (value: string) => {
    const parts = value.split(".");
    if (parts.length !== 4) return null;
    let out = 0;
    for (const part of parts) {
      const n = Number(part);
      if (!Number.isInteger(n) || n < 0 || n > 255) return null;
      out = (out << 8) + n;
    }
    return out >>> 0;
  };
  const a = toInt(ip);
  const b = toInt(range);
  if (a === null || b === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (a & mask) === (b & mask);
}

function ipMatchesRule(ip: string, rule: IpRule) {
  if (rule.ipAddress && rule.ipAddress.replace(/\/32$/, "") === ip) return true;
  if (rule.ipRange && ip.includes(".") && ipInCidr(ip, rule.ipRange)) return true;
  return false;
}

export type FirewallDecision =
  | { action: "allow" }
  | { action: "block"; status: number; attackType: AttackType; reason: string; severity: Severity }
  | { action: "captcha"; attackType: AttackType; reason: string; severity: Severity };

const BOT_UA =
  /(sqlmap|nikto|nessus|acunetix|dirbuster|masscan|zgrab|python-requests|curl\/|wget\/|libwww|scrapy|httrack|semrushbot|ahrefsbot|mj12bot)/i;
const GOOD_BOT_UA = /(googlebot|bingbot|yandexbot|duckduckbot|applebot|slurp|facebookexternalhit|twitterbot|whatsapp|telegrambot|lighthouse|chrome-lighthouse|pagespeed)/i;

/** İsteği güvenlik katmanlarından geçirir; kararı ve gerekçesini döner. */
export async function evaluateRequest(request: Request): Promise<FirewallDecision> {
  const settings = await getSecuritySettings();
  if (!settings.firewallEnabled) return { action: "allow" };

  const url = new URL(request.url);
  const path = url.pathname;
  // Statik dosyalar ve sağlık kontrolleri güvenlik duvarından muaftır.
  if (/\.(js|mjs|css|map|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|txt|xml|json)$/i.test(path)) {
    return { action: "allow" };
  }

  const ip = clientIp(request);
  const ua = request.headers.get("user-agent") ?? "";
  const country = (request.headers.get("cf-ipcountry") ?? "").toUpperCase();
  const aggressive = settings.wafMode === "aggressive";
  const enforcing = settings.wafMode !== "passive";

  const ipRules = await getIpRules();
  const matching = ipRules.filter((r) => ipMatchesRule(ip, r));
  if (matching.some((r) => r.ruleType === "whitelist")) return { action: "allow" };

  const blacklisted = matching.find((r) => r.ruleType === "blacklist");
  if (blacklisted) {
    await logAttack({
      attackType: "ip_block",
      ip,
      ua,
      request,
      severity: "high",
      action: enforcing ? "block" : "log",
      payload: `IP kuralı: ${blacklisted.id}`,
      country,
    });
    await bumpIpRuleHit(blacklisted.id);
    if (enforcing)
      return { action: "block", status: 403, attackType: "ip_block", reason: "IP engelli", severity: "high" };
  }

  if (settings.countryBlockEnabled && country) {
    const blocked = await getBlockedCountries();
    if (blocked.includes(country)) {
      await logAttack({
        attackType: "country_block",
        ip,
        ua,
        request,
        severity: "medium",
        action: enforcing ? "block" : "log",
        country,
      });
      if (enforcing)
        return {
          action: "block",
          status: 403,
          attackType: "country_block",
          reason: "Ülke engelli",
          severity: "medium",
        };
    }
  }

  // Kötü itibarlı IP (0-100; 20 altı engellenir).
  const reputation = await getIpReputation(ip);
  if (reputation !== null && reputation < 20) {
    await logAttack({
      attackType: "ip_block",
      ip,
      ua,
      request,
      severity: "high",
      action: enforcing ? "block" : "log",
      payload: `İtibar puanı ${reputation}`,
      country,
    });
    if (enforcing)
      return {
        action: "block",
        status: 403,
        attackType: "ip_block",
        reason: "IP itibarı düşük",
        severity: "high",
      };
  }

  if (settings.rateLimitEnabled) {
    const custom = matching.find((r) => r.ruleType === "rate_limit" && r.rateLimitPerMinute);
    const limit = custom?.rateLimitPerMinute ?? (aggressive ? 120 : 300);
    const result = await consumeRateLimit(`waf:${ip}`, { limit, windowSeconds: 60 });
    if (!result.allowed) {
      await logAttack({
        attackType: "rate_limit",
        ip,
        ua,
        request,
        severity: "medium",
        action: enforcing ? "block" : "log",
        payload: `${result.hits}/${limit} istek/dk`,
        country,
      });
      if (enforcing)
        return {
          action: "block",
          status: 429,
          attackType: "rate_limit",
          reason: "Çok fazla istek",
          severity: "medium",
        };
    }
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > settings.maxBodyBytes) {
    await logAttack({
      attackType: "payload_size",
      ip,
      ua,
      request,
      severity: "medium",
      action: "block",
      payload: `${contentLength} bayt`,
      country,
    });
    return {
      action: "block",
      status: 413,
      attackType: "payload_size",
      reason: "İstek gövdesi çok büyük",
      severity: "medium",
    };
  }

  if (settings.botDetectionEnabled && !GOOD_BOT_UA.test(ua)) {
    if (BOT_UA.test(ua) || (aggressive && ua.trim().length < 10)) {
      await logAttack({
        attackType: "bot",
        ip,
        ua,
        request,
        severity: "high",
        action: enforcing ? "block" : "log",
        country,
      });
      if (enforcing)
        return { action: "block", status: 403, attackType: "bot", reason: "Bot tespiti", severity: "high" };
    }
  }

  // WAF desenleri: adres, sorgu dizesi ve şüpheli başlıklar taranır.
  const rules = await getWafRules();
  if (rules.length) {
    const target = `${path}?${url.search}`;
    const headerBlob = [
      request.headers.get("referer") ?? "",
      request.headers.get("x-forwarded-for") ?? "",
      request.headers.get("cookie") ? "cookie" : "",
    ].join(" ");
    const decoded = safeDecode(target);
    for (const rule of rules) {
      if (rule.ruleType === "header" && rule.pattern === "^$") {
        if (!ua.trim() && aggressive) {
          await logAttack({ attackType: "header_anomaly", ip, ua, request, severity: "low", action: "log", country });
        }
        continue;
      }
      let re: RegExp;
      try {
        re = new RegExp(rule.pattern);
      } catch {
        continue;
      }
      const hit = re.test(decoded) || re.test(target) || (rule.ruleType === "header" && re.test(headerBlob)) || (rule.ruleType === "bot" && re.test(ua));
      if (!hit) continue;
      const attackType = wafAttackType(rule.ruleType);
      const action: SecAction = enforcing && rule.action === "block" ? "block" : rule.action === "captcha" ? "captcha" : "log";
      await logAttack({
        attackType,
        ip,
        ua,
        request,
        severity: rule.severity,
        action,
        payload: `${rule.ruleName}: ${decoded.slice(0, 400)}`,
        country,
      });
      await bumpWafHit(rule.id);
      if (action === "block")
        return { action: "block", status: 403, attackType, reason: rule.ruleName, severity: rule.severity };
      if (action === "captcha")
        return { action: "captcha", attackType, reason: rule.ruleName, severity: rule.severity };
    }
  }

  return { action: "allow" };
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function wafAttackType(ruleType: string): AttackType {
  switch (ruleType) {
    case "sql":
      return "sql_injection";
    case "xss":
      return "xss";
    case "path":
      return "path_traversal";
    case "csrf":
      return "csrf";
    case "header":
      return "header_anomaly";
    case "bot":
      return "bot";
    default:
      return "rfi";
  }
}

async function bumpWafHit(id: string) {
  try {
    const db = await admin();
    await db.rpc("sec_bump_waf_hit", { _rule_id: id });
  } catch {
    /* sayaç kritik değil */
  }
}

async function bumpIpRuleHit(id: string) {
  try {
    const db = await admin();
    await db.rpc("sec_bump_ip_rule_hit", { _rule_id: id });
  } catch {
    /* sayaç kritik değil */
  }
}

async function getIpReputation(ip: string): Promise<number | null> {
  if (ip === "unknown") return null;
  try {
    const db = await admin();
    const { data } = await db
      .from("sec_ip_reputation")
      .select("reputation_score")
      .eq("ip_address", ip)
      .maybeSingle();
    return data?.reputation_score ?? null;
  } catch {
    return null;
  }
}

/** Saldırı kaydı ekler ve kritik olaylarda uyarı tetikler. */
export async function logAttack(input: {
  attackType: AttackType;
  ip: string;
  ua?: string;
  request?: Request;
  storeId?: string | null;
  severity: Severity;
  action: SecAction;
  payload?: string;
  country?: string;
}) {
  try {
    const db = await admin();
    const url = input.request ? new URL(input.request.url) : null;
    await db.from("sec_attack_logs").insert({
      store_id: input.storeId ?? null,
      attack_type: input.attackType,
      ip_address: input.ip === "unknown" ? null : input.ip,
      user_agent: (input.ua ?? "").slice(0, 500) || null,
      request_method: input.request?.method ?? null,
      request_url: url ? `${url.pathname}${url.search}`.slice(0, 1000) : null,
      request_payload: input.payload?.slice(0, 2000) ?? null,
      country_code: input.country || null,
      severity: input.severity,
      action_taken: input.action,
    });
    if (input.severity === "critical") {
      await sendSecurityAlert({
        title: "KRİTİK GÜVENLİK UYARISI",
        lines: [
          `Tür: ${input.attackType}`,
          `IP: ${input.ip}${input.country ? ` (${input.country})` : ""}`,
          `Hedef: ${url ? url.pathname : "-"}`,
          `Durum: ${input.action === "block" ? "OTOMATİK ENGELLENDİ" : "KAYDEDİLDİ"}`,
        ],
      });
    }
  } catch {
    /* kayıt başarısızsa istek akışı bozulmaz */
  }
}

/** Uyarıyı webhook'a (Slack/Discord) gönderir; e-posta kanalı ayrı işlenir. */
export async function sendSecurityAlert(input: { title: string; lines: string[] }) {
  try {
    const settings = await getSecuritySettings();
    if (!settings.alertWebhookUrl || !/^https:\/\//.test(settings.alertWebhookUrl)) return;
    await fetch(settings.alertWebhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `🚨 ${input.title}\n${input.lines.join("\n")}` }),
    });
  } catch {
    /* uyarı gönderilemezse akış bozulmaz */
  }
}

// ===== Kaba kuvvet koruması =====

export type LockoutState = { locked: boolean; until?: string; reason?: string };

/** Kimlik (e-posta) veya IP için aktif kilit var mı? */
export async function checkLockout(identifiers: { email?: string; ip?: string }): Promise<LockoutState> {
  try {
    const db = await admin();
    const values = [
      ...(identifiers.email ? [identifiers.email.toLowerCase()] : []),
      ...(identifiers.ip && identifiers.ip !== "unknown" ? [identifiers.ip] : []),
    ];
    if (!values.length) return { locked: false };
    const { data } = await db
      .from("sec_lockouts")
      .select("identifier_value, locked_until, lockout_reason")
      .in("identifier_value", values)
      .gt("locked_until", new Date().toISOString())
      .limit(1);
    const row = data?.[0];
    if (!row) return { locked: false };
    return { locked: true, until: row.locked_until, reason: row.lockout_reason ?? undefined };
  } catch {
    return { locked: false };
  }
}

/** Giriş denemesini kaydeder, eşikler aşıldıysa kilit/IP yasağı uygular. */
export async function recordLoginAttempt(input: {
  identifier: string;
  ip: string;
  userAgent?: string | null;
  attemptType: "admin" | "customer" | "api" | "supplier" | "home_maker";
  status: "success" | "failed" | "blocked";
  failureReason?: string;
  storeId?: string | null;
}): Promise<LockoutState> {
  const settings = await getSecuritySettings();
  try {
    const db = await admin();
    const email = input.identifier.toLowerCase();
    await db.from("sec_login_attempts").insert({
      store_id: input.storeId ?? null,
      identifier: email.slice(0, 200),
      ip_address: input.ip === "unknown" ? null : input.ip,
      user_agent: (input.userAgent ?? "").slice(0, 500) || null,
      attempt_type: input.attemptType,
      status: input.status,
      failure_reason: input.failureReason?.slice(0, 300) ?? null,
    });

    if (input.status === "success") {
      await db.from("sec_lockouts").delete().eq("identifier_value", email);
      return { locked: false };
    }
    if (input.status !== "failed") return { locked: false };

    const isAdmin = input.attemptType === "admin" || input.attemptType === "api";
    const maxAttempts = isAdmin ? settings.bruteForceMaxAttempts : 10;
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { count: emailFails } = await db
      .from("sec_login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("identifier", email)
      .eq("status", "failed")
      .gte("created_at", since);

    const fails = emailFails ?? 0;
    if (fails >= maxAttempts) {
      const minutes =
        fails >= maxAttempts * 2 ? Math.max(60, settings.bruteForceLockMinutes * 4) : settings.bruteForceLockMinutes;
      const until = new Date(Date.now() + minutes * 60_000).toISOString();
      await db
        .from("sec_lockouts")
        .upsert(
          {
            store_id: input.storeId ?? null,
            identifier_type: "email",
            identifier_value: email,
            lockout_reason: `${fails} başarısız giriş denemesi`,
            lockout_count: fails,
            locked_until: until,
          },
          { onConflict: "identifier_type,identifier_value" },
        );
      await logAttack({
        attackType: "brute_force",
        ip: input.ip,
        ua: input.userAgent ?? "",
        severity: fails >= settings.bruteForceIpBanAttempts ? "critical" : "high",
        action: "block",
        payload: `${email} · ${fails} başarısız deneme`,
      });

      if (input.ip !== "unknown") {
        const { count: ipFails } = await db
          .from("sec_login_attempts")
          .select("id", { count: "exact", head: true })
          .eq("ip_address", input.ip)
          .eq("status", "failed")
          .gte("created_at", since);
        if ((ipFails ?? 0) >= settings.bruteForceIpBanAttempts) {
          await db.from("sec_ip_rules").insert({
            ip_address: input.ip,
            rule_type: "blacklist",
            reason: `Kaba kuvvet: ${ipFails} başarısız giriş / 1 saat`,
            expires_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
          });
          invalidateSecurityCache();
        }
      }
      return { locked: true, until, reason: `${fails} başarısız giriş denemesi` };
    }
    return { locked: false };
  } catch {
    return { locked: false };
  }
}

/** Engellenen istek için standart yanıt. */
export function firewallBlockResponse(decision: Extract<FirewallDecision, { action: "block" }>) {
  return new Response(
    JSON.stringify({
      error: "security_blocked",
      message: `İstek güvenlik kuralları nedeniyle engellendi: ${decision.reason}`,
    }),
    {
      status: decision.status,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    },
  );
}
