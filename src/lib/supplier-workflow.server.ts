/**
 * Tedarikçi iş akışı (satın alma siparişi, mesajlaşma, XML besleme, ödeme)
 * sunucu yardımcıları. Çağıranlar yetkiyi daima önce doğrular; burada yalnız
 * doğrulanmış kimliklerle ayrıcalıklı istemci kullanılır.
 */

type Client = { from: (table: string) => any };

export type WorkflowPurchaseOrder = {
  id: string;
  storeId: string;
  supplierId: string;
  code: string;
  status: string;
  supplierStatus: string;
  paymentStatus: string;
  paidAmount: number | null;
  paidAt: string | null;
  paymentProvider: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  currency: string;
  expectedAt: string | null;
  note: string | null;
  createdAt: string;
  total: number;
  items: { id: string; title: string; sku: string | null; quantity: number; unitCost: number }[];
};

export async function loadPurchaseOrders(
  admin: Client,
  filter: { supplierIds?: string[]; storeId?: string; ids?: string[] },
  limit = 100,
): Promise<WorkflowPurchaseOrder[]> {
  let query = admin
    .from("purchase_orders")
    .select(
      "id, store_id, supplier_id, code, status, supplier_status, payment_status, paid_amount, paid_at, payment_provider, carrier, tracking_number, shipped_at, currency, expected_at, note, created_at, purchase_order_items(id, title, sku, quantity, unit_cost)",
    )
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (filter.supplierIds) query = query.in("supplier_id", filter.supplierIds.length ? filter.supplierIds : ["00000000-0000-0000-0000-000000000000"]);
  if (filter.storeId) query = query.eq("store_id", filter.storeId);
  if (filter.ids) query = query.in("id", filter.ids);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((row) => {
    const items = ((row.purchase_order_items ?? []) as any[]).map((item) => ({
      id: String(item.id),
      title: String(item.title),
      sku: item.sku ?? null,
      quantity: Number(item.quantity) || 0,
      unitCost: Number(item.unit_cost) || 0,
    }));
    return {
      id: row.id,
      storeId: row.store_id,
      supplierId: row.supplier_id,
      code: row.code,
      status: row.status,
      supplierStatus: row.supplier_status,
      paymentStatus: row.payment_status,
      paidAmount: row.paid_amount === null ? null : Number(row.paid_amount),
      paidAt: row.paid_at,
      paymentProvider: row.payment_provider,
      carrier: row.carrier,
      trackingNumber: row.tracking_number,
      shippedAt: row.shipped_at,
      currency: row.currency || "TRY",
      expectedAt: row.expected_at,
      note: row.note,
      createdAt: row.created_at,
      total: Math.round(items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0) * 100) / 100,
      items,
    };
  });
}

export type WorkflowMessage = {
  id: string;
  supplierId: string;
  purchaseOrderId: string | null;
  senderRole: "store" | "supplier" | "admin";
  body: string;
  createdAt: string;
  readAt: string | null;
};

export async function loadMessages(admin: Client, supplierId: string, limit = 200): Promise<WorkflowMessage[]> {
  const { data, error } = await admin
    .from("supplier_messages")
    .select("id, supplier_id, purchase_order_id, sender_role, body, created_at, read_at")
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[])
    .map((row) => ({
      id: row.id,
      supplierId: row.supplier_id,
      purchaseOrderId: row.purchase_order_id,
      senderRole: row.sender_role,
      body: row.body,
      createdAt: row.created_at,
      readAt: row.read_at,
    }))
    .reverse();
}

/** Karşı tarafın mesajlarını okundu işaretler. */
export async function markRead(admin: Client, supplierId: string, readerRole: "store" | "supplier") {
  await admin
    .from("supplier_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("supplier_id", supplierId)
    .neq("sender_role", readerRole)
    .is("read_at", null);
}

/* ------------------------------ XML besleme ------------------------------ */

const toNumber = (value: string) => {
  const cleaned = value.replace(/[^\d,.-]/g, "");
  const normalized = cleaned.includes(",") && !cleaned.includes(".") ? cleaned.replace(",", ".") : cleaned.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Tedarikçi XML'ini indirir, eşleştirir ve tedarikçi ürünlerine yazar. */
export async function runSupplierFeed(
  admin: Client,
  feed: { id: string; supplier_id: string; store_id: string; source_url: string; field_mapping: Record<string, string> },
  currency: string,
) {
  const { fetchSource } = await import("@/lib/xml-integrator.server");
  const { parseSourceText, suggestMapping, readMapped } = await import("@/lib/xml-integrator");
  const startedAt = new Date().toISOString();
  try {
    const fetched = await fetchSource({ url: feed.source_url });
    const parsed = parseSourceText(fetched.content, fetched.format, { limit: 5000 });
    const mapping = Object.keys(feed.field_mapping ?? {}).length ? feed.field_mapping : suggestMapping(parsed.columns);
    if (!mapping["sku"] || !mapping["title"]) {
      throw new Error("XML içinde stok kodu ve ürün adı alanları bulunamadı");
    }

    const { data: existing } = await admin
      .from("supplier_products")
      .select("id, external_id")
      .eq("supplier_id", feed.supplier_id);
    const byExternal = new Map(((existing ?? []) as any[]).map((row) => [String(row.external_id ?? ""), String(row.id)]));

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const inserts: any[] = [];
    const updates: { id: string; patch: any }[] = [];
    const seen = new Set<string>();

    for (const row of parsed.rows) {
      const sku = readMapped(row, mapping["sku"]);
      const title = readMapped(row, mapping["title"]);
      if (!sku || !title || seen.has(sku)) {
        skipped += 1;
        continue;
      }
      seen.add(sku);
      const imagesRaw = readMapped(row, mapping["images"]);
      const record = {
        store_id: feed.store_id,
        supplier_id: feed.supplier_id,
        external_id: sku,
        sku,
        barcode: readMapped(row, mapping["barcode"]) || null,
        title: title.slice(0, 400),
        brand: readMapped(row, mapping["brand"]) || null,
        category: readMapped(row, mapping["category"]) || null,
        supplier_price: toNumber(readMapped(row, mapping["cost_price"]) || readMapped(row, mapping["price"])),
        currency: ((c) => (c === "TL" || c === "YTL" ? "TRY" : c))((readMapped(row, mapping["currency"]) || currency || "TRY").trim().toUpperCase().slice(0, 10)),
        stock: Math.max(0, Math.round(toNumber(readMapped(row, mapping["stock"])))),
        images: imagesRaw
          ? imagesRaw.split(/[\s,;|]+/).filter((url) => /^https?:\/\//i.test(url)).slice(0, 20)
          : [],
        raw: row,
        last_seen_at: startedAt,
      };
      const id = byExternal.get(sku);
      if (id) updates.push({ id, patch: record });
      else inserts.push(record);
    }

    for (let index = 0; index < inserts.length; index += 500) {
      const { error } = await admin.from("supplier_products").insert(inserts.slice(index, index + 500));
      if (error) throw new Error(error.message);
      created += Math.min(500, inserts.length - index);
    }
    for (const row of updates) {
      const { error } = await admin.from("supplier_products").update(row.patch).eq("id", row.id);
      if (!error) updated += 1;
      else skipped += 1;
    }

    const stats = { totalRows: parsed.totalRows, created, updated, skipped, format: fetched.format };
    await admin
      .from("supplier_xml_feeds")
      .update({ last_run_at: startedAt, last_status: "success", last_error: null, stats, field_mapping: mapping })
      .eq("id", feed.id);
    return stats;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Besleme işlenemedi";
    await admin
      .from("supplier_xml_feeds")
      .update({ last_run_at: startedAt, last_status: "failed", last_error: message.slice(0, 500) })
      .eq("id", feed.id);
    throw new Error(message);
  }
}

/* -------------------------------- ödeme --------------------------------- */

export async function loadSupplierPaymentSettings(admin: Client, supplierId: string) {
  const { data } = await admin
    .from("supplier_payment_settings")
    .select("provider, settings")
    .eq("supplier_id", supplierId)
    .maybeSingle();
  if (!data) return null;
  return { provider: data.provider as "iyzico" | "paytr", settings: (data.settings ?? {}) as Record<string, unknown> };
}

/** Sağlayıcı teyidi alınmış satın alma ödemesini işler (tekrarda güvenli). */
export async function applyPurchaseOrderPayment(
  admin: Client,
  purchaseOrderId: string,
  provider: "iyzico" | "paytr",
  amount: number,
  reference: string,
) {
  const { data: order } = await admin
    .from("purchase_orders")
    .select("id, store_id, supplier_id, code, payment_status")
    .eq("id", purchaseOrderId)
    .maybeSingle();
  if (!order || order.payment_status === "paid") return;
  await admin
    .from("purchase_orders")
    .update({
      payment_status: "paid",
      paid_amount: amount,
      paid_at: new Date().toISOString(),
      payment_provider: provider,
      payment_reference: reference,
    })
    .eq("id", order.id);
  await admin.from("supplier_messages").insert({
    store_id: order.store_id,
    supplier_id: order.supplier_id,
    purchase_order_id: order.id,
    sender_role: "admin",
    body: `${order.code} siparişinin ödemesi ${provider === "iyzico" ? "iyzico" : "PayTR"} ile alındı (${amount.toFixed(2)}).`,
  });
}
