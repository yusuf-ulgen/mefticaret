import { z } from "zod";

import { recordAudit } from "@/lib/audit.server";
import type {
  QnbpaySettingsInput,
  chargeItemSchema,
  createChargeLinkSchema,
  installmentQuerySchema,
} from "@/lib/qnbpay-schemas";
import * as qnbpay from "@/lib/qnbpay.server";

/**
 * QNBpay yönetim akışları (yalnızca platform yöneticisi).
 * Tüm tahsilatlar tek ayar satırı üzerinden yapılandırılır; kart verisi saklanmaz.
 */

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function admin(): Promise<Admin> {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}

async function loadSettingsRow(db: Admin) {
  const { data, error } = await db.from("qnbpay_settings").select("*").limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("QNBpay ayar satırı bulunamadı.");
  return data as unknown as qnbpay.QnbpaySettingsRow & { id: string };
}

function credentialsOf(row: qnbpay.QnbpaySettingsRow) {
  return qnbpay.resolveCredentials(row);
}

function origin(row: qnbpay.QnbpaySettingsRow): string {
  const configured = row.return_origin?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const fallback = process.env["QNBPAY_RETURN_ORIGIN"] ?? process.env["PUBLIC_SITE_ORIGIN"];
  if (fallback) return fallback.replace(/\/$/, "");
  return "https://mefticaret.com";
}

export type QnbpayOverview = {
  settings: {
    environment: qnbpay.QnbpayEnv;
    isEnabled: boolean;
    testMerchantKey: string;
    testAppId: string;
    liveMerchantKey: string;
    liveAppId: string;
    currencyCode: string;
    maxInstallments: number;
    selectedInstallments: number[];
    isCommissionFromUser: boolean;
    transactionType: "Auth" | "PreAuth";
    paymentCompletedBy: "app" | "merchant";
    force3d: boolean;
    saleWebhookKey: string | null;
    refundWebhookKey: string | null;
    returnOrigin: string;
  };
  configured: boolean;
  secretConfigured: boolean;
  baseUrl: string;
  saleWebhookUrl: string;
  refundWebhookUrl: string;
  returnUrl: string;
  cancelUrl: string;
  testCards: typeof qnbpay.TEST_CARDS;
};

export async function loadOverview(): Promise<QnbpayOverview> {
  const db = await admin();
  const row = await loadSettingsRow(db);
  const credentials = credentialsOf(row);
  const base = origin(row);
  return {
    settings: {
      environment: credentials.environment,
      isEnabled: row.is_enabled,
      testMerchantKey: row.test_merchant_key,
      testAppId: row.test_app_id,
      liveMerchantKey: row.live_merchant_key,
      liveAppId: row.live_app_id,
      currencyCode: row.currency_code,
      maxInstallments: row.max_installments,
      selectedInstallments: row.selected_installments ?? [],
      isCommissionFromUser: row.is_commission_from_user,
      transactionType: row.transaction_type === "PreAuth" ? "PreAuth" : "Auth",
      paymentCompletedBy: row.payment_completed_by === "merchant" ? "merchant" : "app",
      force3d: row.force_3d,
      saleWebhookKey: row.sale_webhook_key,
      refundWebhookKey: row.refund_webhook_key,
      returnOrigin: base,
    },
    configured: qnbpay.isConfigured(credentials),
    secretConfigured: Boolean(credentials.appSecret),
    baseUrl: credentials.baseUrl,
    saleWebhookUrl: `${base}/api/public/qnbpay/sale-webhook`,
    refundWebhookUrl: `${base}/api/public/qnbpay/refund-webhook`,
    returnUrl: `${base}/odeme-tamam`,
    cancelUrl: `${base}/odeme-tamam?iptal=1`,
    testCards: qnbpay.TEST_CARDS,
  };
}

export async function saveSettings(input: QnbpaySettingsInput, actorId: string) {
  const db = await admin();
  const row = await loadSettingsRow(db);
  const { error } = await db
    .from("qnbpay_settings")
    .update({
      environment: input.environment,
      is_enabled: input.isEnabled,
      test_merchant_key: input.testMerchantKey,
      test_app_id: input.testAppId,
      live_merchant_key: input.liveMerchantKey,
      live_app_id: input.liveAppId,
      currency_code: input.currencyCode,
      max_installments: input.maxInstallments,
      selected_installments: input.selectedInstallments,
      is_commission_from_user: input.isCommissionFromUser,
      transaction_type: input.transactionType,
      payment_completed_by: input.paymentCompletedBy,
      force_3d: input.force3d,
      sale_webhook_key: input.saleWebhookKey || null,
      refund_webhook_key: input.refundWebhookKey || null,
      return_origin: input.returnOrigin || null,
    })
    .eq("id", row.id);
  if (error) throw new Error(error.message);

  await recordAudit(db, {
    action: "qnbpay.settings.saved",
    actorId,
    entity: "qnbpay_settings",
    entityId: row.id,
    newValue: { environment: input.environment, isEnabled: input.isEnabled },
  });
  return loadOverview();
}

export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  const db = await admin();
  const row = await loadSettingsRow(db);
  const credentials = credentialsOf(row);
  if (!qnbpay.isConfigured(credentials)) {
    return {
      ok: false,
      message: "Üye işyeri anahtarı, uygulama kimliği veya gizli anahtar eksik.",
    };
  }
  try {
    const result = await qnbpay.verifyConnection(credentials);
    const mode =
      result.is3d === 0
        ? "yalnızca 2D"
        : result.is3d === 2
          ? "yalnızca 3D"
          : result.is3d === 4
            ? "markalı ödeme sayfası"
            : "2D/3D";
    return {
      ok: true,
      message: `Bağlantı başarılı (${credentials.environment === "live" ? "canlı" : "test"} ortamı, ${mode}).`,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Bağlantı kurulamadı." };
  }
}

export async function listInstallments(input: z.infer<typeof installmentQuerySchema>) {
  const db = await admin();
  const row = await loadSettingsRow(db);
  const credentials = credentialsOf(row);
  return qnbpay.getPos(credentials, {
    creditCard: input.creditCard,
    amount: input.amount,
    currencyCode: input.currency,
    commissionFromUser: row.is_commission_from_user,
  });
}

export async function loadCommissions(currency: "TRY" | "USD" | "EUR") {
  const db = await admin();
  const row = await loadSettingsRow(db);
  const credentials = credentialsOf(row);
  const [commissions, installments] = await Promise.all([
    qnbpay.getCommissions(credentials, currency).catch(
      (error: unknown): Record<string, unknown> => ({
        error: error instanceof Error ? error.message : "Komisyon bilgisi alınamadı",
      }),
    ),
    qnbpay.getActiveInstallments(credentials, { currencyCode: currency, amount: 100 }).catch(
      (error: unknown): Record<string, unknown> => ({
        error: error instanceof Error ? error.message : "Taksit bilgisi alınamadı",
      }),
    ),
  ]);
  return {
    commissions: JSON.stringify(commissions, null, 2),
    installments: JSON.stringify(installments, null, 2),
  };
}

/** Benzersiz fatura numarası (QNBpay tarafında tekil olmak zorunda). */
function newInvoiceRef(prefix: string): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${stamp}${rand}`;
}

const PREFIX: Record<string, string> = {
  plan: "PLN",
  theme: "THM",
  app: "APP",
  commission: "COM",
  invoice: "INV",
  other: "MEF",
};

export async function createChargeLink(
  input: z.infer<typeof createChargeLinkSchema>,
  actorId: string,
) {
  const db = await admin();
  const row = await loadSettingsRow(db);
  const credentials = credentialsOf(row);
  if (!row.is_enabled) throw new Error("QNBpay tahsilatı kapalı. Ayarlar sekmesinden açın.");
  if (!qnbpay.isConfigured(credentials)) throw new Error("QNBpay bilgileri eksik.");

  const base = origin(row);
  const invoiceRef = newInvoiceRef(PREFIX[input.purpose] ?? "MEF");
  const result = await qnbpay.createPaymentLink(credentials, {
    invoiceId: invoiceRef,
    description: input.description,
    total: input.amount,
    currencyCode: input.currency,
    returnUrl: `${base}/odeme-tamam`,
    cancelUrl: `${base}/odeme-tamam?iptal=1`,
    name: input.buyerName,
    surname: input.buyerSurname,
    items: [
      {
        name: input.description,
        price: input.amount,
        quantity: 1,
        description: input.description,
      },
    ],
    commissionFromUser: row.is_commission_from_user,
    ...(input.selectedInstallments?.length
      ? { selectedInstallments: input.selectedInstallments }
      : {}),
  });

  const { data, error } = await db
    .from("qnbpay_transactions")
    .insert({
      environment: credentials.environment,
      purpose: input.purpose,
      store_id: input.storeId ?? null,
      charge_item_code: input.chargeItemCode ?? null,
      qnbpay_invoice_id: invoiceRef,
      order_id: result.orderId,
      amount: input.amount,
      currency: input.currency,
      installment: 1,
      status: "pending",
      transaction_type: row.transaction_type,
      checkout_url: result.link,
      description: input.description,
      request_summary: {
        buyer: `${input.buyerName} ${input.buyerSurname}`,
        purpose: input.purpose,
        chargeItemCode: input.chargeItemCode ?? null,
      },
      response_summary: result.raw as never,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await recordAudit(db, {
    action: "qnbpay.link.created",
    actorId,
    entity: "qnbpay_transactions",
    entityId: data.id,
    newValue: { invoiceRef, amount: input.amount, currency: input.currency },
  });

  return { id: data.id, invoiceRef, link: result.link };
}

async function transactionById(db: Admin, id: string) {
  const { data, error } = await db
    .from("qnbpay_transactions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("İşlem bulunamadı.");
  return data;
}

function mapStatus(result: qnbpay.StatusResult): string {
  const status = (result.transactionStatus ?? "").toLowerCase();
  if (status === "completed") return "completed";
  if (status === "refunded") return "refunded";
  if (status === "cancelled" || status === "canceled") return "cancelled";
  if (status === "failed") return "failed";
  if (result.transactionType === "Pre-Authorization") return "preauth";
  return "pending";
}

export async function queryTransactionStatus(transactionId: string, actorId: string) {
  const db = await admin();
  const row = await loadSettingsRow(db);
  const credentials = credentialsOf(row);
  const transaction = await transactionById(db, transactionId);

  const result = await qnbpay.checkStatus(credentials, {
    invoiceId: transaction.qnbpay_invoice_id,
    includePending: true,
  });
  const status = mapStatus(result);

  const { error } = await db
    .from("qnbpay_transactions")
    .update({
      status,
      transaction_status: result.transactionStatus,
      order_id: result.orderId ?? result.orderNo ?? transaction.order_id,
      transaction_id: result.transactionId ?? transaction.transaction_id,
      status_code: result.statusCode,
      status_description: result.statusDescription,
      payment_status: result.paymentStatus,
      md_status: result.mdStatus,
      credit_card_no: result.creditCardNo ?? transaction.credit_card_no,
      merchant_commission: result.merchantCommission,
      user_commission: result.userCommission,
      error_code: result.errorCode,
      error_message: result.error,
      bank_status_code: result.bankErrorCode,
      bank_status_description: result.bankErrorDescription,
      response_summary: result.raw as never,
      paid_at: status === "completed" ? (transaction.paid_at ?? new Date().toISOString()) : transaction.paid_at,
    })
    .eq("id", transactionId);
  if (error) throw new Error(error.message);

  if (status === "completed") await settleTransaction(db, transactionId);

  await recordAudit(db, {
    action: "qnbpay.status.queried",
    actorId,
    entity: "qnbpay_transactions",
    entityId: transactionId,
    newValue: { status, transactionStatus: result.transactionStatus },
  });

  return { status, transactionStatus: result.transactionStatus, description: result.statusDescription };
}

/**
 * Ödeme tamamlandığında: paket satın almasını aboneliğe uygular, bağlı platform
 * faturasını kapatır ve dondurulmuş mağazayı yeniden açar.
 */
export async function settleTransaction(db: Admin, transactionId: string) {
  const transaction = await transactionById(db, transactionId);

  // Vitrin siparişi ödemesi: yalnızca siparişi öder, abonelik durumunu etkilemez.
  const summary = (transaction.request_summary ?? {}) as Record<string, unknown>;
  if (summary["purpose"] === "order") {
    const { markOrderPaidFromTransaction } = await import("@/lib/order-payment.server");
    const handled = await markOrderPaidFromTransaction(db as never, transaction as never);
    if (handled.handled) return;
  }

  // AI kredi paketi ödemesi: krediler mağaza cüzdanına yüklenir.
  if (summary["purpose"] === "ai_credit") {
    const { fulfillAiCreditOrder } = await import("@/lib/ai-credit-checkout.server");
    const handled = await fulfillAiCreditOrder(db as never, transaction as never);
    if (handled.handled) return;
  }

  // Tema lisansı ödemesi: lisans mağazaya tanımlanır ve tema kurulur.
  if (summary["purpose"] === "theme_license") {
    const { fulfillThemeLicense } = await import("@/lib/theme-market.server");
    const handled = await fulfillThemeLicense(db as never, transaction as never);
    if (handled.handled) return;
  }



  if (transaction.purpose === "plan") {
    const { activatePlanFromTransaction } = await import("@/lib/plan-checkout.server");
    await activatePlanFromTransaction(db as never, transaction as never);
  }

  if (transaction.invoice_id) {
    const { error } = await db
      .from("invoices")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", transaction.invoice_id)
      .neq("status", "paid");
    if (error) throw new Error(error.message);
  }

  if (transaction.store_id) {
    const { restoreAfterPayment } = await import("@/lib/billing-lifecycle.server");
    await restoreAfterPayment(db as never, transaction.store_id);
  }
}


export async function completeTransaction(
  input: { transactionId: string; action: "complete" | "cancel" },
  actorId: string,
) {
  const db = await admin();
  const row = await loadSettingsRow(db);
  const credentials = credentialsOf(row);
  const transaction = await transactionById(db, input.transactionId);
  if (!transaction.order_id) throw new Error("Bu işlemin sipariş numarası henüz oluşmamış.");

  const result = await qnbpay.completePayment(credentials, {
    invoiceId: transaction.qnbpay_invoice_id,
    orderId: transaction.order_id,
    status: input.action,
  });

  await db
    .from("qnbpay_transactions")
    .update({
      status: input.action === "complete" ? "completed" : "cancelled",
      response_summary: result as never,
      paid_at: input.action === "complete" ? new Date().toISOString() : null,
    })
    .eq("id", input.transactionId);

  if (input.action === "complete") await settleTransaction(db, input.transactionId);

  await recordAudit(db, {
    action: "qnbpay.payment.completed",
    actorId,
    entity: "qnbpay_transactions",
    entityId: input.transactionId,
    newValue: { action: input.action },
  });
  return { ok: true as const };
}

export async function confirmPreAuth(
  input: { transactionId: string; action: "approve" | "cancel"; amount?: number | undefined },
  actorId: string,
) {
  const db = await admin();
  const row = await loadSettingsRow(db);
  const credentials = credentialsOf(row);
  const transaction = await transactionById(db, input.transactionId);

  const result = await qnbpay.confirmPayment(credentials, {
    invoiceId: transaction.qnbpay_invoice_id,
    status: input.action === "approve" ? 1 : 2,
    ...(input.amount != null ? { total: input.amount } : {}),
  });

  await db
    .from("qnbpay_transactions")
    .update({
      status: input.action === "approve" ? "completed" : "cancelled",
      response_summary: result as never,
      paid_at: input.action === "approve" ? new Date().toISOString() : null,
    })
    .eq("id", input.transactionId);

  if (input.action === "approve") await settleTransaction(db, input.transactionId);

  await recordAudit(db, {
    action: "qnbpay.preauth.confirmed",
    actorId,
    entity: "qnbpay_transactions",
    entityId: input.transactionId,
    newValue: { action: input.action, amount: input.amount ?? null },
  });
  return { ok: true as const };
}

export async function refundTransaction(
  input: { transactionId: string; amount: number },
  actorId: string,
) {
  const db = await admin();
  const row = await loadSettingsRow(db);
  const credentials = credentialsOf(row);
  const transaction = await transactionById(db, input.transactionId);

  const paid = Number(transaction.amount ?? 0);
  const alreadyRefunded = Number(transaction.refunded_amount ?? 0);
  const amount = input.amount > 0 ? input.amount : paid - alreadyRefunded;
  if (amount <= 0) throw new Error("İade edilecek tutar kalmadı.");
  if (alreadyRefunded + amount > paid + 0.001) {
    throw new Error("İade tutarı işlem tutarını aşamaz.");
  }

  const { data: refundRow, error: refundError } = await db
    .from("qnbpay_refunds")
    .insert({ transaction_id: input.transactionId, amount, status: "pending" })
    .select("id")
    .single();
  if (refundError) throw new Error(refundError.message);

  try {
    const result = await qnbpay.refundPayment(credentials, {
      invoiceId: transaction.qnbpay_invoice_id,
      amount,
      refundWebhookKey: row.refund_webhook_key,
    });
    const ok = result.statusCode === 100;
    await db
      .from("qnbpay_refunds")
      .update({
        status: ok ? "completed" : "failed",
        ref_no: result.refNo,
        status_code: result.statusCode,
        status_description: result.statusDescription,
        response_summary: result.raw as never,
      })
      .eq("id", refundRow.id);

    if (ok) {
      const total = alreadyRefunded + amount;
      await db
        .from("qnbpay_transactions")
        .update({
          refunded_amount: total,
          status: total >= paid - 0.001 ? "refunded" : "partial_refunded",
        })
        .eq("id", input.transactionId);
    }

    await recordAudit(db, {
      action: "qnbpay.refund.requested",
      actorId,
      entity: "qnbpay_transactions",
      entityId: input.transactionId,
      newValue: { amount, ok, refNo: result.refNo },
    });

    if (!ok) throw new Error(result.statusDescription ?? "İade reddedildi.");
    return { ok: true as const, refNo: result.refNo };
  } catch (error) {
    await db
      .from("qnbpay_refunds")
      .update({
        status: "failed",
        status_description: error instanceof Error ? error.message : "İade başarısız",
      })
      .eq("id", refundRow.id);
    throw error;
  }
}

export type TransactionRow = {
  id: string;
  environment: string;
  purpose: string;
  invoiceRef: string;
  orderId: string | null;
  storeName: string | null;
  amount: number;
  currency: string;
  installment: number;
  status: string;
  transactionStatus: string | null;
  transactionType: string;
  statusDescription: string | null;
  errorMessage: string | null;
  creditCardNo: string | null;
  merchantCommission: number | null;
  userCommission: number | null;
  refundedAmount: number;
  checkoutUrl: string | null;
  description: string | null;
  paidAt: string | null;
  createdAt: string;
};

export async function listTransactions(filter: {
  status?: string | undefined;
  purpose?: string | undefined;
  search?: string | undefined;
}): Promise<TransactionRow[]> {
  const db = await admin();
  let query = db
    .from("qnbpay_transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter.status && filter.status !== "all") query = query.eq("status", filter.status);
  if (filter.purpose && filter.purpose !== "all") query = query.eq("purpose", filter.purpose);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const storeIds = [...new Set((data ?? []).map((r) => r.store_id).filter(Boolean))] as string[];
  const { data: stores } = storeIds.length
    ? await db.from("stores").select("id, name").in("id", storeIds)
    : { data: [] as { id: string; name: string }[] };
  const names = new Map((stores ?? []).map((s) => [s.id, s.name]));

  const rows: TransactionRow[] = (data ?? []).map((r) => ({
    id: r.id,
    environment: r.environment,
    purpose: r.purpose,
    invoiceRef: r.qnbpay_invoice_id,
    orderId: r.order_id,
    storeName: r.store_id ? (names.get(r.store_id) ?? null) : null,
    amount: Number(r.amount ?? 0),
    currency: r.currency,
    installment: r.installment,
    status: r.status,
    transactionStatus: r.transaction_status,
    transactionType: r.transaction_type,
    statusDescription: r.status_description,
    errorMessage: r.error_message,
    creditCardNo: r.credit_card_no,
    merchantCommission: r.merchant_commission != null ? Number(r.merchant_commission) : null,
    userCommission: r.user_commission != null ? Number(r.user_commission) : null,
    refundedAmount: Number(r.refunded_amount ?? 0),
    checkoutUrl: r.checkout_url,
    description: r.description,
    paidAt: r.paid_at,
    createdAt: r.created_at,
  }));

  const needle = filter.search?.trim().toLocaleLowerCase("tr");
  return needle
    ? rows.filter((row) =>
        `${row.invoiceRef} ${row.orderId ?? ""} ${row.storeName ?? ""} ${row.description ?? ""}`
          .toLocaleLowerCase("tr")
          .includes(needle),
      )
    : rows;
}

/* ------------------------- Fiyatlandırma ------------------------- */

export type PricingSnapshot = {
  plans: Array<{
    id: string;
    code: string;
    name: string;
    currency: string;
    priceMonthly: number;
    priceYearly: number;
    commissionRate: number;
    isActive: boolean;
  }>;
  apps: Array<{
    id: string;
    code: string;
    name: string;
    currency: string;
    price: number;
    pricingModel: string;
    isActive: boolean;
  }>;
  items: Array<{
    id: string;
    kind: string;
    code: string;
    name: string;
    description: string | null;
    price: number;
    currency: string;
    commissionRate: number;
    isActive: boolean;
    sortOrder: number;
  }>;
};

export async function loadPricing(): Promise<PricingSnapshot> {
  const db = await admin();
  const [plans, apps, items] = await Promise.all([
    db.from("plans").select("*").order("sort_order"),
    db.from("apps").select("id, code, name, currency, price, pricing_model, is_active").order("name"),
    db.from("platform_charge_items").select("*").order("kind").order("sort_order"),
  ]);
  if (plans.error) throw new Error(plans.error.message);
  if (apps.error) throw new Error(apps.error.message);
  if (items.error) throw new Error(items.error.message);

  return {
    plans: (plans.data ?? []).map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      currency: p.currency,
      priceMonthly: Number(p.price_monthly ?? 0),
      priceYearly: Number(p.price_yearly ?? 0),
      commissionRate: Number(p.commission_rate ?? 0),
      isActive: p.is_active,
    })),
    apps: (apps.data ?? []).map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      currency: a.currency,
      price: Number(a.price ?? 0),
      pricingModel: String(a.pricing_model),
      isActive: a.is_active,
    })),
    items: (items.data ?? []).map((i) => ({
      id: i.id,
      kind: i.kind,
      code: i.code,
      name: i.name,
      description: i.description,
      price: Number(i.price ?? 0),
      currency: i.currency,
      commissionRate: Number(i.commission_rate ?? 0),
      isActive: i.is_active,
      sortOrder: i.sort_order,
    })),
  };
}

export async function savePlanPrice(
  input: { planId: string; priceMonthly: number; priceYearly: number; commissionRate: number },
  actorId: string,
) {
  const db = await admin();
  const { error } = await db
    .from("plans")
    .update({
      price_monthly: input.priceMonthly,
      price_yearly: input.priceYearly,
      commission_rate: input.commissionRate,
    })
    .eq("id", input.planId);
  if (error) throw new Error(error.message);
  await recordAudit(db, {
    action: "platform.plan_price_updated",
    actorId,
    entity: "plans",
    entityId: input.planId,
    newValue: input as unknown as Record<string, unknown>,
  });
  return loadPricing();
}

export async function saveAppPrice(input: { appId: string; price: number }, actorId: string) {
  const db = await admin();
  const { error } = await db.from("apps").update({ price: input.price }).eq("id", input.appId);
  if (error) throw new Error(error.message);
  await recordAudit(db, {
    action: "platform.app_price_updated",
    actorId,
    entity: "apps",
    entityId: input.appId,
    newValue: { price: input.price },
  });
  return loadPricing();
}

export async function saveChargeItem(input: z.infer<typeof chargeItemSchema>, actorId: string) {
  const db = await admin();
  const payload = {
    kind: input.kind,
    code: input.code,
    name: input.name,
    description: input.description ?? null,
    price: input.price,
    currency: input.currency,
    commission_rate: input.commissionRate,
    is_active: input.isActive,
    sort_order: input.sortOrder,
  };
  const query = input.id
    ? db.from("platform_charge_items").update(payload).eq("id", input.id).select("id").single()
    : db.from("platform_charge_items").insert(payload).select("id").single();
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  await recordAudit(db, {
    action: input.id ? "platform.charge_item_updated" : "platform.charge_item_created",
    actorId,
    entity: "platform_charge_items",
    entityId: data.id,
    newValue: payload as unknown as Record<string, unknown>,
  });
  return loadPricing();
}

export async function deleteChargeItem(id: string, actorId: string) {
  const db = await admin();
  const { error } = await db.from("platform_charge_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await recordAudit(db, {
    action: "platform.charge_item_deleted",
    actorId,
    entity: "platform_charge_items",
    entityId: id,
  });
  return loadPricing();
}

/* --------------------------- Webhook --------------------------- */

type WebhookFields = Record<string, string>;

/** Satış webhook'u: hash doğrular, servisten durumu teyit eder, kaydı günceller. */
export async function handleSaleWebhook(fields: WebhookFields) {
  const db = await admin();
  const row = await loadSettingsRow(db);
  const credentials = credentialsOf(row);

  const invoiceRef = fields["invoice_id"];
  if (!invoiceRef) return { ok: false, reason: "invoice_id yok" };

  // hash_key zorunludur: imzasız bildirim hiçbir kaydı değiştirmez.
  const hashKey = fields["hash_key"];
  const validated = hashKey ? qnbpay.validateHashKey(hashKey, credentials.appSecret) : null;
  if (!validated || validated.invoiceId !== invoiceRef) {
    return { ok: false, reason: "hash doğrulanamadı" };
  }

  const { data: transaction } = await db
    .from("qnbpay_transactions")
    .select("id, paid_at, amount, refunded_amount")
    .eq("environment", credentials.environment)
    .eq("qnbpay_invoice_id", invoiceRef)
    .maybeSingle();
  if (!transaction) return { ok: false, reason: "işlem bulunamadı" };

  // Durum yalnızca servisten teyit edilir; webhook gövdesine güvenilmez.
  const result = await qnbpay.checkStatus(credentials, { invoiceId: invoiceRef, includePending: true });
  const status = mapStatus(result);

  await db
    .from("qnbpay_transactions")
    .update({
      status,
      transaction_status: result.transactionStatus,
      order_id: result.orderId ?? result.orderNo ?? null,
      transaction_id: result.transactionId,
      status_code: result.statusCode,
      status_description: result.statusDescription,
      payment_status: result.paymentStatus,
      md_status: result.mdStatus,
      credit_card_no: result.creditCardNo ?? null,
      merchant_commission: result.merchantCommission,
      user_commission: result.userCommission,
      error_code: result.errorCode ?? null,
      error_message: result.error ?? null,
      bank_status_code: result.bankErrorCode,
      bank_status_description: result.bankErrorDescription,
      webhook_payload: fields as never,
      response_summary: result.raw as never,
      paid_at:
        status === "completed" ? (transaction.paid_at ?? new Date().toISOString()) : transaction.paid_at,
    })
    .eq("id", transaction.id);

  if (status === "completed") await settleTransaction(db, transaction.id);

  await recordAudit(db, {
    action: "qnbpay.webhook.sale",
    entity: "qnbpay_transactions",
    entityId: transaction.id,
    newValue: { status, invoiceRef },
  });
  return { ok: true, status };
}

/** İade webhook'u: hash doğrular ve iade kaydını kapatır. */
export async function handleRefundWebhook(fields: WebhookFields) {
  const db = await admin();
  const row = await loadSettingsRow(db);
  const credentials = credentialsOf(row);

  const invoiceRef = fields["invoice_id"];
  if (!invoiceRef) return { ok: false, reason: "invoice_id yok" };
  // hash_key zorunludur: imzasız iade bildirimi kabul edilmez.
  const hashKey = fields["hash_key"];
  const validated = hashKey ? qnbpay.validateHashKey(hashKey, credentials.appSecret) : null;
  if (!validated || validated.invoiceId !== invoiceRef) {
    return { ok: false, reason: "hash doğrulanamadı" };
  }

  const { data: transaction } = await db
    .from("qnbpay_transactions")
    .select("id, amount, refunded_amount")
    .eq("environment", credentials.environment)
    .eq("qnbpay_invoice_id", invoiceRef)
    .maybeSingle();
  if (!transaction) return { ok: false, reason: "işlem bulunamadı" };

  // İade tutarı imzalı hash içeriğinden alınır; gövdedeki tutara güvenilmez.
  const refundedNow = Number(validated.total ?? 0);
  const succeeded = (fields["status"] ?? "").toUpperCase() !== "FAIL";
  const total = Number(transaction.refunded_amount ?? 0) + (succeeded ? refundedNow : 0);
  const paid = Number(transaction.amount ?? 0);

  await db.from("qnbpay_refunds").insert({
    transaction_id: transaction.id,
    amount: refundedNow,
    status: succeeded ? "completed" : "failed",
    ref_no: fields["ref_no"] ?? null,
    status_description: fields["status_description"] ?? null,
    webhook_payload: fields as never,
  });

  if (succeeded) {
    await db
      .from("qnbpay_transactions")
      .update({
        refunded_amount: total,
        status: total >= paid - 0.001 ? "refunded" : "partial_refunded",
        webhook_payload: fields as never,
      })
      .eq("id", transaction.id);
  }

  await recordAudit(db, {
    action: "qnbpay.webhook.refund",
    entity: "qnbpay_transactions",
    entityId: transaction.id,
    newValue: { refundedNow, succeeded },
  });
  return { ok: true };
}

/** Vitrin siparişi için QNBpay ödeme bağlantısı üretir (Mefpay kartla tahsilat). */
export async function createOrderCheckout(input: {
  orderId: string;
  storeId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  buyerName: string;
}): Promise<{ link: string; invoiceRef: string }> {
  const db = await admin();
  const row = await loadSettingsRow(db);
  const credentials = credentialsOf(row);
  if (!row.is_enabled || !qnbpay.isConfigured(credentials)) {
    throw new Error("Kart ile ödeme şu anda kullanılamıyor.");
  }
  const base = origin(row);
  const invoiceRef = newInvoiceRef("ORD");
  const [name, ...rest] = input.buyerName.trim().split(" ");
  const description = `${input.orderNumber} numaralı sipariş ödemesi`;
  const currency = (["TRY", "USD", "EUR"] as const).includes(input.currency as "TRY")
    ? (input.currency as "TRY" | "USD" | "EUR")
    : "TRY";

  const result = await qnbpay.createPaymentLink(credentials, {
    invoiceId: invoiceRef,
    description,
    total: input.amount,
    currencyCode: currency,
    returnUrl: `${base}/odeme-tamam`,
    cancelUrl: `${base}/odeme-tamam?iptal=1`,
    name: name || "Musteri",
    surname: rest.join(" ") || "Musteri",
    items: [{ name: description, price: input.amount, quantity: 1, description }],
    commissionFromUser: row.is_commission_from_user,
  });

  const { error } = await db.from("qnbpay_transactions").insert({
    environment: credentials.environment,
    purpose: "other",
    store_id: input.storeId,
    qnbpay_invoice_id: invoiceRef,
    order_id: result.orderId,
    amount: input.amount,
    currency,
    status: "pending",
    transaction_type: row.transaction_type,
    checkout_url: result.link,
    description,
    request_summary: {
      purpose: "order",
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      storeId: input.storeId,
    } as never,
    response_summary: result.raw as never,
  });
  if (error) throw new Error(error.message);

  return { link: result.link, invoiceRef };
}

/** Fatura sayfası için QNBpay ödeme bağlantısı üretir (mağaza abonelik faturaları). */
export async function createInvoiceCheckout(input: {
  invoiceId: string;
  storeId: string;
  amount: number;
  currency: string;
  invoiceNumber: string;
  buyerName: string;
}): Promise<{ link: string; invoiceRef: string }> {
  const db = await admin();
  const row = await loadSettingsRow(db);
  const credentials = credentialsOf(row);
  if (!row.is_enabled || !qnbpay.isConfigured(credentials)) {
    throw new Error("Kart ile ödeme şu anda kullanılamıyor.");
  }
  const base = origin(row);
  const invoiceRef = newInvoiceRef("INV");
  const [name, ...rest] = input.buyerName.trim().split(" ");
  const description = `${input.invoiceNumber} numaralı fatura ödemesi`;

  const result = await qnbpay.createPaymentLink(credentials, {
    invoiceId: invoiceRef,
    description,
    total: input.amount,
    currencyCode: (["TRY", "USD", "EUR"] as const).includes(input.currency as "TRY")
      ? input.currency
      : "TRY",
    returnUrl: `${base}/odeme-tamam`,
    cancelUrl: `${base}/odeme-tamam?iptal=1`,
    name: name || "Mefticaret",
    surname: rest.join(" ") || "Musteri",
    items: [{ name: description, price: input.amount, quantity: 1, description }],
    commissionFromUser: row.is_commission_from_user,
  });

  const { error } = await db.from("qnbpay_transactions").insert({
    environment: credentials.environment,
    purpose: "invoice",
    store_id: input.storeId,
    invoice_id: input.invoiceId,
    qnbpay_invoice_id: invoiceRef,
    order_id: result.orderId,
    amount: input.amount,
    currency: input.currency,
    status: "pending",
    transaction_type: row.transaction_type,
    checkout_url: result.link,
    description,
    response_summary: result.raw as never,
  });
  if (error) throw new Error(error.message);

  return { link: result.link, invoiceRef };
}

/** Fatura sayfasının kart ödemesi açık mı bilgisi. */
export async function cardPaymentAvailable(): Promise<boolean> {
  try {
    const db = await admin();
    const row = await loadSettingsRow(db);
    return row.is_enabled && qnbpay.isConfigured(credentialsOf(row));
  } catch {
    return false;
  }
}
