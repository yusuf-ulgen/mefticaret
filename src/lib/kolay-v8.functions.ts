import { requireHomeMaker } from "@/lib/home-maker-guard";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";


/**
 * Ev Hanımları Portalı v8 sunucu işlemleri.
 *
 * - Telefon + 4 haneli SMS kodu ile giriş (kod özeti veritabanında, kod asla saklanmaz)
 * - Komşu ürün önerisi (satıcı seçer), hızlı kampanya anahtarları
 * - Yıllık özel gün hatırlatmaları
 * - Ambalaj pazarı ve 1 Dakika Akademi
 * - Havale dekontunu yapay zekâ ile okuyup siparişin ödemesini işaretleme
 *
 * Yetkiler RLS ile veritabanında zorlanır; frontend'den gelen role/mağaza
 * bilgisine güvenilmez.
 */

/* --------------------------------- telefon --------------------------------- */

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_EMAIL_DOMAIN = "telefon.mefticaret.com";

function normalizePhone(raw: string): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `9${digits}`;
  if (digits.length === 10) return `90${digits}`;
  return null;
}

async function hashCode(phone: string, code: string): Promise<string> {
  const pepper = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "mefticaret-otp";
  const bytes = new TextEncoder().encode(`${phone}:${code}:${pepper}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => String(b % 10)).join("");
}

/** Telefona 4 haneli giriş kodu gönderir. */
export const requestPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ phone: z.string().trim().min(10).max(20) }).parse(data))
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Telefon numaranızı 05xx xxx xx xx biçiminde yazın");

    const { consumeRateLimit } = await import("@/lib/rate-limit.server");
    const limit = await consumeRateLimit(`home_maker_otp:${phone}`, {
      limit: 5,
      windowSeconds: 900,
    });
    if (!limit.allowed)
      throw new Error("Çok fazla kod istediniz. Lütfen 15 dakika sonra tekrar deneyin.");

    const code = randomCode();
    const codeHash = await hashCode(phone, code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.from("kolay_phone_otps").insert({
      phone,
      code_hash: codeHash,
      expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    } as never);
    if (error) throw new Error(error.message);

    const { sendOtpSms } = await import("@/lib/otp-sms.server");
    const sent = await sendOtpSms(phone, code);
    if (!sent.ok) throw new Error(sent.error ?? "Kod gönderilemedi");

    return { ok: true as const, phone };
  });

/** Kodu doğrular, gerekiyorsa hesabı açar ve oturum anahtarı döner. */
export const verifyPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        phone: z.string().trim().min(10).max(20),
        code: z.string().trim().regex(/^\d{4}$/, "Kod 4 haneli olmalı"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Telefon numarası geçersiz");

    const { consumeRateLimit } = await import("@/lib/rate-limit.server");
    const limit = await consumeRateLimit(`home_maker_otp_verify:${phone}`, {
      limit: 10,
      windowSeconds: 900,
    });
    if (!limit.allowed) throw new Error("Çok fazla deneme yapıldı. Lütfen sonra tekrar deneyin.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("kolay_phone_otps")
      .select("id, code_hash, expires_at, attempts, consumed_at")
      .eq("phone", phone)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Geçerli bir kod bulunamadı. Yeni kod isteyin.");
    if (new Date(row.expires_at).getTime() < Date.now())
      throw new Error("Kodun süresi doldu. Yeni kod isteyin.");
    if ((row.attempts ?? 0) >= OTP_MAX_ATTEMPTS)
      throw new Error("Bu kod için deneme hakkınız bitti. Yeni kod isteyin.");

    const expected = await hashCode(phone, data.code);
    if (expected !== row.code_hash) {
      await supabaseAdmin
        .from("kolay_phone_otps")
        .update({ attempts: (row.attempts ?? 0) + 1 } as never)
        .eq("id", row.id);
      throw new Error("Kod hatalı. Tekrar deneyin.");
    }

    await supabaseAdmin
      .from("kolay_phone_otps")
      .update({ consumed_at: new Date().toISOString() } as never)
      .eq("id", row.id);

    const email = `${phone}@${OTP_EMAIL_DOMAIN}`;
    const created = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      phone: `+${phone}`,
      user_metadata: { phone_login: true, portal: "home_maker" },
    });
    let userId = created.data.user?.id ?? null;
    if (created.error && !/already|exists|registered/i.test(created.error.message)) {
      throw new Error(created.error.message);
    }

    const link = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) throw new Error(link.error.message);
    userId = userId ?? link.data.user?.id ?? null;
    const tokenHash = link.data.properties?.hashed_token;
    if (!tokenHash || !userId) throw new Error("Giriş anahtarı üretilemedi. Tekrar deneyin.");

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "home_maker" } as never, {
        onConflict: "user_id,role",
        ignoreDuplicates: true,
      });

    return { ok: true as const, email, tokenHash };
  });

/* ------------------------------ komşu ürünleri ------------------------------ */

const storeInput = z.object({ storeId: z.guid() });

export const listCrossSellPartners = createServerFn({ method: "POST" })
  .middleware([requireHomeMaker])
  .inputValidator((data) => storeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("kolay_cross_sell_partners")
      .select(
        "id, partner_store_id, partner_product_id, headline, is_active, sort_order, stores!kolay_cross_sell_partners_partner_store_id_fkey(name, slug), products(title, base_price, currency, slug)",
      )
      .eq("store_id", data.storeId)
      .order("sort_order");
    if (error) throw new Error(error.message);

    return (rows ?? []).map((row) => {
      const store = Array.isArray(row.stores) ? row.stores[0] : row.stores;
      const product = Array.isArray(row.products) ? row.products[0] : row.products;
      return {
        id: row.id,
        partnerStoreId: row.partner_store_id,
        partnerProductId: row.partner_product_id,
        headline: row.headline,
        isActive: row.is_active,
        storeName: store?.name ?? "Komşu mağaza",
        storeSlug: store?.slug ?? "",
        productTitle: product?.title ?? null,
        productPrice: product?.base_price ?? null,
        productSlug: product?.slug ?? null,
        currency: product?.currency ?? "TRY",
      };
    });
  });

/** Aynı şehirdeki diğer Kolay Panel mağazalarının satıştaki ürünleri. */
export const listCrossSellCandidates = createServerFn({ method: "POST" })
  .middleware([requireHomeMaker])
  .inputValidator((data) => storeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: source, error: sourceError } = await context.supabase
      .from("stores")
      .select("id, store_settings(city)")
      .eq("id", data.storeId)
      .maybeSingle();
    if (sourceError) throw new Error(sourceError.message);
    if (!source) throw new Error("Mağaza bulunamadı veya yetkiniz yok");

    const settings = Array.isArray(source.store_settings)
      ? source.store_settings[0]
      : source.store_settings;
    const city = settings?.city?.trim();
    if (!city) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: stores, error } = await supabaseAdmin
      .from("stores")
      .select("id, name, slug, store_settings!inner(city)")
      .eq("store_kind", "micro")
      .eq("status", "active")
      .eq("store_settings.city", city)
      .neq("id", data.storeId)
      .limit(20);
    if (error) throw new Error(error.message);

    const ids = (stores ?? []).map((store) => store.id);
    if (ids.length === 0) return [];

    const { data: products, error: productError } = await supabaseAdmin
      .from("products")
      .select("id, store_id, title, base_price, currency")
      .in("store_id", ids)
      .eq("status", "active")
      .limit(120);
    if (productError) throw new Error(productError.message);

    return (stores ?? []).map((store) => ({
      storeId: store.id,
      storeName: store.name,
      storeSlug: store.slug,
      products: (products ?? [])
        .filter((product) => product.store_id === store.id)
        .map((product) => ({
          id: product.id,
          title: product.title,
          price: Number(product.base_price),
          currency: product.currency ?? "TRY",
        })),
    }));
  });

export const saveCrossSellPartner = createServerFn({ method: "POST" })
  .middleware([requireHomeMaker])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        partnerStoreId: z.guid(),
        partnerProductId: z.guid().nullable(),
        headline: z.string().trim().max(80).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (data.partnerStoreId === data.storeId)
      throw new Error("Kendi mağazanızı komşu olarak ekleyemezsiniz");

    const { error } = await context.supabase.from("kolay_cross_sell_partners").upsert(
      {
        store_id: data.storeId,
        partner_store_id: data.partnerStoreId,
        partner_product_id: data.partnerProductId,
        headline: data.headline,
        is_active: true,
      } as never,
      { onConflict: "store_id,partner_store_id,partner_product_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const setCrossSellActive = createServerFn({ method: "POST" })
  .middleware([requireHomeMaker])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), id: z.guid(), isActive: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("kolay_cross_sell_partners")
      .update({ is_active: data.isActive } as never)
      .eq("id", data.id)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteCrossSellPartner = createServerFn({ method: "POST" })
  .middleware([requireHomeMaker])
  .inputValidator((data) => z.object({ storeId: z.guid(), id: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("kolay_cross_sell_partners")
      .delete()
      .eq("id", data.id)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ----------------------------- hızlı kampanyalar ---------------------------- */

const BUNDLE_CODE = "2AL10";

export const getPromoSettings = createServerFn({ method: "POST" })
  .middleware([requireHomeMaker])
  .inputValidator((data) => storeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("kolay_promo_settings")
      .select("*")
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      bundleEnabled: row?.bundle_enabled ?? false,
      bundleMinQuantity: row?.bundle_min_quantity ?? 2,
      bundleDiscountPercent: Number(row?.bundle_discount_percent ?? 10),
      freeShippingEnabled: row?.free_shipping_enabled ?? false,
      freeShippingThreshold: Number(row?.free_shipping_threshold ?? 250),
      crossSellEnabled: row?.cross_sell_enabled ?? true,
      bundleCode: BUNDLE_CODE,
    };
  });

/**
 * Anahtarları kaydeder ve gerçek karşılıklarını uygular:
 * kargo bedava eşiği mağazanın kargo tarifelerine, paket indirimi gerçek bir
 * indirim koduna yazılır.
 */
export const savePromoSettings = createServerFn({ method: "POST" })
  .middleware([requireHomeMaker])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        bundleEnabled: z.boolean(),
        bundleMinQuantity: z.number().int().min(2).max(10),
        bundleDiscountPercent: z.number().min(1).max(50),
        freeShippingEnabled: z.boolean(),
        freeShippingThreshold: z.number().min(0).max(100_000),
        crossSellEnabled: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { error } = await supabase.from("kolay_promo_settings").upsert(
      {
        store_id: data.storeId,
        bundle_enabled: data.bundleEnabled,
        bundle_min_quantity: data.bundleMinQuantity,
        bundle_discount_percent: data.bundleDiscountPercent,
        free_shipping_enabled: data.freeShippingEnabled,
        free_shipping_threshold: data.freeShippingThreshold,
        cross_sell_enabled: data.crossSellEnabled,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "store_id" },
    );
    if (error) throw new Error(error.message);

    // Kargo bedava barı: mağazanın kargo tarifelerindeki gerçek eşiği güncelle.
    const { error: shippingError } = await supabase
      .from("shipping_rates")
      .update({
        free_over: data.freeShippingEnabled ? data.freeShippingThreshold : null,
      } as never)
      .eq("store_id", data.storeId);
    if (shippingError) throw new Error(shippingError.message);

    // Paket indirimi: gerçek bir indirim kodu aç/kapat.
    const { data: existing, error: discountReadError } = await supabase
      .from("discounts")
      .select("id")
      .eq("store_id", data.storeId)
      .eq("code", BUNDLE_CODE)
      .maybeSingle();
    if (discountReadError) throw new Error(discountReadError.message);

    const payload = {
      store_id: data.storeId,
      code: BUNDLE_CODE,
      title: `${data.bundleMinQuantity} al %${data.bundleDiscountPercent} indirim kazan`,
      type: "percentage" as const,
      value: data.bundleDiscountPercent,
      is_active: data.bundleEnabled,
    };

    if (existing) {
      const { error: updateError } = await supabase
        .from("discounts")
        .update(payload as never)
        .eq("id", existing.id);
      if (updateError) throw new Error(updateError.message);
    } else if (data.bundleEnabled) {
      const { error: insertError } = await supabase.from("discounts").insert(payload as never);
      if (insertError) throw new Error(insertError.message);
    }

    return { ok: true as const, bundleCode: BUNDLE_CODE };
  });

/** Vitrin/kasa için açık kampanyalar ve komşu ürün önerisi (giriş gerekmez). */
export const getStoreBoosters = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ slug: z.string().trim().min(1).max(120) }).parse(data))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: store } = await client
      .from("stores")
      .select("id, name")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!store) return null;

    // Kampanya ayarları herkese açık değildir; yalnız mağazanın gösterilecek alanları okunur.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: promo } = await supabaseAdmin
      .from("kolay_promo_settings")
      .select(
        "bundle_enabled, bundle_min_quantity, bundle_discount_percent, free_shipping_enabled, free_shipping_threshold, cross_sell_enabled, production_mode, production_message, gift_wrap_enabled, gift_wrap_fee",
      )
      .eq("store_id", store.id)
      .maybeSingle();

    const { data: partners } = await client
      .from("kolay_cross_sell_partners")
      .select(
        "id, headline, partner_product_id, stores!kolay_cross_sell_partners_partner_store_id_fkey(name, slug), products(title, base_price, currency, slug)",
      )
      .eq("store_id", store.id)
      .eq("is_active", true)
      .order("sort_order")
      .limit(3);

    const { data: rateRows } = await client
      .from("platform_currency_rates")
      .select("code, rate")
      .in("code", ["EUR", "USD"]);
    const rates: Record<string, number> = {};
    for (const r of rateRows ?? []) if (Number(r.rate) > 0) rates[r.code] = Number(r.rate);

    return {
      production: promo?.production_mode
        ? { message: promo.production_message || "Şu an üretimdeyim, siparişiniz taze hazırlanacak." }
        : null,
      giftWrap: promo?.gift_wrap_enabled ? { fee: Number(promo.gift_wrap_fee ?? 0) } : null,
      rates,
      bundle:
        promo?.bundle_enabled === true
          ? {
              code: BUNDLE_CODE,
              minQuantity: promo.bundle_min_quantity ?? 2,
              percent: Number(promo.bundle_discount_percent ?? 10),
            }
          : null,
      freeShipping:
        promo?.free_shipping_enabled === true
          ? { threshold: Number(promo.free_shipping_threshold ?? 0) }
          : null,
      crossSell:
        promo?.cross_sell_enabled === false
          ? []
          : (partners ?? []).map((row) => {
              const partnerStore = Array.isArray(row.stores) ? row.stores[0] : row.stores;
              const product = Array.isArray(row.products) ? row.products[0] : row.products;
              return {
                id: row.id,
                headline: row.headline,
                storeName: partnerStore?.name ?? "Komşu mağaza",
                storeSlug: partnerStore?.slug ?? "",
                productTitle: product?.title ?? null,
                productSlug: product?.slug ?? null,
                productPrice: product?.base_price ? Number(product.base_price) : null,
                currency: product?.currency ?? "TRY",
              };
            }),
    };
  });

/* ---------------------------- yıllık hatırlatmalar --------------------------- */

export const listAnnualReminders = createServerFn({ method: "POST" })
  .middleware([requireHomeMaker])
  .inputValidator((data) => storeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("kolay_annual_reminders")
      .select("id, customer_name, phone, occasion, remind_on, message, is_active, last_sent_at")
      .eq("store_id", data.storeId)
      .order("remind_on");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const saveAnnualReminder = createServerFn({ method: "POST" })
  .middleware([requireHomeMaker])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        id: z.guid().optional(),
        orderId: z.guid().nullable().optional(),
        customerName: z.string().trim().min(2).max(80),
        phone: z.string().trim().min(10).max(20),
        occasion: z.string().trim().min(2).max(60),
        remindOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        message: z.string().trim().max(300).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Telefon numarası geçersiz");

    const row = {
      store_id: data.storeId,
      order_id: data.orderId ?? null,
      customer_name: data.customerName,
      phone,
      occasion: data.occasion,
      remind_on: data.remindOn,
      message: data.message,
      updated_at: new Date().toISOString(),
    };

    if (data.id) {
      const { error } = await context.supabase
        .from("kolay_annual_reminders")
        .update(row as never)
        .eq("id", data.id)
        .eq("store_id", data.storeId);
      if (error) throw new Error(error.message);
      return { ok: true as const, id: data.id };
    }

    const { data: inserted, error } = await context.supabase
      .from("kolay_annual_reminders")
      .insert(row as never)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: inserted?.id ?? null };
  });

export const deleteAnnualReminder = createServerFn({ method: "POST" })
  .middleware([requireHomeMaker])
  .inputValidator((data) => z.object({ storeId: z.guid(), id: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("kolay_annual_reminders")
      .delete()
      .eq("id", data.id)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ------------------------------ ambalaj pazarı ------------------------------ */

export const listPackagingItems = createServerFn({ method: "GET" })
  .middleware([requireHomeMaker])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("kolay_packaging_items")
      .select(
        "id, title, description, category, unit, pack_size, list_price, sale_price, currency, image_url, supplier_name",
      )
      .eq("is_active", true)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listPackagingOrders = createServerFn({ method: "POST" })
  .middleware([requireHomeMaker])
  .inputValidator((data) => storeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("kolay_packaging_orders")
      .select("id, quantity, total, currency, status, created_at, kolay_packaging_items(title)")
      .eq("store_id", data.storeId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((row) => {
      const item = Array.isArray(row.kolay_packaging_items)
        ? row.kolay_packaging_items[0]
        : row.kolay_packaging_items;
      return {
        id: row.id,
        title: item?.title ?? "Ambalaj",
        quantity: row.quantity,
        total: Number(row.total),
        currency: row.currency,
        status: row.status,
        createdAt: row.created_at,
      };
    });
  });

export const orderPackagingItem = createServerFn({ method: "POST" })
  .middleware([requireHomeMaker])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        itemId: z.guid(),
        quantity: z.number().int().min(1).max(50),
        deliveryNote: z.string().trim().max(200).nullable(),
        usePoints: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: item, error: itemError } = await supabase
      .from("kolay_packaging_items")
      .select("id, sale_price, currency, is_active")
      .eq("id", data.itemId)
      .maybeSingle();
    if (itemError) throw new Error(itemError.message);
    if (!item || !item.is_active) throw new Error("Bu ambalaj ürünü şu anda satışta değil");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("kolay_order_packaging_srv" as never, {
      _user_id: userId,
      _store_id: data.storeId,
      _item_id: item.id,
      _quantity: data.quantity,
      _note: data.deliveryNote,
      _use_points: data.usePoints ?? false,
    } as never);
    if (error) throw new Error(error.message);
    const r = (result ?? {}) as { pointsUsed?: number };
    return { ok: true as const, pointsUsed: Number(r.pointsUsed ?? 0) };
  });

/* --------------------------- 1 Dakika Akademi ------------------------------- */

export const listAcademyLessons = createServerFn({ method: "GET" })
  .middleware([requireHomeMaker])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("kolay_academy_lessons")
      .select("id, title, description, category, duration_seconds, video_url, thumbnail_url, steps")
      .eq("is_active", true)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      durationSeconds: row.duration_seconds,
      videoUrl: row.video_url,
      thumbnailUrl: row.thumbnail_url,
      steps: Array.isArray(row.steps) ? (row.steps as string[]) : [],
    }));
  });

/* ---------------------------- dekont doğrulama ------------------------------ */

export const listReceiptChecks = createServerFn({ method: "POST" })
  .middleware([requireHomeMaker])
  .inputValidator((data) => storeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("kolay_receipt_checks")
      .select(
        "id, order_id, status, detected_amount, detected_at, detected_sender, expected_amount, notes, created_at",
      )
      .eq("store_id", data.storeId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/**
 * Havale dekontunu yapay zekâ ile okur. Tutar siparişle uyuşuyorsa siparişin
 * ödemesi "ödendi" olarak işaretlenir; uyuşmuyorsa karar satıcıya bırakılır.
 */
export const verifyPaymentReceipt = createServerFn({ method: "POST" })
  .middleware([requireHomeMaker])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        orderId: z.guid(),
        imageDataUrl: z
          .string()
          .regex(/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/, "Görsel biçimi geçersiz")
          .max(8_000_000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, grand_total, currency, payment_status, order_number, customer_name")
      .eq("id", data.orderId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (!order) throw new Error("Sipariş bulunamadı veya yetkiniz yok");
    if (order.payment_status === "paid")
      throw new Error("Bu siparişin ödemesi zaten alınmış görünüyor");

    const { consumeRateLimit } = await import("@/lib/rate-limit.server");
    const limit = await consumeRateLimit(`receipt_verify:${data.storeId}`, {
      limit: 40,
      windowSeconds: 3600,
    });
    if (!limit.allowed)
      throw new Error("Saatlik dekont okuma sınırına ulaştınız. Kısa süre sonra tekrar deneyin.");

    const expected = Number(order.grand_total);
    const { callProvider } = await import("@/lib/ai.server");
    const result = await callProvider({
      purpose: "text",
      temperature: 0,
      maxTokens: 400,
      images: [data.imageDataUrl],
      charge: { storeId: data.storeId, userId, task: "receipt_verify" },
      messages: [
        {
          role: "system",
          content:
            'Banka havale/EFT dekontu görselini okuyup yalnızca JSON döndür: {"amount": number|null, "date": string|null, "sender": string|null, "is_receipt": boolean}. Açıklama, kod bloğu veya ek metin yazma.',
        },
        {
          role: "user",
          content: `Bu dekontu oku. Beklenen tutar ${expected} ${order.currency}. Yalnızca JSON döndür.`,
        },
      ],
    });

    let parsed: { amount?: number | null; date?: string | null; sender?: string | null; is_receipt?: boolean } = {};
    try {
      const clean = result.text.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(clean) as typeof parsed;
    } catch {
      parsed = {};
    }

    const amount = typeof parsed.amount === "number" && Number.isFinite(parsed.amount) ? parsed.amount : null;
    const isReceipt = parsed.is_receipt !== false && amount !== null;
    const matches = isReceipt && amount !== null && Math.abs(amount - expected) <= 0.5;

    const status = !isReceipt ? "unreadable" : matches ? "matched" : "mismatch";
    const notes = !isReceipt
      ? "Görselden tutar okunamadı. Lütfen dekontun tamamının göründüğü net bir fotoğraf yükleyin."
      : matches
        ? "Dekonttaki tutar sipariş tutarıyla eşleşti, ödeme alındı olarak işaretlendi."
        : `Dekonttaki tutar (${amount}) sipariş tutarından (${expected}) farklı. Ödeme durumu değiştirilmedi.`;

    if (matches) {
      const { error: updateError } = await supabase
        .from("orders")
        .update({ payment_status: "paid" } as never)
        .eq("id", order.id)
        .eq("store_id", data.storeId);
      if (updateError) throw new Error(updateError.message);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("kolay_receipt_checks").insert({
      store_id: data.storeId,
      order_id: order.id,
      status,
      detected_amount: amount,
      detected_at: typeof parsed.date === "string" ? parsed.date.slice(0, 40) : null,
      detected_sender: typeof parsed.sender === "string" ? parsed.sender.slice(0, 80) : null,
      expected_amount: expected,
      notes,
      created_by: userId,
    } as never);

    return {
      status,
      amount,
      expected,
      currency: order.currency,
      sender: typeof parsed.sender === "string" ? parsed.sender : null,
      date: typeof parsed.date === "string" ? parsed.date : null,
      notes,
      orderNumber: order.order_number,
    };
  });
