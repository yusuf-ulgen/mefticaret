import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sevkiyat (kargo) yönetimi. Tenant izolasyonu RLS ile zorlanır; sipariş kargo
 * durumu veritabanı tetikleyicisi ile otomatik senkronize edilir.
 */

const statusSchema = z.enum(["pending", "in_transit", "delivered", "returned", "cancelled"]);

export const createShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        orderId: z.string().uuid(),
        carrier: z.string().trim().min(2).max(80),
        trackingNumber: z.string().trim().max(120).optional(),
        trackingUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
        status: statusSchema.default("pending"),
        note: z.string().trim().max(500).optional(),
        items: z
          .array(
            z.object({
              orderItemId: z.string().uuid(),
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
        tracking_url: data.trackingUrl || null,
        status: data.status,
        note: data.note || null,
        shipped_at: data.status === "pending" ? null : now,
        delivered_at: data.status === "delivered" ? now : null,
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

    return { id: shipment.id };
  });

export const updateShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        shipmentId: z.string().uuid(),
        status: statusSchema.optional(),
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

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {};
    if (data.carrier !== undefined) patch.carrier = data.carrier;
    if (data.trackingNumber !== undefined) patch.tracking_number = data.trackingNumber || null;
    if (data.trackingUrl !== undefined) patch.tracking_url = data.trackingUrl || null;
    if (data.note !== undefined) patch.note = data.note || null;
    if (data.status !== undefined) {
      patch.status = data.status;
      if (data.status !== "pending" && !current.shipped_at) patch.shipped_at = now;
      patch.delivered_at = data.status === "delivered" ? now : null;
    }

    const { error } = await supabase.from("shipments").update(patch).eq("id", current.id);
    if (error) throw new Error(error.message);

    if (data.status && data.status !== current.status) {
      await supabase.from("order_events").insert({
        order_id: current.order_id,
        store_id: current.store_id,
        actor_id: userId,
        kind: "shipment",
        message: `Sevkiyat durumu güncellendi: ${data.status}`,
        meta: { shipment_id: current.id, status: data.status },
      });
    }

    return { ok: true };
  });

export const deleteShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ shipmentId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("shipments")
      .delete()
      .eq("id", data.shipmentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
