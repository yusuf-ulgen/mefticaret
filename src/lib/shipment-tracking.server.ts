import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  ACTIVE_SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABELS,
  type ShipmentStatus,
} from "@/lib/carriers";

/**
 * Kargo durum değişikliklerinin tek giriş noktası (yalnız sunucu, service role).
 * Hareket kaydı yazar, sipariş durumunu eşitler ve müşteri bildirimini tetikler.
 */

type Db = SupabaseClient<Database>;

export async function admin(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as Db;
}

export async function applyShipmentStatus(
  db: Db,
  shipmentId: string,
  status: ShipmentStatus,
  opts: {
    description?: string | null;
    location?: string | null;
    eventAt?: string;
    source?: "manual" | "carrier" | "system";
    notify?: boolean;
  } = {},
) {
  const { data: s, error: shipmentError } = await db
    .from("shipments")
    .select("id, store_id, order_id, status, shipped_at")
    .eq("id", shipmentId)
    .maybeSingle();
  if (shipmentError) throw new Error(shipmentError.message);
  if (!s) throw new Error("Kargo bulunamadı");
  const at = opts.eventAt ?? new Date().toISOString();

  await db.from("shipment_events").upsert(
    {
      shipment_id: s.id,
      store_id: s.store_id,
      status,
      description: opts.description ?? SHIPMENT_STATUS_LABELS[status] ?? status,
      location: opts.location ?? null,
      source: opts.source ?? "manual",
      event_at: at,
    },
    { onConflict: "shipment_id,status,event_at", ignoreDuplicates: true },
  );

  if (s.status === status) return { changed: false };

  const patch: Database["public"]["Tables"]["shipments"]["Update"] = { status };
  if (status !== "pending" && !s.shipped_at) patch.shipped_at = at;
  if (status === "delivered") patch.delivered_at = at;
  const { error: updateError } = await db.from("shipments").update(patch).eq("id", s.id);
  if (updateError) throw new Error(updateError.message);
  const { data: order, error: orderError } = await db
    .from("orders")
    .select("status, fulfillment_status")
    .eq("id", s.order_id)
    .single();
  if (orderError) throw new Error(orderError.message);

  const orderPatch: Database["public"]["Tables"]["orders"]["Update"] = {};
  if (["picked_up", "in_transit", "out_for_delivery"].includes(status)) {
    orderPatch.status = "shipped";
  } else if (status === "delivered") {
    orderPatch.status = order.fulfillment_status === "fulfilled" ? "delivered" : "processing";
  }
  if (["cancelled", "returned", "refunded"].includes(order.status)) delete orderPatch.status;
  if (Object.keys(orderPatch).length) {
    const { error } = await db
      .from("orders")
      .update(orderPatch)
      .eq("id", s.order_id)
      .eq("status", order.status);
    if (error) throw new Error(error.message);
  }

  await db.from("order_events").insert({
    order_id: s.order_id,
    store_id: s.store_id,
    kind: "shipment",
    message: `Kargo durumu: ${SHIPMENT_STATUS_LABELS[status] ?? status}`,
    meta: { shipment_id: s.id, status, source: opts.source ?? "manual" },
  });

  if (opts.notify !== false) {
    const { dispatchCustomerEvent, eventForShipmentStatus } =
      await import("@/lib/customer-notify.server");
    const event = eventForShipmentStatus(status);
    if (event) await dispatchCustomerEvent(s.order_id, event, { shipmentId: s.id }, db);
  }
  return { changed: true };
}

/** Taşıyıcı API'si olan açık kargoları günceller. Şimdilik yalnız Aras. */
export async function syncActiveShipments(
  db: Db,
  options: { storeId?: string; shipmentId?: string; limit?: number } = {},
) {
  let q = db
    .from("shipments")
    .select("id, carrier, carrier_key, tracking_number, note, status")
    .in("status", ACTIVE_SHIPMENT_STATUSES)
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(options.limit ?? 100);
  if (options.storeId) q = q.eq("store_id", options.storeId);
  if (options.shipmentId) q = q.eq("id", options.shipmentId);
  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);

  let checked = 0,
    updated = 0,
    skipped = 0;
  const errors: string[] = [];
  for (const row of rows ?? []) {
    const isAras = row.carrier_key === "aras" || /aras/i.test(row.carrier ?? "");
    if (!isAras) {
      skipped += 1;
      continue;
    }
    const code = (row.note ?? "").trim() || row.tracking_number;
    if (!code) {
      skipped += 1;
      continue;
    }
    checked += 1;
    try {
      const { queryArasShipment, arasTrackingUrl } = await import("@/lib/aras.server");
      const info = await queryArasShipment(code);
      const patch: Database["public"]["Tables"]["shipments"]["Update"] = {
        last_synced_at: new Date().toISOString(),
        last_sync_error: null,
      };
      if (info.trackingNumber && info.trackingNumber !== row.tracking_number) {
        patch.tracking_number = info.trackingNumber;
        patch.tracking_url = arasTrackingUrl(info.trackingNumber, code);
      }
      await db.from("shipments").update(patch).eq("id", row.id);
      const res = await applyShipmentStatus(db, row.id, info.status as ShipmentStatus, {
        source: "carrier",
        ...(info.status === "delivered" && info.deliveredAt ? { eventAt: info.deliveredAt } : {}),
      });
      if (res.changed) updated += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Senkron hatası";
      errors.push(msg);
      await db
        .from("shipments")
        .update({ last_synced_at: new Date().toISOString(), last_sync_error: msg.slice(0, 300) })
        .eq("id", row.id);
    }
  }
  return { checked, updated, skipped, errors };
}
