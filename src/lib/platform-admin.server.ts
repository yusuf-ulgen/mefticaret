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
  id: z.string().uuid(),
  status: z.enum(["open", "pending", "answered", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assignToMe: z.boolean().optional(),
});

export const ticketReplySchema = z.object({
  ticketId: z.string().uuid(),
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
  userId: z.string().uuid(),
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

export const storeControlSchema = z.object({ storeId: z.string().uuid() });

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
  storeId: z.string().uuid(),
  planId: z.string().uuid().nullable(),
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
