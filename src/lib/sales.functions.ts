import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { compact } from "@/lib/mefti";
import { createManualOrder, manualOrderSchema } from "@/lib/manual-order.server";

/**
 * Satış uygulama katmanı (siparişler, müşteriler, indirimler).
 * Tenant izolasyonu RLS ile zorlanır; burada doğrulama, durum geçişi ve audit yapılır.
 */

const orderStatusEnum = z.enum([
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);
const paymentStatusEnum = z.enum([
  "pending",
  "paid",
  "partially_refunded",
  "refunded",
  "failed",
]);
const fulfillmentStatusEnum = z.enum([
  "unfulfilled",
  "partially_fulfilled",
  "fulfilled",
  "returned",
]);

export const updateOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        orderId: z.string().uuid(),
        patch: z
          .object({
            status: orderStatusEnum.optional(),
            payment_status: paymentStatusEnum.optional(),
            fulfillment_status: fulfillmentStatusEnum.optional(),
            shipping_carrier: z.string().trim().max(80).nullable().optional(),
            tracking_number: z.string().trim().max(80).nullable().optional(),
            note: z.string().trim().max(2000).nullable().optional(),
          })
          .strict(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch = compact(data.patch);
    if (Object.keys(patch).length === 0) throw new Error("Güncellenecek alan yok");

    const { data: order, error } = await supabase
      .from("orders")
      .update(patch as never)
      .eq("id", data.orderId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Bu siparişi düzenleme yetkiniz yok");

    await supabase.from("order_events").insert({
      order_id: order.id,
      store_id: order.store_id,
      actor_id: userId,
      kind: data.patch.status ? "status" : "update",
      message: data.patch.status
        ? `Durum güncellendi: ${data.patch.status}`
        : "Sipariş bilgileri güncellendi",
      meta: patch as never,
    });

    await supabase.from("audit_logs").insert({
      store_id: order.store_id,
      actor_id: userId,
      action: "order.updated",
      entity: "orders",
      entity_id: order.id,
      new_value: patch as never,
    });

    return order;
  });

export const addOrderNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ orderId: z.string().uuid(), message: z.string().trim().min(1).max(1000) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, store_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (!order) throw new Error("Sipariş bulunamadı veya yetkiniz yok");

    const { error } = await supabase.from("order_events").insert({
      order_id: order.id,
      store_id: order.store_id,
      actor_id: userId,
      kind: "note",
      message: data.message,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        customerId: z.string().uuid().optional(),
        storeId: z.string().uuid(),
        fullName: z.string().trim().min(2).max(120),
        email: z.string().trim().email().max(160).optional(),
        phone: z.string().trim().max(40).optional(),
        acceptsMarketing: z.boolean().default(false),
        notes: z.string().trim().max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const payload = {
      store_id: data.storeId,
      full_name: data.fullName,
      email: data.email && data.email.length > 0 ? data.email.toLowerCase() : null,
      phone: data.phone && data.phone.length > 0 ? data.phone : null,
      accepts_marketing: data.acceptsMarketing,
      notes: data.notes && data.notes.length > 0 ? data.notes : null,
    };

    const query = data.customerId
      ? supabase.from("customers").update(payload).eq("id", data.customerId)
      : supabase.from("customers").insert(payload);

    const { data: customer, error } = await query.select("*").maybeSingle();
    if (error) throw new Error(error.message);
    if (!customer) throw new Error("Müşteri kaydedilemedi");

    await supabase.from("audit_logs").insert({
      store_id: data.storeId,
      actor_id: userId,
      action: data.customerId ? "customer.updated" : "customer.created",
      entity: "customers",
      entity_id: customer.id,
      new_value: { full_name: customer.full_name, email: customer.email } as never,
    });

    return customer;
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ customerId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: customer, error } = await supabase
      .from("customers")
      .delete()
      .eq("id", data.customerId)
      .select("id, store_id, full_name")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!customer) throw new Error("Bu müşteriyi silme yetkiniz yok");

    await supabase.from("audit_logs").insert({
      store_id: customer.store_id,
      actor_id: userId,
      action: "customer.deleted",
      entity: "customers",
      entity_id: customer.id,
      old_value: { full_name: customer.full_name } as never,
    });
    return { id: customer.id };
  });

export const upsertDiscount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        discountId: z.string().uuid().optional(),
        storeId: z.string().uuid(),
        code: z
          .string()
          .trim()
          .min(3)
          .max(32)
          .regex(/^[A-Za-z0-9-_]+$/, "Kod yalnızca harf, rakam, - ve _ içerebilir"),
        title: z.string().trim().max(120).optional(),
        type: z.enum(["percentage", "fixed_amount", "free_shipping"]),
        value: z.number().min(0).max(1_000_000),
        minSubtotal: z.number().min(0).max(1_000_000).default(0),
        usageLimit: z.number().int().min(0).max(1_000_000).nullable().optional(),
        endsAt: z.string().trim().max(40).optional(),
        isActive: z.boolean().default(true),
      })
      .superRefine((value, ctx) => {
        if (value.type === "percentage" && value.value > 100) {
          ctx.addIssue({ code: "custom", message: "Yüzde indirim 100'den büyük olamaz" });
        }
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const payload = {
      store_id: data.storeId,
      code: data.code.toUpperCase(),
      title: data.title && data.title.length > 0 ? data.title : null,
      type: data.type,
      value: data.type === "free_shipping" ? 0 : data.value,
      min_subtotal: data.minSubtotal,
      usage_limit: data.usageLimit ?? null,
      ends_at: data.endsAt && data.endsAt.length > 0 ? new Date(data.endsAt).toISOString() : null,
      is_active: data.isActive,
    };

    const query = data.discountId
      ? supabase.from("discounts").update(payload).eq("id", data.discountId)
      : supabase.from("discounts").insert(payload);

    const { data: discount, error } = await query.select("*").maybeSingle();
    if (error) {
      if (error.code === "23505" || error.message.includes("discounts_store_code_key")) {
        throw new Error("Bu kupon kodu bu mağazada zaten kullanılıyor");
      }
      throw new Error(error.message);
    }
    if (!discount) throw new Error("Kupon kaydedilemedi");

    await supabase.from("audit_logs").insert({
      store_id: data.storeId,
      actor_id: userId,
      action: data.discountId ? "discount.updated" : "discount.created",
      entity: "discounts",
      entity_id: discount.id,
      new_value: { code: discount.code, type: discount.type, value: discount.value } as never,
    });

    return discount;
  });

export const toggleDiscount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ discountId: z.string().uuid(), isActive: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: discount, error } = await supabase
      .from("discounts")
      .update({ is_active: data.isActive })
      .eq("id", data.discountId)
      .select("id, is_active")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!discount) throw new Error("Bu kuponu düzenleme yetkiniz yok");
    return discount;
  });

export const createManualOrderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => manualOrderSchema.parse(data))
  .handler(async ({ data, context }) => createManualOrder(context.supabase, data));
