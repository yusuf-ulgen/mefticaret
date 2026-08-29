import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { compact, slugify, SUBDOMAIN_SUFFIX } from "@/lib/mefti";

/**
 * Application katmanı: mağaza yaşam döngüsü.
 * Tenant ID, fiyat, yetki ve slug asla frontend'den güvenilir kabul edilmez;
 * her işlem giriş yapmış kullanıcının token'ı ile RLS altında çalışır.
 */
export const createStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        name: z.string().trim().min(2).max(60),
        industry: z.string().trim().min(2).max(40),
        currency: z.enum(["TRY", "USD", "EUR", "GBP", "AED", "SAR"]).default("TRY"),
        locale: z.enum(["tr", "en", "de", "fr", "es", "ar"]).default("tr"),
        planCode: z.string().trim().max(40).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const base = slugify(data.name) || "magaza";
    let slug = base;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { data: taken } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!taken) break;
      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const { data: plan } = await supabase
      .from("plans")
      .select("id")
      .eq("code", data.planCode ?? "free")
      .maybeSingle();

    const { data: store, error } = await supabase
      .from("stores")
      .insert({
        owner_id: userId,
        name: data.name,
        slug,
        industry: data.industry,
        currency: data.currency,
        locale: data.locale,
        plan_id: plan?.id ?? null,
        onboarding_step: 4,
        status: "draft",
      })
      .select("*")
      .single();

    if (error || !store) throw new Error(error?.message ?? "Mağaza oluşturulamadı");

    await supabase.from("store_users").insert({
      store_id: store.id,
      user_id: userId,
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
    await supabase.from("audit_logs").insert({
      store_id: store.id,
      actor_id: userId,
      action: "store.created",
      entity: "stores",
      entity_id: store.id,
      new_value: { name: store.name, slug: store.slug },
    });

    return store;
  });

export const updateStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        patch: z
          .object({
            name: z.string().trim().min(2).max(60).optional(),
            industry: z.string().trim().max(40).optional(),
            currency: z.enum(["TRY", "USD", "EUR", "GBP", "AED", "SAR"]).optional(),
            locale: z.enum(["tr", "en", "de", "fr", "es", "ar"]).optional(),
            timezone: z.string().trim().max(60).optional(),
            onboarding_step: z.number().int().min(1).max(10).optional(),
            onboarding_completed: z.boolean().optional(),
            status: z.enum(["draft", "active", "suspended", "archived"]).optional(),
          })
          .strict(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch = compact(data.patch);
    if (patch["status"] === "active") patch["published_at"] = new Date().toISOString();

    const { data: store, error } = await supabase
      .from("stores")
      .update(patch as never)
      .eq("id", data.storeId)
      .select("*")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!store) throw new Error("Bu mağazayı düzenleme yetkiniz yok");

    await supabase.from("audit_logs").insert({
      store_id: store.id,
      actor_id: userId,
      action: "store.updated",
      entity: "stores",
      entity_id: store.id,
      new_value: patch as never,
    });

    return store;
  });

export const updateStoreSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        patch: z
          .object({
            contact_email: z.string().trim().email().or(z.literal("")).optional(),
            contact_phone: z.string().trim().max(30).optional(),
            legal_name: z.string().trim().max(120).optional(),
            tax_number: z.string().trim().max(40).optional(),
            tax_included_prices: z.boolean().optional(),
            default_tax_rate: z.number().min(0).max(100).optional(),
            guest_checkout: z.boolean().optional(),
          })
          .strict(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("store_settings")
      .update(compact(data.patch) as never)
      .eq("store_id", data.storeId)
      .select("*")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) throw new Error("Bu mağazanın ayarlarını düzenleme yetkiniz yok");

    await supabase.from("audit_logs").insert({
      store_id: data.storeId,
      actor_id: userId,
      action: "store_settings.updated",
      entity: "store_settings",
      entity_id: data.storeId,
      new_value: data.patch as never,
    });

    return row;
  });

export const addStoreDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        hostname: z
          .string()
          .trim()
          .toLowerCase()
          .min(4)
          .max(253)
          .regex(/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/, "Geçerli bir domain giriniz"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("store_domains")
      .insert({ store_id: data.storeId, hostname: data.hostname, type: "custom" })
      .select("*")
      .maybeSingle();

    if (error) throw new Error(error.message.includes("duplicate") ? "Bu domain zaten kayıtlı" : error.message);
    if (!row) throw new Error("Domain ekleme yetkiniz yok");

    await supabase.from("audit_logs").insert({
      store_id: data.storeId,
      actor_id: userId,
      action: "domain.added",
      entity: "store_domains",
      entity_id: row.id,
      new_value: { hostname: row.hostname },
    });

    return row;
  });

export const verifyStoreDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ domainId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: domain } = await supabase
      .from("store_domains")
      .select("*")
      .eq("id", data.domainId)
      .maybeSingle();
    if (!domain) throw new Error("Domain bulunamadı");

    const dns = await fetch(
      `https://cloudflare-dns.com/dns-query?name=_mefticaret.${domain.hostname}&type=TXT`,
      { headers: { accept: "application/dns-json" } },
    );
    const payload = (await dns.json()) as { Answer?: Array<{ data: string }> };
    const records = (payload.Answer ?? []).map((answer) => answer.data.replace(/"/g, ""));
    const verified = records.includes(domain.verification_token);

    const { data: updated, error } = await supabase
      .from("store_domains")
      .update({
        status: verified ? "verified" : "failed",
        ssl_active: verified,
        verified_at: verified ? new Date().toISOString() : null,
      })
      .eq("id", domain.id)
      .select("*")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Domain doğrulama yetkiniz yok");

    await supabase.from("audit_logs").insert({
      store_id: domain.store_id,
      actor_id: userId,
      action: verified ? "domain.verified" : "domain.verification_failed",
      entity: "store_domains",
      entity_id: domain.id,
      new_value: { hostname: domain.hostname, records },
    });

    return { domain: updated, verified, records };
  });

export const setPrimaryDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.string().uuid(), domainId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await supabase.from("store_domains").update({ is_primary: false }).eq("store_id", data.storeId);
    const { data: row, error } = await supabase
      .from("store_domains")
      .update({ is_primary: true })
      .eq("id", data.domainId)
      .eq("store_id", data.storeId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Yetkiniz yok");
    return row;
  });

export const removeStoreDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ domainId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("store_domains").delete().eq("id", data.domainId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateStoreMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        memberId: z.string().uuid(),
        role: z.enum(["admin", "staff", "marketing", "support"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("store_users")
      .update({ role: data.role })
      .eq("id", data.memberId)
      .neq("role", "owner")
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Yetkiniz yok veya mağaza sahibi değiştirilemez");
    return row;
  });
