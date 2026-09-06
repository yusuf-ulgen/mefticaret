import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugify, SUBDOMAIN_SUFFIX } from "@/lib/mefti";
import { insertAuditRow } from "./audit.server";

/**
 * Süper admin mağaza yönetimi: oluşturma, düzenleme ve silme.
 * Her işlem platform_admin rolü sunucu tarafında doğrulandıktan sonra çalışır;
 * tenant verisi mağaza kimliğiyle izole kalır.
 */

type Supa = SupabaseClient<Database>;

async function assertPlatformAdmin(supabase: Supa, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "platform_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Bu işlem yalnızca platform yöneticileri içindir");
}

async function uniqueSlug(supabase: Supa, desired: string, ignoreStoreId?: string) {
  const base = slugify(desired) || "magaza";
  let slug = base;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const query = supabase.from("stores").select("id").eq("slug", slug).limit(1);
    const { data } = ignoreStoreId ? await query.neq("id", ignoreStoreId) : await query;
    if ((data ?? []).length === 0) return slug;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

const CURRENCIES = ["TRY", "USD", "EUR", "GBP", "AED", "SAR"] as const;
const LOCALES = ["tr", "en", "de", "fr", "es", "ar"] as const;
const STATUSES = ["draft", "active", "suspended", "archived"] as const;

export const createPlatformStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        name: z.string().trim().min(2).max(60),
        slug: z.string().trim().max(60).optional(),
        industry: z.string().trim().min(2).max(40).default("Genel"),
        currency: z.enum(CURRENCIES).default("TRY"),
        locale: z.enum(LOCALES).default("tr"),
        status: z.enum(STATUSES).default("draft"),
        planId: z.guid().nullable().optional(),
        ownerEmail: z.string().trim().email().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPlatformAdmin(supabase, userId);

    const slug = await uniqueSlug(supabase, data.slug || data.name);

    let ownerId = userId;
    if (data.ownerEmail) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", data.ownerEmail)
        .maybeSingle();
      if (profileError) throw new Error(profileError.message);
      if (!profile) throw new Error("Bu e-posta ile kayıtlı kullanıcı bulunamadı");
      ownerId = profile.id;
    }

    // RLS: stores_insert_own yalnızca kendi adına kayıt açmaya izin verir.
    // Mağaza platform yöneticisi adına açılır, sahiplik sonrasında devredilir.
    const { data: store, error } = await supabase
      .from("stores")
      .insert({
        owner_id: userId,
        name: data.name,
        slug,
        industry: data.industry,
        currency: data.currency,
        locale: data.locale,
        plan_id: data.planId ?? null,
        onboarding_step: 4,
        status: data.status,
        ...(data.status === "active" ? { published_at: new Date().toISOString() } : {}),
      })
      .select("*")
      .single();
    if (error || !store) throw new Error(error?.message ?? "Mağaza oluşturulamadı");

    await supabase.from("store_users").insert({
      store_id: store.id,
      user_id: ownerId,
      role: "owner",
      permissions: ["*"],
    });
    await supabase.from("store_settings").insert({ store_id: store.id });
    await supabase.from("store_domains").insert({
      store_id: store.id,
      hostname: `${slug}.${SUBDOMAIN_SUFFIX}`,
      type: "subdomain",
      is_primary: true,
      status: "verified",
      ssl_active: true,
      verified_at: new Date().toISOString(),
    });

    if (ownerId !== userId) {
      const { error: transferError } = await supabase
        .from("stores")
        .update({ owner_id: ownerId })
        .eq("id", store.id);
      if (transferError) throw new Error(transferError.message);
    }

    await insertAuditRow(supabase, {
      store_id: store.id,
      actor_id: userId,
      action: "platform.store_created",
      entity: "stores",
      entity_id: store.id,
      new_value: { name: store.name, slug, owner_id: ownerId, status: data.status } as never,
    });

    return { ...store, owner_id: ownerId };
  });

export const updatePlatformStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        name: z.string().trim().min(2).max(60),
        slug: z.string().trim().min(2).max(60),
        industry: z.string().trim().max(40).optional(),
        currency: z.enum(CURRENCIES),
        locale: z.enum(LOCALES),
        status: z.enum(STATUSES),
        planId: z.guid().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPlatformAdmin(supabase, userId);

    const { data: current, error: currentError } = await supabase
      .from("stores")
      .select("id, name, slug, status, plan_id, currency, locale, industry")
      .eq("id", data.storeId)
      .maybeSingle();
    if (currentError) throw new Error(currentError.message);
    if (!current) throw new Error("Mağaza bulunamadı");

    const slug = data.slug === current.slug ? current.slug : await uniqueSlug(supabase, data.slug, data.storeId);

    const patch: Record<string, unknown> = {
      name: data.name,
      slug,
      industry: data.industry ?? current.industry,
      currency: data.currency,
      locale: data.locale,
      status: data.status,
      plan_id: data.planId ?? null,
    };
    if (data.status === "active") patch["published_at"] = new Date().toISOString();

    const { data: store, error } = await supabase
      .from("stores")
      .update(patch as never)
      .eq("id", data.storeId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!store) throw new Error("Mağaza güncellenemedi");

    if (slug !== current.slug) {
      await supabase
        .from("store_domains")
        .update({ hostname: `${slug}.${SUBDOMAIN_SUFFIX}` })
        .eq("store_id", data.storeId)
        .eq("type", "subdomain");
    }

    await insertAuditRow(supabase, {
      store_id: data.storeId,
      actor_id: userId,
      action: "platform.store_updated",
      entity: "stores",
      entity_id: data.storeId,
      old_value: current as never,
      new_value: patch as never,
    });

    return store;
  });

export const deletePlatformStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        confirmSlug: z.string().trim().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPlatformAdmin(supabase, userId);

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, name, slug")
      .eq("id", data.storeId)
      .maybeSingle();
    if (storeError) throw new Error(storeError.message);
    if (!store) throw new Error("Mağaza bulunamadı");
    if (store.slug !== data.confirmSlug) throw new Error("Onay için mağaza slug'ını doğru yazın");

    await insertAuditRow(supabase, {
      actor_id: userId,
      action: "platform.store_deleted",
      entity: "stores",
      entity_id: store.id,
      old_value: { name: store.name, slug: store.slug } as never,
    });

    const { error } = await supabase.from("stores").delete().eq("id", data.storeId);
    if (error) throw new Error(error.message);

    return { storeId: data.storeId, slug: store.slug };
  });
