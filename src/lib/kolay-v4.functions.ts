import { requireHomeMaker } from "@/lib/home-maker-guard";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";


/**
 * Kolay Panel v4 sunucu işlemleri: malzeme & tazelik takibi, ürün içindekiler
 * bağlantısı, komşu mağazaya sipariş devri ve özel gün kampanyası.
 * Tüm yetki kontrolü RLS ile veritabanında zorlanır.
 */

const CODE_ALPHABET = "ACDEFGHJKLMNPRTUVWXYZ2346789";

function randomSuffix(length = 4) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

/* ---------------------------------- malzeme --------------------------------- */

const materialSchema = z.object({
  storeId: z.guid(),
  materialId: z.guid().optional(),
  name: z.string().trim().min(2).max(60),
  unit: z.enum(["kg", "gr", "lt", "ml", "adet", "paket"]),
  quantity: z.number().min(0).max(100_000),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  note: z.string().trim().max(200).nullable().optional(),
});

/** Malzeme ekler veya günceller (son kullanma tarihi dahil). */
export const saveMaterial = createServerFn({ method: "POST" })
  .middleware([requireHomeMaker])
  .inputValidator((data) => materialSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const row = {
      store_id: data.storeId,
      name: data.name,
      unit: data.unit,
      quantity: data.quantity,
      expiry_date: data.expiryDate,
      note: data.note ?? null,
    };

    if (data.materialId) {
      const { data: updated, error } = await supabase
        .from("store_materials")
        .update(row as never)
        .eq("id", data.materialId)
        .eq("store_id", data.storeId)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!updated) throw new Error("Bu malzemeyi güncelleme yetkiniz yok");
      return { id: updated.id };
    }

    const { data: created, error } = await supabase
      .from("store_materials")
      .insert(row as never)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!created) throw new Error("Malzeme eklenemedi");
    return { id: created.id };
  });

/** Malzemeyi siler; ürün bağlantıları da düşer. */
export const deleteMaterial = createServerFn({ method: "POST" })
  .middleware([requireHomeMaker])
  .inputValidator((data) => z.object({ materialId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("store_materials")
      .delete()
      .eq("id", data.materialId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Bir ürünün içindekiler listesini (malzemelerini) yeniden yazar. */
export const setProductMaterials = createServerFn({ method: "POST" })
  .middleware([requireHomeMaker])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        productId: z.guid(),
        materialIds: z.array(z.guid()).max(40),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error: clearError } = await supabase
      .from("product_materials")
      .delete()
      .eq("product_id", data.productId)
      .eq("store_id", data.storeId);
    if (clearError) throw new Error(clearError.message);

    if (data.materialIds.length === 0) return { count: 0 };

    const { error } = await supabase.from("product_materials").insert(
      data.materialIds.map((materialId) => ({
        store_id: data.storeId,
        product_id: data.productId,
        material_id: materialId,
      })) as never,
    );
    if (error) throw new Error(error.message);
    return { count: data.materialIds.length };
  });

/* ------------------------------ komşu mağazalar ----------------------------- */

/** Aynı şehirdeki aktif mağazaları listeler (yalnızca ad, şehir ve adres). */
export const listNearbyStores = createServerFn({ method: "POST" })
  .middleware([requireHomeMaker])
  .inputValidator((data) => z.object({ storeId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: source, error: sourceError } = await supabase
      .from("stores")
      .select("id, store_kind, owner_id, store_settings(city)")
      .eq("id", data.storeId)
      .maybeSingle();
    if (sourceError) throw new Error(sourceError.message);
    if (!source || source.store_kind !== "micro") throw new Error("Kolay Panel mağazası bulunamadı");

    const { data: membership } = await supabase
      .from("store_users")
      .select("role")
      .eq("store_id", data.storeId)
      .eq("user_id", userId)
      .maybeSingle();
    if (source.owner_id !== userId && !membership) throw new Error("Bu mağazaya erişim yetkiniz yok");

    const sourceSettings = Array.isArray(source.store_settings)
      ? source.store_settings[0]
      : source.store_settings;
    const city = sourceSettings?.city?.trim();
    if (!city) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("stores")
      .select("id, name, slug, store_settings!inner(city)")
      .eq("store_kind", "micro")
      .eq("status", "active")
      .neq("id", data.storeId)
      .ilike("store_settings.city", city)
      .limit(50);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((row) => {
      const settings = Array.isArray(row.store_settings) ? row.store_settings[0] : row.store_settings;
      return { id: row.id, name: row.name, slug: row.slug, city: settings?.city ?? "" };
    });
  });

/** Siparişi güvendiğiniz komşu mağazaya devretmek için talep açar. */
export const delegateOrder = createServerFn({ method: "POST" })
  .middleware([requireHomeMaker])
  .inputValidator((data) =>
    z
      .object({
        orderId: z.guid(),
        toStoreId: z.guid(),
        note: z.string().trim().max(300).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, store_id, order_number")
      .eq("id", data.orderId)
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (!order) throw new Error("Sipariş bulunamadı veya yetkiniz yok");
    if (order.store_id === data.toStoreId) throw new Error("Sipariş zaten bu mağazada");

    const { data: created, error } = await supabase
      .from("order_delegations")
      .insert({
        order_id: order.id,
        from_store_id: order.store_id,
        to_store_id: data.toStoreId,
        note: data.note ?? null,
        requested_by: userId,
        status: "pending",
      } as never)
      .select("id, status")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!created) throw new Error("Devir talebi oluşturulamadı");

    await supabase.from("order_events").insert({
      order_id: order.id,
      store_id: order.store_id,
      actor_id: userId,
      kind: "note",
      message: `Sipariş komşu mağazaya devredildi (onay bekliyor).`,
    } as never);

    return { id: created.id, status: created.status };
  });

/** Devredilen mağaza talebi kabul eder veya reddeder. */
export const answerDelegation = createServerFn({ method: "POST" })
  .middleware([requireHomeMaker])
  .inputValidator((data) => z.object({ delegationId: z.guid(), accept: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: updated, error } = await context.supabase
      .from("order_delegations")
      .update({ status: data.accept ? "accepted" : "rejected" } as never)
      .eq("id", data.delegationId)
      .select("id, status")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Bu talebi güncelleme yetkiniz yok");
    return { status: updated.status };
  });

/** Devir talebini geri alır. */
export const cancelDelegation = createServerFn({ method: "POST" })
  .middleware([requireHomeMaker])
  .inputValidator((data) => z.object({ delegationId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("order_delegations")
      .update({ status: "cancelled" } as never)
      .eq("id", data.delegationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------------------- özel gün kampanyası --------------------------- */

const campaignSchema = z.object({
  storeId: z.guid(),
  occasion: z.string().trim().min(2).max(40),
  percent: z.number().int().min(1).max(70),
  endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preorder: z.boolean().optional(),
});

/** Özel gün kampanyası başlatır: indirim kodu üretir ve vitrine duyuru yazar. */
export const startSeasonalCampaign = createServerFn({ method: "POST" })
  .middleware([requireHomeMaker])
  .inputValidator((data) => campaignSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const slugPart =
      data.occasion
        .toLocaleUpperCase("tr-TR")
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 8) || "OZELGUN";
    const code = `${slugPart}${randomSuffix(4)}`;
    const endsAt = new Date(`${data.endsAt}T23:59:59`).toISOString();

    const { error: discountError } = await supabase.from("discounts").insert({
      store_id: data.storeId,
      code,
      title: `${data.occasion} kampanyası`,
      type: "percentage",
      value: data.percent,
      starts_at: new Date().toISOString(),
      ends_at: endsAt,
      is_active: true,
    } as never);
    if (discountError) throw new Error(discountError.message);

    const banner = {
      occasion: data.occasion,
      percent: data.percent,
      code,
      ends_at: endsAt,
      preorder: Boolean(data.preorder),
      message: data.preorder
        ? `${data.occasion} için ön siparişler açıldı — ${code} kodu ile %${data.percent} indirim.`
        : `${data.occasion} kampanyası — ${code} kodu ile %${data.percent} indirim.`,
    };

    const { error: settingsError } = await supabase
      .from("store_settings")
      .update({ campaign_banner: banner } as never)
      .eq("store_id", data.storeId);
    if (settingsError) throw new Error(settingsError.message);

    return { code, message: banner.message };
  });

/** Kampanyayı bitirir: duyuru kaldırılır, kod pasife alınır. */
export const stopSeasonalCampaign = createServerFn({ method: "POST" })
  .middleware([requireHomeMaker])
  .inputValidator((data) => z.object({ storeId: z.guid(), code: z.string().max(40) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.code) {
      const { error } = await supabase
        .from("discounts")
        .update({ is_active: false } as never)
        .eq("store_id", data.storeId)
        .eq("code", data.code);
      if (error) throw new Error(error.message);
    }
    const { error: settingsError } = await supabase
      .from("store_settings")
      .update({ campaign_banner: null } as never)
      .eq("store_id", data.storeId);
    if (settingsError) throw new Error(settingsError.message);
    return { ok: true };
  });
