import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { insertAuditRow } from "./audit.server";

/**
 * İade & geri ödeme akışı. Tenant izolasyonu RLS ile zorlanır; stok geri alımı
 * "received" durumunda denetim izli inventory_movements kayıtlarıyla yapılır.
 */

const itemSchema = z.object({
  orderItemId: z.guid(),
  quantity: z.number().int().min(1).max(999),
});

export const createReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        orderId: z.guid(),
        reason: z.enum([
          "damaged",
          "wrong_item",
          "not_as_described",
          "size_fit",
          "changed_mind",
          "other",
        ]),
        customerNote: z.string().trim().max(1000).optional(),
        restock: z.boolean().default(true),
        items: z.array(itemSchema).min(1).max(50),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, store_id, currency, customer_id, order_number")
      .eq("id", data.orderId)
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (!order) throw new Error("Sipariş bulunamadı");

    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select("id, title, variant_title, variant_id, quantity, unit_price")
      .eq("order_id", order.id);
    if (itemsError) throw new Error(itemsError.message);

    const byId = new Map((orderItems ?? []).map((row) => [row.id, row]));
    const lines = data.items.map((line) => {
      const source = byId.get(line.orderItemId);
      if (!source) throw new Error("Sipariş kalemi bulunamadı");
      const quantity = Math.min(line.quantity, source.quantity);
      return {
        order_item_id: source.id,
        variant_id: source.variant_id,
        title: source.title,
        variant_title: source.variant_title,
        quantity,
        unit_price: source.unit_price,
        line_total: Number((Number(source.unit_price) * quantity).toFixed(2)),
      };
    });

    const refundAmount = Number(
      lines.reduce((sum, line) => sum + line.line_total, 0).toFixed(2),
    );

    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

    const { data: created, error } = await supabase
      .from("return_requests")
      .insert({
        store_id: order.store_id,
        order_id: order.id,
        customer_id: order.customer_id,
        return_number: `IADE-${stamp}-${suffix}`,
        reason: data.reason,
        customer_note: data.customerNote ?? null,
        restock: data.restock,
        refund_amount: refundAmount,
        currency: order.currency,
      })
      .select("id, return_number, store_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!created) throw new Error("İade talebi oluşturulamadı");

    const { error: linesError } = await supabase.from("return_items").insert(
      lines.map((line) => ({ ...line, return_id: created.id, store_id: created.store_id })) as never,
    );
    if (linesError) throw new Error(linesError.message);

    await insertAuditRow(supabase, {
      store_id: created.store_id,
      actor_id: userId,
      action: "return.created",
      entity: "return_requests",
      entity_id: created.id,
      new_value: { return_number: created.return_number, refund_amount: refundAmount } as never,
    });

    return created;
  });

export const updateReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        returnId: z.guid(),
        status: z
          .enum(["requested", "approved", "rejected", "received", "refunded", "cancelled"])
          .optional(),
        staffNote: z.string().trim().max(1000).optional(),
        refundAmount: z.number().min(0).max(1_000_000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: current, error: currentError } = await supabase
      .from("return_requests")
      .select("id, store_id, order_id, status, restock, currency, return_number")
      .eq("id", data.returnId)
      .maybeSingle();
    if (currentError) throw new Error(currentError.message);
    if (!current) throw new Error("İade talebi bulunamadı");

    const patch: Record<string, unknown> = {};
    if (data.status) patch["status"] = data.status;
    if (data.staffNote !== undefined) patch["staff_note"] = data.staffNote || null;
    if (data.refundAmount !== undefined) patch["refund_amount"] = data.refundAmount;
    if (data.status && ["refunded", "rejected", "cancelled"].includes(data.status)) {
      patch["resolved_at"] = new Date().toISOString();
    }
    if (Object.keys(patch).length === 0) throw new Error("Güncellenecek alan yok");

    const { data: updated, error } = await supabase
      .from("return_requests")
      .update(patch as never)
      .eq("id", current.id)
      .select("id, status, refund_amount")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Bu iade talebini güncelleme yetkiniz yok");

    // Teslim alındı + stoğa geri ekleme: varyant stoklarını denetim iziyle arttır.
    if (data.status === "received" && current.status !== "received" && current.restock) {
      const { data: lines } = await supabase
        .from("return_items")
        .select("variant_id, quantity, title")
        .eq("return_id", current.id);

      for (const line of lines ?? []) {
        if (!line.variant_id) continue;
        const { data: variant } = await supabase
          .from("product_variants")
          .select("id, product_id, stock")
          .eq("id", line.variant_id)
          .maybeSingle();
        if (!variant) continue;
        const before = Number(variant.stock ?? 0);
        const after = before + Number(line.quantity ?? 0);
        await supabase.from("product_variants").update({ stock: after }).eq("id", variant.id);
        await supabase.from("inventory_movements").insert({
          store_id: current.store_id,
          product_id: variant.product_id,
          variant_id: variant.id,
          kind: "return",
          quantity: Number(line.quantity ?? 0),
          stock_before: before,
          stock_after: after,
          reason: `İade ${current.return_number}`,
          actor_id: userId,
        });
      }
    }

    // Geri ödeme: sipariş ödeme durumunu güncelle (ledger kaydı trigger ile düşer).
    if (data.status === "refunded" && current.status !== "refunded") {
      const { data: order } = await supabase
        .from("orders")
        .select("id, grand_total")
        .eq("id", current.order_id)
        .maybeSingle();
      const refunded = Number(updated.refund_amount ?? 0);
      const total = Number(order?.grand_total ?? 0);
      await supabase
        .from("orders")
        .update({
          payment_status: refunded >= total ? "refunded" : "partially_refunded",
          status: refunded >= total ? "refunded" : undefined,
        } as never)
        .eq("id", current.order_id);
    }

    await insertAuditRow(supabase, {
      store_id: current.store_id,
      actor_id: userId,
      action: "return.updated",
      entity: "return_requests",
      entity_id: current.id,
      old_value: { status: current.status } as never,
      new_value: patch as never,
    });

    return updated;
  });
