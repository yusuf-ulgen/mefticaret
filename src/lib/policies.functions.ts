/**
 * Politika Sistemi v2 — panel sunucu işlevleri.
 * storeId verilirse mağaza yöneticisi, null ise süper yönetici (platform politikaları) doğrulanır.
 * Yayınlanan sürümler değişmez kayıt olarak saklanır (KVKK kanıtı).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sanitizeBlogHtml } from "@/lib/blog-sanitize";
import {
  PLATFORM_POLICY_KEYS,
  STORE_POLICY_KEYS,
  nextVersion,
  renderPolicy,
  validatePlaceholders,
  type PlaceholderDef,
} from "@/lib/policy-content";

type Db = { from: (t: string) => any };

async function guard(supabase: unknown, storeId: string | null, userId: string) {
  if (storeId) {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(supabase as never, storeId, userId);
  } else {
    const { assertPlatformAdmin } = await import("@/lib/platform-admin.server");
    await assertPlatformAdmin(supabase as never, userId);
  }
  return supabase as Db;
}

const scope = z.object({ storeId: z.guid().nullable() });

function scoped(q: any, storeId: string | null) {
  return storeId ? q.eq("store_id", storeId) : q.is("store_id", null);
}

async function storeName(db: Db, storeId: string | null) {
  if (!storeId) return "Mefticaret";
  const { data } = await db.from("stores").select("name").eq("id", storeId).maybeSingle();
  return (data?.name as string) ?? "";
}

/** Politikaları listeler; mağazada eksik zorunlu politikaları şablondan oluşturur. */
export const listPolicies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => scope.parse(data))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const keys = data.storeId ? STORE_POLICY_KEYS : PLATFORM_POLICY_KEYS;
    const { data: existing } = await scoped(db.from("policies").select("policy_key"), data.storeId);
    const have = new Set(((existing ?? []) as Array<{ policy_key: string }>).map((r) => r.policy_key));
    const missing = keys.filter((k) => !have.has(k));
    if (missing.length) {
      const { data: templates } = await db
        .from("policy_templates")
        .select("id, policy_key, title, content")
        .eq("policy_type", data.storeId ? "store" : "platform")
        .in("policy_key", missing);
      const { data: settings } = data.storeId
        ? await db.from("store_settings").select("contact_email").eq("store_id", data.storeId).maybeSingle()
        : { data: null };
      const { data: defs } = await db.from("policy_placeholders").select("policy_key, placeholder_key, default_value").in("policy_key", missing);
      const rows = ((templates ?? []) as Array<{ id: string; policy_key: string; title: string; content: string }>).map((t) => {
        const values: Record<string, string> = {};
        for (const d of (defs ?? []) as Array<{ policy_key: string; placeholder_key: string; default_value: string | null }>) {
          if (d.policy_key === t.policy_key) values[d.placeholder_key] = d.default_value ?? "";
        }
        if ("DESTEK_EMAIL" in values && settings?.contact_email) values["DESTEK_EMAIL"] = settings.contact_email as string;
        return {
          store_id: data.storeId,
          policy_type: data.storeId ? "store" : "platform",
          policy_key: t.policy_key,
          title: t.title,
          draft_content: t.content,
          placeholder_values: values,
          template_id: t.id,
          is_mandatory: true,
        };
      });
      if (rows.length) await db.from("policies").insert(rows);
    }
    const { data: rows, error } = await scoped(
      db
        .from("policies")
        .select("id, policy_key, title, version, current_version_id, effective_date, requires_acceptance, acceptance_count, is_visible, is_mandatory, next_review_date, last_reviewed_at, updated_at"),
      data.storeId,
    ).order("policy_key");
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{
      id: string; policy_key: string; title: string; version: string; current_version_id: string | null;
      effective_date: string | null; requires_acceptance: boolean; acceptance_count: number; is_visible: boolean;
      is_mandatory: boolean; next_review_date: string | null; last_reviewed_at: string | null; updated_at: string;
    }>;
  });

export const getPolicy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => scope.extend({ policyId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const { data: row, error } = await scoped(db.from("policies").select("*").eq("id", data.policyId), data.storeId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Politika bulunamadı");
    const { data: defs } = await db
      .from("policy_placeholders")
      .select("placeholder_key, label, default_value, input_type, min_value, is_required")
      .eq("policy_key", row.policy_key)
      .order("sort_order");
    return { policy: row as Record<string, any>, placeholders: (defs ?? []) as PlaceholderDef[], storeName: await storeName(db, data.storeId) };
  });

const draftInput = scope.extend({
  policyId: z.guid(),
  title: z.string().trim().min(2).max(160),
  draftContent: z.string().max(300_000),
  placeholderValues: z.record(z.string().regex(/^[A-Z_]+$/), z.string().max(4000)),
  seoTitle: z.string().trim().max(255).nullable(),
  seoDescription: z.string().trim().max(500).nullable(),
  isVisible: z.boolean(),
  nextReviewDate: z.string().date().nullable(),
});

export const savePolicyDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => draftInput.parse(data))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const { error } = await scoped(
      db.from("policies").update({
        title: data.title,
        draft_content: sanitizeBlogHtml(data.draftContent),
        placeholder_values: data.placeholderValues,
        seo_title: data.seoTitle || null,
        seo_description: data.seoDescription || null,
        is_visible: data.isVisible,
        next_review_date: data.nextReviewDate,
      }).eq("id", data.policyId),
      data.storeId,
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const publishPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    scope
      .extend({
        policyId: z.guid(),
        bump: z.enum(["minor", "major"]),
        effectiveDate: z.string().date(),
        changeSummary: z.string().trim().min(2).max(1000),
        requiresAcceptance: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const { data: p } = await scoped(db.from("policies").select("*").eq("id", data.policyId), data.storeId).maybeSingle();
    if (!p) throw new Error("Politika bulunamadı");
    const { data: defs } = await db
      .from("policy_placeholders")
      .select("placeholder_key, label, default_value, input_type, min_value, is_required")
      .eq("policy_key", p.policy_key);
    const values = { ...(p.placeholder_values as Record<string, string>), MAGAZA_ADI: await storeName(db, data.storeId) };
    const errors = validatePlaceholders((defs ?? []) as PlaceholderDef[], values);
    if (errors.length) throw new Error(errors.join(" · "));

    const version = p.current_version_id ? nextVersion(p.version as string, data.bump) : "1.0";
    const content = sanitizeBlogHtml(renderPolicy(p.draft_content as string, values));
    const now = new Date().toISOString();
    const { data: v, error } = await db
      .from("policy_versions")
      .insert({
        policy_id: p.id,
        store_id: data.storeId,
        version,
        title: p.title,
        content,
        effective_date: data.effectiveDate,
        change_summary: data.changeSummary,
        requires_acceptance: data.requiresAcceptance,
        created_by: context.userId,
        published_at: now,
        is_active: false,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message.includes("duplicate") ? `v${version} zaten var` : error.message);
    await db.from("policy_versions").update({ is_active: false }).eq("policy_id", p.id).neq("id", v.id);
    await db.from("policy_versions").update({ is_active: true }).eq("id", v.id);
    const { error: upErr } = await db
      .from("policies")
      .update({
        current_version_id: v.id,
        version,
        effective_date: data.effectiveDate,
        change_summary: data.changeSummary,
        requires_acceptance: data.requiresAcceptance,
        last_reviewed_at: now,
        last_reviewed_by: context.userId,
      })
      .eq("id", p.id);
    if (upErr) throw new Error(upErr.message);
    return { version };
  });

export const listPolicyVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => scope.extend({ policyId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const { data: rows, error } = await scoped(
      db.from("policy_versions").select("id, version, title, content, effective_date, change_summary, published_at, is_active, created_by").eq("policy_id", data.policyId),
      data.storeId,
    ).order("published_at", { ascending: false });
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Array<{ id: string; version: string; title: string; content: string; effective_date: string | null; change_summary: string | null; published_at: string; is_active: boolean }>;
    const counts = new Map<string, number>();
    if (list.length) {
      const { data: acc } = await db.from("policy_acceptances").select("policy_version_id").eq("policy_id", data.policyId).is("withdrawn_at", null).limit(10000);
      for (const a of (acc ?? []) as Array<{ policy_version_id: string | null }>) {
        if (a.policy_version_id) counts.set(a.policy_version_id, (counts.get(a.policy_version_id) ?? 0) + 1);
      }
    }
    return list.map((r) => ({ ...r, acceptances: counts.get(r.id) ?? 0 }));
  });

export const listPolicyAcceptances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => scope.extend({ policyId: z.guid().nullable(), q: z.string().trim().max(160).default("") }).parse(data))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    let query = scoped(
      db.from("policy_acceptances").select("id, policy_id, version_label, user_type, subject_email, order_number, ip_address, user_agent, acceptance_method, accepted_at, withdrawn_at"),
      data.storeId,
    );
    if (data.policyId) query = query.eq("policy_id", data.policyId);
    if (data.q) query = query.ilike("subject_email", `%${data.q.replace(/[%_]/g, "")}%`);
    const { data: rows, error } = await query.order("accepted_at", { ascending: false }).limit(1000);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Array<{ id: string; policy_id: string; version_label: string | null; user_type: string; subject_email: string | null; order_number: string | null; ip_address: string | null; user_agent: string | null; acceptance_method: string; accepted_at: string; withdrawn_at: string | null }>;
    return {
      rows: list,
      total: list.length,
      active: list.filter((r) => !r.withdrawn_at).length,
      withdrawn: list.filter((r) => r.withdrawn_at).length,
    };
  });

export const withdrawPolicyAcceptance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), acceptanceId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const { error } = await db
      .from("policy_acceptances")
      .update({ withdrawn_at: new Date().toISOString() })
      .eq("id", data.acceptanceId)
      .eq("store_id", data.storeId)
      .is("withdrawn_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const bannerInput = z.object({
  storeId: z.guid(),
  position: z.enum(["bottom", "bottom-left", "bottom-right"]),
  colorScheme: z.enum(["auto", "dark", "light"]),
  usesAnalytics: z.boolean(),
  usesMarketing: z.boolean(),
  bannerText: z.string().trim().max(400).nullable(),
});

export const getCookieBanner = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const { data: row } = await db.from("cookie_banner_settings").select("*").eq("store_id", data.storeId).maybeSingle();
    return {
      position: (row?.position ?? "bottom") as z.infer<typeof bannerInput>["position"],
      colorScheme: (row?.color_scheme ?? "auto") as z.infer<typeof bannerInput>["colorScheme"],
      usesAnalytics: row?.uses_analytics ?? true,
      usesMarketing: row?.uses_marketing ?? false,
      bannerText: (row?.banner_text ?? null) as string | null,
    };
  });

export const saveCookieBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => bannerInput.parse(data))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const { data: prev } = await db.from("cookie_banner_settings").select("uses_analytics, uses_marketing, consent_version").eq("store_id", data.storeId).maybeSingle();
    // Kullanılan çerez kategorileri değişirse ziyaretçilerden yeniden onay istenir.
    const changed = prev && (prev.uses_analytics !== data.usesAnalytics || prev.uses_marketing !== data.usesMarketing);
    const { error } = await db.from("cookie_banner_settings").upsert(
      {
        store_id: data.storeId,
        position: data.position,
        color_scheme: data.colorScheme,
        uses_analytics: data.usesAnalytics,
        uses_marketing: data.usesMarketing,
        banner_text: data.bannerText || null,
        consent_version: changed ? nextVersion(prev.consent_version as string, "minor") : (prev?.consent_version ?? "1.0"),
      },
      { onConflict: "store_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
