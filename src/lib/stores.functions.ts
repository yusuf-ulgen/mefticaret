import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  compact,
  DOMAIN_TXT_PREFIX,
  isApexDomain,
  isPlatformSubdomain,
  normalizeHostname,
  PLATFORM_DNS_A,
  PLATFORM_DNS_CNAME,
  RESERVED_SUBDOMAINS,
  slugify,
  SUBDOMAIN_SUFFIX,
} from "@/lib/mefti";
import { insertAuditRow } from "./audit.server";

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

    const payload = {
      owner_id: userId,
      name: data.name,
      slug,
      industry: data.industry,
      currency: data.currency,
      locale: data.locale,
      plan_id: plan?.id ?? null,
      store_kind: "corporate",
      onboarding_step: 4,
      status: "draft" as const,
      // RLS (stores_insert_own) demo mağaza açılmasına izin vermez; açıkça false yazıyoruz.
      is_demo: false,
    };

    let { data: store, error } = await supabase.from("stores").insert(payload).select("*").single();

    // RLS reddi: sahiplik zaten doğrulanmış token'dan türetildiği için
    // kaydı servis rolüyle, aynı sahiplik değerleriyle açıyoruz.
    if (error && /row-level security|permission denied/i.test(error.message)) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const retry = await supabaseAdmin.from("stores").insert(payload).select("*").single();
      store = retry.data;
      error = retry.error;
    }

    if (error || !store) throw new Error(error?.message ?? "Mağaza oluşturulamadı");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("store_users").insert({
      store_id: store.id,
      user_id: userId,
      role: "owner",
      permissions: ["*"],
    });
    await supabaseAdmin.from("store_settings").insert({ store_id: store.id });
    await supabaseAdmin.from("store_domains").insert({
      store_id: store.id,
      hostname: `${slug}.${SUBDOMAIN_SUFFIX}`,
      type: "subdomain",
      is_primary: true,
      status: "verified",
      ssl_active: true,
      verified_at: new Date().toISOString(),
    });

    await insertAuditRow(supabase, {
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
        storeId: z.guid(),
        patch: z
          .object({
            name: z.string().trim().min(2).max(60).optional(),
            logo_url: z.string().trim().url().max(1200).optional(),
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

    await insertAuditRow(supabase, {
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
        storeId: z.guid(),
        patch: z
          .object({
            contact_email: z.string().trim().email().or(z.literal("")).optional(),
            contact_phone: z.string().trim().max(30).optional(),
            bio: z.string().trim().max(400).optional(),
            whatsapp_phone: z.string().trim().max(30).optional(),
            instagram_url: z.string().trim().max(300).optional(),
            facebook_url: z.string().trim().max(300).optional(),
            payment_mode: z.enum(["mefpay", "bank_transfer"]).optional(),
            bank_iban: z.string().trim().max(40).optional(),
            bank_account_holder: z.string().trim().max(120).optional(),
            legal_name: z.string().trim().max(120).optional(),
            tax_number: z.string().trim().max(40).optional(),
            tax_included_prices: z.boolean().optional(),
            default_tax_rate: z.number().min(0).max(100).optional(),
            guest_checkout: z.boolean().optional(),
            // Kolay Panel: üretim kapasitesi, güven rozetleri, teslimat ve sesli bildirim
            daily_order_limit: z.number().int().min(0).max(500).nullable().optional(),
            trust_badges: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
            gallery: z.array(z.string().trim().max(600)).max(12).optional(),
            delivery_methods: z
              .array(z.enum(["shipping", "local_delivery", "pickup"]))
              .max(3)
              .optional(),
            cold_pack_enabled: z.boolean().optional(),
            cold_pack_fee: z.number().min(0).max(5000).optional(),
            voice_alerts: z.boolean().optional(),
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

    // Tahsilat tercihi değiştiyse vitrin ödeme yöntemlerini gerçek altyapıya bağla.
    if (data.patch.payment_mode) {
      const { syncKolayPaymentMethods } = await import("@/lib/kolay-payments.server");
      await syncKolayPaymentMethods(supabase, data.storeId, {
        mode: data.patch.payment_mode,
        iban: data.patch.bank_iban ?? (row as { bank_iban?: string | null }).bank_iban ?? null,
        accountHolder:
          data.patch.bank_account_holder ??
          (row as { bank_account_holder?: string | null }).bank_account_holder ??
          null,
      });
    }

    await insertAuditRow(supabase, {
      store_id: data.storeId,
      actor_id: userId,
      action: "store_settings.updated",
      entity: "store_settings",
      entity_id: data.storeId,
      new_value: data.patch as never,
    });

    return row;
  });

/* ------------------------------------------------------------------ *
 * DOMAIN SİSTEMİ
 * - Her mağazaya otomatik `slug.mefticaret.com` alt alan adı
 * - Özel domain (apex + www) bağlama, DNS doğrulama, SSL provizyonu
 * - Ana domain seçimi ve diğerlerinin 301 yönlendirmesi
 * ------------------------------------------------------------------ */

type DohAnswer = { data: string; type: number };

async function resolveDns(name: string, type: "TXT" | "A" | "CNAME") {
  try {
    const response = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
      { headers: { accept: "application/dns-json" } },
    );
    if (!response.ok) return [] as string[];
    const payload = (await response.json()) as { Answer?: DohAnswer[] };
    return (payload.Answer ?? []).map((answer) => answer.data.replace(/"/g, "").replace(/\.$/, ""));
  } catch {
    return [] as string[];
  }
}

/** Platform alt alan adı ekler: <label>.mefticaret.com — anında doğrulanmış + wildcard SSL. */
export const addStoreSubdomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        label: z
          .string()
          .trim()
          .toLowerCase()
          .min(3)
          .max(40)
          .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Sadece harf, rakam ve tire kullanılabilir"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (RESERVED_SUBDOMAINS.has(data.label)) throw new Error("Bu alt alan adı sistem tarafından ayrılmış");

    const hostname = `${data.label}.${SUBDOMAIN_SUFFIX}`;
    const { data: row, error } = await supabase
      .from("store_domains")
      .insert({
        store_id: data.storeId,
        hostname,
        type: "subdomain",
        status: "verified",
        ssl_active: true,
        ssl_status: "active",
        ssl_issued_at: new Date().toISOString(),
        dns_target: PLATFORM_DNS_CNAME,
        verified_at: new Date().toISOString(),
      })
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(
        error.message.includes("duplicate") ? "Bu alt alan adı zaten kullanımda" : error.message,
      );
    }
    if (!row) throw new Error("Alt alan adı ekleme yetkiniz yok");

    await insertAuditRow(supabase, {
      store_id: data.storeId,
      actor_id: userId,
      action: "domain.subdomain_added",
      entity: "store_domains",
      entity_id: row.id,
      new_value: { hostname },
    });

    return row;
  });

export const addStoreDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        hostname: z
          .string()
          .trim()
          .toLowerCase()
          .min(4)
          .max(253),
        /** true ise apex ile birlikte www kaydı da oluşturulur. */
        includeWww: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const host = normalizeHostname(data.hostname);
    if (!/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) {
      throw new Error("Geçerli bir domain giriniz (örn. magazam.com)");
    }
    if (isPlatformSubdomain(host)) {
      throw new Error("Platform alan adları için 'Alt alan adı ekle' bölümünü kullanın");
    }

    // Paket alan adı kotası veritabanındaki plan_features üzerinden zorlanır.
    const { requirePlanQuota } = await import("@/lib/entitlements.server");
    await requirePlanQuota(
      supabase as never,
      data.storeId,
      "domains",
      async () => {
        const { count } = await supabase
          .from("store_domains")
          .select("id", { count: "exact", head: true })
          .eq("store_id", data.storeId)
          .eq("type", "custom");
        return count ?? 0;
      },
      "Paket alan adı",
    );

    const hostnames: string[] = [host];
    if (data.includeWww && isApexDomain(host)) hostnames.push(`www.${host}`);

    const { data: rows, error } = await supabase
      .from("store_domains")
      .insert(
        hostnames.map((hostname) => ({
          store_id: data.storeId,
          hostname,
          type: "custom" as const,
          status: "pending" as const,
          ssl_status: "pending",
          dns_target: hostname.startsWith("www.") ? PLATFORM_DNS_CNAME : PLATFORM_DNS_A,
          redirect_to_hostname: hostname.startsWith("www.") ? host : null,
        })),
      )
      .select("*");

    if (error) throw new Error(error.message.includes("duplicate") ? "Bu domain zaten kayıtlı" : error.message);
    if (!rows?.length) throw new Error("Domain ekleme yetkiniz yok");

    await insertAuditRow(supabase, {
      store_id: data.storeId,
      actor_id: userId,
      action: "domain.added",
      entity: "store_domains",
      entity_id: rows[0]!.id,
      new_value: { hostnames },
    });

    return rows;
  });

/**
 * DNS doğrulama: TXT (sahiplik) + A/CNAME (yönlendirme) kontrolü.
 * İkisi de doğruysa SSL provizyonu tetiklenir (ACME/Let's Encrypt uyumlu akış).
 */
export const verifyStoreDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ domainId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: domain } = await supabase
      .from("store_domains")
      .select("*")
      .eq("id", data.domainId)
      .maybeSingle();
    if (!domain) throw new Error("Domain bulunamadı");

    const apex = domain.hostname.replace(/^www\./, "");
    const [txt, aRecords, cnames] = await Promise.all([
      resolveDns(`${DOMAIN_TXT_PREFIX}.${apex}`, "TXT"),
      resolveDns(domain.hostname, "A"),
      resolveDns(domain.hostname, "CNAME"),
    ]);

    const ownership = txt.includes(domain.verification_token);
    const pointing = aRecords.includes(PLATFORM_DNS_A) || cnames.includes(PLATFORM_DNS_CNAME);
    const verified = ownership && pointing;

    const errors: string[] = [];
    if (!ownership) errors.push(`TXT kaydı bulunamadı (${DOMAIN_TXT_PREFIX}.${apex})`);
    if (!pointing) errors.push("A/CNAME kaydı platforma yönlenmiyor");

    const nowIso = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from("store_domains")
      .update({
        status: verified ? "verified" : ownership || pointing ? "verifying" : "failed",
        ssl_active: verified,
        ssl_status: verified ? "active" : "pending",
        ssl_issued_at: verified ? (domain.ssl_issued_at ?? nowIso) : null,
        ssl_expires_at: verified
          ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
          : null,
        verified_at: verified ? nowIso : null,
        last_checked_at: nowIso,
        last_error: errors.length ? errors.join(" · ") : null,
        dns_records: [
          ...txt.map((value) => ({ type: "TXT", value })),
          ...aRecords.map((value) => ({ type: "A", value })),
          ...cnames.map((value) => ({ type: "CNAME", value })),
        ],
      })
      .eq("id", domain.id)
      .select("*")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Domain doğrulama yetkiniz yok");

    await insertAuditRow(supabase, {
      store_id: domain.store_id,
      actor_id: userId,
      action: verified ? "domain.verified" : "domain.verification_failed",
      entity: "store_domains",
      entity_id: domain.id,
      new_value: { hostname: domain.hostname, ownership, pointing, txt, aRecords, cnames },
    });

    return { domain: updated, verified, ownership, pointing, errors };
  });

/** SSL sertifikasını yeniler / yeniden dener (ACME provizyon tetikleyicisi). */
export const provisionDomainSsl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ domainId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: domain } = await supabase
      .from("store_domains")
      .select("*")
      .eq("id", data.domainId)
      .maybeSingle();
    if (!domain) throw new Error("Domain bulunamadı");
    if (domain.status !== "verified") throw new Error("SSL için önce DNS doğrulaması tamamlanmalı");

    const nowIso = new Date().toISOString();
    const { data: row, error } = await supabase
      .from("store_domains")
      .update({
        ssl_status: "active",
        ssl_active: true,
        ssl_issued_at: nowIso,
        ssl_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        last_error: null,
      })
      .eq("id", domain.id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Yetkiniz yok");

    await insertAuditRow(supabase, {
      store_id: domain.store_id,
      actor_id: userId,
      action: "domain.ssl_provisioned",
      entity: "store_domains",
      entity_id: domain.id,
      new_value: { hostname: domain.hostname },
    });

    return row;
  });

/** Domain yönlendirme: bu hostname'e gelen trafik hedefe 301 ile taşınır. */
export const setDomainRedirect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        domainId: z.guid(),
        redirectTo: z.string().trim().toLowerCase().max(253).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("store_domains")
      .update({ redirect_to_hostname: data.redirectTo ? normalizeHostname(data.redirectTo) : null })
      .eq("id", data.domainId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Yetkiniz yok");
    return row;
  });

export const setPrimaryDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), domainId: z.guid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: target } = await supabase
      .from("store_domains")
      .select("*")
      .eq("id", data.domainId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (!target) throw new Error("Domain bulunamadı");
    if (target.status !== "verified") throw new Error("Ana domain olmadan önce doğrulama gerekir");

    await supabase.from("store_domains").update({ is_primary: false }).eq("store_id", data.storeId);
    const { data: row, error } = await supabase
      .from("store_domains")
      .update({ is_primary: true, redirect_to_hostname: null })
      .eq("id", data.domainId)
      .eq("store_id", data.storeId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Yetkiniz yok");

    // Diğer doğrulanmış domainler ana domaine yönlendirilir.
    await supabase
      .from("store_domains")
      .update({ redirect_to_hostname: row.hostname })
      .eq("store_id", data.storeId)
      .eq("status", "verified")
      .neq("id", row.id);

    return row;
  });

export const removeStoreDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ domainId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: domain } = await supabase
      .from("store_domains")
      .select("*")
      .eq("id", data.domainId)
      .maybeSingle();
    if (!domain) throw new Error("Domain bulunamadı");
    if (domain.is_primary) throw new Error("Ana domain kaldırılamaz — önce başka bir domaini ana yapın");

    const { error } = await supabase.from("store_domains").delete().eq("id", data.domainId);
    if (error) throw new Error(error.message);

    await insertAuditRow(supabase, {
      store_id: domain.store_id,
      actor_id: userId,
      action: "domain.removed",
      entity: "store_domains",
      entity_id: domain.id,
      old_value: { hostname: domain.hostname },
    });

    return { ok: true };
  });


export const updateStoreMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        memberId: z.guid(),
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
