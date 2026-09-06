import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Depo / şube yönetimi, depo bazlı stok seviyeleri ve depolar arası transfer.
 * Tenant izolasyonu RLS ile zorlanır. Gelecek entegrasyonlar (barkod okuyucu,
 * POS, dropshipping, tedarikçi stokları, XML senkronizasyonu) için depo kaydında
 * `external_source` / `sync_url` alanları ayrılmıştır.
 */

const kindEnum = z.enum(["warehouse", "branch", "supplier", "dropship", "virtual"]);

const warehouseInput = z.object({
  storeId: z.guid(),
  id: z.guid().optional(),
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  kind: kindEnum,
  city: z.string().trim().max(80).optional(),
  district: z.string().trim().max(80).optional(),
  address: z.string().trim().max(400).optional(),
  contactName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  priority: z.number().int().min(0).max(9999).default(100),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  allowsFulfillment: z.boolean().default(true),
  externalSource: z.string().trim().max(60).optional(),
  syncUrl: z.string().trim().max(500).optional(),
  note: z.string().trim().max(500).optional(),
});

const nullable = (value?: string) => (value && value.length > 0 ? value : null);

export const saveWarehouse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => warehouseInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const payload = {
      store_id: data.storeId,
      code: data.code.toLocaleUpperCase("tr"),
      name: data.name,
      kind: data.kind,
      city: nullable(data.city),
      district: nullable(data.district),
      address: nullable(data.address),
      contact_name: nullable(data.contactName),
      phone: nullable(data.phone),
      priority: data.priority,
      is_active: data.isActive,
      allows_fulfillment: data.allowsFulfillment,
      external_source: nullable(data.externalSource),
      sync_url: nullable(data.syncUrl),
      note: nullable(data.note),
    };

    if (data.isDefault) {
      const { error: clearError } = await supabase
        .from("warehouses")
        .update({ is_default: false })
        .eq("store_id", data.storeId)
        .eq("is_default", true);
      if (clearError) throw new Error(clearError.message);
    }

    if (data.id) {
      const { error } = await supabase
        .from("warehouses")
        .update({ ...payload, is_default: data.isDefault })
        .eq("id", data.id)
        .eq("store_id", data.storeId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: created, error } = await supabase
      .from("warehouses")
      .insert({ ...payload, is_default: data.isDefault })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const deleteWarehouse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), id: z.guid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: warehouse, error: readError } = await context.supabase
      .from("warehouses")
      .select("id, is_default")
      .eq("id", data.id)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!warehouse) throw new Error("Depo bulunamadı veya yetkiniz yok");
    if (warehouse.is_default) throw new Error("Varsayılan depo silinemez");

    const { error } = await context.supabase
      .from("warehouses")
      .delete()
      .eq("id", data.id)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Bir varyantı depoya bağlar (stok seviyesi kaydı oluşturur). */
export const ensureInventoryLevel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        warehouseId: z.guid(),
        variantId: z.guid(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: variant, error } = await supabase
      .from("product_variants")
      .select("id, product_id")
      .eq("id", data.variantId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!variant) throw new Error("Varyant bulunamadı veya yetkiniz yok");

    const { error: insertError } = await supabase.from("inventory_levels").upsert(
      {
        store_id: data.storeId,
        warehouse_id: data.warehouseId,
        variant_id: variant.id,
        product_id: variant.product_id,
      },
      { onConflict: "warehouse_id,variant_id", ignoreDuplicates: true },
    );
    if (insertError) throw new Error(insertError.message);
    return { ok: true };
  });

const levelKind = z.enum(["count", "restock", "manual_out", "return", "damage"]);

/** Depo bazlı stok hareketi: mevcut stoğu değiştirir ve denetim izi yazar. */
export const adjustWarehouseStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        levelId: z.guid(),
        kind: levelKind,
        amount: z.number().int().min(0).max(1_000_000),
        reason: z.string().trim().max(300).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: level, error } = await supabase
      .from("inventory_levels")
      .select("id, warehouse_id, variant_id, product_id, on_hand")
      .eq("id", data.levelId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!level) throw new Error("Stok kaydı bulunamadı veya yetkiniz yok");

    const before = level.on_hand ?? 0;
    let after = before;
    if (data.kind === "count") after = data.amount;
    else if (data.kind === "restock" || data.kind === "return") after = before + data.amount;
    else after = Math.max(before - data.amount, 0);

    const { error: updateError } = await supabase
      .from("inventory_levels")
      .update({ on_hand: after })
      .eq("id", level.id);
    if (updateError) throw new Error(updateError.message);

    const { error: moveError } = await supabase.from("inventory_movements").insert({
      store_id: data.storeId,
      product_id: level.product_id,
      variant_id: level.variant_id,
      warehouse_id: level.warehouse_id,
      kind: data.kind,
      quantity: after - before,
      stock_before: before,
      stock_after: after,
      reason: nullable(data.reason),
      actor_id: userId,
    });
    if (moveError) throw new Error(moveError.message);

    return { before, after };
  });

/** Rezerve stok ve minimum stok eşiği güncelleme. */
export const updateLevelSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        levelId: z.guid(),
        reserved: z.number().int().min(0).max(1_000_000).optional(),
        minStock: z.number().int().min(0).max(1_000_000).optional(),
        binLocation: z.string().trim().max(60).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const patch: {
      reserved?: number;
      min_stock?: number;
      bin_location?: string | null;
    } = {};
    if (data.reserved !== undefined) patch.reserved = data.reserved;
    if (data.minStock !== undefined) patch.min_stock = data.minStock;
    if (data.binLocation !== undefined) patch.bin_location = nullable(data.binLocation);
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await context.supabase
      .from("inventory_levels")
      .update(patch)
      .eq("id", data.levelId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------------------------- Transfer --------------------------------- */

export const createStockTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        fromWarehouseId: z.guid(),
        toWarehouseId: z.guid(),
        note: z.string().trim().max(500).optional(),
        items: z
          .array(
            z.object({
              variantId: z.guid(),
              quantity: z.number().int().min(1).max(1_000_000),
            }),
          )
          .min(1)
          .max(200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.fromWarehouseId === data.toWarehouseId)
      throw new Error("Kaynak ve hedef depo aynı olamaz");

    const { data: variants, error: variantError } = await supabase
      .from("product_variants")
      .select("id, product_id, title, sku, products(title)")
      .eq("store_id", data.storeId)
      .in(
        "id",
        data.items.map((item) => item.variantId),
      );
    if (variantError) throw new Error(variantError.message);
    if (!variants || variants.length === 0) throw new Error("Varyant bulunamadı");

    const code = `TR-${Date.now().toString(36).toLocaleUpperCase("tr")}`;
    const { data: transfer, error } = await supabase
      .from("stock_transfers")
      .insert({
        store_id: data.storeId,
        code,
        from_warehouse_id: data.fromWarehouseId,
        to_warehouse_id: data.toWarehouseId,
        note: nullable(data.note),
        created_by: userId,
      })
      .select("id, code")
      .single();
    if (error) throw new Error(error.message);

    const rows = data.items.flatMap((item) => {
      const variant = variants.find((entry) => entry.id === item.variantId);
      if (!variant) return [];
      const productTitle = (variant as { products?: { title?: string } | null }).products?.title;
      return [
        {
          store_id: data.storeId,
          transfer_id: transfer.id,
          variant_id: variant.id,
          product_id: variant.product_id,
          title: productTitle ? `${productTitle} · ${variant.title}` : variant.title,
          sku: variant.sku,
          quantity: item.quantity,
        },
      ];
    });
    if (rows.length === 0) throw new Error("Transfer satırı oluşturulamadı");

    const { error: itemsError } = await supabase.from("stock_transfer_items").insert(rows);
    if (itemsError) throw new Error(itemsError.message);

    return { id: transfer.id, code: transfer.code };
  });

async function loadTransfer(
  supabase: { from: (table: string) => any },
  storeId: string,
  transferId: string,
) {
  const { data, error } = await supabase
    .from("stock_transfers")
    .select(
      "id, code, status, from_warehouse_id, to_warehouse_id, stock_transfer_items(id, variant_id, product_id, quantity, received_quantity)",
    )
    .eq("id", transferId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Transfer bulunamadı veya yetkiniz yok");
  return data as {
    id: string;
    code: string;
    status: string;
    from_warehouse_id: string;
    to_warehouse_id: string;
    stock_transfer_items: {
      id: string;
      variant_id: string | null;
      product_id: string | null;
      quantity: number;
    }[];
  };
}

/** Transferi yola çıkarır: kaynak depodan düşer, hedef depoda "yolda" artar. */
export const shipStockTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), transferId: z.guid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const transfer = await loadTransfer(supabase as never, data.storeId, data.transferId);
    if (transfer.status !== "draft") throw new Error("Sadece taslak transferler gönderilebilir");

    for (const item of transfer.stock_transfer_items) {
      if (!item.variant_id) continue;

      const { data: source, error } = await supabase
        .from("inventory_levels")
        .select("id, on_hand")
        .eq("store_id", data.storeId)
        .eq("warehouse_id", transfer.from_warehouse_id)
        .eq("variant_id", item.variant_id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      const before = source?.on_hand ?? 0;
      if (!source || before < item.quantity)
        throw new Error("Kaynak depoda yeterli stok yok: " + item.variant_id);

      const after = before - item.quantity;
      const { error: updateError } = await supabase
        .from("inventory_levels")
        .update({ on_hand: after })
        .eq("id", source.id);
      if (updateError) throw new Error(updateError.message);

      const { data: target, error: targetError } = await supabase
        .from("inventory_levels")
        .select("id, incoming")
        .eq("store_id", data.storeId)
        .eq("warehouse_id", transfer.to_warehouse_id)
        .eq("variant_id", item.variant_id)
        .maybeSingle();
      if (targetError) throw new Error(targetError.message);

      if (target) {
        const { error: incError } = await supabase
          .from("inventory_levels")
          .update({ incoming: (target.incoming ?? 0) + item.quantity })
          .eq("id", target.id);
        if (incError) throw new Error(incError.message);
      } else {
        const { error: createError } = await supabase.from("inventory_levels").insert({
          store_id: data.storeId,
          warehouse_id: transfer.to_warehouse_id,
          variant_id: item.variant_id,
          product_id: item.product_id,
          incoming: item.quantity,
        });
        if (createError) throw new Error(createError.message);
      }

      const { error: moveError } = await supabase.from("inventory_movements").insert({
        store_id: data.storeId,
        product_id: item.product_id,
        variant_id: item.variant_id,
        warehouse_id: transfer.from_warehouse_id,
        target_warehouse_id: transfer.to_warehouse_id,
        transfer_id: transfer.id,
        kind: "transfer_out",
        quantity: -item.quantity,
        stock_before: before,
        stock_after: after,
        reason: `Transfer ${transfer.code}`,
        actor_id: userId,
      });
      if (moveError) throw new Error(moveError.message);
    }

    const { error: statusError } = await supabase
      .from("stock_transfers")
      .update({ status: "in_transit", shipped_at: new Date().toISOString() })
      .eq("id", transfer.id);
    if (statusError) throw new Error(statusError.message);
    return { ok: true };
  });

/** Transferi teslim alır: hedef depoda mevcut stok artar, "yolda" düşer. */
export const receiveStockTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), transferId: z.guid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const transfer = await loadTransfer(supabase as never, data.storeId, data.transferId);
    if (transfer.status !== "in_transit") throw new Error("Sadece yoldaki transferler teslim alınır");

    for (const item of transfer.stock_transfer_items) {
      if (!item.variant_id) continue;

      const { data: target, error } = await supabase
        .from("inventory_levels")
        .select("id, on_hand, incoming")
        .eq("store_id", data.storeId)
        .eq("warehouse_id", transfer.to_warehouse_id)
        .eq("variant_id", item.variant_id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!target) throw new Error("Hedef depo stok kaydı bulunamadı");

      const before = target.on_hand ?? 0;
      const after = before + item.quantity;
      const { error: updateError } = await supabase
        .from("inventory_levels")
        .update({
          on_hand: after,
          incoming: Math.max((target.incoming ?? 0) - item.quantity, 0),
        })
        .eq("id", target.id);
      if (updateError) throw new Error(updateError.message);

      const { error: itemError } = await supabase
        .from("stock_transfer_items")
        .update({ received_quantity: item.quantity })
        .eq("id", item.id);
      if (itemError) throw new Error(itemError.message);

      const { error: moveError } = await supabase.from("inventory_movements").insert({
        store_id: data.storeId,
        product_id: item.product_id,
        variant_id: item.variant_id,
        warehouse_id: transfer.to_warehouse_id,
        transfer_id: transfer.id,
        kind: "transfer_in",
        quantity: item.quantity,
        stock_before: before,
        stock_after: after,
        reason: `Transfer ${transfer.code}`,
        actor_id: userId,
      });
      if (moveError) throw new Error(moveError.message);
    }

    const { error: statusError } = await supabase
      .from("stock_transfers")
      .update({ status: "received", received_at: new Date().toISOString() })
      .eq("id", transfer.id);
    if (statusError) throw new Error(statusError.message);
    return { ok: true };
  });

export const cancelStockTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), transferId: z.guid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const transfer = await loadTransfer(context.supabase as never, data.storeId, data.transferId);
    if (transfer.status !== "draft")
      throw new Error("Yola çıkmış transfer iptal edilemez; ters transfer oluşturun");
    const { error } = await context.supabase
      .from("stock_transfers")
      .update({ status: "cancelled" })
      .eq("id", transfer.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
