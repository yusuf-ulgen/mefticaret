import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const storeGuard = async (supabase: any, storeId: string) => {
  const { data, error } = await supabase
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Mağaza bulunamadı veya yetkiniz yok");
};

export const saveSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        id: z.guid().optional(),
        name: z.string().trim().min(2).max(120),
        contactName: z.string().trim().max(120).optional(),
        email: z.string().trim().email().max(160).optional().or(z.literal("")),
        phone: z.string().trim().max(40).optional(),
        taxNumber: z.string().trim().max(40).optional(),
        address: z.string().trim().max(400).optional(),
        note: z.string().trim().max(400).optional(),
        isActive: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await storeGuard(supabase, data.storeId);

    const payload = {
      store_id: data.storeId,
      name: data.name,
      contact_name: data.contactName || null,
      email: data.email || null,
      phone: data.phone || null,
      tax_number: data.taxNumber || null,
      address: data.address || null,
      note: data.note || null,
      is_active: data.isActive,
    };

    if (data.id) {
      const { error } = await supabase
        .from("suppliers")
        .update(payload)
        .eq("id", data.id)
        .eq("store_id", data.storeId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: inserted, error } = await supabase
      .from("suppliers")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (inserted as { id: string }).id };
  });

export const createPurchaseOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        code: z.string().trim().min(3).max(40),
        supplierId: z.guid().optional(),
        expectedAt: z.string().trim().max(20).optional(),
        note: z.string().trim().max(400).optional(),
        items: z
          .array(
            z.object({
              variantId: z.guid(),
              productId: z.guid().optional(),
              title: z.string().trim().min(1).max(200),
              sku: z.string().trim().max(80).optional(),
              quantity: z.number().int().min(1).max(100_000),
              unitCost: z.number().min(0).max(10_000_000),
            }),
          )
          .min(1)
          .max(200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await storeGuard(supabase, data.storeId);

    const { data: order, error } = await supabase
      .from("purchase_orders")
      .insert({
        store_id: data.storeId,
        code: data.code,
        supplier_id: data.supplierId ?? null,
        expected_at: data.expectedAt || null,
        note: data.note || null,
        status: "ordered",
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const orderId = (order as { id: string }).id;
    const { error: itemsError } = await supabase.from("purchase_order_items").insert(
      data.items.map((item) => ({
        store_id: data.storeId,
        purchase_order_id: orderId,
        variant_id: item.variantId,
        product_id: item.productId ?? null,
        title: item.title,
        sku: item.sku || null,
        quantity: item.quantity,
        unit_cost: item.unitCost,
      })),
    );
    if (itemsError) {
      await supabase.from("purchase_orders").delete().eq("id", orderId);
      throw new Error(itemsError.message);
    }

    return { id: orderId };
  });

export const receivePurchaseOrderLines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        purchaseOrderId: z.guid(),
        lines: z
          .array(
            z.object({
              itemId: z.guid(),
              quantity: z.number().int().min(1).max(100_000),
            }),
          )
          .min(1)
          .max(200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await storeGuard(supabase, data.storeId);
    const { receivePurchaseOrder } = await import("@/lib/purchasing.server");
    return receivePurchaseOrder(
      supabase as never,
      data.storeId,
      userId,
      data.purchaseOrderId,
      data.lines,
    );
  });

export const setPurchaseOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        purchaseOrderId: z.guid(),
        status: z.enum(["draft", "ordered", "cancelled"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await storeGuard(supabase, data.storeId);
    const { error } = await supabase
      .from("purchase_orders")
      .update({ status: data.status })
      .eq("id", data.purchaseOrderId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
