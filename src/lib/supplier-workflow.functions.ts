import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Tedarikçi iş akışı: mağaza → tedarikçi satın alma siparişi, durum takibi,
 * mesajlaşma, tedarikçi XML beslemesi ve iyzico/PayTR ile ödeme alma.
 * Her çağrı tedarikçi (portal_user_id), mağaza yöneticisi veya platform
 * yöneticisi olarak sunucuda doğrulanır.
 */

const assertSupplier = async (supabase: any, userId: string, supplierId: string) => {
  const { listPortalSuppliers } = await import("@/lib/supplier-portal.server");
  const suppliers = await listPortalSuppliers(supabase, userId);
  const supplier = suppliers.find((row) => row.id === supplierId);
  if (!supplier) throw new Error("Bu tedarikçi kaydına erişiminiz yok");
  return supplier;
};

const admin = async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as never as { from: (table: string) => any };
};

/* ----------------------------- Tedarikçi -------------------------------- */

export const supplierWorkflowOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ supplierId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supplier = await assertSupplier(context.supabase, context.userId, data.supplierId);
    const db = await admin();
    const lib = await import("@/lib/supplier-workflow.server");
    const [orders, messages, feeds, payment] = await Promise.all([
      lib.loadPurchaseOrders(db, { supplierIds: [supplier.id] }),
      lib.loadMessages(db, supplier.id),
      db
        .from("supplier_xml_feeds")
        .select("id, name, source_url, is_active, last_run_at, last_status, last_error, stats, sale_markup_percent")
        .eq("supplier_id", supplier.id)
        .order("created_at", { ascending: true }),
      lib.loadSupplierPaymentSettings(db, supplier.id),
    ]);
    return {
      orders,
      messages,
      unread: messages.filter((m) => m.senderRole !== "supplier" && !m.readAt).length,
      feeds: ((feeds.data ?? []) as any[]).map((feed) => ({
        id: String(feed.id),
        name: String(feed.name),
        sourceUrl: String(feed.source_url),
        markupPercent: Number(feed.sale_markup_percent ?? 0) || 0,
        isActive: Boolean(feed.is_active),
        lastRunAt: (feed.last_run_at as string | null) ?? null,
        lastStatus: (feed.last_status as string | null) ?? null,
        lastError: (feed.last_error as string | null) ?? null,
        stats: (feed.stats ?? {}) as { totalRows?: number; created?: number; updated?: number; skipped?: number },
      })),
      payment: payment
        ? {
            provider: payment.provider,
            test: payment.provider === "iyzico" ? payment.settings["sandbox"] !== false : payment.settings["test_mode"] !== false,
          }
        : null,
    };
  });

export const supplierUpdatePurchaseOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        supplierId: z.guid(),
        purchaseOrderId: z.guid(),
        supplierStatus: z.enum(["accepted", "preparing", "shipped", "rejected"]),
        carrier: z.string().trim().max(80).optional(),
        trackingNumber: z.string().trim().max(80).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supplier = await assertSupplier(context.supabase, context.userId, data.supplierId);
    const db = await admin();
    const { data: row } = await db
      .from("purchase_orders")
      .select("id, store_id, code, status")
      .eq("id", data.purchaseOrderId)
      .eq("supplier_id", supplier.id)
      .maybeSingle();
    if (!row || row.status === "draft") throw new Error("Sipariş bulunamadı");
    if (row.status === "cancelled" || row.status === "received") throw new Error("Bu sipariş kapanmış");
    if (data.supplierStatus === "shipped" && !data.trackingNumber) {
      throw new Error("Kargoya vermek için takip numarası girin");
    }
    const patch: Record<string, unknown> = { supplier_status: data.supplierStatus };
    if (data.carrier !== undefined) patch["carrier"] = data.carrier || null;
    if (data.trackingNumber !== undefined) patch["tracking_number"] = data.trackingNumber || null;
    if (data.supplierStatus === "shipped") patch["shipped_at"] = new Date().toISOString();
    const { error } = await db.from("purchase_orders").update(patch).eq("id", row.id);
    if (error) throw new Error(error.message);
    const labels = { accepted: "kabul edildi", preparing: "hazırlanıyor", shipped: "kargoya verildi", rejected: "reddedildi" };
    await db.from("supplier_messages").insert({
      store_id: row.store_id,
      supplier_id: supplier.id,
      purchase_order_id: row.id,
      sender_role: "supplier",
      sender_user_id: context.userId,
      body:
        `${row.code} siparişi ${labels[data.supplierStatus]}.` +
        (data.supplierStatus === "shipped" ? ` ${data.carrier ?? ""} takip no: ${data.trackingNumber}` : ""),
    });
    return { ok: true };
  });

export const supplierSendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ supplierId: z.guid(), body: z.string().trim().min(1).max(4000), purchaseOrderId: z.guid().optional() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supplier = await assertSupplier(context.supabase, context.userId, data.supplierId);
    const db = await admin();
    if (data.purchaseOrderId) {
      const { data: po } = await db.from("purchase_orders").select("id").eq("id", data.purchaseOrderId).eq("supplier_id", supplier.id).maybeSingle();
      if (!po) throw new Error("Sipariş bulunamadı");
    }
    const { error } = await db.from("supplier_messages").insert({
      store_id: supplier.store_id,
      supplier_id: supplier.id,
      purchase_order_id: data.purchaseOrderId ?? null,
      sender_role: "supplier",
      sender_user_id: context.userId,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const supplierMarkMessagesRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ supplierId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supplier = await assertSupplier(context.supabase, context.userId, data.supplierId);
    const { markRead } = await import("@/lib/supplier-workflow.server");
    await markRead(await admin(), supplier.id, "supplier");
    return { ok: true };
  });

export const supplierSaveFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        supplierId: z.guid(),
        name: z.string().trim().min(2).max(120),
        sourceUrl: z.string().trim().url().max(2000),
        markupPercent: z.number().min(0).max(1000).default(0),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supplier = await assertSupplier(context.supabase, context.userId, data.supplierId);
    const { assertPublicUrl } = await import("@/lib/safe-fetch.server");
    assertPublicUrl(data.sourceUrl);
    const db = await admin();
    const { count } = await db.from("supplier_xml_feeds").select("id", { count: "exact", head: true }).eq("supplier_id", supplier.id);
    if ((count ?? 0) >= 10) throw new Error("En fazla 10 XML beslemesi eklenebilir");
    const { data: created, error } = await db
      .from("supplier_xml_feeds")
      .insert({ supplier_id: supplier.id, store_id: supplier.store_id, name: data.name, source_url: data.sourceUrl, sale_markup_percent: data.markupPercent })
      .select("id, supplier_id, store_id, source_url, field_mapping, sale_markup_percent")
      .single();
    if (error) throw new Error(error.message);
    // Eklenen besleme hemen ilk kez yüklenir; hata olursa besleme kalır ve hata mesajı döner.
    const { runSupplierFeed } = await import("@/lib/supplier-workflow.server");
    try {
      const stats = await runSupplierFeed(db, created as never, supplier.currency || "TRY");
      return { id: String(created.id), stats, error: null as string | null };
    } catch (cause) {
      return { id: String(created.id), stats: null, error: cause instanceof Error ? cause.message : "Besleme yüklenemedi" };
    }
  });

/** Beslemenin mağaza satış fiyatı kâr oranını günceller. */
export const supplierSetFeedMarkup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ supplierId: z.guid(), feedId: z.guid(), markupPercent: z.number().min(0).max(1000) }).parse(data))
  .handler(async ({ data, context }) => {
    const supplier = await assertSupplier(context.supabase, context.userId, data.supplierId);
    const db = await admin();
    const { error } = await db.from("supplier_xml_feeds").update({ sale_markup_percent: data.markupPercent }).eq("id", data.feedId).eq("supplier_id", supplier.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Tek bir tedarikçi ürününün mağaza satış fiyatını belirler. */
export const supplierSetSalePrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ supplierId: z.guid(), productId: z.guid(), salePrice: z.number().min(0).max(100_000_000) }).parse(data))
  .handler(async ({ data, context }) => {
    const supplier = await assertSupplier(context.supabase, context.userId, data.supplierId);
    const db = await admin();
    const { data: row, error } = await db.from("supplier_products").update({ computed_price: data.salePrice }).eq("id", data.productId).eq("supplier_id", supplier.id).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Ürün bulunamadı");
    const { propagateToImporters } = await import("@/lib/supplier-catalog.server");
    await propagateToImporters(db, supplier.id);
    return { ok: true };
  });

export const supplierDeleteFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ supplierId: z.guid(), feedId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supplier = await assertSupplier(context.supabase, context.userId, data.supplierId);
    const db = await admin();
    const { error } = await db.from("supplier_xml_feeds").delete().eq("id", data.feedId).eq("supplier_id", supplier.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const supplierRunFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ supplierId: z.guid(), feedId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supplier = await assertSupplier(context.supabase, context.userId, data.supplierId);
    const { consumeRateLimit, RATE_LIMITS } = await import("@/lib/rate-limit.server");
    const limit = await consumeRateLimit(`supplier_feed:${context.userId}`, RATE_LIMITS.import_trigger);
    if (!limit.allowed) throw new Error("Çok fazla deneme. Bir dakika sonra tekrar deneyin.");
    const db = await admin();
    const { data: feed } = await db
      .from("supplier_xml_feeds")
      .select("id, supplier_id, store_id, source_url, field_mapping, sale_markup_percent")
      .eq("id", data.feedId)
      .eq("supplier_id", supplier.id)
      .maybeSingle();
    if (!feed) throw new Error("Besleme bulunamadı");
    const { runSupplierFeed } = await import("@/lib/supplier-workflow.server");
    return runSupplierFeed(db, feed, supplier.currency || "TRY");
  });

const paymentSchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("iyzico"),
    supplierId: z.guid(),
    apiKey: z.string().trim().min(8).max(200),
    secretKey: z.string().trim().min(8).max(200),
    test: z.boolean(),
  }),
  z.object({
    provider: z.literal("paytr"),
    supplierId: z.guid(),
    merchantId: z.string().trim().min(3).max(40),
    merchantKey: z.string().trim().min(8).max(200),
    merchantSalt: z.string().trim().min(8).max(200),
    test: z.boolean(),
  }),
]);

/** Tedarikçinin kendi iyzico / PayTR üye işyeri anahtarlarını kaydeder (geri okunmaz). */
export const supplierSavePaymentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => paymentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const supplier = await assertSupplier(context.supabase, context.userId, data.supplierId);
    const settings =
      data.provider === "iyzico"
        ? { api_key: data.apiKey, secret_key: data.secretKey, sandbox: data.test }
        : { merchant_id: data.merchantId, merchant_key: data.merchantKey, merchant_salt: data.merchantSalt, test_mode: data.test };
    const db = await admin();
    const { error } = await db
      .from("supplier_payment_settings")
      .upsert({ supplier_id: supplier.id, provider: data.provider, settings, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------- Mağaza --------------------------------- */

export const storeSupplierWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const db = await admin();
    const lib = await import("@/lib/supplier-workflow.server");
    const orders = await lib.loadPurchaseOrders(db, { storeId: data.storeId });
    const supplierIds = Array.from(new Set(orders.map((o) => o.supplierId).filter(Boolean)));
    const { data: payRows } = supplierIds.length
      ? await db.from("supplier_payment_settings").select("supplier_id, provider").in("supplier_id", supplierIds)
      : { data: [] };
    const { data: unreadRows } = await db
      .from("supplier_messages")
      .select("supplier_id")
      .eq("store_id", data.storeId)
      .eq("sender_role", "supplier")
      .is("read_at", null);
    const unread: Record<string, number> = {};
    for (const row of (unreadRows ?? []) as any[]) unread[row.supplier_id] = (unread[row.supplier_id] ?? 0) + 1;
    return {
      orders: orders.map((order) => ({
        ...order,
        payProvider: ((payRows ?? []) as any[]).find((row) => row.supplier_id === order.supplierId)?.provider ?? null,
      })),
      unread,
    };
  });

export const storeSupplierThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), supplierId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const db = await admin();
    const { data: supplier } = await db.from("suppliers").select("id").eq("id", data.supplierId).eq("store_id", data.storeId).maybeSingle();
    if (!supplier) throw new Error("Tedarikçi bulunamadı");
    const lib = await import("@/lib/supplier-workflow.server");
    await lib.markRead(db, data.supplierId, "store");
    return lib.loadMessages(db, data.supplierId);
  });

export const storeSendSupplierMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ storeId: z.guid(), supplierId: z.guid(), body: z.string().trim().min(1).max(4000), purchaseOrderId: z.guid().optional() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const db = await admin();
    const { data: supplier } = await db.from("suppliers").select("id").eq("id", data.supplierId).eq("store_id", data.storeId).maybeSingle();
    if (!supplier) throw new Error("Tedarikçi bulunamadı");
    const { error } = await db.from("supplier_messages").insert({
      store_id: data.storeId,
      supplier_id: data.supplierId,
      purchase_order_id: data.purchaseOrderId ?? null,
      sender_role: "store",
      sender_user_id: context.userId,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Mağaza, tedarikçinin kendi iyzico/PayTR hesabı üzerinden siparişi kartla öder. */
export const storePayPurchaseOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), purchaseOrderId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const db = await admin();
    const lib = await import("@/lib/supplier-workflow.server");
    const [order] = await lib.loadPurchaseOrders(db, { storeId: data.storeId, ids: [data.purchaseOrderId] }, 1);
    if (!order) throw new Error("Sipariş bulunamadı");
    if (order.paymentStatus === "paid") throw new Error("Bu sipariş zaten ödendi");
    if (order.status === "cancelled") throw new Error("İptal edilen sipariş ödenemez");
    if (order.total <= 0) throw new Error("Sipariş tutarı sıfır");
    const pay = await lib.loadSupplierPaymentSettings(db, order.supplierId);
    if (!pay) throw new Error("Tedarikçi henüz ödeme hesabı (iyzico/PayTR) tanımlamadı");

    const { data: store } = await db.from("stores").select("name, slug").eq("id", data.storeId).maybeSingle();
    const { data: me } = await context.supabase.auth.getUser();
    const request = getRequest();
    const origin = new URL(request.url).origin;
    const ip = (request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "127.0.0.1").split(",")[0]!.trim();
    const gw = await import("@/lib/store-gateways.server");
    const gatewayOrder = {
      id: order.id,
      storeId: data.storeId,
      slug: String(store?.slug ?? ""),
      orderNumber: order.code,
      amount: order.total,
      currency: order.currency,
      email: me.user?.email ?? "magaza@mefticaret.com",
      name: String(store?.name ?? "Mağaza"),
      phone: "",
      address: {},
    };
    const back = `${origin}/store/${data.storeId}/purchasing?po=${order.id}`;
    const url =
      pay.provider === "iyzico"
        ? await gw.createIyzicoPayment(pay.settings, gatewayOrder, { origin, ip, callbackUrl: `${origin}/api/public/pay/supplier-iyzico/${order.id}` })
        : await gw.createPaytrPayment(pay.settings, gatewayOrder, { origin, ip, backUrl: back });
    await db.from("purchase_orders").update({ payment_status: "pending", payment_provider: pay.provider }).eq("id", order.id).neq("payment_status", "paid");
    return { url };
  });

/* --------------------------- Süper Yönetici ----------------------------- */

const assertAdmin = async (supabase: any, userId: string) => {
  const { assertPlatformAdmin } = await import("@/lib/platform-admin.server");
  await assertPlatformAdmin(supabase, userId);
};

export const adminSupplierOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const [{ data: suppliers }, { data: payouts }, { data: stores }] = await Promise.all([
      db
        .from("suppliers")
        .select("id, name, store_id, email, portal_user_id, portal_enabled, is_active, created_at")
        .not("portal_user_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(300),
      db
        .from("supplier_payout_requests")
        .select("id, store_id, supplier_id, amount, currency, iban, account_name, status, note, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      db.from("stores").select("id, name").order("name").limit(1000),
    ]);
    const lib = await import("@/lib/supplier-workflow.server");
    const ids = ((suppliers ?? []) as any[]).map((s) => s.id);
    const orders = ids.length ? await lib.loadPurchaseOrders(db, { supplierIds: ids }, 100) : [];
    // Tedarikçi sayfasından kayıt olup henüz bir tedarikçi kaydına bağlanmamış hesaplar.
    const linked = new Set(((suppliers ?? []) as any[]).map((s) => s.portal_user_id as string));
    const pending: { userId: string; email: string; name: string | null; createdAt: string; confirmed: boolean }[] = [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (let page = 1; page <= 20; page += 1) {
      const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (listError) break;
      for (const u of list.users) {
        if (u.user_metadata?.["signup_kind"] !== "supplier" || linked.has(u.id) || !u.email) continue;
        pending.push({ userId: u.id, email: u.email, name: (u.user_metadata?.["full_name"] as string | null) ?? null, createdAt: u.created_at, confirmed: Boolean(u.email_confirmed_at) });
      }
      if (list.users.length < 200) break;
    }
    pending.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const storeName = new Map(((stores ?? []) as any[]).map((s) => [s.id, s.name as string]));
    const supplierName = new Map(((suppliers ?? []) as any[]).map((s) => [s.id, s.name as string]));
    return {
      stores: ((stores ?? []) as any[]).map((s) => ({ id: String(s.id), name: String(s.name) })),
      pending,
      suppliers: ((suppliers ?? []) as any[]).map((s) => ({
        id: String(s.id),
        name: String(s.name),
        storeName: storeName.get(s.store_id) ?? "—",
        email: (s.email as string | null) ?? null,
        portalEnabled: Boolean(s.portal_enabled),
      })),
      payouts: ((payouts ?? []) as any[]).map((p) => ({
        id: String(p.id),
        supplierName: supplierName.get(p.supplier_id) ?? "Tedarikçi",
        storeName: storeName.get(p.store_id) ?? "—",
        amount: Number(p.amount) || 0,
        currency: String(p.currency ?? "TRY"),
        iban: String(p.iban ?? ""),
        accountName: (p.account_name as string | null) ?? null,
        status: String(p.status),
        note: (p.note as string | null) ?? null,
        createdAt: String(p.created_at),
      })),
      orders: orders.map((o) => ({ ...o, supplierName: supplierName.get(o.supplierId) ?? "—", storeName: storeName.get(o.storeId) ?? "—" })),
    };
  });

/** Bir mağaza sahibine, seçilen mağazanın tedarikçisi olarak portal erişimi verir. */
export const adminGrantSupplierAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        buyerStoreId: z.guid().optional(),
        email: z.string().trim().email().max(200),
        supplierName: z.string().trim().max(160).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const email = data.email.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let userId: string | null = null;
    let metaName: string | null = null;
    for (let page = 1; page <= 20 && !userId; page += 1) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      const hit = list.users.find((u) => (u.email ?? "").toLowerCase() === email);
      if (hit) {
        userId = hit.id;
        metaName = (hit.user_metadata?.["full_name"] as string | undefined) ?? null;
      }
      if (list.users.length < 200) break;
    }
    if (!userId) throw new Error("Bu e-postayla kayıtlı kullanıcı bulunamadı");

    // Tedarikçinin mevcut kaydı varsa (hangi mağazada olursa olsun) yeniden aç.
    const { data: existingRows } = data.buyerStoreId
      ? await db
          .from("suppliers")
          .select("id")
          .eq("portal_user_id", userId)
          .eq("store_id", data.buyerStoreId)
          .limit(1)
          .returns<{ id: string }[]>()
      : await db.from("suppliers").select("id").eq("portal_user_id", userId).limit(1).returns<{ id: string }[]>();
    const existing = existingRows?.[0];
    if (existing) {
      await db.from("suppliers").update({ portal_enabled: true, is_active: true }).eq("id", existing.id);
      return { id: String(existing.id), created: false };
    }

    // Mağaza seçilmediyse kayıt, yöneticinin kendi mağazasına (yoksa ilk mağazaya) bağlanır;
    // katalog herkese açık olduğundan tüm mağazalar tedarikçiyi görür.
    let storeId = data.buyerStoreId ?? null;
    if (!storeId) {
      const { data: own } = await db.from("stores").select("id").eq("owner_id", context.userId).order("created_at").limit(1);
      storeId = own?.[0]?.id ?? null;
    }
    if (!storeId) {
      const { data: first } = await db.from("stores").select("id").order("created_at").limit(1);
      storeId = first?.[0]?.id ?? null;
    }
    if (!storeId) throw new Error("Tedarikçi kaydı için platformda en az bir mağaza olmalı");
    const name = (data.supplierName && data.supplierName.length >= 2 ? data.supplierName : metaName) || email.split("@")[0];

    const { data: created, error } = await db
      .from("suppliers")
      .insert({
        store_id: storeId,
        name,
        is_public_catalog: true,
        email,
        is_active: true,
        portal_user_id: userId,
        portal_enabled: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: String(created.id), created: true };
  });

export const adminSetSupplierPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ supplierId: z.guid(), enabled: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { error } = await db.from("suppliers").update({ portal_enabled: data.enabled }).eq("id", data.supplierId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Süper yönetici tedarikçi ödeme talebini işler; "ödendi" hakedişleri kapatır. */
export const adminProcessSupplierPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ payoutId: z.guid(), status: z.enum(["approved", "paid", "rejected"]), adminNote: z.string().trim().max(500).optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { data: request } = await db
      .from("supplier_payout_requests")
      .select("id, store_id, supplier_id, amount, status")
      .eq("id", data.payoutId)
      .maybeSingle();
    if (!request) throw new Error("Ödeme talebi bulunamadı");
    if (request.status === "paid" || request.status === "rejected") throw new Error("Bu talep zaten kapanmış");
    const { error } = await db
      .from("supplier_payout_requests")
      .update({ status: data.status, admin_note: data.adminNote ?? null, processed_at: new Date().toISOString() })
      .eq("id", request.id);
    if (error) throw new Error(error.message);
    if (data.status !== "paid") return { ok: true, settled: 0 };
    const { data: entries } = await db
      .from("supplier_commission_entries")
      .select("id, net_amount")
      .eq("supplier_id", request.supplier_id)
      .in("status", ["pending", "payable"])
      .order("created_at", { ascending: true });
    let remaining = Number(request.amount) || 0;
    const settled: string[] = [];
    for (const entry of (entries ?? []) as any[]) {
      const net = Number(entry.net_amount) || 0;
      if (net > remaining + 0.01) break;
      remaining -= net;
      settled.push(String(entry.id));
    }
    if (settled.length) {
      await db.from("supplier_commission_entries").update({ status: "paid", payout_request_id: request.id }).in("id", settled);
    }
    return { ok: true, settled: settled.length };
  });
