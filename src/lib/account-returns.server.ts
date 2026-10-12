import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { findMyCustomer } from "@/lib/account.server";

/**
 * Vitrin müşteri self-servis iade talepleri (yalnızca sunucu).
 * Tüm işlemler oturum açmış kullanıcı olarak RLS altında yapılır; müşteri
 * yalnızca kendi siparişleri için talep açabilir ve yalnızca henüz işleme
 * alınmamış ("requested") taleplerini iptal edebilir.
 */

type Client = SupabaseClient<Database>;

export type MyReturn = {
  id: string;
  return_number: string;
  status: string;
  reason: string;
  refund_amount: number;
  currency: string;
  customer_note: string | null;
  staff_note: string | null;
  created_at: string;
  resolved_at: string | null;
  orders: { order_number: string } | null;
  return_items: {
    id: string;
    title: string;
    variant_title: string | null;
    quantity: number;
    line_total: number;
  }[];
};

export const createReturnSchema = z.object({
  storeId: z.guid(),
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
  items: z
    .array(z.object({ orderItemId: z.guid(), quantity: z.number().int().min(1).max(999) }))
    .min(1)
    .max(50),
});

export const cancelReturnSchema = z.object({
  storeId: z.guid(),
  returnId: z.guid(),
});

export async function listMyReturns(
  supabase: Client,
  userId: string,
  storeId: string,
): Promise<MyReturn[]> {
  const customer = await findMyCustomer(supabase, userId, storeId);
  if (!customer) return [];
  const { data, error } = await supabase
    .from("return_requests")
    .select(
      "id, return_number, status, reason, refund_amount, currency, customer_note, staff_note, created_at, resolved_at, orders(order_number), return_items(id, title, variant_title, quantity, line_total)",
    )
    .eq("store_id", storeId)
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MyReturn[];
}

export async function createMyReturn(
  supabase: Client,
  userId: string,
  input: z.infer<typeof createReturnSchema>,
) {
  const customer = await findMyCustomer(supabase, userId, input.storeId);
  if (!customer) throw new Error("Mağaza hesabınız bulunamadı.");

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, store_id, currency, order_number, payment_status")
    .eq("id", input.orderId)
    .eq("store_id", input.storeId)
    .eq("customer_id", customer.id)
    .maybeSingle();
  if (orderError) throw new Error(orderError.message);
  if (!order) throw new Error("Sipariş bulunamadı.");
  if (!["paid", "partially_refunded"].includes(order.payment_status)) {
    throw new Error("Yalnızca ödemesi tamamlanmış siparişler için iade talebi açabilirsiniz.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("return_requests")
    .select("id, return_number, status")
    .eq("order_id", order.id)
    .not("status", "in", "(rejected,cancelled)")
    .limit(1);
  if (existingError) throw new Error(existingError.message);
  if (existing && existing.length > 0) {
    throw new Error(`Bu sipariş için zaten açık bir iade talebiniz var (${existing[0]!.return_number}).`);
  }

  const { data: orderItems, error: itemsError } = await supabase
    .from("order_items")
    .select("id, title, variant_title, variant_id, quantity, unit_price")
    .eq("order_id", order.id);
  if (itemsError) throw new Error(itemsError.message);

  const byId = new Map((orderItems ?? []).map((row) => [row.id, row]));
  const lines = input.items.map((line) => {
    const source = byId.get(line.orderItemId);
    if (!source) throw new Error("Sipariş kalemi bulunamadı.");
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

  const refundAmount = Number(lines.reduce((sum, line) => sum + line.line_total, 0).toFixed(2));
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

  const { data: created, error } = await supabase
    .from("return_requests")
    .insert({
      store_id: order.store_id,
      order_id: order.id,
      customer_id: customer.id,
      return_number: `IADE-${stamp}-${suffix}`,
      reason: input.reason,
      customer_note: input.customerNote ?? null,
      restock: true,
      refund_amount: refundAmount,
      currency: order.currency,
    })
    .select("id, return_number, store_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!created) throw new Error("İade talebi oluşturulamadı.");

  const { error: linesError } = await supabase.from("return_items").insert(
    lines.map((line) => ({ ...line, return_id: created.id, store_id: created.store_id })) as never,
  );
  if (linesError) throw new Error(linesError.message);

  return { id: created.id, returnNumber: created.return_number, refundAmount };
}

export async function cancelMyReturn(
  supabase: Client,
  userId: string,
  input: z.infer<typeof cancelReturnSchema>,
) {
  const customer = await findMyCustomer(supabase, userId, input.storeId);
  if (!customer) throw new Error("Mağaza hesabınız bulunamadı.");

  const { data: updated, error } = await supabase
    .from("return_requests")
    .update({ status: "cancelled", resolved_at: new Date().toISOString() } as never)
    .eq("id", input.returnId)
    .eq("customer_id", customer.id)
    .eq("status", "requested")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) throw new Error("Bu talep artık iptal edilemez.");
  return { ok: true };
}
