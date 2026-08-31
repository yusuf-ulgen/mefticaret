/**
 * Satın alma siparişi mal kabul katmanı.
 * Teslim alınan adetler varyant stoğuna eklenir ve her satır için
 * denetim izli `restock` stok hareketi yazılır.
 */

type Client = { from: (table: string) => any };

export type ReceiveLine = { itemId: string; quantity: number };

export type ReceiveResult = {
  received: { itemId: string; title: string; quantity: number; stockAfter: number | null }[];
  skipped: { itemId: string; reason: string }[];
  status: "ordered" | "received";
};

export async function receivePurchaseOrder(
  supabase: Client,
  storeId: string,
  actorId: string,
  purchaseOrderId: string,
  lines: ReceiveLine[],
): Promise<ReceiveResult> {
  const { data: order, error: orderError } = await supabase
    .from("purchase_orders")
    .select("id, status, code")
    .eq("id", purchaseOrderId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (orderError) throw new Error(orderError.message);
  if (!order) throw new Error("Satın alma siparişi bulunamadı");
  if (order.status === "cancelled") throw new Error("İptal edilmiş sipariş mal kabul edilemez");

  const { data: items, error: itemsError } = await supabase
    .from("purchase_order_items")
    .select("id, product_id, variant_id, title, quantity, received_quantity")
    .eq("purchase_order_id", purchaseOrderId)
    .eq("store_id", storeId);
  if (itemsError) throw new Error(itemsError.message);

  const itemMap = new Map<string, any>((items ?? []).map((item: any) => [item.id, item]));
  const result: ReceiveResult = { received: [], skipped: [], status: "ordered" };

  for (const line of lines) {
    const item = itemMap.get(line.itemId);
    if (!item) {
      result.skipped.push({ itemId: line.itemId, reason: "Kalem bulunamadı" });
      continue;
    }
    const remaining = item.quantity - item.received_quantity;
    const quantity = Math.min(line.quantity, Math.max(remaining, 0));
    if (quantity <= 0) {
      result.skipped.push({ itemId: line.itemId, reason: "Teslim alınacak adet kalmadı" });
      continue;
    }

    let stockAfter: number | null = null;
    if (item.variant_id) {
      const { data: variant, error: variantError } = await supabase
        .from("product_variants")
        .select("id, product_id, stock")
        .eq("id", item.variant_id)
        .eq("store_id", storeId)
        .maybeSingle();
      if (variantError || !variant) {
        result.skipped.push({ itemId: line.itemId, reason: "Varyant bulunamadı" });
        continue;
      }
      const before = variant.stock ?? 0;
      const after = before + quantity;
      const { error: updateError } = await supabase
        .from("product_variants")
        .update({ stock: after })
        .eq("id", variant.id);
      if (updateError) {
        result.skipped.push({ itemId: line.itemId, reason: updateError.message });
        continue;
      }
      const { error: moveError } = await supabase.from("inventory_movements").insert({
        store_id: storeId,
        product_id: variant.product_id,
        variant_id: variant.id,
        kind: "restock",
        quantity,
        stock_before: before,
        stock_after: after,
        reason: `Mal kabul · ${order.code}`,
        actor_id: actorId,
      });
      if (moveError) {
        result.skipped.push({ itemId: line.itemId, reason: moveError.message });
        continue;
      }
      stockAfter = after;
    }

    const { error: itemUpdateError } = await supabase
      .from("purchase_order_items")
      .update({ received_quantity: item.received_quantity + quantity })
      .eq("id", item.id);
    if (itemUpdateError) {
      result.skipped.push({ itemId: line.itemId, reason: itemUpdateError.message });
      continue;
    }
    item.received_quantity += quantity;
    result.received.push({ itemId: item.id, title: item.title, quantity, stockAfter });
  }

  const fullyReceived = Array.from(itemMap.values()).every(
    (item: any) => item.received_quantity >= item.quantity,
  );
  result.status = fullyReceived ? "received" : "ordered";

  const { error: statusError } = await supabase
    .from("purchase_orders")
    .update({
      status: result.status,
      received_at: fullyReceived ? new Date().toISOString() : null,
    })
    .eq("id", purchaseOrderId)
    .eq("store_id", storeId);
  if (statusError) throw new Error(statusError.message);

  return result;
}
