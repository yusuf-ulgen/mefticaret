/**
 * Dropshipping sipariş gönderimi. Tenant izolasyonu çağıran istemcinin RLS
 * bağlamıyla sağlanır; bu katman yalnızca iş kurallarını uygular.
 */

type Client = { from: (table: string) => any };

/**
 * Siparişi tedarikçiye iletir. Tedarikçi uç noktası tanımlıysa imzasız JSON
 * POST yapılır; tanımlı değilse kayıt "beklemede" olarak kuyruğa alınır.
 */
export async function sendDropshipOrder(
  supabase: Client,
  storeId: string,
  orderId: string,
  supplierId: string | null,
): Promise<{ id: string; status: string; error?: string }> {
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, order_number, currency, grand_total, customer_name, customer_email, customer_phone, shipping_address, order_items(id, title, sku, quantity, unit_price, variant_id)",
    )
    .eq("id", orderId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (orderError) throw new Error(orderError.message);
  if (!order) throw new Error("Sipariş bulunamadı");

  let supplier: { id: string; name: string; order_endpoint: string | null } | null = null;
  if (supplierId) {
    const { data } = await supabase
      .from("suppliers")
      .select("id, name, order_endpoint")
      .eq("id", supplierId)
      .eq("store_id", storeId)
      .maybeSingle();
    supplier = data ?? null;
  }

  const payload = {
    reference: order.order_number,
    currency: order.currency,
    customer: {
      name: order.customer_name,
      email: order.customer_email,
      phone: order.customer_phone,
    },
    shipping_address: order.shipping_address,
    items: (order.order_items ?? []).map((item: any) => ({
      sku: item.sku,
      title: item.title,
      quantity: item.quantity,
      unit_price: Number(item.unit_price ?? 0),
    })),
  };

  const { data: record, error: insertError } = await supabase
    .from("dropship_orders")
    .insert({
      store_id: storeId,
      supplier_id: supplierId,
      order_id: orderId,
      status: "pending",
      payload: payload as never,
    })
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);
  const id = (record as { id: string }).id;

  if (!supplier?.order_endpoint) {
    return { id, status: "pending" };
  }

  try {
    const response = await fetch(supplier.order_endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* düz metin yanıt */
    }
    if (!response.ok) throw new Error(`Tedarikçi yanıtı ${response.status}`);

    const external =
      parsed && typeof parsed === "object"
        ? ((parsed as Record<string, unknown>)["id"] ??
            (parsed as Record<string, unknown>)["reference"] ??
            null)
        : null;

    await supabase
      .from("dropship_orders")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        response: (typeof parsed === "object" ? parsed : { body: text }) as never,
        external_ref: external ? String(external) : null,
      })
      .eq("id", id);
    return { id, status: "sent" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gönderim başarısız";
    await supabase.from("dropship_orders").update({ status: "failed", error: message }).eq("id", id);
    return { id, status: "failed", error: message };
  }
}
