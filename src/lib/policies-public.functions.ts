/** Politika Sistemi v2 — herkese açık okuma işlevleri (yalnız yayınlanmış sürümler). */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { policyKeyFromSlug, policySlug } from "@/lib/policy-content";

type Db = { from: (t: string) => any };

async function pub() {
  const { publicSupabase } = await import("@/lib/public-supabase.server");
  return publicSupabase() as unknown as Db;
}

async function storeBySlug(db: Db, slug: string) {
  const { data } = await db.from("stores").select("id, name, slug").eq("slug", slug).eq("status", "active").maybeSingle();
  return data as { id: string; name: string; slug: string } | null;
}

export type PublicPolicy = {
  key: string;
  slug: string;
  title: string;
  version: string;
  effectiveDate: string | null;
  publishedAt: string | null;
  content: string;
  seoTitle: string | null;
  seoDescription: string | null;
};

async function loadPolicies(db: Db, storeId: string | null, key?: string) {
  let q = db
    .from("policies")
    .select("id, policy_key, title, version, effective_date, seo_title, seo_description, current_version_id")
    .not("current_version_id", "is", null)
    .eq("is_visible", true);
  q = storeId ? q.eq("store_id", storeId) : q.is("store_id", null);
  if (key) q = q.eq("policy_key", key);
  const { data: rows } = await q.order("policy_key");
  const list = (rows ?? []) as Array<{ id: string; policy_key: string; title: string; version: string; effective_date: string | null; seo_title: string | null; seo_description: string | null; current_version_id: string }>;
  if (!list.length) return [];
  const { data: versions } = await db
    .from("policy_versions")
    .select("id, content, published_at")
    .in("id", list.map((p) => p.current_version_id))
    .eq("is_active", true);
  const byId = new Map(((versions ?? []) as Array<{ id: string; content: string; published_at: string | null }>).map((v) => [v.id, v]));
  const scope = storeId ? "store" : "platform";
  return list
    .filter((p) => byId.has(p.current_version_id))
    .map<PublicPolicy>((p) => ({
      key: p.policy_key,
      slug: policySlug(scope, p.policy_key),
      title: p.title,
      version: p.version,
      effectiveDate: p.effective_date,
      publishedAt: byId.get(p.current_version_id)!.published_at,
      content: byId.get(p.current_version_id)!.content,
      seoTitle: p.seo_title,
      seoDescription: p.seo_description,
    }));
}

export const getStorePublicPolicies = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().trim().min(1).max(120) }).parse(data))
  .handler(async ({ data }) => {
    const db = await pub();
    const store = await storeBySlug(db, data.slug);
    if (!store) return null;
    return { storeName: store.name, policies: await loadPolicies(db, store.id) };
  });

export const getStorePublicPolicy = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().trim().min(1).max(120), policy: z.string().trim().min(1).max(80) }).parse(data))
  .handler(async ({ data }) => {
    const db = await pub();
    const store = await storeBySlug(db, data.slug);
    if (!store) return null;
    const key = policyKeyFromSlug("store", data.policy) ?? data.policy;
    const [policy] = await loadPolicies(db, store.id, key);
    return { storeName: store.name, policy: policy ?? null };
  });

export const getPlatformPublicPolicies = createServerFn({ method: "GET" }).handler(async () => {
  const db = await pub();
  return loadPolicies(db, null);
});

export const getPlatformPublicPolicy = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ policy: z.string().trim().min(1).max(80) }).parse(data))
  .handler(async ({ data }) => {
    const db = await pub();
    const key = policyKeyFromSlug("platform", data.policy);
    if (!key) return null;
    const [policy] = await loadPolicies(db, null, key);
    return policy ?? null;
  });

export const getPublicCookieBanner = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().trim().min(1).max(120) }).parse(data))
  .handler(async ({ data }) => {
    const db = await pub();
    const store = await storeBySlug(db, data.slug);
    if (!store) return null;
    const { data: row } = await db
      .from("cookie_banner_settings")
      .select("position, color_scheme, uses_analytics, uses_marketing, banner_text, consent_version")
      .eq("store_id", store.id)
      .maybeSingle();
    return {
      position: (row?.position ?? "bottom") as "bottom" | "bottom-left" | "bottom-right",
      colorScheme: (row?.color_scheme ?? "auto") as "auto" | "dark" | "light",
      usesAnalytics: row?.uses_analytics ?? true,
      usesMarketing: row?.uses_marketing ?? false,
      bannerText: (row?.banner_text ?? null) as string | null,
      consentVersion: (row?.consent_version ?? "1.0") as string,
    };
  });
