import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/**
 * Sevkiyat (kargo) yönetimi. Tenant izolasyonu RLS ile zorlanır; sipariş kargo
 * durumu veritabanı tetikleyicisi ile otomatik senkronize edilir.
 */

import { CARRIER_KEYS, SHIPMENT_STATUSES, carrierName, carrierTrackUrl } from "@/lib/carriers";

const statusSchema = z.enum(SHIPMENT_STATUSES);
const carrierKeySchema = z.enum([...CARRIER_KEYS, "other"]);

export const createShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        orderId: z.guid(),
        carrierKey: carrierKeySchema.optional(),
        estimatedDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
        carrier: z.string().trim().min(2).max(80),
        trackingNumber: z.string().trim().max(120).optional(),
        trackingUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
        status: statusSchema.default("pending"),
        note: z.string().trim().max(500).optional(),
        items: z
          .array(
            z.object({
              orderItemId: z.guid(),
              quantity: z.number().int().min(1).max(999),
            }),
          )
          .max(100)
          .default([]),
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
    if (!order) throw new Error("Sipariş bulunamadı");

    const now = new Date().toISOString();
    const { data: shipment, error } = await supabase
      .from("shipments")
      .insert({
        store_id: order.store_id,
        order_id: order.id,
        carrier: data.carrier,
        tracking_number: data.trackingNumber || null,
        tracking_url:
          data.trackingUrl ||
          (data.trackingNumber && data.carrierKey ? carrierTrackUrl(data.carrierKey, data.trackingNumber) : null),
        carrier_key: data.carrierKey ?? null,
        estimated_delivery_date: data.estimatedDeliveryDate || null,
        status: "pending",
        note: data.note || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.items.length > 0) {
      const { error: itemsError } = await supabase.from("shipment_items").insert(
        data.items.map((line) => ({
          shipment_id: shipment.id,
          order_item_id: line.orderItemId,
          quantity: line.quantity,
        })),
      );
      if (itemsError) throw new Error(itemsError.message);
    }

    await supabase.from("order_events").insert({
      order_id: order.id,
      store_id: order.store_id,
      actor_id: userId,
      kind: "shipment",
      message: `Sevkiyat oluşturuldu: ${data.carrier}${
        data.trackingNumber ? ` · ${data.trackingNumber}` : ""
      }`,
      meta: { shipment_id: shipment.id, status: data.status },
    });

    const { admin, applyShipmentStatus } = await import("@/lib/shipment-tracking.server");
    await applyShipmentStatus(await admin(), shipment.id, data.status, { source: "manual" });
    void now;
    void carrierName;

    return { id: shipment.id };
  });

export const updateShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        shipmentId: z.guid(),
        status: statusSchema.optional(),
        carrierKey: carrierKeySchema.nullable().optional(),
        estimatedDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal("")),
        location: z.string().trim().max(120).optional(),
        description: z.string().trim().max(300).optional(),
        carrier: z.string().trim().min(2).max(80).optional(),
        trackingNumber: z.string().trim().max(120).nullable().optional(),
        trackingUrl: z.string().trim().max(500).nullable().optional(),
        note: z.string().trim().max(500).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: current, error: readError } = await supabase
      .from("shipments")
      .select("id, order_id, store_id, status, shipped_at")
      .eq("id", data.shipmentId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!current) throw new Error("Sevkiyat bulunamadı");

    const patch: Database["public"]["Tables"]["shipments"]["Update"] = { updated_at: new Date().toISOString() };
    if (data.carrier !== undefined) patch.carrier = data.carrier;
    if (data.carrierKey !== undefined) patch.carrier_key = data.carrierKey;
    if (data.estimatedDeliveryDate !== undefined) patch.estimated_delivery_date = data.estimatedDeliveryDate || null;
    if (data.trackingNumber !== undefined) patch.tracking_number = data.trackingNumber || null;
    if (data.trackingUrl !== undefined) patch.tracking_url = data.trackingUrl || null;
    if (data.note !== undefined) patch.note = data.note || null;

    // Kullanıcı istemcisiyle güncelleme: RLS yönetim yetkisini doğrular.
    const { data: okRow, error } = await supabase.from("shipments").update(patch).eq("id", current.id).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!okRow) throw new Error("Bu kargoyu düzenleme yetkiniz yok");

    if (data.status && (data.status !== current.status || data.description || data.location)) {
      const { admin, applyShipmentStatus } = await import("@/lib/shipment-tracking.server");
      await applyShipmentStatus(await admin(), current.id, data.status, {
        source: "manual",
        description: data.description || null,
        location: data.location || null,
      });
    }
    void userId;

    return { ok: true };
  });

export const deleteShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ shipmentId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("shipments")
      .delete()
      .eq("id", data.shipmentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getOrderShipments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("shipments")
      .select("id, carrier, carrier_key, tracking_number, tracking_url, status, estimated_delivery_date, shipped_at, delivered_at, last_synced_at, last_sync_error, created_at, shipment_events(id, status, description, location, source, event_at)")
      .eq("order_id", data.orderId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      ...r,
      shipment_events: [...(r.shipment_events ?? [])].sort((a, b) => (a.event_at < b.event_at ? 1 : -1)),
    }));
  });

export const syncShipmentNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ shipmentId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: okRow } = await context.supabase
      .from("shipments")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.shipmentId)
      .select("id, carrier, carrier_key")
      .maybeSingle();
    if (!okRow) throw new Error("Bu kargoyu güncelleme yetkiniz yok");
    const { admin, syncActiveShipments } = await import("@/lib/shipment-tracking.server");
    const res = await syncActiveShipments(await admin(), { shipmentId: data.shipmentId, limit: 1 });
    if (res.skipped) return { ok: false, message: `${carrierName(okRow.carrier_key, okRow.carrier)} için otomatik takip bağlantısı yok; durumu elle güncelleyin.` };
    if (res.errors.length) return { ok: false, message: res.errors[0] };
    return { ok: true, message: res.updated ? "Kargo durumu güncellendi" : "Yeni hareket yok" };
  });
