import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type T<N extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][N]["Row"];

// ===== Herkese açık: doğrulama sayfası =====

export const getFwCaptcha = createServerFn({ method: "POST" }).handler(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const { consumeRateLimit, clientIp } = await import("@/lib/rate-limit.server");
  const request = getRequest();
  const r = await consumeRateLimit(`fwcap:${clientIp(request)}`, { limit: 20, windowSeconds: 600 });
  if (!r.allowed) throw new Error("Çok fazla deneme. Birkaç dakika sonra tekrar deneyin.");
  const { createCaptcha } = await import("@/lib/ddos-firewall.server");
  return createCaptcha(request);
});

export const solveFwCaptcha = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), answer: z.number().int().min(0).max(1000) }).parse(d))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { solveCaptcha } = await import("@/lib/ddos-firewall.server");
    return solveCaptcha(getRequest(), data.id, data.answer);
  });

// ===== Süper yönetici =====

type Ctx = { supabase: Parameters<typeof import("@/lib/security-admin.server").assertSecurityAdmin>[0]; userId: string };

async function guard(ctx: Ctx) {
  const { assertSecurityAdmin } = await import("@/lib/security-admin.server");
  await assertSecurityAdmin(ctx.supabase, ctx.userId);
}

async function audit(ctx: { supabase: unknown; userId: string }, action: string, value: unknown) {
  try {
    const { recordAudit } = await import("@/lib/audit.server");
    await recordAudit(ctx.supabase as never, { action, actorId: ctx.userId, entity: "firewall", entityId: null as never, newValue: value as never });
  } catch {
    /* denetim kaydı kritik değil */
  }
  const { invalidateFwCache } = await import("@/lib/ddos-firewall.server");
  invalidateFwCache();
}

export const getFirewallDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context);
    const sb = context.supabase;
    const since = new Date(Date.now() - 60 * 60_000).toISOString();
    const [settings, snaps, events, countries, asns, endpoints, violations, bans, captchas] = await Promise.all([
      sb.from("fw_settings").select("*").maybeSingle(),
      sb.from("fw_traffic_snapshots").select("snapshot_at, requests_total, requests_blocked, requests_challenged, top_countries, top_endpoints, level").gte("snapshot_at", since).order("snapshot_at"),
      sb.from("fw_ddos_events").select("*").order("started_at", { ascending: false }).limit(30),
      sb.from("fw_country_rules").select("*").order("country_code"),
      sb.from("fw_asn_rules").select("*").order("asn_number"),
      sb.from("fw_endpoint_limits").select("*").order("path_prefix"),
      sb.from("fw_rate_limit_violations").select("*").order("created_at", { ascending: false }).limit(200),
      sb.from("sec_ip_rules").select("id, ip_address, ip_range, rule_type, reason, expires_at, is_active, created_at").eq("is_active", true).order("created_at", { ascending: false }).limit(300),
      sb.from("fw_captcha_challenges").select("status").gte("created_at", new Date(Date.now() - 86400_000).toISOString()).limit(5000),
    ]);
    const capStats = { pending: 0, passed: 0, failed: 0, expired: 0 } as Record<string, number>;
    for (const c of captchas.data ?? []) capStats[c.status] = (capStats[c.status] ?? 0) + 1;
    const ipCounts = new Map<string, number>();
    for (const v of violations.data ?? []) ipCounts.set(v.ip_address, (ipCounts.get(v.ip_address) ?? 0) + 1);
    const topIps = [...ipCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([ip, count]) => ({ ip, count }));
    const out = {
      settings: settings.data,
      snapshots: snaps.data ?? [],
      events: events.data ?? [],
      countries: countries.data ?? [],
      asns: asns.data ?? [],
      endpoints: endpoints.data ?? [],
      violations: (violations.data ?? []).slice(0, 50),
      ipRules: bans.data ?? [],
      captcha: capStats,
      topIps,
    };
    return JSON.parse(JSON.stringify(out)) as {
      settings: T<"fw_settings"> | null;
      snapshots: (Omit<T<"fw_traffic_snapshots">, "top_countries" | "top_endpoints"> & { top_countries: { key: string; count: number }[]; top_endpoints: { key: string; count: number }[] })[];
      events: T<"fw_ddos_events">[]; countries: T<"fw_country_rules">[]; asns: T<"fw_asn_rules">[];
      endpoints: T<"fw_endpoint_limits">[]; violations: T<"fw_rate_limit_violations">[];
      ipRules: (Pick<T<"sec_ip_rules">, "id" | "rule_type" | "reason" | "expires_at" | "is_active" | "created_at"> & { ip_address: string | null; ip_range: string | null })[];
      captcha: Record<string, number>; topIps: { ip: string; count: number }[];
    };
  });

const settingsSchema = z.object({
  enabled: z.boolean(),
  auto_mitigation: z.boolean(),
  level1_rpm: z.number().int().min(100).max(100_000_000),
  level2_rpm: z.number().int().min(100).max(100_000_000),
  level3_rpm: z.number().int().min(100).max(100_000_000),
  level4_rpm: z.number().int().min(100).max(100_000_000),
  auto_ban_per_minute: z.number().int().min(30).max(100_000),
  auto_ban_minutes: z.number().int().min(1).max(43_200),
}).refine((v) => v.level1_rpm < v.level2_rpm && v.level2_rpm < v.level3_rpm && v.level3_rpm < v.level4_rpm, "Eşikler artan sırada olmalı.");

export const saveFirewallSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => settingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await guard(context);
    const { error } = await context.supabase.from("fw_settings").update({ ...data, updated_at: new Date().toISOString() }).eq("id", true);
    if (error) throw new Error(error.message);
    await audit(context, "firewall.settings", data);
    return { ok: true };
  });

const countrySchema = z.object({
  country_code: z.string().regex(/^[A-Za-z]{2}$/).transform((v) => v.toUpperCase()),
  country_name: z.string().trim().min(2).max(80),
  rule_type: z.enum(["block", "allow", "captcha", "rate_limit"]),
  reason: z.string().trim().max(200).optional(),
});
export const upsertCountryRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => countrySchema.parse(d))
  .handler(async ({ data, context }) => {
    await guard(context);
    const { error } = await context.supabase.from("fw_country_rules").upsert({ ...data, reason: data.reason ?? null, added_by_user_id: context.userId, is_active: true }, { onConflict: "country_code" });
    if (error) throw new Error(error.message);
    await audit(context, "firewall.country", data);
    return { ok: true };
  });

const asnSchema = z.object({
  asn_number: z.number().int().min(1).max(4_294_967_295),
  asn_name: z.string().trim().min(2).max(80),
  rule_type: z.enum(["block", "captcha", "rate_limit"]),
  reason: z.string().trim().max(200).optional(),
});
export const upsertAsnRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => asnSchema.parse(d))
  .handler(async ({ data, context }) => {
    await guard(context);
    const { error } = await context.supabase.from("fw_asn_rules").upsert({ ...data, reason: data.reason ?? null, is_active: true }, { onConflict: "asn_number" });
    if (error) throw new Error(error.message);
    await audit(context, "firewall.asn", data);
    return { ok: true };
  });

const endpointSchema = z.object({
  path_prefix: z.string().trim().regex(/^\/[\w\-/.]*$/).max(120),
  limit_count: z.number().int().min(1).max(100000),
  window_seconds: z.number().int().min(1).max(86400),
  on_exceed: z.enum(["block", "captcha"]),
});
export const upsertEndpointLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => endpointSchema.parse(d))
  .handler(async ({ data, context }) => {
    await guard(context);
    const { error } = await context.supabase.from("fw_endpoint_limits").upsert({ ...data, is_active: true }, { onConflict: "path_prefix" });
    if (error) throw new Error(error.message);
    await audit(context, "firewall.endpoint", data);
    return { ok: true };
  });

const TABLES = { country: "fw_country_rules", asn: "fw_asn_rules", endpoint: "fw_endpoint_limits" } as const;
const ruleRef = z.object({ kind: z.enum(["country", "asn", "endpoint"]), id: z.string().uuid() });

export const toggleFwRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ruleRef.extend({ active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await guard(context);
    const { error } = await context.supabase.from(TABLES[data.kind]).update({ is_active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context, `firewall.${data.kind}.toggle`, data);
    return { ok: true };
  });

export const deleteFwRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ruleRef.parse(d))
  .handler(async ({ data, context }) => {
    await guard(context);
    const { error } = await context.supabase.from(TABLES[data.kind]).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context, `firewall.${data.kind}.delete`, data);
    return { ok: true };
  });

/** Yüksek riskli ülke kurallarını (doğrulama) tek seferde açar. */
export const enableHighRiskCountries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context);
    const codes = ["RU", "CN", "KP", "IR", "NG", "UA", "RO", "BG", "BR"];
    const { error } = await context.supabase.from("fw_country_rules").update({ is_active: true }).in("country_code", codes).eq("rule_type", "captcha");
    if (error) throw new Error(error.message);
    await audit(context, "firewall.country.high_risk", { codes });
    return { ok: true };
  });

const ipv4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
export const addIpAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      ip: z.string().trim().refine((v) => ipv4.test(v.split("/")[0] ?? "") && (!v.includes("/") || /\/(\d|[12]\d|3[0-2])$/.test(v)), "Geçerli IPv4 veya CIDR girin."),
      type: z.enum(["blacklist", "whitelist"]),
      reason: z.string().trim().max(200).optional(),
      hours: z.number().int().min(0).max(24 * 365).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await guard(context);
    const isRange = data.ip.includes("/");
    const { error } = await context.supabase.from("sec_ip_rules").insert({
      ...(isRange ? { ip_range: data.ip } : { ip_address: data.ip }),
      rule_type: data.type,
      reason: data.reason || (data.type === "blacklist" ? "Manuel ban" : "Manuel izin"),
      expires_at: data.hours ? new Date(Date.now() + data.hours * 3600_000).toISOString() : null,
    } as never);
    if (error) throw new Error(error.message);
    const { invalidateSecurityCache } = await import("@/lib/security-firewall.server");
    invalidateSecurityCache();
    await audit(context, `firewall.ip.${data.type}`, data);
    return { ok: true };
  });

export const removeIpRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await guard(context);
    const { error } = await context.supabase.from("sec_ip_rules").update({ is_active: false }).eq("id", data.id);
    if (error) throw new Error(error.message);
    const { invalidateSecurityCache } = await import("@/lib/security-firewall.server");
    invalidateSecurityCache();
    await audit(context, "firewall.ip.remove", data);
    return { ok: true };
  });
