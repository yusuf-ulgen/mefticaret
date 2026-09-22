import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Tedarikçi portalı sunucu fonksiyonları: fulfillment masası, toplu ürün
 * yükleme, otomatik senkron, komisyon defteri ve ödeme talepleri.
 * Her çağrıda kullanıcının kendi tedarikçi kayıtları doğrulanır.
 */

const assertSupplier = async (supabase: any, userId: string, supplierId?: string) => {
  const { listPortalSuppliers } = await import("@/lib/supplier-portal.server");
  const suppliers = await listPortalSuppliers(supabase, userId);
  if (!suppliers.length) throw new Error("Tedarikçi portal erişiminiz bulunmuyor");
  if (!supplierId) return { suppliers, supplier: suppliers[0]! };
  const supplier = suppliers.find((row) => row.id === supplierId);
  if (!supplier) throw new Error("Bu tedarikçi kaydına erişiminiz yok");
  return { suppliers, supplier };
};

/** İçe aktarma tetikleyicileri: kullanıcı başına 10 istek/dakika. */
const assertImportRate = async (userId: string) => {
  const { consumeRateLimit, RATE_LIMITS } = await import("@/lib/rate-limit.server");
  const result = await consumeRateLimit(`supplier_import:${userId}`, RATE_LIMITS.import_trigger);
  if (!result.allowed) {
    throw new Error("Çok fazla içe aktarma denemesi. Lütfen bir dakika sonra tekrar deneyin.");
  }
};

const rowSchema = z.object({
  index: z.number(),
  sku: z.string().trim().min(1).max(120),
  barcode: z.string().max(120).nullable(),
  title: z.string().trim().min(1).max(400),
  description: z.string().max(8000).nullable(),
  shortDescription: z.string().max(1000).nullable().default(null),
  costPrice: z.number().finite().min(0).max(100_000_000),
  retailPrice: z.number().finite().min(0).max(100_000_000).nullable(),
  discountPrice: z.number().finite().min(0).max(100_000_000).nullable().default(null),
  taxRate: z.number().finite().min(0).max(100).nullable().default(null),
  stock: z.number().int().min(0).max(10_000_000),
  category: z.string().max(200).nullable(),
  categoryPath: z.array(z.string().max(200)).max(6).default([]),
  brand: z.string().max(200).nullable(),
  images: z.array(z.string().max(2000)).max(20),
  videos: z
    .array(
      z.object({
        url: z.string(),
        source: z.string(),
        embedUrl: z.string(),
        thumbnailUrl: z.string().nullable(),
      }),
    )
    .max(6)
    .default([]),
  color: z.string().max(120).nullable(),
  size: z.string().max(120).nullable(),
  currency: z.string().max(10).nullable(),
  fabric: z.string().max(200).nullable().default(null),
  modelSize: z.string().max(200).nullable().default(null),
  hsCode: z.string().max(40).nullable().default(null),
  weight: z.number().finite().min(0).max(100_000).nullable().default(null),
  variants: z
    .array(
      z.object({
        name: z.string(),
        value: z.string(),
        barcode: z.string().nullable(),
        stock: z.number(),
        price: z.number().nullable(),
        image: z.string().nullable(),
      }),
    )
    .max(60)
    .default([]),
  warnings: z.array(z.string()).default([]),
  errors: z.array(z.string()),
});

export const supplierDeskOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { listPortalSuppliers } = await import("@/lib/supplier-portal.server");
    const suppliers = await listPortalSuppliers(supabase, userId);
    if (!suppliers.length) {
      // Erişim yoksa hata fırlatmak yerine boş panel durumu döndürülür.
      return {
        hasAccess: false as boolean,
        suppliers: [] as {
          id: string;
          name: string;
          storeId: string;
          currency: string;
          leadTimeDays: number | null;
        }[],
        orders: [] as Awaited<
          ReturnType<typeof import("@/lib/supplier-desk.server").loadSupplierDeskOrders>
        >,
        ledger: [] as Awaited<
          ReturnType<typeof import("@/lib/supplier-desk.server").loadSupplierLedger>
        >["ledger"],
        payouts: [] as Awaited<
          ReturnType<typeof import("@/lib/supplier-desk.server").loadSupplierLedger>
        >["payouts"],
        products: [] as Awaited<
          ReturnType<typeof import("@/lib/supplier-desk.server").loadSupplierWorkspace>
        >["products"],
        rfqs: [] as Awaited<
          ReturnType<typeof import("@/lib/supplier-desk.server").loadSupplierWorkspace>
        >["rfqs"],
        credit: null as Awaited<
          ReturnType<typeof import("@/lib/supplier-desk.server").loadSupplierWorkspace>
        >["credit"],
        transactions: [] as Awaited<
          ReturnType<typeof import("@/lib/supplier-desk.server").loadSupplierWorkspace>
        >["transactions"],
        movements: [] as Awaited<
          ReturnType<typeof import("@/lib/supplier-desk.server").loadSupplierWorkspace>
        >["movements"],
      };
    }
    const supplierIds = suppliers.map((supplier) => supplier.id);

    const { loadSupplierDeskOrders, loadSupplierLedger, loadSupplierWorkspace } = await import(
      "@/lib/supplier-desk.server"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [orders, ledger, workspace] = await Promise.all([
      loadSupplierDeskOrders(supabaseAdmin as never, supplierIds, 200),
      loadSupplierLedger(supabaseAdmin as never, suppliers as never),
      loadSupplierWorkspace(supabaseAdmin as never, suppliers as never),
    ]);

    return {
      hasAccess: true as boolean,
      suppliers: suppliers.map((supplier) => ({
        id: supplier.id,
        name: supplier.name,
        storeId: supplier.store_id,
        currency: supplier.currency || "TRY",
        leadTimeDays: supplier.lead_time_days,
      })),
      orders,
      ledger: ledger.ledger,
      payouts: ledger.payouts,
      ...workspace,
    };
  });

/** Tedarikçinin kendi ürünlerinden gerçek RFQ teklifi oluşturur. */
export const supplierDeskCreateRfq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    supplierId: z.guid(), companyName: z.string().trim().min(2).max(200),
    validDays: z.number().int().min(1).max(180).default(30),
    items: z.array(z.object({ supplierProductId: z.guid(), quantity: z.number().int().min(1).max(100000) })).min(1).max(50),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supplier } = await assertSupplier(context.supabase, context.userId, data.supplierId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids = data.items.map((item) => item.supplierProductId);
    const { data: products, error } = await supabaseAdmin.from("supplier_products")
      .select("id, title, sku, supplier_price, computed_price, currency").eq("supplier_id", supplier.id).eq("store_id", supplier.store_id).in("id", ids);
    if (error) throw new Error(error.message);
    if ((products ?? []).length !== ids.length) throw new Error("Teklif ürünlerinden biri bu tedarikçiye ait değil");
    const rows = (products ?? []) as any[];
    const items = data.items.map((item) => {
      const product = rows.find((row) => row.id === item.supplierProductId);
      const unitPrice = Number(product?.computed_price ?? product?.supplier_price ?? 0);
      return { supplierProductId: item.supplierProductId, title: String(product?.title ?? "Ürün"), sku: product?.sku ?? null, quantity: item.quantity, unitPrice, lineTotal: unitPrice * item.quantity };
    });
    const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const reference = `RFQ-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const validUntil = new Date(Date.now() + data.validDays * 86_400_000).toISOString().slice(0, 10);
    const { data: created, error: insertError } = await supabaseAdmin.from("rfq_requests").insert({
      store_id: supplier.store_id, supplier_id: supplier.id, reference, company_name: data.companyName,
      currency: supplier.currency || "TRY", items, requested_total: total, quoted_total: total,
      status: "quoted", valid_until: validUntil,
    }).select("id").single();
    if (insertError) throw new Error(insertError.message);
    return { id: (created as { id: string }).id, reference, total };
  });

/** Teklifi onaylar ve bağlı gerçek satın alma siparişini üretir. */
export const supplierDeskApproveRfq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ supplierId: z.guid(), rfqId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supplier } = await assertSupplier(context.supabase, context.userId, data.supplierId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rfq, error } = await supabaseAdmin.from("rfq_requests").select("*")
      .eq("id", data.rfqId).eq("supplier_id", supplier.id).eq("store_id", supplier.store_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!rfq) throw new Error("Teklif bulunamadı veya yetkiniz yok");
    if (rfq.purchase_order_id) return { purchaseOrderId: rfq.purchase_order_id };
    const items = Array.isArray(rfq.items) ? rfq.items as any[] : [];
    if (!items.length) throw new Error("Teklifte sipariş kalemi bulunmuyor");
    const productIds = items.map((item) => item.supplierProductId).filter(Boolean);
    const { data: products } = await supabaseAdmin.from("supplier_products").select("id, product_id, variant_id, title, sku")
      .eq("supplier_id", supplier.id).in("id", productIds);
    if ((products ?? []).length !== productIds.length) throw new Error("Teklif ürünleri doğrulanamadı");
    const code = `SA-${String(rfq.reference).replace(/^RFQ-/, "")}`;
    const { data: order, error: orderError } = await supabaseAdmin.from("purchase_orders").insert({
      store_id: supplier.store_id, supplier_id: supplier.id, code, status: "ordered",
      currency: rfq.currency || supplier.currency || "TRY", expected_at: rfq.valid_until,
      note: `${rfq.reference} teklifinden oluşturuldu`, created_by: context.userId,
    }).select("id").single();
    if (orderError) throw new Error(orderError.message);
    const purchaseOrderId = (order as { id: string }).id;
    const details = items.map((item) => {
      const product = (products ?? []).find((row: any) => row.id === item.supplierProductId) as any;
      return { store_id: supplier.store_id, purchase_order_id: purchaseOrderId, product_id: product?.product_id ?? null,
        variant_id: product?.variant_id ?? null, title: item.title, sku: item.sku ?? product?.sku ?? null,
        quantity: Number(item.quantity), unit_cost: Number(item.unitPrice) };
    });
    const { error: itemError } = await supabaseAdmin.from("purchase_order_items").insert(details);
    if (itemError) {
      await supabaseAdmin.from("purchase_orders").delete().eq("id", purchaseOrderId);
      throw new Error(itemError.message);
    }
    const { error: updateError } = await supabaseAdmin.from("rfq_requests").update({ status: "won", purchase_order_id: purchaseOrderId }).eq("id", rfq.id);
    if (updateError) throw new Error(updateError.message);
    return { purchaseOrderId };
  });

/** Banka bilgisi (IBAN) kaydı. */
export const supplierDeskSaveBank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        supplierId: z.guid(),
        iban: z.string().trim().min(15).max(40),
        accountName: z.string().trim().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supplier } = await assertSupplier(supabase, userId, data.supplierId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const iban = data.iban.replace(/\s+/g, "").toUpperCase();
    if (!/^[A-Z]{2}[0-9A-Z]{13,32}$/.test(iban)) throw new Error("IBAN biçimi geçersiz");
    const { error } = await supabaseAdmin
      .from("suppliers")
      .update({ iban, bank_account_name: data.accountName || null } as never)
      .eq("id", supplier.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Ödeme (havale) talebi oluşturur. */
export const supplierDeskRequestPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        supplierId: z.guid(),
        amount: z.number().positive().max(10_000_000),
        note: z.string().trim().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supplier } = await assertSupplier(supabase, userId, data.supplierId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: detail } = await supabaseAdmin
      .from("suppliers")
      .select("iban, bank_account_name, currency")
      .eq("id", supplier.id)
      .maybeSingle();
    const iban = (detail as { iban?: string } | null)?.iban;
    if (!iban) throw new Error("Önce IBAN bilginizi kaydedin");

    const { data: entries } = await supabaseAdmin
      .from("supplier_commission_entries")
      .select("net_amount, status")
      .eq("supplier_id", supplier.id);
    const available = ((entries ?? []) as any[])
      .filter((entry) => entry.status !== "paid" && entry.status !== "cancelled")
      .reduce((total, entry) => total + (Number(entry.net_amount) || 0), 0);

    const { data: openRequests } = await supabaseAdmin
      .from("supplier_payout_requests")
      .select("amount, status")
      .eq("supplier_id", supplier.id)
      .in("status", ["requested", "approved"]);
    const reserved = ((openRequests ?? []) as any[]).reduce(
      (total, row) => total + (Number(row.amount) || 0),
      0,
    );

    if (data.amount > available - reserved + 0.01) {
      throw new Error("Talep edilen tutar ödenebilir bakiyenizi aşıyor");
    }

    const { error } = await supabaseAdmin.from("supplier_payout_requests").insert({
      store_id: supplier.store_id,
      supplier_id: supplier.id,
      amount: data.amount,
      currency: (detail as { currency?: string } | null)?.currency || supplier.currency || "TRY",
      iban,
      account_name: (detail as { bank_account_name?: string } | null)?.bank_account_name ?? null,
      status: "requested",
      note: data.note ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Mağaza yöneticisi: tedarikçi ödeme talebini işler (onay / ödendi / red). */
export const storeProcessSupplierPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        payoutId: z.guid(),
        status: z.enum(["approved", "paid", "rejected"]),
        adminNote: z.string().trim().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: request, error } = await supabase
      .from("supplier_payout_requests")
      .select("id, supplier_id, amount, status")
      .eq("id", data.payoutId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!request) throw new Error("Ödeme talebi bulunamadı");

    // RLS: yalnız mağaza yöneticisi güncelleyebilir.
    const { error: updateError } = await supabase
      .from("supplier_payout_requests")
      .update({
        status: data.status,
        admin_note: data.adminNote ?? null,
        processed_at: new Date().toISOString(),
      })
      .eq("id", data.payoutId);
    if (updateError) throw new Error(updateError.message);

    if (data.status !== "paid") return { ok: true, settled: 0 };

    const { data: entries } = await supabase
      .from("supplier_commission_entries")
      .select("id, net_amount, status")
      .eq("store_id", data.storeId)
      .eq("supplier_id", (request as { supplier_id: string }).supplier_id)
      .in("status", ["pending", "payable"])
      .order("created_at", { ascending: true });

    let remaining = Number((request as { amount: number }).amount) || 0;
    const settled: string[] = [];
    for (const entry of (entries ?? []) as any[]) {
      const net = Number(entry.net_amount) || 0;
      if (net > remaining + 0.01) break;
      remaining -= net;
      settled.push(entry.id as string);
    }
    if (settled.length) {
      const { error: settleError } = await supabase
        .from("supplier_commission_entries")
        .update({ status: "paid", payout_request_id: data.payoutId })
        .in("id", settled);
      if (settleError) throw new Error(settleError.message);
    }
    return { ok: true, settled: settled.length };
  });
