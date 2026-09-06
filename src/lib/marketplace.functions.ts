import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Çok satıcılı pazaryeri: satıcı başvurusu, onay/red/askı, komisyon belirleme,
 * satıcı ürün-stok yönetimi ve para çekme talepleri.
 *
 * Tüm yetki kontrolleri RLS + `app_private.can_manage_store` /
 * `app_private.approved_seller_id` üzerinden zorlanır. Satıcı, kendi kaydında
 * durum ve komisyon oranını değiştiremez (DB tetikleyicisi bu alanları geri alır),
 * bu yüzden yönetici işlemleri güncelleme sonrası doğrulanır.
 */

const nullable = (value?: string | null) => (value && value.trim().length > 0 ? value.trim() : null);

const applyInput = z.object({
  storeId: z.guid(),
  displayName: z.string().trim().min(2).max(120),
  legalName: z.string().trim().max(160).optional(),
  email: z.string().trim().email().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
  taxId: z.string().trim().max(60).optional(),
  iban: z.string().trim().max(40).optional(),
  about: z.string().trim().max(1000).optional(),
});

export const applyAsSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => applyInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: created, error } = await supabase
      .from("marketplace_sellers")
      .insert({
        store_id: data.storeId,
        user_id: userId,
        display_name: data.displayName,
        legal_name: nullable(data.legalName),
        email: nullable(data.email),
        phone: nullable(data.phone),
        tax_id: nullable(data.taxId),
        iban: nullable(data.iban),
        about: nullable(data.about),
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

const profileInput = z.object({
  sellerId: z.guid(),
  displayName: z.string().trim().min(2).max(120),
  legalName: z.string().trim().max(160).optional(),
  email: z.string().trim().email().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
  taxId: z.string().trim().max(60).optional(),
  iban: z.string().trim().max(40).optional(),
  about: z.string().trim().max(1000).optional(),
});

/** Satıcı kendi profilini güncelleyebilir; durum/komisyon alanları korunur. */
export const updateSellerProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => profileInput.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("marketplace_sellers")
      .update({
        display_name: data.displayName,
        legal_name: nullable(data.legalName),
        email: nullable(data.email),
        phone: nullable(data.phone),
        tax_id: nullable(data.taxId),
        iban: nullable(data.iban),
        about: nullable(data.about),
      })
      .eq("id", data.sellerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const reviewInput = z.object({
  sellerId: z.guid(),
  status: z.enum(["pending", "approved", "rejected", "suspended"]),
  reason: z.string().trim().max(500).optional(),
  commissionRate: z.number().min(0).max(0.9).optional(),
});

/** Platform / mağaza yöneticisi: satıcı onay, red, askı ve komisyon belirleme. */
export const reviewSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => reviewInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const now = new Date().toISOString();
    const patch: {
      status: "pending" | "approved" | "rejected" | "suspended";
      rejection_reason: string | null;
      approved_at: string | null;
      suspended_at: string | null;
      commission_rate?: number;
    } = {
      status: data.status,
      rejection_reason: data.status === "rejected" ? nullable(data.reason) : null,
      approved_at: data.status === "approved" ? now : null,
      suspended_at: data.status === "suspended" ? now : null,
    };
    if (typeof data.commissionRate === "number") patch.commission_rate = data.commissionRate;

    const { data: updated, error } = await supabase
      .from("marketplace_sellers")
      .update(patch)
      .eq("id", data.sellerId)
      .select("id, status, commission_rate")
      .single();
    if (error) throw new Error(error.message);
    if (updated.status !== data.status) {
      throw new Error("Bu satıcıyı yönetme yetkiniz yok.");
    }
    return { id: updated.id as string, status: updated.status };
  });

/** Yönetici: bir ürünü satıcıya bağlar veya bağlantıyı kaldırır. */
export const assignProductSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        productId: z.guid(),
        sellerId: z.guid().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("products")
      .update({ seller_id: data.sellerId })
      .eq("id", data.productId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Satıcı: kendi varyantının stok ve fiyat bilgisini güncelleyebilir. */
export const updateSellerVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        variantId: z.guid(),
        stock: z.number().int().min(0).max(1_000_000).optional(),
        price: z.number().min(0).max(10_000_000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const patch: { stock?: number; price?: number } = {};
    if (typeof data.stock === "number") patch.stock = data.stock;
    if (typeof data.price === "number") patch.price = data.price;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await context.supabase
      .from("product_variants")
      .update(patch)
      .eq("id", data.variantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Satıcı: para çekme talebi oluşturur (tutar sunucuda kazanç bakiyesine karşı doğrulanır). */
export const requestSellerPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        sellerId: z.guid(),
        amount: z.number().positive().max(10_000_000),
        iban: z.string().trim().max(40).optional(),
        note: z.string().trim().max(400).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: seller, error: sellerError } = await supabase
      .from("marketplace_sellers")
      .select("id, store_id, status, commission_rate, iban")
      .eq("id", data.sellerId)
      .single();
    if (sellerError) throw new Error(sellerError.message);
    if (seller.status !== "approved") throw new Error("Yalnızca onaylı satıcılar para çekebilir.");

    const [itemsRes, requestsRes] = await Promise.all([
      supabase
        .from("order_items")
        .select("line_total, products!inner(seller_id)")
        .eq("store_id", seller.store_id)
        .eq("products.seller_id", data.sellerId)
        .limit(20000),
      supabase
        .from("seller_payout_requests")
        .select("amount, status")
        .eq("seller_id", data.sellerId)
        .limit(2000),
    ]);
    if (itemsRes.error) throw new Error(itemsRes.error.message);
    if (requestsRes.error) throw new Error(requestsRes.error.message);

    const revenue = (itemsRes.data ?? []).reduce(
      (sum, row) => sum + Number((row as { line_total: number }).line_total ?? 0),
      0,
    );
    const commissionRate = Number(seller.commission_rate ?? 0);
    const net = revenue * (1 - commissionRate);
    const reserved = (requestsRes.data ?? [])
      .filter((row) => row.status !== "failed")
      .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const available = Math.max(0, net - reserved);

    if (data.amount > available + 0.01) {
      throw new Error(
        `Çekilebilir bakiye yetersiz. Kullanılabilir: ${available.toFixed(2)}`,
      );
    }

    const { data: created, error } = await supabase
      .from("seller_payout_requests")
      .insert({
        store_id: seller.store_id,
        seller_id: data.sellerId,
        amount: data.amount,
        iban: nullable(data.iban) ?? seller.iban,
        note: nullable(data.note),
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

/** Yönetici: para çekme talebini işler (işleniyor / ödendi / başarısız). */
export const reviewPayoutRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        requestId: z.guid(),
        status: z.enum(["pending", "processing", "paid", "failed"]),
        adminNote: z.string().trim().max(400).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: updated, error } = await context.supabase
      .from("seller_payout_requests")
      .update({
        status: data.status,
        admin_note: nullable(data.adminNote),
        processed_at: data.status === "pending" ? null : new Date().toISOString(),
      })
      .eq("id", data.requestId)
      .select("id, status")
      .single();
    if (error) throw new Error(error.message);
    if (updated.status !== data.status) throw new Error("Bu talebi yönetme yetkiniz yok.");
    return { ok: true };
  });
