import { z } from "zod";

import { PLATFORM_DATASETS, PLATFORM_DATASET_KEYS, type PlatformDatasetKey } from "@/lib/platform-datasets";
import { insertAuditRow } from "./audit.server";

/** Süper admin panelinin sunucu tarafı: rol doğrulaması sonrası platform genelinde okuma/yazma. */

/** Ağ üzerinden taşınabilir satır değeri. */
export type PlatformValue = string | number | boolean | null;
export type PlatformRow = Record<string, PlatformValue>;

export const listInputSchema = z.object({
  dataset: z.enum(PLATFORM_DATASET_KEYS as [PlatformDatasetKey, ...PlatformDatasetKey[]]),
  search: z.string().trim().max(120).optional(),
  limit: z.number().int().min(1).max(500).default(100),
});

export const ticketUpdateSchema = z.object({
  id: z.guid(),
  status: z.enum(["open", "pending", "answered", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assignToMe: z.boolean().optional(),
});

export const ticketReplySchema = z.object({
  ticketId: z.guid(),
  body: z.string().trim().min(1).max(4000),
  isInternal: z.boolean().default(false),
});

export const settingSchema = z.object({
  key: z.string().trim().min(2).max(120),
  value: z.string().max(2000),
  label: z.string().trim().max(120).optional(),
  description: z.string().trim().max(400).optional(),
  isPublic: z.boolean().default(false),
});

export const settingsBulkSchema = z.object({
  items: z.array(settingSchema).min(1).max(120),
});

type SupabaseLike = {
  from: (table: string) => any;
};

/** Yalnızca platform yöneticileri devam edebilir. */
export async function assertPlatformAdmin(supabase: SupabaseLike, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "platform_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Bu alan yalnızca platform yöneticileri içindir");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseLike;
}

/** Mağaza kimliklerini isimlere çevirir (liste ekranlarında bağlam için). */
async function storeNames(db: SupabaseLike, ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 500);
  if (unique.length === 0) return {};
  const { data } = await db.from("stores").select("id, name").in("id", unique);
  return Object.fromEntries(((data ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name]));
}

/** Beyaz listedeki bir veri kümesini platform genelinde okur. */
export async function listPlatformRows(input: z.infer<typeof listInputSchema>) {
  const dataset = PLATFORM_DATASETS[input.dataset];
  const db = await admin();

  let query = db.from(dataset.table).select("*").order(dataset.orderBy, { ascending: false, nullsFirst: false });

  for (const [column, values] of Object.entries(dataset.filter ?? {})) {
    query = query.in(column, values);
  }

  const term = input.search?.trim();
  if (term && dataset.searchColumns.length > 0) {
    query = query.or(dataset.searchColumns.map((column) => `${column}.ilike.%${term}%`).join(","));
  }

  const { data, error } = await query.limit(input.limit);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as PlatformRow[];
  if (!dataset.withStore) return { rows, storeNames: {} as Record<string, string> };

  const names = await storeNames(
    db,
    rows.map((row) => String(row["store_id"] ?? "")),
  );
  return { rows, storeNames: names };
}

/** Panel üst kısmındaki platform özeti. */
export async function platformSummary() {
  const db = await admin();
  const count = async (table: string, apply?: (q: any) => any) => {
    let query = db.from(table).select("id", { count: "exact", head: true });
    if (apply) query = apply(query);
    const { count: total } = await query;
    return Number(total ?? 0);
  };

  const [stores, activeStores, users, sellers, apps, openTickets, subscriptions] = await Promise.all([
    count("stores"),
    count("stores", (q) => q.eq("status", "active")),
    count("profiles"),
    count("marketplace_sellers"),
    count("apps"),
    count("support_tickets", (q) => q.in("status", ["open", "pending", "answered"])),
    count("subscriptions", (q) => q.in("status", ["trialing", "active"])),
  ]);

  const { data: fees } = await db
    .from("ledger_entries")
    .select("amount, kind, status")
    .in("kind", ["platform_fee", "marketplace_commission"])
    .eq("status", "posted")
    .limit(5000);

  const commission = ((fees ?? []) as { amount: number }[]).reduce(
    (total, row) => total + Number(row.amount ?? 0),
    0,
  );

  return { stores, activeStores, users, sellers, apps, openTickets, subscriptions, commission };
}

/** Destek talepleri (platform geneli) ve son yazışmalar. */
export async function listTickets(status?: string) {
  const db = await admin();
  let query = db
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status && status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as PlatformRow[];
  const names = await storeNames(db, rows.map((row) => String(row["store_id"] ?? "")));
  return { rows, storeNames: names };
}

export async function listTicketMessages(ticketId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("support_ticket_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlatformRow[];
}

export async function updateTicket(input: z.infer<typeof ticketUpdateSchema>, userId: string) {
  const db = await admin();
  const patch: Record<string, unknown> = {};
  if (input.status) {
    patch["status"] = input.status;
    patch["resolved_at"] = input.status === "resolved" || input.status === "closed" ? new Date().toISOString() : null;
  }
  if (input.priority) patch["priority"] = input.priority;
  if (input.assignToMe) patch["assigned_to"] = userId;
  if (Object.keys(patch).length === 0) return { id: input.id };

  const { error } = await db.from("support_tickets").update(patch).eq("id", input.id);
  if (error) throw new Error(error.message);

  await insertAuditRow(db, {
    actor_id: userId,
    action: "platform.ticket_updated",
    entity: "support_tickets",
    entity_id: input.id,
    new_value: patch,
  });
  return { id: input.id };
}

export async function replyTicket(
  input: z.infer<typeof ticketReplySchema>,
  userId: string,
  authorName: string | null,
) {
  const db = await admin();
  const { error } = await db.from("support_ticket_messages").insert({
    ticket_id: input.ticketId,
    author_id: userId,
    author_name: authorName,
    body: input.body,
    is_internal: input.isInternal,
  });
  if (error) throw new Error(error.message);

  await db
    .from("support_tickets")
    .update({
      last_reply_at: new Date().toISOString(),
      ...(input.isInternal ? {} : { status: "answered" }),
    })
    .eq("id", input.ticketId);

  return { ticketId: input.ticketId };
}

export async function listSettings() {
  const db = await admin();
  const { data, error } = await db.from("platform_settings").select("*").order("key");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlatformRow[];
}

export async function saveSetting(input: z.infer<typeof settingSchema>, userId: string) {
  const db = await admin();
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.value);
  } catch {
    parsed = input.value;
  }

  const { error } = await db.from("platform_settings").upsert(
    {
      key: input.key,
      value: parsed,
      label: input.label ?? null,
      description: input.description ?? null,
      is_public: input.isPublic,
      updated_by: userId,
    },
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);

  await insertAuditRow(db, {
    actor_id: userId,
    action: "platform.setting_saved",
    entity: "platform_settings",
    entity_id: input.key,
    new_value: { key: input.key, value: parsed, is_public: input.isPublic },
  });
  return { key: input.key };
}

/** Birden fazla ayarı tek istekte kaydeder (grup halinde form kaydı için). */
export async function saveSettings(input: z.infer<typeof settingsBulkSchema>, userId: string) {
  for (const item of input.items) {
    await saveSetting(item, userId);
  }
  return { saved: input.items.length };
}

/** Kullanıcı platform rollerini listeler (rol yönetimi ekranı için). */
export async function listUserRoles() {
  const db = await admin();
  const { data, error } = await db.from("user_roles").select("user_id, role");
  if (error) throw new Error(error.message);
  return (data ?? []) as { user_id: string; role: string }[];
}

export const roleSchema = z.object({
  userId: z.guid(),
  role: z.enum(["platform_admin", "agency", "seller", "customer"]),
  grant: z.boolean(),
});

export async function setUserRole(input: z.infer<typeof roleSchema>, userId: string) {
  const db = await admin();
  if (input.grant) {
    const { error } = await db.from("user_roles").upsert(
      { user_id: input.userId, role: input.role },
      { onConflict: "user_id,role" },
    );
    if (error) throw new Error(error.message);
  } else {
    if (input.userId === userId && input.role === "platform_admin") {
      throw new Error("Kendi platform yöneticiliğini kaldıramazsın");
    }
    const { error } = await db
      .from("user_roles")
      .delete()
      .eq("user_id", input.userId)
      .eq("role", input.role);
    if (error) throw new Error(error.message);
  }

  await insertAuditRow(db, {
    actor_id: userId,
    action: input.grant ? "platform.role_granted" : "platform.role_revoked",
    entity: "user_roles",
    entity_id: input.userId,
    new_value: { role: input.role },
  });
  return { userId: input.userId, role: input.role, grant: input.grant };
}

/* ------------------------------------------------------------------ */
/* Gelişmiş platform analitiği                                         */
/* ------------------------------------------------------------------ */

export const analyticsInputSchema = z.object({
  days: z.number().int().min(7).max(365).default(30),
});

type OrderRow = {
  store_id: string;
  grand_total: number | string | null;
  status: string;
  payment_status: string;
  placed_at: string | null;
  created_at: string;
  customer_email: string | null;
};

/** Gün bazlı seri + kırılımlar: platform genelinde ciro, sipariş, mağaza, müşteri. */
export async function platformAnalytics(input: z.infer<typeof analyticsInputSchema>) {
  const db = await admin();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (input.days - 1));
  since.setUTCHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();

  const [ordersRes, storesRes, customersRes, statsRes, subsRes, ledgerRes, itemsRes, plansRes] =
    await Promise.all([
      db
        .from("orders")
        .select("store_id, grand_total, status, payment_status, placed_at, created_at, customer_email")
        .gte("created_at", sinceIso)
        .limit(20000),
      db.from("stores").select("id, name, slug, status, plan_id, created_at").limit(2000),
      db.from("customers").select("id, store_id, created_at").gte("created_at", sinceIso).limit(20000),
      db.from("store_daily_stats").select("stat_date, visitors, sessions, abandoned_carts").gte("stat_date", sinceIso.slice(0, 10)).limit(20000),
      db.from("subscriptions").select("status, billing_interval, amount, plan_id").limit(5000),
      db.from("ledger_entries").select("kind, amount, status, occurred_at").gte("occurred_at", sinceIso).limit(20000),
      db.from("order_items").select("title, quantity, line_total, store_id").limit(20000),
      db.from("plans").select("id, code, name, price_monthly, price_yearly").limit(200),
    ]);

  for (const res of [ordersRes, storesRes, customersRes, statsRes, subsRes, ledgerRes, itemsRes, plansRes] as {
    error?: { message: string } | null;
  }[]) {
    if (res.error) throw new Error(res.error.message);
  }

  const orders = (ordersRes.data ?? []) as OrderRow[];
  const stores = (storesRes.data ?? []) as {
    id: string;
    name: string;
    slug: string;
    status: string;
    plan_id: string | null;
    created_at: string;
  }[];
  const plans = (plansRes.data ?? []) as {
    id: string;
    code: string;
    name: string;
    price_monthly: number | string;
    price_yearly: number | string;
  }[];

  // Gün serisi
  const index = new Map<string, number>();
  const series: {
    date: string;
    label: string;
    revenue: number;
    orders: number;
    stores: number;
    customers: number;
    visitors: number;
    commission: number;
  }[] = [];
  for (let i = 0; i < input.days; i += 1) {
    const day = new Date(since);
    day.setUTCDate(since.getUTCDate() + i);
    const key = day.toISOString().slice(0, 10);
    index.set(key, series.length);
    series.push({
      date: key,
      label: day.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" }),
      revenue: 0,
      orders: 0,
      stores: 0,
      customers: 0,
      visitors: 0,
      commission: 0,
    });
  }
  const bump = (dateLike: string | null, apply: (slot: (typeof series)[number]) => void) => {
    if (!dateLike) return;
    const slot = index.get(String(dateLike).slice(0, 10));
    if (slot === undefined) return;
    apply(series[slot]!);
  };

  const statusBreakdown = new Map<string, number>();
  const paymentBreakdown = new Map<string, number>();
  const storeRevenue = new Map<string, { revenue: number; orders: number }>();
  let revenue = 0;
  let cancelled = 0;
  const buyers = new Set<string>();

  for (const row of orders) {
    const total = Number(row.grand_total ?? 0);
    statusBreakdown.set(row.status, (statusBreakdown.get(row.status) ?? 0) + 1);
    paymentBreakdown.set(row.payment_status, (paymentBreakdown.get(row.payment_status) ?? 0) + 1);
    if (row.status === "cancelled" || row.status === "refunded") cancelled += 1;
    if (row.customer_email) buyers.add(row.customer_email.toLowerCase());
    revenue += total;
    const agg = storeRevenue.get(row.store_id) ?? { revenue: 0, orders: 0 };
    agg.revenue += total;
    agg.orders += 1;
    storeRevenue.set(row.store_id, agg);
    bump(row.placed_at ?? row.created_at, (slot) => {
      slot.revenue += total;
      slot.orders += 1;
    });
  }

  for (const row of stores) bump(row.created_at, (slot) => { slot.stores += 1; });
  for (const row of (customersRes.data ?? []) as { created_at: string }[]) {
    bump(row.created_at, (slot) => { slot.customers += 1; });
  }
  let visitors = 0;
  let abandoned = 0;
  for (const row of (statsRes.data ?? []) as {
    stat_date: string;
    visitors: number | null;
    abandoned_carts: number | null;
  }[]) {
    visitors += Number(row.visitors ?? 0);
    abandoned += Number(row.abandoned_carts ?? 0);
    bump(row.stat_date, (slot) => { slot.visitors += Number(row.visitors ?? 0); });
  }

  const ledgerBreakdown = new Map<string, number>();
  let commission = 0;
  let refunds = 0;
  for (const row of (ledgerRes.data ?? []) as {
    kind: string;
    amount: number | string;
    status: string;
    occurred_at: string;
  }[]) {
    const amount = Number(row.amount ?? 0);
    ledgerBreakdown.set(row.kind, (ledgerBreakdown.get(row.kind) ?? 0) + amount);
    if (row.kind === "platform_fee" || row.kind === "marketplace_commission") {
      commission += amount;
      bump(row.occurred_at, (slot) => { slot.commission += amount; });
    }
    if (row.kind === "refund") refunds += amount;
  }

  // Abonelik / MRR
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const subscriptionStatus = new Map<string, number>();
  const planDistribution = new Map<string, number>();
  let mrr = 0;
  for (const row of (subsRes.data ?? []) as {
    status: string;
    billing_interval: string;
    amount: number | string;
    plan_id: string | null;
  }[]) {
    subscriptionStatus.set(row.status, (subscriptionStatus.get(row.status) ?? 0) + 1);
    if (row.status === "active" || row.status === "trialing") {
      const amount = Number(row.amount ?? 0);
      mrr += row.billing_interval === "yearly" ? amount / 12 : amount;
    }
  }
  for (const store of stores) {
    const label = store.plan_id ? (planById.get(store.plan_id)?.name ?? "Bilinmiyor") : "Paketsiz";
    planDistribution.set(label, (planDistribution.get(label) ?? 0) + 1);
  }

  // En çok satan ürünler (platform geneli)
  const productAgg = new Map<string, { title: string; quantity: number; revenue: number }>();
  for (const row of (itemsRes.data ?? []) as {
    title: string;
    quantity: number | null;
    line_total: number | string | null;
  }[]) {
    const agg = productAgg.get(row.title) ?? { title: row.title, quantity: 0, revenue: 0 };
    agg.quantity += Number(row.quantity ?? 0);
    agg.revenue += Number(row.line_total ?? 0);
    productAgg.set(row.title, agg);
  }

  const storeById = new Map(stores.map((store) => [store.id, store]));
  const topStores = [...storeRevenue.entries()]
    .map(([storeId, agg]) => ({
      storeId,
      name: storeById.get(storeId)?.name ?? "—",
      slug: storeById.get(storeId)?.slug ?? "",
      status: storeById.get(storeId)?.status ?? "—",
      revenue: agg.revenue,
      orders: agg.orders,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const toPairs = (map: Map<string, number>) =>
    [...map.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value);

  return {
    days: input.days,
    series,
    totals: {
      revenue,
      orders: orders.length,
      commission,
      refunds,
      visitors,
      abandoned,
      buyers: buyers.size,
      cancelled,
      mrr,
      arpu: stores.length ? revenue / stores.length : 0,
      aov: orders.length ? revenue / orders.length : 0,
      conversion: visitors ? orders.length / visitors : 0,
      newStores: stores.filter((store) => store.created_at >= sinceIso).length,
      newCustomers: (customersRes.data ?? []).length,
    },
    statusBreakdown: toPairs(statusBreakdown),
    paymentBreakdown: toPairs(paymentBreakdown),
    ledgerBreakdown: toPairs(ledgerBreakdown),
    subscriptionStatus: toPairs(subscriptionStatus),
    planDistribution: toPairs(planDistribution),
    topStores,
    topProducts: [...productAgg.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
  };
}

/* ------------------------------------------------------------------ */
/* Mağaza kontrol merkezi                                             */
/* ------------------------------------------------------------------ */

export const storeControlSchema = z.object({ storeId: z.guid() });

/** Tek bir kiracının 360° görünümü: sahibi, ekip, plan, sayaçlar, son siparişler. */
export async function storeControlCenter(input: z.infer<typeof storeControlSchema>) {
  const db = await admin();
  const { data: store, error } = await db
    .from("stores")
    .select("*, plans(id, code, name, price_monthly, price_yearly)")
    .eq("id", input.storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!store) throw new Error("Mağaza bulunamadı");

  const count = async (table: string, apply?: (q: any) => any) => {
    let query = db.from(table).select("id", { count: "exact", head: true }).eq("store_id", input.storeId);
    if (apply) query = apply(query);
    const { count: total } = await query;
    return Number(total ?? 0);
  };

  const [
    products,
    activeProducts,
    variants,
    ordersCount,
    customers,
    discounts,
    pages,
    webhooks,
    apiKeys,
    sections,
    domains,
    team,
    ordersRes,
    ownerRes,
    subRes,
    ledgerRes,
  ] = await Promise.all([
    count("products"),
    count("products", (q) => q.eq("status", "active")),
    count("product_variants"),
    count("orders"),
    count("customers"),
    count("discounts"),
    count("store_pages"),
    count("store_webhooks"),
    count("api_keys"),
    count("store_theme_sections"),
    count("store_domains"),
    db.from("store_users").select("user_id, role, created_at").eq("store_id", input.storeId).limit(50),
    db
      .from("orders")
      .select("id, order_number, status, payment_status, grand_total, currency, created_at, customer_name")
      .eq("store_id", input.storeId)
      .order("created_at", { ascending: false })
      .limit(10),
    db.from("profiles").select("id, email, full_name, phone").eq("id", store.owner_id).maybeSingle(),
    db
      .from("subscriptions")
      .select("status, billing_interval, amount, current_period_end, trial_ends_at")
      .eq("store_id", input.storeId)
      .order("created_at", { ascending: false })
      .limit(1),
    db.from("ledger_entries").select("kind, amount, status").eq("store_id", input.storeId).limit(5000),
  ]);

  const memberIds = ((team.data ?? []) as { user_id: string }[]).map((row) => row.user_id);
  const { data: memberProfiles } = memberIds.length
    ? await db.from("profiles").select("id, email, full_name").in("id", memberIds)
    : { data: [] as { id: string; email: string; full_name: string | null }[] };
  const profileById = new Map(
    ((memberProfiles ?? []) as { id: string; email: string; full_name: string | null }[]).map((row) => [
      row.id,
      row,
    ]),
  );

  const ledger = (ledgerRes.data ?? []) as { kind: string; amount: number | string; status: string }[];
  const revenue = ledger
    .filter((row) => row.kind === "sale")
    .reduce((total, row) => total + Number(row.amount ?? 0), 0);
  const fees = ledger
    .filter((row) => row.kind === "platform_fee" || row.kind === "marketplace_commission")
    .reduce((total, row) => total + Number(row.amount ?? 0), 0);

  return {
    store: store as unknown as Record<string, PlatformValue> & {
      plans?: { id: string; code: string; name: string } | null;
    },
    owner: (ownerRes.data ?? null) as { id: string; email: string; full_name: string | null; phone: string | null } | null,
    subscription: ((subRes.data ?? [])[0] ?? null) as Record<string, PlatformValue> | null,
    counts: {
      products,
      activeProducts,
      variants,
      orders: ordersCount,
      customers,
      discounts,
      pages,
      webhooks,
      apiKeys,
      sections,
      domains,
      team: memberIds.length,
    },
    finance: { revenue, fees },
    team: ((team.data ?? []) as { user_id: string; role: string; created_at: string }[]).map((row) => ({
      userId: row.user_id,
      role: row.role,
      createdAt: row.created_at,
      email: profileById.get(row.user_id)?.email ?? "—",
      fullName: profileById.get(row.user_id)?.full_name ?? null,
    })),
    recentOrders: (ordersRes.data ?? []) as unknown as Record<string, PlatformValue>[],
  };
}

export const storePlanSchema = z.object({
  storeId: z.guid(),
  planId: z.guid().nullable(),
});

/** Kiracının paketini değiştirir (yalnızca platform yöneticisi). */
export async function setStorePlan(input: z.infer<typeof storePlanSchema>, userId: string) {
  const db = await admin();
  const { error } = await db.from("stores").update({ plan_id: input.planId }).eq("id", input.storeId);
  if (error) throw new Error(error.message);
  await insertAuditRow(db, {
    store_id: input.storeId,
    actor_id: userId,
    action: "platform.store_plan_changed",
    entity: "stores",
    entity_id: input.storeId,
    new_value: { plan_id: input.planId },
  });
  return { storeId: input.storeId, planId: input.planId };
}

/* ------------------------------------------------------------------ */
/* Finans Merkezi                                                      */
/* ------------------------------------------------------------------ */

export const financeInputSchema = z.object({
  days: z.number().int().min(7).max(365).default(30),
  limit: z.number().int().min(10).max(500).default(100),
});

/** Finans merkezi: gelirler, komisyonlar, iadeler, ödeme kayıtları, faturalar, banka transferleri, KPI'lar. */
export async function financeCenter(input: z.infer<typeof financeInputSchema>) {
  const db = await admin();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (input.days - 1));
  since.setUTCHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();

  const [
    invoicesRes,
    paymentsRes,
    refundsRes,
    commissionsRes,
    payoutsRes,
    subsRes,
    plansRes,
    ordersRes,
  ] = await Promise.all([
    db
      .from("invoices")
      .select("*")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(input.limit),
    db
      .from("payments")
      .select("*")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(input.limit),
    db
      .from("refunds")
      .select("*")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(input.limit),
    db
      .from("commissions")
      .select("*")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(input.limit),
    db
      .from("payouts")
      .select("*")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(input.limit),
    db.from("subscriptions").select("status, billing_interval, amount, plan_id").in("status", ["trialing", "active"]).limit(5000),
    db.from("plans").select("id, code, name").limit(200),
    db
      .from("orders")
      .select("grand_total, created_at, store_id")
      .gte("created_at", sinceIso)
      .limit(20000),
  ]);

  for (const res of [invoicesRes, paymentsRes, refundsRes, commissionsRes, payoutsRes, subsRes, plansRes, ordersRes] as {
    error?: { message: string } | null;
  }[]) {
    if (res.error) throw new Error(res.error.message);
  }

  const invoices = (invoicesRes.data ?? []) as unknown as PlatformRow[];
  const payments = (paymentsRes.data ?? []) as unknown as PlatformRow[];
  const refunds = (refundsRes.data ?? []) as unknown as PlatformRow[];
  const commissions = (commissionsRes.data ?? []) as unknown as PlatformRow[];
  const payouts = (payoutsRes.data ?? []) as unknown as PlatformRow[];
  const subs = (subsRes.data ?? []) as { status: string; billing_interval: string; amount: number | string; plan_id: string | null }[];
  const orders = (ordersRes.data ?? []) as { grand_total: number | string; created_at: string; store_id: string }[];

  const mrr = subs.reduce((total, row) => {
    const amount = Number(row.amount ?? 0);
    return total + (row.billing_interval === "yearly" ? amount / 12 : amount);
  }, 0);
  const arr = mrr * 12;
  const gmv = orders.reduce((total, row) => total + Number(row.grand_total ?? 0), 0);

  const collected = payments
    .filter((row) => row["status"] === "paid")
    .reduce((total, row) => total + Number(row["amount"] ?? 0), 0);
  const pendingPayments = payments
    .filter((row) => row["status"] === "pending")
    .reduce((total, row) => total + Number(row["amount"] ?? 0), 0);
  const pendingInvoices = invoices
    .filter((row) => row["status"] === "open")
    .reduce((total, row) => total + Number(row["total"] ?? 0), 0);
  const refundTotal = refunds.reduce((total, row) => total + Number(row["amount"] ?? 0), 0);
  const commissionTotal = commissions.reduce((total, row) => total + Number(row["commission_amount"] ?? 0), 0);
  const payoutTotal = payouts
    .filter((row) => row["status"] === "paid")
    .reduce((total, row) => total + Number(row["net_amount"] ?? 0), 0);
  const taxTotal = invoices.reduce((total, row) => total + Number(row["tax_total"] ?? 0), 0);

  const allIds = [
    ...invoices.map((row) => String(row["store_id"] ?? "")),
    ...payments.map((row) => String(row["store_id"] ?? "")),
    ...refunds.map((row) => String(row["store_id"] ?? "")),
    ...commissions.map((row) => String(row["store_id"] ?? "")),
    ...payouts.map((row) => String(row["store_id"] ?? "")),
  ];
  const names = await storeNames(db, allIds);

  return {
    kpis: {
      mrr,
      arr,
      gmv,
      collected,
      pendingPayments,
      pendingInvoices,
      refundTotal,
      commissionTotal,
      payoutTotal,
      taxTotal,
    },
    invoices,
    payments,
    refunds,
    commissions,
    payouts,
    storeNames: names,
  };
}

/* ------------------------------------------------------------------ */
/* Sistem Durumu                                                       */
/* ------------------------------------------------------------------ */

/** Kuyruk sağlığı, API hacmi/hata oranı, güvenlik & audit akışı, tablo sayıları. */
export async function systemHealth() {
  const db = await admin();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const count = async (table: string, apply?: (q: any) => any) => {
    let query = db.from(table).select("id", { count: "exact", head: true });
    if (apply) query = apply(query);
    const { count: total } = await query;
    return Number(total ?? 0);
  };

  const [
    queued,
    running,
    failed,
    succeeded24h,
    failedJobsRes,
    apiLogsRes,
    securityRes,
    auditRes,
    storesTotal,
    usersTotal,
    ordersTotal,
    productsTotal,
  ] = await Promise.all([
    count("job_queue", (q) => q.eq("status", "queued")),
    count("job_queue", (q) => q.eq("status", "running")),
    count("job_queue", (q) => q.eq("status", "failed")),
    count("job_queue", (q) => q.eq("status", "succeeded").gte("finished_at", since24h)),
    db
      .from("job_queue")
      .select("id, kind, last_error, attempts, max_attempts, store_id, updated_at")
      .eq("status", "failed")
      .order("updated_at", { ascending: false })
      .limit(20),
    db
      .from("api_request_logs")
      .select("status_code, duration_ms, created_at, path, method, store_id")
      .gte("created_at", since24h)
      .limit(20000),
    db
      .from("security_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30),
    db
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30),
    count("stores"),
    count("profiles"),
    count("orders"),
    count("products"),
  ]);

  if (apiLogsRes.error) throw new Error(apiLogsRes.error.message);
  if (securityRes.error) throw new Error(securityRes.error.message);
  if (auditRes.error) throw new Error(auditRes.error.message);

  const apiLogs = (apiLogsRes.data ?? []) as { status_code: number; duration_ms: number | null }[];
  const totalRequests = apiLogs.length;
  const errorRequests = apiLogs.filter((row) => row.status_code >= 500 || row.status_code === 429).length;
  const avgDuration = totalRequests
    ? apiLogs.reduce((total, row) => total + Number(row.duration_ms ?? 0), 0) / totalRequests
    : 0;

  const securityRows = (securityRes.data ?? []) as unknown as PlatformRow[];
  const auditRows = (auditRes.data ?? []) as unknown as PlatformRow[];
  const failedJobs = (failedJobsRes.data ?? []) as unknown as PlatformRow[];

  const storeIds = [
    ...securityRows.map((row) => String(row["store_id"] ?? "")),
    ...auditRows.map((row) => String(row["store_id"] ?? "")),
    ...failedJobs.map((row) => String(row["store_id"] ?? "")),
  ];
  const names = await storeNames(db, storeIds);

  return {
    queue: { queued, running, failed, succeeded24h },
    failedJobs,
    api: { totalRequests, errorRequests, errorRate: totalRequests ? errorRequests / totalRequests : 0, avgDuration },
    securityEvents: securityRows,
    auditLogs: auditRows,
    tableCounts: { stores: storesTotal, users: usersTotal, orders: ordersTotal, products: productsTotal },
    storeNames: names,
  };
}

/* ------------------------------------------------------------------ */
/* Mağaza yönetici notları                                             */
/* ------------------------------------------------------------------ */

export async function listStoreAdminNotes(storeId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("store_admin_notes")
    .select("*")
    .eq("store_id", storeId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { author_id: string }[];
  const authorIds = [...new Set(rows.map((row) => row.author_id))];
  const { data: authors } = authorIds.length
    ? await db.from("profiles").select("id, email, full_name").in("id", authorIds)
    : { data: [] as { id: string; email: string; full_name: string | null }[] };
  const byId = new Map(
    ((authors ?? []) as { id: string; email: string; full_name: string | null }[]).map((row) => [row.id, row]),
  );
  return (rows as unknown as PlatformRow[]).map((row) => ({
    ...row,
    author_name: byId.get(String(row["author_id"]))?.full_name ?? byId.get(String(row["author_id"]))?.email ?? "—",
  }));
}

export const storeAdminNoteSchema = z.object({
  storeId: z.guid(),
  note: z.string().trim().min(1).max(2000),
  isPinned: z.boolean().default(false),
});

export async function addStoreAdminNote(input: z.infer<typeof storeAdminNoteSchema>, userId: string) {
  const db = await admin();
  const { error } = await db.from("store_admin_notes").insert({
    store_id: input.storeId,
    author_id: userId,
    note: input.note,
    is_pinned: input.isPinned,
  });
  if (error) throw new Error(error.message);
  await insertAuditRow(db, {
    store_id: input.storeId,
    actor_id: userId,
    action: "platform.store_note_added",
    entity: "store_admin_notes",
    new_value: { note: input.note, is_pinned: input.isPinned },
  });
  return { storeId: input.storeId };
}

export const storeAdminNoteTogglePinSchema = z.object({
  id: z.guid(),
  isPinned: z.boolean(),
});

export async function toggleStoreAdminNotePin(input: z.infer<typeof storeAdminNoteTogglePinSchema>, userId: string) {
  const db = await admin();
  const { error } = await db.from("store_admin_notes").update({ is_pinned: input.isPinned }).eq("id", input.id);
  if (error) throw new Error(error.message);
  await insertAuditRow(db, {
    actor_id: userId,
    action: "platform.store_note_pin_toggled",
    entity: "store_admin_notes",
    entity_id: input.id,
    new_value: { is_pinned: input.isPinned },
  });
  return { id: input.id };
}

export async function deleteStoreAdminNote(id: string, userId: string) {
  const db = await admin();
  const { error } = await db.from("store_admin_notes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await insertAuditRow(db, {
    actor_id: userId,
    action: "platform.store_note_deleted",
    entity: "store_admin_notes",
    entity_id: id,
  });
  return { id };
}

/* ------------------------------------------------------------------ */
/* İnceleme oturumu (impersonation) — salt okunur, kimlik değişmez      */
/* ------------------------------------------------------------------ */

export async function listImpersonationSessions(storeId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("admin_impersonation_sessions")
    .select("*")
    .eq("store_id", storeId)
    .order("started_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { admin_id: string }[];
  const adminIds = [...new Set(rows.map((row) => row.admin_id))];
  const { data: admins } = adminIds.length
    ? await db.from("profiles").select("id, email, full_name").in("id", adminIds)
    : { data: [] as { id: string; email: string; full_name: string | null }[] };
  const byId = new Map(
    ((admins ?? []) as { id: string; email: string; full_name: string | null }[]).map((row) => [row.id, row]),
  );
  return (rows as unknown as PlatformRow[]).map((row) => ({
    ...row,
    admin_name: byId.get(String(row["admin_id"]))?.full_name ?? byId.get(String(row["admin_id"]))?.email ?? "—",
  }));
}

export const startImpersonationSchema = z.object({
  storeId: z.guid(),
  reason: z.string().trim().min(3).max(500),
});

/**
 * Salt okunur inceleme oturumu başlatır: kimlik/oturum değişmez, token üretilmez.
 * Yalnızca denetim amaçlı bir kayıt açar ve audit_logs'a yazar.
 */
export async function startImpersonation(input: z.infer<typeof startImpersonationSchema>, userId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("admin_impersonation_sessions")
    .insert({ store_id: input.storeId, admin_id: userId, reason: input.reason })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await insertAuditRow(db, {
    store_id: input.storeId,
    actor_id: userId,
    action: "platform.impersonation_started",
    entity: "admin_impersonation_sessions",
    entity_id: (data as { id: string }).id,
    new_value: { reason: input.reason },
  });
  return data as unknown as PlatformRow;
}

export const endImpersonationSchema = z.object({
  id: z.guid(),
});

export async function endImpersonation(input: z.infer<typeof endImpersonationSchema>, userId: string) {
  const db = await admin();
  const { data: existing, error: fetchError } = await db
    .from("admin_impersonation_sessions")
    .select("store_id")
    .eq("id", input.id)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!existing) throw new Error("Oturum bulunamadı");

  const { error } = await db
    .from("admin_impersonation_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", input.id);
  if (error) throw new Error(error.message);

  await insertAuditRow(db, {
    store_id: (existing as { store_id: string }).store_id,
    actor_id: userId,
    action: "platform.impersonation_ended",
    entity: "admin_impersonation_sessions",
    entity_id: input.id,
  });
  return { id: input.id };
}

export const liveInputSchema = z.object({
  minutes: z.number().int().min(5).max(180).default(60),
});

/**
 * Platform geneli canlı izleme: son N dakikadaki vitrin olayları, bugünün
 * siparişleri, aktif sepetler ve mağaza/şehir/cihaz kırılımları.
 */
export async function platformLive(input: z.infer<typeof liveInputSchema>) {
  const db = await admin();
  const minutes = input.minutes;
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [eventsRes, ordersRes, cartsRes] = await Promise.all([
    db
      .from("analytics_events")
      .select("id, store_id, kind, visitor_id, session_id, path, city, country, device, value, currency, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(4000),
    db
      .from("orders")
      .select("id, store_id, order_number, customer_name, grand_total, currency, status, payment_status, created_at")
      .gte("created_at", dayStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(500),
    db
      .from("carts")
      .select("id, store_id, grand_total, currency, updated_at, completed_at")
      .is("completed_at", null)
      .gte("updated_at", new Date(Date.now() - 4 * 3_600_000).toISOString())
      .limit(500),
  ]);

  type Ev = {
    id: string;
    store_id: string;
    kind: string;
    visitor_id: string | null;
    session_id: string | null;
    path: string | null;
    city: string | null;
    country: string | null;
    device: string | null;
    value: number | string | null;
    currency: string | null;
    created_at: string;
  };
  type Ord = {
    id: string;
    store_id: string;
    order_number: string;
    customer_name: string | null;
    grand_total: number | string;
    currency: string;
    status: string;
    payment_status: string;
    created_at: string;
  };
  type Crt = { id: string; store_id: string; grand_total: number | string; currency: string; updated_at: string };

  const events = (eventsRes.data ?? []) as Ev[];
  const orders = (ordersRes.data ?? []) as Ord[];
  const carts = (cartsRes.data ?? []) as Crt[];

  const names = await storeNames(db, [
    ...events.map((row) => row.store_id),
    ...orders.map((row) => row.store_id),
    ...carts.map((row) => row.store_id),
  ]);

  const tally = (rows: Ev[], key: keyof Ev, limit: number) => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const label = (row[key] as string | null) || "Bilinmiyor";
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  };

  const fresh = events.filter((row) => Date.now() - new Date(row.created_at).getTime() < 5 * 60_000);
  const visitors = new Set(fresh.map((row) => row.visitor_id ?? row.session_id ?? row.id)).size;
  const sessions = new Set(fresh.map((row) => row.session_id ?? row.id)).size;

  const buckets: { minute: string; count: number }[] = [];
  for (let index = minutes - 1; index >= 0; index -= 1) {
    const start = Date.now() - index * 60_000;
    const stamp = new Date(start);
    stamp.setSeconds(0, 0);
    const next = stamp.getTime() + 60_000;
    const inBucket = events.filter((row) => {
      const time = new Date(row.created_at).getTime();
      return time >= stamp.getTime() && time < next;
    });
    buckets.push({
      minute: stamp.toISOString(),
      count: new Set(inBucket.map((row) => row.visitor_id ?? row.id)).size,
    });
  }

  const perStore = new Map<string, { storeId: string; name: string; visitors: Set<string>; events: number; orders: number; revenue: number; carts: number }>();
  const bucketFor = (storeId: string) => {
    let entry = perStore.get(storeId);
    if (!entry) {
      entry = { storeId, name: names[storeId] ?? "Mağaza", visitors: new Set(), events: 0, orders: 0, revenue: 0, carts: 0 };
      perStore.set(storeId, entry);
    }
    return entry;
  };
  for (const row of events) {
    const entry = bucketFor(row.store_id);
    entry.events += 1;
    entry.visitors.add(row.visitor_id ?? row.id);
  }
  for (const row of orders) {
    const entry = bucketFor(row.store_id);
    entry.orders += 1;
    if (row.payment_status === "paid") entry.revenue += Number(row.grand_total ?? 0);
  }
  for (const row of carts) bucketFor(row.store_id).carts += 1;

  const stores = [...perStore.values()]
    .map((entry) => ({
      storeId: entry.storeId,
      name: entry.name,
      visitors: entry.visitors.size,
      events: entry.events,
      orders: entry.orders,
      revenue: entry.revenue,
      carts: entry.carts,
    }))
    .sort((a, b) => b.visitors - a.visitors || b.orders - a.orders)
    .slice(0, 12);

  const paidOrders = orders.filter((row) => row.payment_status === "paid");
  const funnelViews = events.filter((row) => row.kind === "page_view" || row.kind === "product_view").length;

  return {
    minutes,
    visitors,
    sessions,
    activeStores: stores.filter((store) => store.visitors > 0).length,
    eventCount: events.length,
    cartCount: carts.length,
    cartValue: carts.reduce((sum, row) => sum + Number(row.grand_total ?? 0), 0),
    orderCount: orders.length,
    revenue: paidOrders.reduce((sum, row) => sum + Number(row.grand_total ?? 0), 0),
    conversionRate: funnelViews > 0 ? (events.filter((row) => row.kind === "purchase").length / funnelViews) * 100 : 0,
    buckets,
    stores,
    cities: tally(events, "city", 8),
    devices: tally(events, "device", 4),
    countries: tally(events, "country", 6),
    paths: tally(events, "path", 6),
    funnel: [
      { label: "Görüntüleme", value: funnelViews },
      { label: "Sepete ekleme", value: events.filter((row) => row.kind === "add_to_cart").length },
      { label: "Ödeme adımı", value: events.filter((row) => row.kind === "checkout").length },
      { label: "Satın alma", value: events.filter((row) => row.kind === "purchase").length },
    ],
    activity: events.slice(0, 20).map((row) => ({
      id: row.id,
      kind: row.kind,
      path: row.path,
      city: row.city,
      country: row.country,
      device: row.device,
      value: Number(row.value ?? 0),
      currency: row.currency ?? "TRY",
      storeName: names[row.store_id] ?? "Mağaza",
      createdAt: row.created_at,
    })),
    recentOrders: orders.slice(0, 8).map((row) => ({
      id: row.id,
      orderNumber: row.order_number,
      customer: row.customer_name,
      total: Number(row.grand_total ?? 0),
      currency: row.currency,
      status: row.status,
      paymentStatus: row.payment_status,
      storeName: names[row.store_id] ?? "Mağaza",
      createdAt: row.created_at,
    })),
  };
}

/* ---------- Uygulama mağazası yönetimi (platform admin) ---------- */

const APP_CATEGORY_VALUES = [
  "seo","marketing","payment","shipping","accounting","crm","analytics","social",
  "email","sms","whatsapp","ai","reviews","loyalty","dropshipping","marketplace",
] as const;

export const appSaveSchema = z.object({
  id: z.guid().optional(),
  code: z.string().trim().min(2).max(60).regex(/^[a-z0-9-]+$/, "Kod yalnızca küçük harf, rakam ve tire içerebilir"),
  name: z.string().trim().min(2).max(120),
  tagline: z.string().trim().max(160).nullable().default(null),
  description: z.string().trim().max(4000).nullable().default(null),
  category: z.enum(APP_CATEGORY_VALUES),
  developer: z.string().trim().min(1).max(120).default("Mefticaret"),
  developer_url: z.string().trim().url().max(300).nullable().default(null),
  version: z.string().trim().min(1).max(20).default("1.0.0"),
  logo_emoji: z.string().trim().max(8).nullable().default(null),
  pricing_model: z.enum(["free", "monthly", "one_time", "usage"]),
  price: z.number().min(0).max(999_999),
  currency: z.string().trim().length(3).default("TRY"),
  is_active: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  sort_order: z.number().int().min(0).max(9999).default(100),
});

export const appPriceBulkSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.guid(),
        pricing_model: z.enum(["free", "monthly", "one_time", "usage"]),
        price: z.number().min(0).max(999_999),
        currency: z.string().trim().length(3),
      }),
    )
    .min(1)
    .max(200),
});

export const appToggleSchema = z.object({
  id: z.guid(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

export async function listAppsForAdmin() {
  const db = await admin();
  const { data, error } = await db
    .from("apps")
    .select(
      "id, code, name, tagline, description, category, developer, developer_url, version, logo_emoji, pricing_model, price, currency, is_active, is_featured, sort_order, install_count, rating, updated_at",
    )
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Record<string, PlatformValue>[];
}

export async function saveApp(input: z.infer<typeof appSaveSchema>, actorId: string) {
  const db = await admin();
  const payload = {
    code: input.code,
    name: input.name,
    tagline: input.tagline,
    description: input.description,
    category: input.category,
    developer: input.developer,
    developer_url: input.developer_url,
    version: input.version,
    logo_emoji: input.logo_emoji,
    pricing_model: input.pricing_model,
    price: input.pricing_model === "free" ? 0 : input.price,
    currency: input.currency.toUpperCase(),
    is_active: input.is_active,
    is_featured: input.is_featured,
    sort_order: input.sort_order,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await db.from("apps").update(payload).eq("id", input.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from("apps").insert(payload);
    if (error) throw new Error(error.message);
  }

  await insertAuditRow(db as never, {
    store_id: null,
    actor_id: actorId,
    action: input.id ? "platform.app_updated" : "platform.app_created",
    entity: "apps",
    entity_id: input.id ?? null,
    new_value: payload as never,
  });

  return { ok: true as const };
}

export async function saveAppPrices(input: z.infer<typeof appPriceBulkSchema>, actorId: string) {
  const db = await admin();
  for (const item of input.items) {
    const { error } = await db
      .from("apps")
      .update({
        pricing_model: item.pricing_model,
        price: item.pricing_model === "free" ? 0 : item.price,
        currency: item.currency.toUpperCase(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    if (error) throw new Error(error.message);
  }

  await insertAuditRow(db as never, {
    store_id: null,
    actor_id: actorId,
    action: "platform.app_prices_updated",
    entity: "apps",
    entity_id: null,
    new_value: { count: input.items.length } as never,
  });

  return { ok: true as const, count: input.items.length };
}

export async function toggleApp(input: z.infer<typeof appToggleSchema>, actorId: string) {
  const db = await admin();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.isActive !== undefined) patch["is_active"] = input.isActive;
  if (input.isFeatured !== undefined) patch["is_featured"] = input.isFeatured;
  const { error } = await db.from("apps").update(patch).eq("id", input.id);
  if (error) throw new Error(error.message);

  await insertAuditRow(db as never, {
    store_id: null,
    actor_id: actorId,
    action: "platform.app_toggled",
    entity: "apps",
    entity_id: input.id,
    new_value: patch as never,
  });
  return { ok: true as const };
}
