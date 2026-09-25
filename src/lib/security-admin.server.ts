/**
 * Güvenlik paneli sunucu mantığı (platform yöneticisi).
 * Okumalar platform genelinde, yazmalar denetim kaydıyla yapılır.
 */

import { z } from "zod";

import { insertAuditRow } from "./audit.server";
import { securityScore, type Severity } from "@/lib/security-firewall";
import { invalidateSecurityCache } from "@/lib/security-firewall.server";

type SupabaseLike = { from: (table: string) => any };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Yalnızca platform yöneticileri devam edebilir. */
export async function assertSecurityAdmin(supabase: SupabaseLike, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "platform_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Bu alan yalnızca platform yöneticileri içindir");
}

export const overviewSchema = z.object({ days: z.number().int().min(1).max(90).default(1) });

export type SecurityOverview = {
  score: number;
  blockedToday: number;
  attacksToday: number;
  criticalToday: number;
  fraudPending: number;
  fraudDetectedToday: number;
  fraudAmountBlocked: number;
  activeSessions: number;
  lockouts: number;
  blacklistRules: number;
  sslExpiringDays: number | null;
  typeBreakdown: { type: string; count: number }[];
  recent: {
    id: string;
    createdAt: string;
    attackType: string;
    severity: Severity;
    action: string;
    ip: string | null;
    country: string | null;
    url: string | null;
  }[];
  settings: {
    firewallEnabled: boolean;
    wafMode: string;
    botDetectionEnabled: boolean;
    countryBlockEnabled: boolean;
    rateLimitEnabled: boolean;
    fraudDetectionEnabled: boolean;
  };
};

export async function getOverview(): Promise<SecurityOverview> {
  const db = await admin();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [attacks, fraudPending, fraudToday, sessions, lockouts, blacklist, settings, ssl] =
    await Promise.all([
      db
        .from("sec_attack_logs")
        .select("id, created_at, attack_type, severity, action_taken, ip_address, country_code, request_url")
        .gte("created_at", dayAgo)
        .order("created_at", { ascending: false })
        .limit(500),
      db.from("sec_fraud_scores").select("id", { count: "exact", head: true }).eq("status", "pending"),
      db.from("sec_fraud_scores").select("total_risk_score, action_taken").gte("created_at", dayAgo),
      db
        .from("sec_sessions")
        .select("id", { count: "exact", head: true })
        .is("revoked_at", null)
        .gte("last_activity_at", new Date(Date.now() - 60 * 60 * 1000).toISOString()),
      db
        .from("sec_lockouts")
        .select("id", { count: "exact", head: true })
        .gt("locked_until", new Date().toISOString()),
      db
        .from("sec_ip_rules")
        .select("id", { count: "exact", head: true })
        .eq("rule_type", "blacklist")
        .eq("is_active", true),
      db.from("sec_settings").select("*").is("store_id", null).maybeSingle(),
      db
        .from("sec_ssl_certificates")
        .select("expires_at")
        .not("expires_at", "is", null)
        .order("expires_at", { ascending: true })
        .limit(1),
    ]);

  const rows = (attacks.data ?? []) as {
    id: string;
    created_at: string;
    attack_type: string;
    severity: Severity;
    action_taken: string;
    ip_address: string | null;
    country_code: string | null;
    request_url: string | null;
  }[];

  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.attack_type, (counts.get(row.attack_type) ?? 0) + 1);

  const set = settings.data as Record<string, unknown> | null;
  const expiresAt = (ssl.data?.[0] as { expires_at?: string } | undefined)?.expires_at;
  const sslDays = expiresAt
    ? Math.round((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
    : null;

  const fraudRows = (fraudToday.data ?? []) as { total_risk_score: number; action_taken: string }[];

  return {
    score: securityScore({
      firewallEnabled: Boolean(set?.["firewall_enabled"]),
      wafMode: (set?.["waf_mode"] as never) ?? "active",
      adminTwoFactor: (set?.["admin_2fa"] ?? "required") === "required",
      criticalAttacksToday: rows.filter((r) => r.severity === "critical").length,
      pendingFraudReviews: fraudPending.count ?? 0,
      expiringCertificates: sslDays !== null && sslDays < 15 ? 1 : 0,
      blacklistRules: blacklist.count ?? 0,
    }),
    blockedToday: rows.filter((r) => r.action_taken === "block").length,
    attacksToday: rows.length,
    criticalToday: rows.filter((r) => r.severity === "critical").length,
    fraudPending: fraudPending.count ?? 0,
    fraudDetectedToday: fraudRows.filter((r) => r.total_risk_score > 30).length,
    fraudAmountBlocked: 0,
    activeSessions: sessions.count ?? 0,
    lockouts: lockouts.count ?? 0,
    blacklistRules: blacklist.count ?? 0,
    sslExpiringDays: sslDays,
    typeBreakdown: [...counts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    recent: rows.slice(0, 25).map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      attackType: r.attack_type,
      severity: r.severity,
      action: r.action_taken,
      ip: r.ip_address,
      country: r.country_code,
      url: r.request_url,
    })),
    settings: {
      firewallEnabled: Boolean(set?.["firewall_enabled"]),
      wafMode: String(set?.["waf_mode"] ?? "active"),
      botDetectionEnabled: Boolean(set?.["bot_detection_enabled"]),
      countryBlockEnabled: Boolean(set?.["country_block_enabled"]),
      rateLimitEnabled: Boolean(set?.["rate_limit_enabled"]),
      fraudDetectionEnabled: Boolean(set?.["fraud_detection_enabled"]),
    },
  };
}

export const attackListSchema = z.object({
  attackType: z.string().trim().max(40).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  action: z.string().trim().max(20).optional(),
  ip: z.string().trim().max(60).optional(),
  days: z.number().int().min(1).max(90).default(7),
  limit: z.number().int().min(1).max(500).default(100),
});

export async function listAttacks(input: z.infer<typeof attackListSchema>) {
  const db = await admin();
  let query = db
    .from("sec_attack_logs")
    .select("*")
    .gte("created_at", new Date(Date.now() - input.days * 86_400_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(input.limit);
  if (input.attackType) query = query.eq("attack_type", input.attackType);
  if (input.severity) query = query.eq("severity", input.severity);
  if (input.action) query = query.eq("action_taken", input.action);
  if (input.ip) query = query.eq("ip_address", input.ip);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export const falsePositiveSchema = z.object({ id: z.string().uuid(), isFalsePositive: z.boolean() });

export async function markFalsePositive(userId: string, input: z.infer<typeof falsePositiveSchema>) {
  const db = await admin();
  const { error } = await db
    .from("sec_attack_logs")
    .update({ is_false_positive: input.isFalsePositive })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  await insertAuditRow(db as never, {
    actor_id: userId,
    action: "security.attack.false_positive",
    entity: "sec_attack_logs",
    entity_id: input.id,
    new_value: { is_false_positive: input.isFalsePositive },
  });
  return { ok: true as const };
}

export const ipRuleSchema = z
  .object({
    ruleType: z.enum(["whitelist", "blacklist", "rate_limit"]),
    ipAddress: z.string().trim().max(60).optional(),
    ipRange: z.string().trim().max(60).optional(),
    rateLimitPerMinute: z.number().int().min(1).max(100_000).optional(),
    reason: z.string().trim().max(300).optional(),
    expiresInDays: z.number().int().min(1).max(3650).optional(),
  })
  .refine((v) => Boolean(v.ipAddress || v.ipRange), { message: "IP adresi veya IP aralığı gerekli" });

export async function listIpRules() {
  const db = await admin();
  const { data, error } = await db
    .from("sec_ip_rules")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createIpRule(userId: string, input: z.infer<typeof ipRuleSchema>) {
  const db = await admin();
  const { data, error } = await db
    .from("sec_ip_rules")
    .insert({
      rule_type: input.ruleType,
      ip_address: input.ipAddress || null,
      ip_range: input.ipRange || null,
      rate_limit_per_minute: input.rateLimitPerMinute ?? null,
      reason: input.reason ?? null,
      created_by: userId,
      expires_at: input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString()
        : null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  invalidateSecurityCache();
  await insertAuditRow(db as never, {
    actor_id: userId,
    action: "security.ip_rule.created",
    entity: "sec_ip_rules",
    entity_id: data.id,
    new_value: input as never,
  });
  return { ok: true as const, id: data.id };
}

export const idSchema = z.object({ id: z.string().uuid() });

export async function deleteIpRule(userId: string, input: z.infer<typeof idSchema>) {
  const db = await admin();
  const { error } = await db.from("sec_ip_rules").delete().eq("id", input.id);
  if (error) throw new Error(error.message);
  invalidateSecurityCache();
  await insertAuditRow(db as never, {
    actor_id: userId,
    action: "security.ip_rule.deleted",
    entity: "sec_ip_rules",
    entity_id: input.id,
  });
  return { ok: true as const };
}

export const countrySchema = z.object({
  countryCode: z.string().trim().length(2),
  reason: z.string().trim().max(200).optional(),
});

export async function listBlockedCountries() {
  const db = await admin();
  const { data, error } = await db
    .from("sec_blocked_countries")
    .select("*")
    .order("country_code");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addBlockedCountry(userId: string, input: z.infer<typeof countrySchema>) {
  const db = await admin();
  const code = input.countryCode.toUpperCase();
  const { data: existing } = await db
    .from("sec_blocked_countries")
    .select("id")
    .is("store_id", null)
    .eq("country_code", code)
    .maybeSingle();
  const payload = { reason: input.reason ?? null, is_active: true };
  const { error } = existing
    ? await db.from("sec_blocked_countries").update(payload).eq("id", (existing as { id: string }).id)
    : await db
        .from("sec_blocked_countries")
        .insert({ store_id: null, country_code: code, created_by: userId, ...payload });
  if (error) throw new Error(error.message);
  invalidateSecurityCache();
  return { ok: true as const };
}


export async function deleteBlockedCountry(input: z.infer<typeof idSchema>) {
  const db = await admin();
  const { error } = await db.from("sec_blocked_countries").delete().eq("id", input.id);
  if (error) throw new Error(error.message);
  invalidateSecurityCache();
  return { ok: true as const };
}

export async function listFraudQueue() {
  const db = await admin();
  const { data, error } = await db
    .from("sec_fraud_scores")
    .select("*, sec_fraud_signals(*)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export const fraudReviewSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected", "pending"]),
});

export async function reviewFraudScore(userId: string, input: z.infer<typeof fraudReviewSchema>) {
  const db = await admin();
  const { error } = await db
    .from("sec_fraud_scores")
    .update({ status: input.status, reviewed_by: userId, reviewed_at: new Date().toISOString() })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  await insertAuditRow(db as never, {
    actor_id: userId,
    action: `security.fraud.${input.status}`,
    entity: "sec_fraud_scores",
    entity_id: input.id,
  });
  return { ok: true as const };
}

export async function listLockouts() {
  const db = await admin();
  const { data, error } = await db
    .from("sec_lockouts")
    .select("*")
    .order("locked_until", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function releaseLockout(userId: string, input: z.infer<typeof idSchema>) {
  const db = await admin();
  const { error } = await db.from("sec_lockouts").delete().eq("id", input.id);
  if (error) throw new Error(error.message);
  await insertAuditRow(db as never, {
    actor_id: userId,
    action: "security.lockout.released",
    entity: "sec_lockouts",
    entity_id: input.id,
  });
  return { ok: true as const };
}

export async function listWafRules() {
  const db = await admin();
  const { data, error } = await db
    .from("sec_waf_rules")
    .select("*")
    .order("severity", { ascending: false })
    .order("rule_name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export const wafToggleSchema = z.object({ id: z.string().uuid(), isActive: z.boolean() });

export async function toggleWafRule(userId: string, input: z.infer<typeof wafToggleSchema>) {
  const db = await admin();
  const { error } = await db.from("sec_waf_rules").update({ is_active: input.isActive }).eq("id", input.id);
  if (error) throw new Error(error.message);
  invalidateSecurityCache();
  await insertAuditRow(db as never, {
    actor_id: userId,
    action: "security.waf_rule.toggled",
    entity: "sec_waf_rules",
    entity_id: input.id,
    new_value: { is_active: input.isActive },
  });
  return { ok: true as const };
}

export const settingsSchema = z.object({
  firewallEnabled: z.boolean().optional(),
  botDetectionEnabled: z.boolean().optional(),
  countryBlockEnabled: z.boolean().optional(),
  rateLimitEnabled: z.boolean().optional(),
  fraudDetectionEnabled: z.boolean().optional(),
  wafMode: z.enum(["passive", "active", "aggressive"]).optional(),
  passwordMinLength: z.number().int().min(8).max(64).optional(),
  passwordRequireUpper: z.boolean().optional(),
  passwordRequireDigit: z.boolean().optional(),
  passwordRequireSymbol: z.boolean().optional(),
  adminSessionHours: z.number().int().min(1).max(24).optional(),
  sellerSessionHours: z.number().int().min(1).max(72).optional(),
  customerSessionDays: z.number().int().min(1).max(365).optional(),
  bruteForceMaxAttempts: z.number().int().min(3).max(50).optional(),
  bruteForceLockMinutes: z.number().int().min(1).max(1440).optional(),
  bruteForceIpBanAttempts: z.number().int().min(5).max(500).optional(),
  admin2fa: z.enum(["required", "optional", "off"]).optional(),
  seller2fa: z.enum(["required", "optional", "off"]).optional(),
  customer2fa: z.enum(["required", "optional", "off"]).optional(),
  alertEmail: z.string().trim().email().max(200).nullish(),
  alertWebhookUrl: z.string().trim().url().max(500).nullish(),
});

export async function getSettingsRow() {
  const db = await admin();
  const { data, error } = await db.from("sec_settings").select("*").is("store_id", null).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function saveSettings(userId: string, input: z.infer<typeof settingsSchema>) {
  const db = await admin();
  const patch: Record<string, unknown> = {};
  const map: Record<string, string> = {
    firewallEnabled: "firewall_enabled",
    botDetectionEnabled: "bot_detection_enabled",
    countryBlockEnabled: "country_block_enabled",
    rateLimitEnabled: "rate_limit_enabled",
    fraudDetectionEnabled: "fraud_detection_enabled",
    wafMode: "waf_mode",
    passwordMinLength: "password_min_length",
    passwordRequireUpper: "password_require_upper",
    passwordRequireDigit: "password_require_digit",
    passwordRequireSymbol: "password_require_symbol",
    adminSessionHours: "admin_session_hours",
    sellerSessionHours: "seller_session_hours",
    customerSessionDays: "customer_session_days",
    bruteForceMaxAttempts: "brute_force_max_attempts",
    bruteForceLockMinutes: "brute_force_lock_minutes",
    bruteForceIpBanAttempts: "brute_force_ip_ban_attempts",
    admin2fa: "admin_2fa",
    seller2fa: "seller_2fa",
    customer2fa: "customer_2fa",
    alertEmail: "alert_email",
    alertWebhookUrl: "alert_webhook_url",
  };
  for (const [key, column] of Object.entries(map)) {
    const value = (input as Record<string, unknown>)[key];
    if (value !== undefined) patch[column] = value;
  }
  if (!Object.keys(patch).length) return { ok: true as const };

  const existing = await getSettingsRow();
  if (existing) {
    const { error } = await db.from("sec_settings").update(patch).eq("id", (existing as { id: string }).id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from("sec_settings").insert({ store_id: null, ...patch });
    if (error) throw new Error(error.message);
  }
  invalidateSecurityCache();
  await insertAuditRow(db as never, {
    actor_id: userId,
    action: "security.settings.updated",
    entity: "sec_settings",
    new_value: patch as never,
  });
  return { ok: true as const };
}

export async function listSessions() {
  const db = await admin();
  const { data, error } = await db
    .from("sec_sessions")
    .select("*")
    .is("revoked_at", null)
    .order("last_activity_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function revokeSession(userId: string, input: z.infer<typeof idSchema>) {
  const db = await admin();
  const { error } = await db
    .from("sec_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  await insertAuditRow(db as never, {
    actor_id: userId,
    action: "security.session.revoked",
    entity: "sec_sessions",
    entity_id: input.id,
  });
  return { ok: true as const };
}

export async function listRetentionPolicies() {
  const db = await admin();
  const { data, error } = await db
    .from("sec_data_retention_policies")
    .select("*")
    .is("store_id", null)
    .order("data_type");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export const retentionSchema = z.object({
  dataType: z.enum(["orders", "customers", "logs", "analytics", "sessions", "attacks"]),
  retentionDays: z.number().int().min(1).max(7300),
  autoDelete: z.boolean(),
});

export async function saveRetentionPolicy(userId: string, input: z.infer<typeof retentionSchema>) {
  const db = await admin();
  const { data: existing } = await db
    .from("sec_data_retention_policies")
    .select("id")
    .is("store_id", null)
    .eq("data_type", input.dataType)
    .maybeSingle();
  const payload = { retention_days: input.retentionDays, auto_delete: input.autoDelete };
  const { error } = existing
    ? await db
        .from("sec_data_retention_policies")
        .update(payload)
        .eq("id", (existing as { id: string }).id)
    : await db
        .from("sec_data_retention_policies")
        .insert({ store_id: null, data_type: input.dataType, ...payload });
  if (error) throw new Error(error.message);

  await insertAuditRow(db as never, {
    actor_id: userId,
    action: "security.retention.updated",
    entity: "sec_data_retention_policies",
    new_value: input as never,
  });
  return { ok: true as const };
}
