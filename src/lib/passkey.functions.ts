import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Passkey (parmak izi / Face ID) ile hızlı kasa sunucu uçları.
 * Tüm uçlar oturum gerektirir; passkey yalnızca oturum sahibinin kendi kaydına bağlanır.
 */

async function currentRequest() {
  const { getRequest } = await import("@tanstack/react-start/server");
  return getRequest();
}

export const fetchMyPasskeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listPasskeys } = await import("@/lib/passkey.server");
    return listPasskeys(context.userId);
  });

export const removeMyPasskey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { deletePasskey } = await import("@/lib/passkey.server");
    return deletePasskey(context.userId, data.id);
  });

export const startPasskeyRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { beginPasskeyRegistration } = await import("@/lib/passkey.server");
    const { data } = await context.supabase.auth.getUser();
    const userName = data.user?.email ?? context.userId;
    const options = await beginPasskeyRegistration({
      request: await currentRequest(),
      userId: context.userId,
      userName,
    });
    // Tarayıcıya düz JSON gönderilir (WebAuthn seçenek tipi doğrudan serileştirilemez).
    return JSON.parse(JSON.stringify(options)) as Record<string, unknown>;
  });

export const completePasskeyRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ label: z.string().trim().max(60).default("Passkey"), response: z.unknown() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { finishPasskeyRegistration } = await import("@/lib/passkey.server");
    return finishPasskeyRegistration({
      request: await currentRequest(),
      userId: context.userId,
      label: data.label,
      response: data.response,
    });
  });

export const startPasskeyCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { beginPasskeyAuthentication } = await import("@/lib/passkey.server");
    return beginPasskeyAuthentication({ request: await currentRequest(), userId: context.userId });
  });

/**
 * Passkey doğrulandıktan sonra kayıtlı varsayılan adresle siparişi oluşturur.
 * Tutarlar ve stok kontrolü her zaman sunucudaki kasa mantığından gelir.
 */
export const completePasskeyCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        slug: z.string().trim().min(1).max(120),
        items: z
          .array(z.object({ variantId: z.guid(), quantity: z.number().int().min(1).max(50) }))
          .min(1)
          .max(30),
        response: z.unknown(),
        note: z.string().trim().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { verifyPasskeyAssertion } = await import("@/lib/passkey.server");
    await verifyPasskeyAssertion({
      request: await currentRequest(),
      userId: context.userId,
      response: data.response,
    });

    const { data: userData } = await context.supabase.auth.getUser();
    const email = userData.user?.email?.trim().toLowerCase();
    if (!email) throw new Error("Hesabınızda e-posta adresi bulunamadı.");

    const { data: store } = await context.supabase
      .from("stores")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!store) throw new Error("Mağaza bulunamadı.");

    const { data: customer } = await context.supabase
      .from("customers")
      .select("id, full_name, phone")
      .eq("store_id", store.id)
      .eq("user_id", context.userId)
      .maybeSingle();

    const { data: address } = await context.supabase
      .from("customer_addresses")
      .select("recipient, phone, country, city, district, line1, postal_code")
      .eq("store_id", store.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!address) {
      throw new Error("Hızlı ödeme için önce hesabınıza bir teslimat adresi ekleyin.");
    }

    const phone = address.phone ?? customer?.phone ?? "";
    if (phone.trim().length < 5) {
      throw new Error("Hızlı ödeme için adresinize telefon numarası ekleyin.");
    }

    const { createStorefrontOrder } = await import("@/lib/checkout.server");
    return createStorefrontOrder(
      {
        slug: data.slug,
        items: data.items,
        customer: {
          fullName: address.recipient ?? customer?.full_name ?? email,
          email,
          phone,
          acceptsMarketing: false,
        },
        address: {
          country: address.country,
          city: address.city,
          ...(address.district ? { district: address.district } : {}),
          line1: address.line1,
          ...(address.postal_code ? { postalCode: address.postal_code } : {}),
        },
        ...(data.note ? { note: data.note } : {}),
      } as never,
      { userId: context.userId, email },
    );
  });
