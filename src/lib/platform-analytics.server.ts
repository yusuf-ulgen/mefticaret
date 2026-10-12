/**
 * Platform Analitik Merkezi — sunucu hesaplamaları.
 * Yalnız assertPlatformAdmin sonrasında çağrılır; platform geneli okuma servis rolüyle,
 * sadece bu dosyada ve izin listeli alanlarla yapılır. Kişisel veri (e-posta, ad, adres)
 * ve ödeme kimlik bilgisi okunmaz. KPI, grafik, rapor ve CSV aynı veri kümesinden üretilir.
 */
import {
  addMoney,
  ageBucketOf,
  resolveCenterRange,
  safeChange,
  type CenterInput,
  type MoneyByCurrency,
  type ReportInput,
} from "@/lib/platform-analytics";

type Row = Record<string, any>;
const DAY = 86_400_000;
const TZ_MS = 3 * 3_600_000;
const LIMIT = 50_000;
const PAID = new Set(["paid", "partially_refunded", "refunded"]);

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const istDay = (iso: string) => new Date(Date.parse(iso) + TZ_MS).toISOString().slice(0, 10);
const inRange = (iso: string | null | undefined, from: string, to: string) => !!iso && iso >= from && iso < to;
const orderDate = (o: Row) => (o["placed_at"] ?? o["created_at"]) as string;
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const monthly = (s: Row) => {
  const a = Number(s["amount"] ?? 0);
  return s["billing_interval"] === "yearly" ? a / 12 : a;
};

/* ------------------------------------------------------------------ */
/* Veri kümesi (2 dk önbellek)                                          */
/* ------------------------------------------------------------------ */

type Dataset = Awaited<ReturnType<typeof fetchDataset>>;
const cache = new Map<string, { at: number; value: Dataset }>();
const TTL = 120_000;

async function fetchDataset(windowFrom: string, windowTo: string) {
  const c = await db();
  const truncated: string[] = [];
  const run = async (name: string, q: PromiseLike<{ data: unknown; error: { message: string } | null }>, limit = LIMIT) => {
    const { data, error } = await q;
    if (error) return { rows: [] as Row[], error: `${name}: ${error.message}` };
    const rows = (data ?? []) as Row[];
    if (rows.length >= limit) truncated.push(name);
    return { rows, error: null as string | null };
  };
  const res = await Promise.all([
    run("stores", c.from("stores").select("id, name, slug, industry, currency, status, plan_id, created_at, published_at, is_demo, is_test").limit(10_000), 10_000),
    run("plans", c.from("plans").select("id, code, name, price_monthly, price_yearly, currency").limit(500), 500),
    run("subscriptions", c.from("subscriptions").select("store_id, plan_id, status, billing_interval, currency, amount, trial_ends_at, started_at, canceled_at, created_at").limit(20_000), 20_000),
    run("orders", c.from("orders").select("store_id, status, payment_status, currency, grand_total, tax_total, shipping_total, discount_total, placed_at, created_at").gte("created_at", new Date(Date.parse(windowFrom) - 30 * DAY).toISOString()).lt("created_at", windowTo).limit(LIMIT)),
    run("return_requests", c.from("return_requests").select("store_id, status, refund_amount, currency, updated_at, resolved_at").gte("updated_at", windowFrom).limit(LIMIT)),
    run("payments", c.from("payments").select("store_id, provider, method, status, amount, currency, created_at").gte("created_at", windowFrom).lt("created_at", windowTo).limit(LIMIT)),
    run("invoices", c.from("invoices").select("store_id, status, total, currency, paid_at, due_at, issued_at").limit(LIMIT)),
    run("ledger", c.from("ledger_entries").select("store_id, kind, amount, currency, status, occurred_at").eq("kind", "platform_fee").gte("occurred_at", windowFrom).lt("occurred_at", windowTo).limit(LIMIT)),
    run("milestones", c.rpc("platform_store_milestones") as never, 10_000),
    run("sessions", c.from("analytics_daily_summary").select("store_id, date, sessions").gte("date", istDay(windowFrom)).limit(LIMIT)),
    run("jobs", c.from("job_queue").select("kind, status, run_at, started_at, finished_at, created_at").gte("created_at", windowFrom).lt("created_at", windowTo).limit(LIMIT)),
    run("webhooks", c.from("webhook_deliveries").select("store_id, status, duration_ms, created_at").gte("created_at", windowFrom).lt("created_at", windowTo).limit(LIMIT)),
    run("xml_runs", c.from("xml_import_logs").select("store_id, status, created_at").gte("created_at", windowFrom).lt("created_at", windowTo).limit(LIMIT)),
    run("shipments", c.from("shipments").select("store_id, carrier, last_sync_error, last_synced_at").not("last_synced_at", "is", null).gte("last_synced_at", windowFrom).limit(LIMIT)),
    run("api_logs", c.from("api_request_logs").select("status_code, duration_ms, created_at").gte("created_at", windowFrom).lt("created_at", windowTo).limit(LIMIT)),
    run("domains", c.from("store_domains").select("store_id, type, status, ssl_status, ssl_expires_at, verified_at").limit(20_000), 20_000),
    run("themes", c.from("store_themes").select("store_id, is_published").limit(20_000), 20_000),
    run("xml_feeds", c.from("xml_feeds").select("store_id, is_active").limit(20_000), 20_000),
    run("apps", c.from("app_installations").select("store_id, status").limit(20_000), 20_000),
    run("pay_methods", c.from("store_payment_methods").select("store_id, is_active").limit(20_000), 20_000),
  ]);
  const names = ["stores", "plans", "subscriptions", "orders", "returns", "payments", "invoices", "ledger", "milestones", "sessions", "jobs", "webhooks", "xmlRuns", "shipments", "apiLogs", "domains", "themes", "xmlFeeds", "apps", "payMethods"] as const;
  const out = {} as Record<(typeof names)[number], Row[]>;
  const errors: string[] = [];
  names.forEach((n, i) => {
    out[n] = res[i]!.rows;
    if (res[i]!.error) errors.push(res[i]!.error!);
  });
  return { ...out, truncated, errors, fetchedAt: new Date().toISOString() };
}

async function loadDataset(windowFrom: string, windowTo: string) {
  const key = `${windowFrom}|${windowTo}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const value = await fetchDataset(windowFrom, windowTo);
  if (cache.size > 50) cache.clear();
  cache.set(key, { at: Date.now(), value });
  return value;
}

/* ------------------------------------------------------------------ */
/* Filtreler                                                            */
/* ------------------------------------------------------------------ */

function scope(ds: Dataset, input: CenterInput) {
  const stores = ds.stores.filter((s) => {
    if (s["is_demo"] || s["is_test"]) return false;
    if (input.storeId && s["id"] !== input.storeId) return false;
    if (input.planId && s["plan_id"] !== input.planId) return false;
    if (input.industry && (s["industry"] ?? "") !== input.industry) return false;
    if (input.age && ageBucketOf(s["created_at"]) !== input.age) return false;
    return true;
  });
  const ids = new Set(stores.map((s) => s["id"] as string));
  const cur = (r: Row) => !input.currency || (r["currency"] ?? "TRY").toUpperCase() === input.currency;
  const own = (r: Row) => ids.has(r["store_id"]);
  return {
    stores,
    ids,
    orders: ds.orders.filter((o) => own(o) && cur(o)),
    returns: ds.returns.filter((r) => own(r) && cur(r) && r["status"] === "refunded"),
    payments: ds.payments.filter((p) => own(p) && cur(p)),
    invoices: ds.invoices.filter((r) => own(r) && cur(r)),
    ledger: ds.ledger.filter((r) => own(r) && cur(r) && r["status"] === "posted"),
    subs: ds.subscriptions.filter(own),
    milestones: new Map(ds.milestones.filter(own).map((m) => [m["store_id"] as string, m])),
    sessions: ds.sessions.filter(own),
  };
}
type Scoped = ReturnType<typeof scope>;

/* ------------------------------------------------------------------ */
/* Dönem KPI'ları                                                       */
/* ------------------------------------------------------------------ */

function periodKpis(sc: Scoped, from: string, to: string) {
  const gmv: MoneyByCurrency = {};
  const tax: MoneyByCurrency = {};
  const ship: MoneyByCurrency = {};
  const refunds: MoneyByCurrency = {};
  const ordersByCur: Record<string, number> = {};
  const selling = new Set<string>();
  let orders = 0;
  let cancelled = 0;
  for (const o of sc.orders) {
    if (!inRange(orderDate(o), from, to)) continue;
    if (o["status"] === "cancelled") { cancelled += 1; continue; }
    if (!PAID.has(o["payment_status"])) continue;
    orders += 1;
    selling.add(o["store_id"]);
    const c = (o["currency"] ?? "TRY").toUpperCase();
    ordersByCur[c] = (ordersByCur[c] ?? 0) + 1;
    addMoney(gmv, c, Number(o["grand_total"] ?? 0));
    addMoney(tax, c, Number(o["tax_total"] ?? 0));
    addMoney(ship, c, Number(o["shipping_total"] ?? 0));
  }
  for (const r of sc.returns) {
    if (inRange(r["resolved_at"] ?? r["updated_at"], from, to)) addMoney(refunds, r["currency"], Number(r["refund_amount"] ?? 0));
  }
  const net: MoneyByCurrency = {};
  const aov: MoneyByCurrency = {};
  const refundRate: Record<string, number | null> = {};
  for (const c of new Set([...Object.keys(gmv), ...Object.keys(refunds)])) {
    net[c] = (gmv[c] ?? 0) - (tax[c] ?? 0) - (ship[c] ?? 0) - (refunds[c] ?? 0);
    if (ordersByCur[c]) aov[c] = (gmv[c] ?? 0) / ordersByCur[c]!;
    refundRate[c] = gmv[c] ? ((refunds[c] ?? 0) / gmv[c]!) * 100 : null;
  }
  const subRevenue: MoneyByCurrency = {};
  for (const i of sc.invoices) if (i["status"] === "paid" && inRange(i["paid_at"], from, to)) addMoney(subRevenue, i["currency"], Number(i["total"] ?? 0));
  const commission: MoneyByCurrency = {};
  for (const l of sc.ledger) if (inRange(l["occurred_at"], from, to)) addMoney(commission, l["currency"], Math.abs(Number(l["amount"] ?? 0)));
  const platformRevenue: MoneyByCurrency = {};
  for (const [c, v] of Object.entries(subRevenue)) addMoney(platformRevenue, c, v);
  for (const [c, v] of Object.entries(commission)) addMoney(platformRevenue, c, v);

  let payTotal = 0;
  let payFailed = 0;
  for (const p of sc.payments) {
    if (!inRange(p["created_at"], from, to)) continue;
    payTotal += 1;
    if (p["status"] === "failed") payFailed += 1;
  }
  let firstSale = 0;
  for (const m of sc.milestones.values()) if (inRange(m["first_order_at"], from, to)) firstSale += 1;
  const sessions = sc.sessions.filter((s) => s["date"] >= istDay(from) && s["date"] < istDay(to)).reduce((a, s) => a + Number(s["sessions"] ?? 0), 0);

  return {
    storesTotal: sc.stores.filter((s) => s["created_at"] < to).length,
    storesNew: sc.stores.filter((s) => inRange(s["created_at"], from, to)).length,
    storesSelling: selling.size,
    firstSale,
    gmv, net, tax, shipping: ship, refunds, aov, refundRate,
    orders, cancelled,
    platformRevenue, subRevenue, commission,
    payments: { total: payTotal, failed: payFailed, rate: payTotal ? (payFailed / payTotal) * 100 : null },
    sessions,
    conversion: sessions > 0 ? (orders / sessions) * 100 : null,
  };
}
type Kpis = ReturnType<typeof periodKpis>;

function primaryCurrency(k: Kpis) {
  const entries = Object.entries(k.gmv).sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] ?? "TRY";
}

/* ------------------------------------------------------------------ */
/* Ana hesaplama                                                        */
/* ------------------------------------------------------------------ */

export async function computeCenter(input: CenterInput) {
  const { range, compare, partial } = resolveCenterRange(input);
  const windowFrom = compare && compare.from < range.from ? compare.from : range.from;
  const ds = await loadDataset(windowFrom, range.to);
  const sc = scope(ds, input);
  const cur = periodKpis(sc, range.from, range.to);
  const prev = compare ? periodKpis(sc, compare.from, compare.to) : null;
  const primary = input.currency ?? primaryCurrency(cur);

  // Günlük seri (karşılaştırma aynı indeksle hizalı)
  const days = Math.max(1, Math.round((Date.parse(range.to) - Date.parse(range.from)) / DAY));
  const series = Array.from({ length: days }, (_, i) => {
    const f = new Date(Date.parse(range.from) + i * DAY).toISOString();
    const t = new Date(Date.parse(range.from) + (i + 1) * DAY).toISOString();
    const k = periodKpis(sc, f, t);
    const p = compare ? periodKpis(sc, new Date(Date.parse(compare.from) + i * DAY).toISOString(), new Date(Date.parse(compare.from) + (i + 1) * DAY).toISOString()) : null;
    return {
      date: istDay(f),
      gmv: k.gmv[primary] ?? 0,
      net: k.net[primary] ?? 0,
      orders: k.orders,
      refunds: k.refunds[primary] ?? 0,
      cancelled: k.cancelled,
      platformRevenue: k.platformRevenue[primary] ?? 0,
      newStores: k.storesNew,
      prevGmv: p ? p.gmv[primary] ?? 0 : null,
      prevOrders: p ? p.orders : null,
    };
  });

  /* Abonelik ve gelir (anlık durum) */
  const planName = new Map(ds.plans.map((p) => [p["id"], p["name"] as string]));
  const activeSubs = sc.subs.filter((s) => ["active", "past_due"].includes(s["status"]) && Number(s["amount"] ?? 0) > 0);
  const mrr: MoneyByCurrency = {};
  for (const s of activeSubs) addMoney(mrr, s["currency"], monthly(s));
  const byPlan = new Map<string, { plan: string; stores: number; mrr: MoneyByCurrency }>();
  for (const s of sc.subs.filter((x) => ["active", "past_due", "trialing"].includes(x["status"]))) {
    const key = s["plan_id"] ?? "none";
    const e = byPlan.get(key) ?? { plan: planName.get(key) ?? "Plan yok", stores: 0, mrr: {} };
    e.stores += 1;
    if (s["status"] !== "trialing" && Number(s["amount"] ?? 0) > 0) addMoney(e.mrr, s["currency"], monthly(s));
    byPlan.set(key, e);
  }
  const newMrr: MoneyByCurrency = {};
  const churnedMrr: MoneyByCurrency = {};
  let canceledCount = 0;
  for (const s of sc.subs) {
    if (inRange(s["started_at"] ?? s["created_at"], range.from, range.to) && activeSubs.includes(s)) addMoney(newMrr, s["currency"], monthly(s));
    if (inRange(s["canceled_at"], range.from, range.to)) { canceledCount += 1; addMoney(churnedMrr, s["currency"], monthly(s)); }
  }
  const trialEnded = sc.subs.filter((s) => inRange(s["trial_ends_at"], range.from, range.to) && Date.parse(s["trial_ends_at"]) <= Date.now());
  const trialConverted = trialEnded.filter((s) => ["active", "past_due"].includes(s["status"]) && Number(s["amount"] ?? 0) > 0).length;
  const openInvoices: MoneyByCurrency = {};
  const overdueInvoices: MoneyByCurrency = {};
  let openCount = 0;
  for (const i of sc.invoices) {
    if (i["status"] !== "open") continue;
    openCount += 1;
    addMoney(openInvoices, i["currency"], Number(i["total"] ?? 0));
    if (i["due_at"] && Date.parse(i["due_at"]) < Date.now()) addMoney(overdueInvoices, i["currency"], Number(i["total"] ?? 0));
  }
  const churnBase = activeSubs.length + canceledCount;
  const subCohorts = new Map<string, { started: number; active: number }>();
  for (const s of sc.subs) {
    const m = String(s["started_at"] ?? s["created_at"]).slice(0, 7);
    const e = subCohorts.get(m) ?? { started: 0, active: 0 };
    e.started += 1;
    if (["active", "past_due", "trialing"].includes(s["status"])) e.active += 1;
    subCohorts.set(m, e);
  }

  /* Satıcı hunisi (dönemde oluşturulan mağazalar) */
  const cohortStores = sc.stores.filter((s) => inRange(s["created_at"], range.from, range.to));
  const paidStore = new Set(activeSubs.map((s) => s["store_id"]));
  const ms = (id: string) => sc.milestones.get(id) ?? {};
  const steps = [
    { key: "created", label: "Mağaza oluşturma", test: () => true },
    { key: "product", label: "Ürün ekleme", test: (s: Row) => !!ms(s["id"])["first_product_at"] },
    { key: "payment", label: "Ödeme ayarı", test: (s: Row) => !!ms(s["id"])["first_payment_method_at"] },
    { key: "domain", label: "Alan adı bağlama", test: (s: Row) => !!ms(s["id"])["first_domain_verified_at"] },
    { key: "published", label: "Yayına alma", test: (s: Row) => !!s["published_at"] },
    { key: "first_order", label: "İlk sipariş", test: (s: Row) => !!ms(s["id"])["first_order_at"] },
    { key: "paid_plan", label: "Ücretli plana geçiş", test: (s: Row) => paidStore.has(s["id"]) },
  ];
  const funnel = steps.map((st) => ({ key: st.key, label: st.label, count: cohortStores.filter(st.test).length }));
  const diffDays = (a: string | null, b: string | null) => (a && b ? (Date.parse(b) - Date.parse(a)) / DAY : null);
  const ttfProduct = median(cohortStores.map((s) => diffDays(s["created_at"], ms(s["id"])["first_product_at"])).filter((x): x is number => x !== null && x >= 0));
  const ttfOrder = median(cohortStores.map((s) => diffDays(s["created_at"], ms(s["id"])["first_order_at"])).filter((x): x is number => x !== null && x >= 0));
  const storeCohorts = new Map<string, { stores: number; product: number; firstOrder: number; paid: number }>();
  for (const s of sc.stores) {
    const m = String(s["created_at"]).slice(0, 7);
    const e = storeCohorts.get(m) ?? { stores: 0, product: 0, firstOrder: 0, paid: 0 };
    e.stores += 1;
    if (ms(s["id"])["first_product_at"]) e.product += 1;
    if (ms(s["id"])["first_order_at"]) e.firstOrder += 1;
    if (paidStore.has(s["id"])) e.paid += 1;
    storeCohorts.set(m, e);
  }
  const breakdown = (keyOf: (s: Row) => string) => {
    const map = new Map<string, { key: string; stores: number; selling: number; firstOrder: number }>();
    const sellingSet = new Set(sc.orders.filter((o) => inRange(orderDate(o), range.from, range.to) && PAID.has(o["payment_status"]) && o["status"] !== "cancelled").map((o) => o["store_id"]));
    for (const s of sc.stores) {
      const k = keyOf(s);
      const e = map.get(k) ?? { key: k, stores: 0, selling: 0, firstOrder: 0 };
      e.stores += 1;
      if (sellingSet.has(s["id"])) e.selling += 1;
      if (ms(s["id"])["first_order_at"]) e.firstOrder += 1;
      map.set(k, e);
    }
    return [...map.values()].sort((a, b) => b.stores - a.stores);
  };

  /* Sağlık puanı — açıklanabilir kurallar */
  const now = Date.now();
  const recentOrders = new Map<string, { last30: number; prev30: number }>();
  for (const o of ds.orders) {
    if (!sc.ids.has(o["store_id"]) || !PAID.has(o["payment_status"]) || o["status"] === "cancelled") continue;
    const age = (now - Date.parse(orderDate(o))) / DAY;
    const e = recentOrders.get(o["store_id"]) ?? { last30: 0, prev30: 0 };
    if (age <= 30) e.last30 += 1;
    else if (age <= 60) e.prev30 += 1;
    recentOrders.set(o["store_id"], e);
  }
  const pastDue = new Set(sc.subs.filter((s) => s["status"] === "past_due").map((s) => s["store_id"]));
  const health = sc.stores.map((s) => {
    const m = ms(s["id"]);
    const r = recentOrders.get(s["id"]) ?? { last30: 0, prev30: 0 };
    const factors: { label: string; points: number }[] = [];
    if (!m["first_product_at"]) factors.push({ label: "Ürün yok", points: -25 });
    if (!m["first_payment_method_at"]) factors.push({ label: "Ödeme yöntemi yok", points: -20 });
    if (!s["published_at"]) factors.push({ label: "Yayında değil", points: -20 });
    if (pastDue.has(s["id"])) factors.push({ label: "Ödemesi gecikmiş abonelik", points: -15 });
    if (r.prev30 >= 5 && r.last30 < r.prev30 * 0.5) factors.push({ label: `Sipariş düşüşü (${r.prev30} → ${r.last30}, son 30 gün)`, points: -20 });
    if (m["first_order_at"] && r.last30 === 0) factors.push({ label: "Son 30 günde sipariş yok", points: -10 });
    const score = Math.max(0, 100 + factors.reduce((a, f) => a + f.points, 0));
    const ageDays = (now - Date.parse(s["created_at"])) / DAY;
    return { storeId: s["id"], name: s["name"], slug: s["slug"], plan: planName.get(s["plan_id"]) ?? "—", ageDays: Math.floor(ageDays), score, factors, declining: factors.some((f) => f.label.startsWith("Sipariş düşüşü")), stuck: ageDays > 7 && factors.some((f) => ["Ürün yok", "Ödeme yöntemi yok", "Yayında değil"].includes(f.label)) };
  });

  /* Ticaret */
  const providers = new Map<string, { provider: string; total: number; failed: number }>();
  for (const p of sc.payments) {
    if (!inRange(p["created_at"], range.from, range.to)) continue;
    const k = p["provider"] ?? "bilinmiyor";
    const e = providers.get(k) ?? { provider: k, total: 0, failed: 0 };
    e.total += 1;
    if (p["status"] === "failed") e.failed += 1;
    providers.set(k, e);
  }
  const storeName = new Map(sc.stores.map((s) => [s["id"], s["name"] as string]));
  const topStoresMap = new Map<string, { storeId: string; name: string; orders: number; gmv: number }>();
  for (const o of sc.orders) {
    if (!inRange(orderDate(o), range.from, range.to) || !PAID.has(o["payment_status"]) || o["status"] === "cancelled") continue;
    if ((o["currency"] ?? "TRY").toUpperCase() !== primary) continue;
    const e = topStoresMap.get(o["store_id"]) ?? { storeId: o["store_id"], name: storeName.get(o["store_id"]) ?? "—", orders: 0, gmv: 0 };
    e.orders += 1;
    e.gmv += Number(o["grand_total"] ?? 0);
    topStoresMap.set(o["store_id"], e);
  }

  /* Ürün / modül kullanımı (bağlı vs kullanılan) */
  const has = (rows: Row[], pred: (r: Row) => boolean) => new Set(rows.filter((r) => sc.ids.has(r["store_id"]) && pred(r)).map((r) => r["store_id"])).size;
  const total = sc.stores.length || 0;
  const modules = [
    { key: "theme", label: "Tema yayında", connected: has(ds.themes, () => true), used: has(ds.themes, (r) => !!r["is_published"]), usedLabel: "yayında tema" },
    { key: "xml", label: "XML entegratörü", connected: has(ds.xmlFeeds, (r) => !!r["is_active"]), used: has(ds.xmlRuns, (r) => inRange(r["created_at"], range.from, range.to)), usedLabel: "dönemde senkron çalıştı" },
    { key: "payments", label: "Ödeme yöntemi", connected: has(ds.payMethods, (r) => !!r["is_active"]), used: has(ds.payments, (r) => inRange(r["created_at"], range.from, range.to)), usedLabel: "dönemde ödeme aldı" },
    { key: "apps", label: "Uygulama mağazası", connected: has(ds.apps, (r) => r["status"] === "installed"), used: null as number | null, usedLabel: "kullanım olayı tutulmuyor" },
    { key: "domain", label: "Özel alan adı", connected: has(ds.domains, (r) => r["type"] === "custom"), used: has(ds.domains, (r) => r["type"] === "custom" && !!r["verified_at"]), usedLabel: "doğrulanmış" },
  ];

  /* Operasyon */
  const jobs = ds.jobs.filter((j) => inRange(j["created_at"], range.from, range.to));
  const waits = jobs.filter((j) => j["started_at"] && j["run_at"]).map((j) => (Date.parse(j["started_at"]) - Date.parse(j["run_at"])) / 1000).filter((x) => x >= 0);
  const wh = ds.webhooks.filter((w) => inRange(w["created_at"], range.from, range.to));
  const whDur = wh.map((w) => Number(w["duration_ms"])).filter((x) => Number.isFinite(x) && x > 0);
  const xr = ds.xmlRuns.filter((x) => inRange(x["created_at"], range.from, range.to));
  const api = ds.apiLogs.filter((a) => inRange(a["created_at"], range.from, range.to));
  const apiDur = api.map((a) => Number(a["duration_ms"])).filter((x) => Number.isFinite(x) && x >= 0).sort((a, b) => a - b);
  const in14 = Date.now() + 14 * DAY;
  const ops = {
    jobs: { total: jobs.length, failed: jobs.filter((j) => j["status"] === "failed").length, queued: jobs.filter((j) => j["status"] === "queued").length, medianWaitSec: median(waits) },
    webhooks: { total: wh.length, success: wh.filter((w) => w["status"] === "success").length, failed: wh.filter((w) => w["status"] === "failed").length, medianMs: median(whDur) },
    xml: { total: xr.length, success: xr.filter((x) => x["status"] === "success").length, partial: xr.filter((x) => x["status"] === "partial").length, failed: xr.filter((x) => x["status"] === "failed").length },
    shipping: { synced: ds.shipments.length, errors: ds.shipments.filter((s) => s["last_sync_error"]).length },
    paymentErrors: [...providers.values()].reduce((a, p) => a + p.failed, 0),
    api: { total: api.length, errors5xx: api.filter((a) => Number(a["status_code"]) >= 500).length, errors4xx: api.filter((a) => Number(a["status_code"]) >= 400 && Number(a["status_code"]) < 500).length, p50: apiDur.length ? apiDur[Math.floor(apiDur.length * 0.5)]! : null, p95: apiDur.length ? apiDur[Math.floor(apiDur.length * 0.95)]! : null },
    domains: { custom: ds.domains.filter((d) => d["type"] === "custom").length, failed: ds.domains.filter((d) => d["status"] === "failed").length, sslIssues: ds.domains.filter((d) => d["type"] === "custom" && d["verified_at"] && (d["ssl_status"] === "failed" || (d["ssl_expires_at"] && Date.parse(d["ssl_expires_at"]) < in14))).length },
  };

  /* Kural tabanlı içgörüler */
  const insights: { tone: "positive" | "negative" | "neutral"; title: string; detail: string; source: string; tab: string }[] = [];
  if (prev) {
    const g = safeChange(cur.gmv[primary] ?? 0, prev.gmv[primary] ?? 0);
    if (g !== null && prev.orders >= 10 && Math.abs(g) >= 15)
      insights.push({ tone: g > 0 ? "positive" : "negative", title: `GMV ${g > 0 ? "arttı" : "düştü"} (%${g.toFixed(1)})`, detail: `${primary} GMV, karşılaştırma dönemine göre değişti. Bu bir ilişki gözlemidir; nedeni ayrıca incelenmelidir.`, source: "orders · ödenmiş kapsam", tab: "commerce" });
    const pr = safeChange(cur.platformRevenue[primary] ?? 0, prev.platformRevenue[primary] ?? 0);
    if (pr !== null && Math.abs(pr) >= 15)
      insights.push({ tone: pr > 0 ? "positive" : "negative", title: `Platform geliri ${pr > 0 ? "arttı" : "düştü"} (%${pr.toFixed(1)})`, detail: "Tahsil edilmiş faturalar + komisyon kayıtları.", source: "invoices, ledger_entries", tab: "revenue" });
    if (cur.payments.total >= 20 && prev.payments.total >= 20 && cur.payments.rate !== null && prev.payments.rate !== null && cur.payments.rate - prev.payments.rate >= 3)
      insights.push({ tone: "negative", title: "Ödeme hataları arttı", detail: `Başarısızlık oranı %${prev.payments.rate.toFixed(1)} → %${cur.payments.rate.toFixed(1)}.`, source: "payments", tab: "operations" });
  }
  const conv = funnel[0]!.count >= 10 ? (funnel[5]!.count / funnel[0]!.count) * 100 : null;
  if (conv !== null && conv < 20) insights.push({ tone: "negative", title: `Yeni mağazaların %${conv.toFixed(0)}'i ilk siparişe ulaştı`, detail: `Dönemde açılan ${funnel[0]!.count} mağazanın ${funnel[5]!.count}'i ilk siparişini aldı.`, source: "stores, orders", tab: "sellers" });
  const stuck = health.filter((h) => h.stuck).length;
  if (stuck >= 3) insights.push({ tone: "neutral", title: `${stuck} mağaza onboarding'de takılı`, detail: "7 günden eski ve ürün/ödeme/yayın adımı eksik mağazalar.", source: "stores, products, store_payment_methods", tab: "sellers" });
  const declining = health.filter((h) => h.declining).length;
  if (declining >= 1) insights.push({ tone: "negative", title: `${declining} mağazada sipariş düşüşü`, detail: "Son 30 günde siparişi, önceki 30 güne göre yarıdan fazla azalan (önceki ≥ 5) mağazalar.", source: "orders", tab: "sellers" });

  const coverage = {
    truncated: ds.truncated,
    errors: ds.errors,
    partial,
    excludedDemoStores: ds.stores.filter((s) => s["is_demo"] || s["is_test"]).length,
    sessionsTracked: ds.sessions.length > 0,
    unsupported: [
      "Genişleyen/daralan MRR: plan değişiklik geçmişi tutulmuyor.",
      "LTV, CAC, geri ödeme süresi: platform edinme maliyeti verisi yok.",
      "Ülke filtresi: mağazalarda ülke alanı yok.",
      "Kayıt adımı: huni mağaza oluşturmadan başlar (kullanıcı kaydı ayrı olay olarak tutulmuyor).",
      "Blog ve uygulama gerçek kullanımı: modül kullanım olayları tutulmuyor.",
      "Uptime: ölçüm kaynağı yok. Kur dönüşümü: para birimleri ayrı gösterilir.",
      "Tahmin: güvenilir tahmin için yeterli geçmiş veri yok; tahmin üretilmez.",
    ],
  };

  return {
    range, compare, primary, fetchedAt: ds.fetchedAt,
    filters: {
      stores: sc.stores.length <= 500 ? ds.stores.filter((s) => !s["is_demo"] && !s["is_test"]).map((s) => ({ id: s["id"], name: s["name"] })) : [],
      plans: ds.plans.map((p) => ({ id: p["id"], name: p["name"] })),
      industries: [...new Set(ds.stores.map((s) => s["industry"]).filter(Boolean))].sort(),
      currencies: [...new Set(ds.orders.map((o) => (o["currency"] ?? "TRY").toUpperCase()))].sort(),
    },
    kpis: {
      current: cur, previous: prev,
      trialing: sc.subs.filter((s) => s["status"] === "trialing").length,
      paidStores: paidStore.size,
      published: sc.stores.filter((s) => s["status"] === "active" && s["published_at"]).length,
    },
    series,
    revenue: {
      mrr, arr: Object.fromEntries(Object.entries(mrr).map(([c, v]) => [c, v * 12])),
      byPlan: [...byPlan.values()].sort((a, b) => b.stores - a.stores),
      newMrr, churnedMrr, canceledCount,
      churnRate: churnBase ? (canceledCount / churnBase) * 100 : null,
      trial: { ended: trialEnded.length, converted: trialConverted, rate: trialEnded.length ? (trialConverted / trialEnded.length) * 100 : null },
      invoices: { collected: cur.subRevenue, open: openInvoices, openCount, overdue: overdueInvoices },
      commission: cur.commission,
      cohorts: [...subCohorts.entries()].sort().slice(-12).map(([month, v]) => ({ month, ...v })),
    },
    sellers: {
      funnel, ttfProductDays: ttfProduct, ttfOrderDays: ttfOrder,
      cohorts: [...storeCohorts.entries()].sort().slice(-12).map(([month, v]) => ({ month, ...v })),
      byIndustry: breakdown((s) => s["industry"] || "Belirtilmemiş"),
      byPlan: breakdown((s) => planName.get(s["plan_id"]) ?? "Plan yok"),
      byAge: breakdown((s) => ageBucketOf(s["created_at"])),
      stuck: health.filter((h) => h.stuck).sort((a, b) => a.score - b.score).slice(0, 50),
      declining: health.filter((h) => h.declining).slice(0, 50),
      healthAvg: health.length ? health.reduce((a, h) => a + h.score, 0) / health.length : null,
    },
    commerce: {
      providers: [...providers.values()].map((p) => ({ ...p, successRate: p.total ? ((p.total - p.failed) / p.total) * 100 : null })),
      topStores: [...topStoresMap.values()].sort((a, b) => b.gmv - a.gmv).slice(0, 15),
    },
    modules: modules.map((m) => ({ ...m, total })),
    ops,
    insights,
    coverage,
  };
}
export type CenterData = Awaited<ReturnType<typeof computeCenter>>;

/* ------------------------------------------------------------------ */
/* Özel rapor (aynı veri kümesi, izin listeli)                          */
/* ------------------------------------------------------------------ */

export async function computeReport(input: ReportInput) {
  const started = Date.now();
  const { range, compare } = resolveCenterRange(input);
  const windowFrom = compare && compare.from < range.from ? compare.from : range.from;
  const ds = await loadDataset(windowFrom, range.to);
  const sc = scope(ds, input);
  const planName = new Map(ds.plans.map((p) => [p["id"], p["name"] as string]));
  const storeById = new Map(sc.stores.map((s) => [s["id"], s]));
  const keyOf = (storeId: string, iso: string, currency?: string) => {
    const s = storeById.get(storeId) ?? {};
    const d = istDay(iso);
    switch (input.dimension) {
      case "day": return d;
      case "week": {
        const dt = new Date(`${d}T00:00:00Z`);
        dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
        return dt.toISOString().slice(0, 10);
      }
      case "month": return d.slice(0, 7);
      case "store": return (s["name"] as string) ?? "—";
      case "plan": return planName.get(s["plan_id"]) ?? "Plan yok";
      case "industry": return (s["industry"] as string) || "Belirtilmemiş";
      case "currency": return (currency ?? "TRY").toUpperCase();
      case "age": return s["created_at"] ? ageBucketOf(s["created_at"]) : "—";
    }
  };
  const groups = new Map<string, Record<string, number> & { _sellers?: never }>();
  const sellers = new Map<string, Set<string>>();
  const g = (k: string) => {
    let e = groups.get(k);
    if (!e) { e = { gmv: 0, orders: 0, net: 0, stores_new: 0, refunds: 0, payments_failed: 0 } as never; groups.set(k, e!); }
    return e!;
  };
  const oneCurrency = input.currency ?? null;
  for (const o of sc.orders) {
    const iso = orderDate(o);
    if (!inRange(iso, range.from, range.to) || o["status"] === "cancelled" || !PAID.has(o["payment_status"])) continue;
    const k = keyOf(o["store_id"], iso, o["currency"]);
    const e = g(k);
    e["gmv"]! += Number(o["grand_total"] ?? 0);
    e["net"]! += Number(o["grand_total"] ?? 0) - Number(o["tax_total"] ?? 0) - Number(o["shipping_total"] ?? 0);
    e["orders"]! += 1;
    const set = sellers.get(k) ?? new Set();
    set.add(o["store_id"]);
    sellers.set(k, set);
  }
  for (const r of sc.returns) {
    const iso = r["resolved_at"] ?? r["updated_at"];
    if (!inRange(iso, range.from, range.to)) continue;
    const e = g(keyOf(r["store_id"], iso, r["currency"]));
    e["refunds"]! += Number(r["refund_amount"] ?? 0);
    e["net"]! -= Number(r["refund_amount"] ?? 0);
  }
  for (const s of sc.stores) if (inRange(s["created_at"], range.from, range.to)) g(keyOf(s["id"], s["created_at"], s["currency"]))["stores_new"]! += 1;
  for (const p of sc.payments) if (inRange(p["created_at"], range.from, range.to) && p["status"] === "failed") g(keyOf(p["store_id"], p["created_at"], p["currency"]))["payments_failed"]! += 1;

  let rows = [...groups.entries()].map(([key, v]) => {
    const out: Record<string, number | string> = { key };
    for (const m of input.metrics) {
      if (m === "aov") out[m] = v["orders"] ? v["gmv"]! / v["orders"]! : 0;
      else if (m === "stores_selling") out[m] = sellers.get(key)?.size ?? 0;
      else if (m === "net_sales") out[m] = v["net"]!;
      else out[m] = v[m]!;
    }
    return out;
  });
  const first = input.metrics[0]!;
  if (input.sort === "dimension") rows.sort((a, b) => String(a["key"]).localeCompare(String(b["key"]), "tr"));
  else rows.sort((a, b) => (input.sort === "value_desc" ? 1 : -1) * (Number(b[first]) - Number(a[first])));
  const totalRows = rows.length;
  rows = rows.slice(0, input.limit);
  const mixedCurrency = !oneCurrency && new Set(sc.orders.map((o) => (o["currency"] ?? "TRY").toUpperCase())).size > 1 && input.dimension !== "currency";
  return { range, rows, totalRows, truncated: totalRows > input.limit || ds.truncated.length > 0, mixedCurrency, elapsedMs: Date.now() - started, fetchedAt: ds.fetchedAt };
}
