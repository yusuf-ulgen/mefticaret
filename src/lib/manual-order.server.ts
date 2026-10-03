import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

/**
 * Panelden manuel sipariş oluşturma (telefon/whatsapp siparişleri).
 * Yazma işlemleri oturum açmış personelin RLS bağlamında yapılır; fiyat ve
 * stok daima veritabanından doğrulanır, istemciden gelen tutarlara güvenilmez.
 */

type Client = SupabaseClient<Database>;

export const manualOrderSchema = z.object({
  storeId: z.guid(),
  customer: z.object({
    fullName: z.string().trim().min(2).max(120),
    // WhatsApp/telefon siparişlerinde e-posta olmayabilir; telefon yeterlidir.
    email: z.string().trim().email().max(160).optional().nullable(),
    phone: z.string().trim().max(40).optional().nullable(),
  }),
  /** Siparişin nereden geldiği: whatsapp, phone veya manual. */
  source: z.enum(["manual", "whatsapp", "phone", "pos"]).default("manual"),
  /** Perakende (mağaza kasası) satışlarında ödeme şekli. */
  posPaymentMethod: z.enum(["cash", "card", "transfer"]).optional().nullable(),
  address: z
    .object({
      city: z.string().trim().max(80).optional().nullable(),
      district: z.string().trim().max(80).optional().nullable(),
      line1: z.string().trim().max(300).optional().nullable(),
      postalCode: z.string().trim().max(20).optional().nullable(),
    })
    .optional(),
  items: z
    .array(
      z.object({
        variantId: z.guid(),
        quantity: z.number().int().min(1).max(999),
      }),
    )
    .min(1)
    .max(50),
  shippingTotal: z.number().min(0).max(1_000_000).default(0),
  discountTotal: z.number().min(0).max(1_000_000).default(0),
  paymentStatus: z.enum(["pending", "paid"]).default("pending"),
  note: z.string().trim().max(1000).optional().nullable(),
});

export type ManualOrderInput = z.infer<typeof manualOrderSchema>;

function orderNumber() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.floor(Math.random() * 46_656)
    .toString(36)
    .toUpperCase()
    .padStart(3, "0");
  return `MEF-${stamp}${rand}`;
}

export async function createManualOrder(supabase: Client, input: ManualOrderInput) {
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, currency")
    .eq("id", input.storeId)
    .maybeSingle();
  if (storeError) throw new Error(storeError.message);
  if (!store) throw new Error("Mağazaya erişiminiz yok.");

  const variantIds = [...new Set(input.items.map((item) => item.variantId))];
  const { data: variants, error: variantsError } = await supabase
    .from("product_variants")
    .select("id, product_id, title, sku, price, stock, products!inner(id, title, base_price, store_id)")
    .eq("store_id", store.id)
    .in("id", variantIds);
  if (variantsError) throw new Error(variantsError.message);

  type VariantRow = NonNullable<typeof variants>[number] & {
    products: { id: string; title: string; base_price: number; store_id: string };
  };
  const rows = (variants ?? []) as VariantRow[];

  const lines = input.items.map((item) => {
    const variant = rows.find((row) => row.id === item.variantId);
    if (!variant) throw new Error("Seçilen ürün bu mağazada bulunamadı.");
    const unitPrice = Number(variant.price ?? variant.products.base_price);
    return {
      variant,
      quantity: item.quantity,
      unitPrice,
      lineTotal: Number((unitPrice * item.quantity).toFixed(2)),
    };
  });

  const subtotal = Number(lines.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2));
  const discountTotal = Math.min(subtotal, Number(input.discountTotal.toFixed(2)));
  const shippingTotal = Number(input.shippingTotal.toFixed(2));

  const { data: settings } = await supabase
    .from("store_settings")
    .select("default_tax_rate, tax_included_prices")
    .eq("store_id", store.id)
    .maybeSingle();
  const taxRate = Number(settings?.default_tax_rate ?? 0);
  const taxable = Math.max(0, subtotal - discountTotal);
  const taxTotal = settings?.tax_included_prices ? 0 : Number(((taxable * taxRate) / 100).toFixed(2));
  const grandTotal = Number((taxable + shippingTotal + taxTotal).toFixed(2));

  const email = input.customer.email?.trim().toLowerCase() || null;
  const phone = input.customer.phone?.trim() || null;
  if (!email && !phone) throw new Error("Müşteri için telefon veya e-posta gerekli.");

  // Aynı müşteriyi iki kez açmamak için önce e-posta, yoksa telefon ile eşleşme aranır.
  const matcher = supabase
    .from("customers")
    .select("id, orders_count, total_spent")
    .eq("store_id", store.id);
  const { data: existingCustomer } = email
    ? await matcher.ilike("email", email).maybeSingle()
    : await matcher.eq("phone", phone!).maybeSingle();

  let customerId = existingCustomer?.id ?? null;
  if (!customerId) {
    const { data: inserted, error: customerError } = await supabase
      .from("customers")
      .insert({
        store_id: store.id,
        full_name: input.customer.fullName,
        email,
        phone,
      })
      .select("id")
      .single();
    if (customerError) throw new Error(customerError.message);
    customerId = inserted.id;
  }

  const addressJson = input.address
    ? {
        recipient: input.customer.fullName,
        phone: input.customer.phone ?? null,
        city: input.address.city ?? null,
        district: input.address.district ?? null,
        line1: input.address.line1 ?? null,
        postal_code: input.address.postalCode ?? null,
      }
    : null;

  const number = orderNumber();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      store_id: store.id,
      customer_id: customerId,
      order_number: number,
      status: "processing",
      payment_status: input.paymentStatus,
      fulfillment_status: "unfulfilled",
      currency: store.currency,
      subtotal,
      discount_total: discountTotal,
      shipping_total: shippingTotal,
      tax_total: taxTotal,
      grand_total: grandTotal,
      customer_email: email,
      customer_phone: phone,
      customer_name: input.customer.fullName,
      shipping_address: addressJson,
      billing_address: addressJson,
      note: input.note?.length ? input.note : null,
    })
    .select("id, order_number, grand_total, currency")
    .single();
  if (orderError) throw new Error(orderError.message);

  const { error: itemsError } = await supabase.from("order_items").insert(
    lines.map((line) => ({
      order_id: order.id,
      store_id: store.id,
      product_id: line.variant.product_id,
      variant_id: line.variant.id,
      title: line.variant.products.title,
      variant_title: line.variant.title,
      sku: line.variant.sku,
      unit_price: line.unitPrice,
      quantity: line.quantity,
      line_total: line.lineTotal,
    })),
  );
  if (itemsError) throw new Error(itemsError.message);

  for (const line of lines) {
    const before = line.variant.stock ?? 0;
    const after = Math.max(0, before - line.quantity);
    await supabase.from("product_variants").update({ stock: after }).eq("id", line.variant.id);
    await supabase.from("inventory_movements").insert({
      store_id: store.id,
      product_id: line.variant.product_id,
      variant_id: line.variant.id,
      kind: "sale",
      quantity: line.quantity,
      stock_before: before,
      stock_after: after,
      reason: `Manuel sipariş ${number}`,
    });
  }

  const sourceLabel =
    input.source === "whatsapp"
      ? "WhatsApp siparişi panele kaydedildi"
      : input.source === "pos"
        ? "Perakende satış (mağaza kasası) kaydedildi"
      : input.source === "phone"
        ? "Telefon siparişi panele kaydedildi"
        : "Panelden manuel sipariş oluşturuldu";
  await supabase.from("order_events").insert({
    order_id: order.id,
    store_id: store.id,
    kind: "created",
    message: sourceLabel,
    meta: { source: input.source, pos_payment_method: input.posPaymentMethod ?? null },
  });

  if (existingCustomer) {
    await supabase
      .from("customers")
      .update({
        orders_count: (existingCustomer.orders_count ?? 0) + 1,
        total_spent: Number(existingCustomer.total_spent ?? 0) + grandTotal,
      })
      .eq("id", existingCustomer.id);
  } else if (customerId) {
    await supabase.from("customers").update({ orders_count: 1, total_spent: grandTotal }).eq("id", customerId);
  }

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    grandTotal: Number(order.grand_total),
    currency: order.currency,
  };
}
