/**
 * Perakende operasyon yardımcıları — sunucu katmanı.
 * 1) Stok tükenme tahmini (gerçek sipariş kalemlerinden günlük tüketim)
 * 2) Mağazadan teslim (Click & Collect) noktaları
 * 3) RFQ temsilci masası mesajları ve teklif güncelleme
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;
type Any = any;

export type StockForecastRow = {
  productId: string;
  name: string;
  available: number;
  dailyUsage: number;
  daysLeft: number | null;
  status: "critical" | "warning" | "healthy" | "idle";
};

/** Son `windowDays` gündeki gerçek satışlardan günlük tüketimi ve tükenme gününü çıkarır. */
export async function forecastStockDepletion(client: Client, storeId: string, windowDays = 30) {
  const db = client as unknown as Any;
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();

  const [products, items] = await Promise.all([
    db
      .from("products")
      .select("id, title, track_inventory, product_variants(stock)")
      .eq("store_id", storeId)
      .order("title", { ascending: true })
      .limit(500),
    db
      .from("order_items")
      .select("product_id, quantity, created_at, orders!inner(status)")
      .eq("store_id", storeId)
      .gte("created_at", since)
      .limit(5000),
  ]);
  if (products.error) throw new Error(products.error.message);
  if (items.error) throw new Error(items.error.message);

  const excluded = new Set(["cancelled", "failed", "refunded"]);
  const sold = new Map<string, number>();
  for (const row of (items.data ?? []) as Any[]) {
    const order = row.orders ?? {};
    if (excluded.has(String(order.status ?? ""))) continue;
    const key = String(row.product_id ?? "");
    if (!key) continue;
    sold.set(key, (sold.get(key) ?? 0) + Number(row.quantity ?? 0));
  }

  const rows: StockForecastRow[] = ((products.data ?? []) as Any[]).map((product) => {
    const variants = (product.product_variants ?? []) as Any[];
    const available = variants.reduce((sum, variant) => sum + Number(variant.stock ?? 0), 0);
    const dailyUsage = (sold.get(String(product.id)) ?? 0) / windowDays;
    const daysLeft = dailyUsage > 0 ? Math.floor(available / dailyUsage) : null;
    let status: StockForecastRow["status"] = "idle";
    if (dailyUsage > 0) {
      status = daysLeft !== null && daysLeft <= 7 ? "critical" : daysLeft !== null && daysLeft <= 21 ? "warning" : "healthy";
    }
    return {
      productId: String(product.id),
      name: String(product.title ?? ""),
      available,
      dailyUsage: Math.round(dailyUsage * 100) / 100,
      daysLeft,
      status,
    };
  });

  rows.sort((a, b) => {
    const aDays = a.daysLeft ?? Number.POSITIVE_INFINITY;
    const bDays = b.daysLeft ?? Number.POSITIVE_INFINITY;
    return aDays - bDays;
  });

  return { windowDays, rows };
}

export type PickupLocationRow = {
  id: string;
  name: string;
  addressLine: string;
  city: string;
  phone: string;
  openingHours: string;
  notes: string;
  isActive: boolean;
};

function mapPickup(row: Any): PickupLocationRow {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    addressLine: String(row.address_line ?? ""),
    city: String(row.city ?? ""),
    phone: String(row.phone ?? ""),
    openingHours: String(row.opening_hours ?? ""),
    notes: String(row.notes ?? ""),
    isActive: Boolean(row.is_active),
  };
}

export async function listPickupLocations(client: Client, storeId: string) {
  const { data, error } = await (client as unknown as Any)
    .from("pickup_locations")
    .select("*")
    .eq("store_id", storeId)
    .order("name", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Any[]).map(mapPickup);
}

/** Vitrin: yalnızca aktif teslim noktaları. */
export async function listActivePickupLocations(client: Client, storeSlug: string) {
  const db = client as unknown as Any;
  const { data: store } = await db.from("stores").select("id").eq("slug", storeSlug).maybeSingle();
  if (!store) return [];
  const { data, error } = await db
    .from("pickup_locations")
    .select("*")
    .eq("store_id", store.id)
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Any[]).map(mapPickup);
}

export async function savePickupLocation(options: {
  client: Client;
  storeId: string;
  userId: string;
  input: {
    id?: string | null | undefined;
    name: string;
    addressLine: string;
    city: string;
    phone?: string | undefined;
    openingHours?: string | undefined;
    notes?: string | undefined;
    isActive: boolean;
  };
}) {
  const { assertStoreManager } = await import("@/lib/store-access.server");
  await assertStoreManager(options.client, options.storeId, options.userId);
  const { input } = options;
  const row: Record<string, unknown> = {
    store_id: options.storeId,
    name: input.name,
    address_line: input.addressLine,
    city: input.city,
    phone: input.phone ?? null,
    opening_hours: input.openingHours ?? null,
    notes: input.notes ?? null,
    is_active: input.isActive,
    updated_at: new Date().toISOString(),
  };
  if (input.id) row["id"] = input.id;
  const { data, error } = await (options.client as unknown as Any)
    .from("pickup_locations")
    .upsert(row, { onConflict: "id" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: String(data.id) };
}

export async function deletePickupLocation(options: {
  client: Client;
  storeId: string;
  userId: string;
  id: string;
}) {
  const { assertStoreManager } = await import("@/lib/store-access.server");
  await assertStoreManager(options.client, options.storeId, options.userId);
  const { error } = await (options.client as unknown as Any)
    .from("pickup_locations")
    .delete()
    .eq("id", options.id)
    .eq("store_id", options.storeId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export type RfqMessageRow = {
  id: string;
  rfqId: string;
  authorKind: "rep" | "buyer";
  body: string;
  quotedTotal: number | null;
  createdAt: string;
};

export async function listRfqDesk(client: Client, storeId: string) {
  const db = client as unknown as Any;
  const [requests, messages] = await Promise.all([
    db
      .from("rfq_requests")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("rfq_messages")
      .select("id, rfq_id, author_kind, body, quoted_total, created_at")
      .eq("store_id", storeId)
      .order("created_at", { ascending: true })
      .limit(500),
  ]);
  if (requests.error) throw new Error(requests.error.message);
  if (messages.error) throw new Error(messages.error.message);

  return {
    requests: ((requests.data ?? []) as Any[]).map((row) => ({
      id: String(row.id),
      reference: String(row.reference ?? ""),
      companyName: String(row.company_name ?? ""),
      contactName: String(row.contact_name ?? ""),
      email: String(row.email ?? ""),
      currency: String(row.currency ?? "TRY"),
      requestedTotal: Number(row.requested_total ?? 0),
      quotedTotal: row.quoted_total === null ? null : Number(row.quoted_total),
      status: String(row.status ?? "new"),
      notes: String(row.notes ?? ""),
      createdAt: String(row.created_at),
    })),
    messages: ((messages.data ?? []) as Any[]).map((row) => ({
      id: String(row.id),
      rfqId: String(row.rfq_id),
      authorKind: String(row.author_kind) as RfqMessageRow["authorKind"],
      body: String(row.body ?? ""),
      quotedTotal: row.quoted_total === null ? null : Number(row.quoted_total),
      createdAt: String(row.created_at),
    })) as RfqMessageRow[],
  };
}

/** Temsilci mesajı ekler; teklif tutarı verildiyse RFQ kaydını da günceller. */
export async function replyToRfq(options: {
  client: Client;
  storeId: string;
  userId: string;
  rfqId: string;
  body: string;
  quotedTotal?: number | undefined;
  status?: string | undefined;
}) {
  const { assertStoreManager } = await import("@/lib/store-access.server");
  await assertStoreManager(options.client, options.storeId, options.userId);
  const db = options.client as unknown as Any;

  const { error: insertError } = await db.from("rfq_messages").insert({
    store_id: options.storeId,
    rfq_id: options.rfqId,
    author_kind: "rep",
    author_id: options.userId,
    body: options.body,
    quoted_total: options.quotedTotal ?? null,
  });
  if (insertError) throw new Error(insertError.message);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof options.quotedTotal === "number") patch["quoted_total"] = options.quotedTotal;
  if (options.status) patch["status"] = options.status;
  if (Object.keys(patch).length > 1) {
    const { error } = await db
      .from("rfq_requests")
      .update(patch)
      .eq("id", options.rfqId)
      .eq("store_id", options.storeId);
    if (error) throw new Error(error.message);
  }

  return { ok: true as const };
}
