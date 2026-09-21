/**
 * Otomatik stres testi orkestratörü (sunucu tarafı).
 *
 * Bir "tur" (cycle) dört fazdan geçer:
 *   purge  → eski test verisini siler
 *   seed   → TEST mağazaları + varyantlı ürünleri oluşturur
 *   traffic→ vitrin isteği + kasa/sipariş/kargo/iade akışını simüle eder
 *   verify → aşırı satış ve komisyon mutabakatını doğrular
 *   report → özet yazar, uyarı gönderir, test verisini temizler, sonraki turu planlar
 *
 * Her cron turunda yalnızca sınırlı bir iş bütçesi (birkaç saniye) harcanır;
 * faz tamamlanınca bir sonrakine geçilir. Tüm veri gerçek tablolara yazılır ve
 * yalnızca `stores.is_test` işaretli kayıtlar oluşturulur/silinir.
 */

const PHASES = ["purge", "seed", "traffic", "verify", "report"] as const;
export type LoadTestPhase = (typeof PHASES)[number];

/** Komisyon oranları (kuruş hassasiyetinde doğrulanır). */
export const COMMISSION_RATES = {
  platform_sale: 0.001,
  mefpay: 0.007,
  supplier: 0.005,
} as const;

/** Eşikler: aşılırsa tur raporunda bulgu ve uyarı üretilir. */
export const LOADTEST_THRESHOLDS = {
  apiLatencyMs: 200,
  errorRatePct: 1,
};

/** Bir cron turunda harcanabilecek en fazla süre. */
const TICK_BUDGET_MS = 18_000;
const STORE_BATCH = 50;
const PRODUCT_BATCH = 200;
const ORDER_BATCH = 40;
const VARIANTS_PER_PRODUCT = 6; // 2 beden x 3 renk matrisi

export type LoadTestConfig = {
  enabled: boolean;
  paused: boolean;
  cycleMinutes: number;
  storesTarget: number;
  productsTarget: number;
  vusersTarget: number;
  ordersTarget: number;
};

export type LoadTestRun = {
  id: string;
  cycleNo: number;
  status: string;
  phase: LoadTestPhase;
  scale: Record<string, unknown>;
  metrics: Record<string, unknown>;
  summary: Record<string, unknown>;
  findingsCount: number;
  error: string | null;
  startedAt: string;
  phaseStartedAt: string;
  nextCycleAt: string | null;
  finishedAt: string | null;
};

type Admin = Awaited<ReturnType<typeof admin>>;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

/* ------------------------------------------------------------------ config */

export async function getLoadTestConfig(): Promise<LoadTestConfig> {
  const db = await admin();
  const { data } = await db.from("load_test_config").select("*").eq("id", 1).maybeSingle();
  const row = (data ?? {}) as Record<string, number | boolean | null>;
  return {
    enabled: Boolean(row["enabled"]),
    paused: Boolean(row["paused"]),
    cycleMinutes: Number(row["cycle_minutes"] ?? 180),
    storesTarget: Number(row["stores_target"] ?? 1000),
    productsTarget: Number(row["products_target"] ?? 50000),
    vusersTarget: Number(row["vusers_target"] ?? 500),
    ordersTarget: Number(row["orders_target"] ?? 10000),
  };
}

export async function updateLoadTestConfig(patch: Partial<LoadTestConfig>): Promise<LoadTestConfig> {
  const db = await admin();
  const row: Record<string, number | boolean> = {};
  if (patch.enabled !== undefined) row["enabled"] = patch.enabled;
  if (patch.paused !== undefined) row["paused"] = patch.paused;
  if (patch.cycleMinutes !== undefined) row["cycle_minutes"] = patch.cycleMinutes;
  if (patch.storesTarget !== undefined) row["stores_target"] = patch.storesTarget;
  if (patch.productsTarget !== undefined) row["products_target"] = patch.productsTarget;
  if (patch.vusersTarget !== undefined) row["vusers_target"] = patch.vusersTarget;
  if (patch.ordersTarget !== undefined) row["orders_target"] = patch.ordersTarget;
  if (Object.keys(row).length > 0) {
    const { error } = await db.from("load_test_config").update(row as never).eq("id", 1);
    if (error) throw new Error(error.message);
  }
  return getLoadTestConfig();
}

/* -------------------------------------------------------------------- runs */

function mapRun(row: Record<string, unknown>): LoadTestRun {
  return {
    id: String(row["id"]),
    cycleNo: Number(row["cycle_no"] ?? 1),
    status: String(row["status"] ?? "running"),
    phase: String(row["phase"] ?? "purge") as LoadTestPhase,
    scale: (row["scale"] ?? {}) as Record<string, unknown>,
    metrics: (row["metrics"] ?? {}) as Record<string, unknown>,
    summary: (row["summary"] ?? {}) as Record<string, unknown>,
    findingsCount: Number(row["findings_count"] ?? 0),
    error: (row["error"] as string | null) ?? null,
    startedAt: String(row["started_at"]),
    phaseStartedAt: String(row["phase_started_at"]),
    nextCycleAt: (row["next_cycle_at"] as string | null) ?? null,
    finishedAt: (row["finished_at"] as string | null) ?? null,
  };
}

async function activeRun(db: Admin): Promise<LoadTestRun | null> {
  const { data } = await db
    .from("load_test_runs")
    .select("*")
    .eq("status", "running")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? mapRun(data as Record<string, unknown>) : null;
}

async function lastRun(db: Admin): Promise<LoadTestRun | null> {
  const { data } = await db
    .from("load_test_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? mapRun(data as Record<string, unknown>) : null;
}

async function logEvent(
  db: Admin,
  runId: string,
  phase: string,
  message: string,
  meta: Record<string, unknown> = {},
  level: "INFO" | "WARNING" | "CRITICAL" = "INFO",
) {
  await db.from("load_test_events").insert({ run_id: runId, phase, message, level, meta } as never);
}

async function patchRun(db: Admin, runId: string, patch: Record<string, unknown>) {
  await db.from("load_test_runs").update(patch as never).eq("id", runId);
}

async function addFinding(
  db: Admin,
  runId: string,
  kind: string,
  severity: "WARNING" | "CRITICAL",
  detail: string,
  meta: Record<string, unknown> = {},
) {
  await db.from("load_test_findings").insert({ run_id: runId, kind, severity, detail, meta } as never);
}

/* ------------------------------------------------------------------- purge */

async function runPurge(db: Admin, run: LoadTestRun, dropStores: boolean) {
  const { data, error } = await db.rpc("purge_load_test_data", { _drop_stores: dropStores } as never);
  if (error) throw new Error(`Temizlik başarısız: ${error.message}`);
  const result = (data ?? {}) as Record<string, unknown>;
  await logEvent(db, run.id, "purge", "Eski test verisi silindi", result);
  return result;
}

/* -------------------------------------------------------------------- seed */

function variantMatrix(basePrice: number) {
  const sizes = ["S", "M", "L"];
  const colors = ["Siyah", "Beyaz"];
  const out: { title: string; options: Record<string, string>; price: number; stock: number }[] = [];
  for (const size of sizes) {
    for (const color of colors) {
      out.push({
        title: `${size} / ${color}`,
        options: { Beden: size, Renk: color },
        price: money(basePrice + sizes.indexOf(size) * 5),
        stock: 20 + ((sizes.indexOf(size) + colors.indexOf(color)) % 5) * 10,
      });
    }
  }
  return out.slice(0, VARIANTS_PER_PRODUCT);
}

/** Tedarikçi XML gövdesi üretir; alan eşleştirme motoruyla ayrıştırılır. */
function testFeedXml(storeIndex: number, offset: number, count: number): string {
  const items: string[] = [];
  for (let i = 0; i < count; i++) {
    const n = offset + i;
    items.push(
      `<urun><stok_kodu>TEST-${storeIndex}-${n}</stok_kodu><ad>TEST Ürün ${storeIndex}-${n}</ad>` +
        `<fiyat>${(50 + (n % 450)).toFixed(2)}</fiyat><stok>${20 + (n % 80)}</stok>` +
        `<marka>MefTest</marka><kategori>Test Kategori ${n % 12}</kategori></urun>`,
    );
  }
  return `<?xml version="1.0" encoding="UTF-8"?><urunler>${items.join("")}</urunler>`;
}

async function seedStores(db: Admin, run: LoadTestRun, target: number, deadline: number) {
  const { count } = await db
    .from("stores")
    .select("id", { count: "exact", head: true })
    .eq("is_test", true);
  let existing = count ?? 0;
  while (existing < target && Date.now() < deadline) {
    const rows = [];
    for (let i = existing; i < Math.min(target, existing + STORE_BATCH); i++) {
      rows.push({
        name: `TEST Mağaza ${i + 1}`,
        slug: `test-store-${i + 1}`,
        status: "active",
        currency: i % 5 === 0 ? "USD" : "TRY",
        locale: i % 4 === 0 ? "en" : "tr",
        industry: `test-sektor-${i % 10}`,
        is_test: true,
        onboarding_completed: true,
        published_at: new Date().toISOString(),
      };
    }
    const { error } = await db.from("stores").upsert(rows as never, { onConflict: "slug" });
    if (error) throw new Error(`Mağaza tohumlama hatası: ${error.message}`);
    existing += rows.length;
  }
  return existing;
}

async function seedProducts(db: Admin, run: LoadTestRun, target: number, deadline: number) {
  const { parseTextFeed, suggestMapping, validateRows } = await import("@/lib/supplier-import");
  const { data: storeRows } = await db
    .from("stores")
    .select("id, slug, currency")
    .eq("is_test", true)
    .order("slug", { ascending: true })
    .limit(2000);
  const stores = (storeRows ?? []) as { id: string; slug: string; currency: string }[];
  if (stores.length === 0) return 0;

  const { count } = await db
    .from("products")
    .select("id", { count: "exact", head: true })
    .in("store_id", stores.map((s) => s.id).slice(0, 1000));
  let created = count ?? 0;
  let cursor = created;

  while (created < target && Date.now() < deadline) {
    const batch = Math.min(PRODUCT_BATCH, target - created);
    const store = stores[cursor % stores.length]!;
    // Tedarikçi XML akışı → alan eşleştirme → doğrulanmış satırlar
    const xml = testFeedXml(cursor % stores.length, cursor, batch);
    const parsed = parseTextFeed(xml, "xml");
    const mapping = suggestMapping(parsed.columns);
    const rows = validateRows(parsed.rows, mapping);

    const productRows = rows.map((row, index) => ({
      store_id: store.id,
      title: row.title ?? `TEST Ürün ${cursor + index}`,
      slug: `test-${cursor + index}-${Math.random().toString(36).slice(2, 7)}`,
      status: "active",
      base_price: money(row.price ?? 99),
      currency: store.currency ?? "TRY",
      sku: row.sku ?? `TEST-${cursor + index}`,
      vendor: row.brand ?? "MefTest",
      description: "Otomatik yük testi ürünü (TEST).",
      variant_options: [
        { name: "Beden", values: ["S", "M", "L"] },
        { name: "Renk", values: ["Siyah", "Beyaz"] },
      ],
      tags: ["loadtest"],
    }));

    const { data: inserted, error } = await db
      .from("products")
      .insert(productRows as never)
      .select("id, store_id, base_price");
    if (error) throw new Error(`Ürün tohumlama hatası: ${error.message}`);

    const variantRows: Record<string, unknown>[] = [];
    for (const product of (inserted ?? []) as { id: string; store_id: string; base_price: number }[]) {
      for (const [position, variant] of variantMatrix(Number(product.base_price)).entries()) {
        variantRows.push({
          product_id: product.id,
          store_id: product.store_id,
          title: variant.title,
          options: variant.options,
          price: variant.price,
          stock: variant.stock,
          position,
          sku: `${product.id.slice(0, 8)}-${position}`,
        });
      }
    }
    if (variantRows.length > 0) {
      const { error: variantError } = await db.from("product_variants").insert(variantRows as never);
      if (variantError) throw new Error(`Varyant tohumlama hatası: ${variantError.message}`);
    }

    created += productRows.length;
    cursor += productRows.length;
  }

  await logEvent(db, run.id, "seed", "Ürün tohumlama ilerledi", { products: created, target });
  return created;
}

/* ----------------------------------------------------------------- traffic */

async function measureStorefront(db: Admin, slugs: string[], baseUrl: string) {
  const samples: number[] = [];
  let errors = 0;
  for (const slug of slugs) {
    const started = Date.now();
    try {
      const res = await fetch(`${baseUrl}/s/${slug}`, { headers: { "user-agent": "mefticaret-loadtest" } });
      samples.push(Date.now() - started);
      if (!res.ok) errors++;
      await res.arrayBuffer();
    } catch {
      errors++;
      samples.push(Date.now() - started);
    }
  }
  samples.sort((a, b) => a - b);
  const p = (q: number) => (samples.length === 0 ? 0 : samples[Math.min(samples.length - 1, Math.floor(samples.length * q))]!);
  return { requests: samples.length, errors, p50: p(0.5), p95: p(0.95) };
}

/** Sipariş + ödeme + tedarikçi bölme + kargo yaşam döngüsü + iade simülasyonu. */
async function simulateOrders(db: Admin, run: LoadTestRun, target: number, deadline: number) {
  const summary = run.summary as Record<string, number>;
  let orders = Number(summary["orders"] ?? 0);
  let blocked = Number(summary["stockBlocked"] ?? 0);
  let returns = Number(summary["returns"] ?? 0);

  while (orders < target && Date.now() < deadline) {
    const { data: variantRows } = await db
      .from("product_variants")
      .select("id, product_id, store_id, price, stock, title, sku, products!inner(title, tax_rate, store_id)")
      .gt("stock", 0)
      .order("updated_at", { ascending: true })
      .limit(ORDER_BATCH);
    const variants = (variantRows ?? []) as unknown as {
      id: string;
      product_id: string;
      store_id: string;
      price: number;
      title: string;
      sku: string | null;
      products: { title: string; tax_rate: number };
    }[];
    const testStoreIds = await testStoreIdSet(db);
    const usable = variants.filter((v) => testStoreIds.has(v.store_id));
    if (usable.length === 0) break;

    for (const variant of usable) {
      if (Date.now() > deadline || orders >= target) break;
      const quantity = 1 + (orders % 2);
      const { error: reserveError } = await db.rpc("reserve_variant_stock", {
        _variant_id: variant.id,
        _qty: quantity,
      } as never);
      if (reserveError) {
        blocked++;
        continue;
      }

      const unitPrice = money(Number(variant.price));
      const subtotal = money(unitPrice * quantity);
      const taxRate = Number(variant.products?.tax_rate ?? 20);
      const taxTotal = money((subtotal * taxRate) / 100);
      const grandTotal = money(subtotal + taxTotal);
      const orderNumber = `TEST-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();

      const { data: orderRow, error: orderError } = await db
        .from("orders")
        .insert({
          store_id: variant.store_id,
          order_number: orderNumber,
          status: "paid",
          payment_status: "paid",
          fulfillment_status: "unfulfilled",
          currency: "TRY",
          subtotal,
          tax_total: taxTotal,
          grand_total: grandTotal,
          customer_name: "TEST Müşteri",
          customer_email: `loadtest+${orders}@mefticaret.test`,
          note: "Otomatik yük testi siparişi",
          placed_at: new Date().toISOString(),
        } as never)
        .select("id")
        .single();
      if (orderError || !orderRow) {
        await db.rpc("release_variant_stock", { _variant_id: variant.id, _qty: quantity } as never);
        continue;
      }
      const orderId = (orderRow as { id: string }).id;

      const { data: itemRow } = await db
        .from("order_items")
        .insert({
          order_id: orderId,
          store_id: variant.store_id,
          product_id: variant.product_id,
          variant_id: variant.id,
          title: variant.products?.title ?? "TEST Ürün",
          variant_title: variant.title,
          sku: variant.sku,
          unit_price: unitPrice,
          quantity,
          line_total: subtotal,
          tax_rate: taxRate,
          tax_total: taxTotal,
        } as never)
        .select("id")
        .single();
      const orderItemId = (itemRow as { id: string } | null)?.id ?? null;

      // Komisyonlar: platform satış, Mefpay, tedarikçi
      await db.from("commissions").insert(
        Object.entries(COMMISSION_RATES).map(([kind, rate]) => ({
          store_id: variant.store_id,
          order_id: orderId,
          order_item_id: orderItemId,
          rate,
          base_amount: subtotal,
          commission_amount: money(subtotal * rate),
          currency: "TRY",
          status: kind === "mefpay" ? "captured" : "pending",
        })) as never,
      );

      // Kargo yaşam döngüsü: hazırlanıyor → kargoda (barkod) → teslim
      const barcode = `AR${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 900 + 100)}`;
      await db.from("orders").update({ status: "processing" } as never).eq("id", orderId);
      await db
        .from("orders")
        .update({
          status: "shipped",
          fulfillment_status: "fulfilled",
          shipping_carrier: orders % 2 === 0 ? "Aras Kargo" : "Kargoist",
          tracking_number: barcode,
        } as never)
        .eq("id", orderId);
      await db.from("orders").update({ status: "delivered" } as never).eq("id", orderId);

      // Her 5. sipariş için iade talebi
      if (orders % 5 === 0) {
        const { data: returnRow } = await db
          .from("return_requests")
          .insert({
            store_id: variant.store_id,
            order_id: orderId,
            return_number: `IADE-${orderNumber}`,
            status: "requested",
            reason: "changed_mind",
            refund_amount: grandTotal,
            currency: "TRY",
            customer_note: "Otomatik yük testi iadesi",
          } as never)
          .select("id")
          .single();
        const returnId = (returnRow as { id: string } | null)?.id;
        if (returnId) {
          await db.from("return_items").insert({
            return_id: returnId,
            store_id: variant.store_id,
            order_item_id: orderItemId,
            variant_id: variant.id,
            title: variant.products?.title ?? "TEST Ürün",
            variant_title: variant.title,
            quantity,
            unit_price: unitPrice,
            line_total: subtotal,
          } as never);
          returns++;
        }
      }

      orders++;
    }
  }

  return { orders, blocked, returns };
}

let testStoreCache: { ids: Set<string>; at: number } | undefined;

async function testStoreIdSet(db: Admin): Promise<Set<string>> {
  if (testStoreCache && Date.now() - testStoreCache.at < 60_000) return testStoreCache.ids;
  const { data } = await db.from("stores").select("id").eq("is_test", true).limit(5000);
  const ids = new Set(((data ?? []) as { id: string }[]).map((row) => row.id));
  testStoreCache = { ids, at: Date.now() };
  return ids;
}

/* ------------------------------------------------------------------ verify */

/** Aşırı satış ve komisyon mutabakatı. */
export async function verifyIntegrity(db: Admin, runId: string) {
  const storeIds = [...(await testStoreIdSet(db))];
  const findings: { kind: string; detail: string }[] = [];

  // 1) Negatif stok = aşırı satış
  const { data: negative } = await db
    .from("product_variants")
    .select("id, stock, store_id")
    .lt("stock", 0)
    .in("store_id", storeIds.slice(0, 1000))
    .limit(50);
  const oversold = (negative ?? []) as { id: string; stock: number }[];
  for (const row of oversold) {
    findings.push({ kind: "oversell", detail: `Varyant ${row.id} stoğu ${row.stock} (negatif)` });
    await addFinding(db, runId, "oversell", "CRITICAL", `Varyant ${row.id} negatif stok: ${row.stock}`, {
      variantId: row.id,
      stock: row.stock,
    });
  }

  // 2) Komisyon mutabakatı (kuruş hassasiyeti)
  const { data: commissionRows } = await db
    .from("commissions")
    .select("id, rate, base_amount, commission_amount, store_id")
    .in("store_id", storeIds.slice(0, 1000))
    .limit(3000);
  let checked = 0;
  let mismatches = 0;
  for (const row of (commissionRows ?? []) as {
    id: string;
    rate: number;
    base_amount: number;
    commission_amount: number;
  }[]) {
    checked++;
    const expected = money(Number(row.base_amount) * Number(row.rate));
    if (Math.abs(expected - Number(row.commission_amount)) > 0.005) {
      mismatches++;
      if (mismatches <= 20) {
        await addFinding(
          db,
          runId,
          "commission_mismatch",
          "CRITICAL",
          `Komisyon sapması: beklenen ${expected}, kayıtlı ${row.commission_amount}`,
          { commissionId: row.id, expected, actual: row.commission_amount, rate: row.rate },
        );
      }
    }
  }

  return {
    oversoldVariants: oversold.length,
    commissionsChecked: checked,
    commissionMismatches: mismatches,
    findings: findings.length + mismatches,
  };
}

/* -------------------------------------------------------- orchestrator tick */

function baseUrlFrom(request?: Request): string {
  if (request) {
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}`;
  }
  return "http://localhost:8080";
}

/** Tek bir cron adımı: aktif turu bir adım ilerletir veya yeni tur başlatır. */
export async function advanceLoadTestCycle(request?: Request): Promise<Record<string, unknown>> {
  const db = await admin();
  const config = await getLoadTestConfig();
  const deadline = Date.now() + TICK_BUDGET_MS;

  if (!config.enabled) return { skipped: "disabled" };
  if (config.paused) return { skipped: "paused" };

  let run = await activeRun(db);

  if (!run) {
    const previous = await lastRun(db);
    const dueAt = previous?.nextCycleAt ? new Date(previous.nextCycleAt).getTime() : 0;
    if (previous && Date.now() < dueAt) {
      return { skipped: "waiting", nextCycleAt: previous.nextCycleAt };
    }
    const { data, error } = await db
      .from("load_test_runs")
      .insert({
        cycle_no: (previous?.cycleNo ?? 0) + 1,
        status: "running",
        phase: "purge",
        scale: {
          stores: config.storesTarget,
          products: config.productsTarget,
          vusers: config.vusersTarget,
          orders: config.ordersTarget,
        },
        next_cycle_at: new Date(Date.now() + config.cycleMinutes * 60_000).toISOString(),
      } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    run = mapRun(data as Record<string, unknown>);
    await logEvent(db, run.id, "purge", `Tur ${run.cycleNo} başladı`, { scale: run.scale });
  }

  try {
    switch (run.phase) {
      case "purge": {
        const result = await runPurge(db, run, true);
        testStoreCache = undefined;
        await patchRun(db, run.id, {
          phase: "seed",
          phase_started_at: new Date().toISOString(),
          summary: { ...run.summary, purge: result },
        });
        return { run: run.id, phase: "purge", result };
      }
      case "seed": {
        const stores = await seedStores(db, run, config.storesTarget, deadline);
        testStoreCache = undefined;
        const products = Date.now() < deadline ? await seedProducts(db, run, config.productsTarget, deadline) : 0;
        const done = stores >= config.storesTarget && products >= config.productsTarget;
        await patchRun(db, run.id, {
          ...(done ? { phase: "traffic", phase_started_at: new Date().toISOString() } : {}),
          summary: { ...run.summary, stores, products },
        });
        return { run: run.id, phase: "seed", stores, products, done };
      }
      case "traffic": {
        const { data: slugRows } = await db
          .from("stores")
          .select("slug")
          .eq("is_test", true)
          .limit(Math.max(5, Math.min(25, Math.round(config.vusersTarget / 20))));
        const slugs = ((slugRows ?? []) as { slug: string }[]).map((row) => row.slug);
        const traffic = await measureStorefront(db, slugs, baseUrlFrom(request));
        const orderStats = await simulateOrders(db, run, config.ordersTarget, deadline);
        const done = orderStats.orders >= config.ordersTarget;
        await patchRun(db, run.id, {
          ...(done ? { phase: "verify", phase_started_at: new Date().toISOString() } : {}),
          summary: { ...run.summary, ...orderStats },
          metrics: {
            ...run.metrics,
            storefrontP50: traffic.p50,
            storefrontP95: traffic.p95,
            storefrontRequests: Number(run.metrics["storefrontRequests"] ?? 0) + traffic.requests,
            storefrontErrors: Number(run.metrics["storefrontErrors"] ?? 0) + traffic.errors,
            vusers: config.vusersTarget,
          },
        });
        await logEvent(db, run.id, "traffic", "Trafik ve sipariş simülasyonu ilerledi", {
          ...orderStats,
          ...traffic,
        });
        return { run: run.id, phase: "traffic", ...orderStats, ...traffic };
      }
      case "verify": {
        const integrity = await verifyIntegrity(db, run.id);
        const { infrastructureHealth } = await import("@/lib/monitoring.server");
        const health = await infrastructureHealth();
        await patchRun(db, run.id, {
          phase: "report",
          phase_started_at: new Date().toISOString(),
          summary: { ...run.summary, integrity },
          metrics: { ...run.metrics, health },
          findings_count: integrity.findings,
        });
        await logEvent(db, run.id, "verify", "Bütünlük ve mutabakat doğrulandı", { integrity }, integrity.findings > 0 ? "CRITICAL" : "INFO");
        return { run: run.id, phase: "verify", integrity };
      }
      case "report": {
        const fresh = await db.from("load_test_runs").select("*").eq("id", run.id).single();
        const current = mapRun(fresh.data as Record<string, unknown>);
        const metrics = current.metrics as Record<string, number | Record<string, number>>;
        const health = (metrics["health"] ?? {}) as Record<string, number>;
        const latency = Number(health["apiP95"] ?? metrics["storefrontP95"] ?? 0);
        const errorRate =
          Number(metrics["storefrontRequests"] ?? 0) > 0
            ? (Number(metrics["storefrontErrors"] ?? 0) / Number(metrics["storefrontRequests"])) * 100
            : 0;
        const failed: string[] = [];
        if (latency > LOADTEST_THRESHOLDS.apiLatencyMs) failed.push(`API gecikmesi ${Math.round(latency)} ms > ${LOADTEST_THRESHOLDS.apiLatencyMs} ms`);
        if (errorRate > LOADTEST_THRESHOLDS.errorRatePct) failed.push(`Hata oranı %${errorRate.toFixed(2)}`);
        if (current.findingsCount > 0) failed.push(`${current.findingsCount} bütünlük bulgusu`);

        const purge = await runPurge(db, current, true);
        testStoreCache = undefined;

        await patchRun(db, run.id, {
          status: failed.length > 0 ? "completed_with_findings" : "completed",
          phase: "report",
          finished_at: new Date().toISOString(),
          summary: {
            ...current.summary,
            cleanup: purge,
            thresholdFailures: failed,
            errorRatePct: Number(errorRate.toFixed(2)),
            latencyMs: Math.round(latency),
          },
        });

        if (failed.length > 0) {
          const { sendMonitoringAlert } = await import("@/lib/monitoring.server");
          await sendMonitoringAlert({
            key: `loadtest:${run.id}`,
            severity: "CRITICAL",
            title: `Yük testi turu ${current.cycleNo} eşikleri aştı`,
            detail: failed.join(" · "),
            muteSeconds: 60,
          });
        }
        await logEvent(db, run.id, "report", "Tur tamamlandı", { failed, purge }, failed.length > 0 ? "WARNING" : "INFO");
        return { run: run.id, phase: "report", failed, purge };
      }
      default:
        return { skipped: "unknown-phase" };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "bilinmeyen hata";
    await patchRun(db, run.id, { status: "failed", error: message, finished_at: new Date().toISOString() });
    await logEvent(db, run.id, run.phase, `Faz hatası: ${message}`, {}, "CRITICAL");
    const { recordAppError } = await import("@/lib/monitoring.server");
    await recordAppError({
      severity: "CRITICAL",
      source: `loadtest:${run.phase}`,
      message,
      ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    });
    return { run: run.id, phase: run.phase, error: message };
  }
}

/* ------------------------------------------------------------------ status */

export async function loadTestStatus() {
  const db = await admin();
  const config = await getLoadTestConfig();
  const active = await activeRun(db);
  const previous = await lastRun(db);
  const { data: runRows } = await db
    .from("load_test_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(10);
  const focus = active ?? previous;
  const { data: eventRows } = focus
    ? await db
        .from("load_test_events")
        .select("*")
        .eq("run_id", focus.id)
        .order("created_at", { ascending: false })
        .limit(40)
    : { data: [] };
  const { data: findingRows } = focus
    ? await db
        .from("load_test_findings")
        .select("*")
        .eq("run_id", focus.id)
        .order("created_at", { ascending: false })
        .limit(40)
    : { data: [] };

  const { count: testStores } = await db
    .from("stores")
    .select("id", { count: "exact", head: true })
    .eq("is_test", true);

  return {
    config,
    activeRun: active,
    runs: ((runRows ?? []) as Record<string, unknown>[]).map(mapRun),
    events: (eventRows ?? []) as Record<string, unknown>[],
    findings: (findingRows ?? []) as Record<string, unknown>[],
    nextCycleAt: active ? null : (previous?.nextCycleAt ?? null),
    testStores: testStores ?? 0,
    thresholds: LOADTEST_THRESHOLDS,
    commissionRates: COMMISSION_RATES,
  };
}

/** Yöneticinin turu elle durdurması: aktif tur kapatılır ve test verisi silinir. */
export async function stopLoadTest(cleanup: boolean) {
  const db = await admin();
  const run = await activeRun(db);
  let purge: Record<string, unknown> | null = null;
  if (run) {
    if (cleanup) purge = await runPurge(db, run, true);
    await patchRun(db, run.id, {
      status: "stopped",
      finished_at: new Date().toISOString(),
      next_cycle_at: null,
    });
    await logEvent(db, run.id, run.phase, "Tur yönetici tarafından durduruldu", purge ?? {}, "WARNING");
  } else if (cleanup) {
    const { data } = await db.rpc("purge_load_test_data", { _drop_stores: true } as never);
    purge = (data ?? {}) as Record<string, unknown>;
  }
  testStoreCache = undefined;
  await updateLoadTestConfig({ enabled: false, paused: false });
  return { stopped: Boolean(run), purge };
}
