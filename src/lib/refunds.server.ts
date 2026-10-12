import { RefundOutcomeUnknownError } from "@/lib/refund-errors";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import type { createRefundSchema } from "@/lib/refund-schema";

import type { Database } from "@/integrations/supabase/types";

/** Shopify tarzı iade: oluşturma, sağlayıcıya iletme ve sonuçlandırma. */

type Db = SupabaseClient<Database>;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Kullanıcının bu siparişi yönetip yönetemediğini RLS üzerinden doğrular. */
async function assertOrderAccess(user: Db, storeId: string, orderId: string) {
  const { data, error } = await user
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sipariş bulunamadı veya yetkiniz yok");
}

async function paidQnbpayTransaction(db: Db, orderId: string) {
  const { data } = await db
    .from("qnbpay_transactions")
    .select("id, amount, refunded_amount, status")
    .eq("request_summary->>orderId", orderId)
    .in("status", ["completed", "partial_refunded"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function createAndProcessRefund(
  user: Db,
  userId: string,
  input: z.infer<typeof createRefundSchema>,
) {
  await assertOrderAccess(user, input.storeId, input.orderId);
  const db = await admin();

  const { data: member } = await db
    .from("stores")
    .select("id")
    .eq("id", input.storeId)
    .maybeSingle();
  if (!member) throw new Error("Mağaza bulunamadı");

  if (input.method === "original_payment") {
    const tx = await paidQnbpayTransaction(db, input.orderId);
    if (!tx) {
      throw new Error(
        "Bu sipariş kartla çevrimiçi ödenmemiş. Havale veya kapıda ödeme iadeleri için 'Manuel' ya da 'Mağaza kredisi' seçin.",
      );
    }
    const remaining = Number(tx.amount) - Number(tx.refunded_amount ?? 0);
    if (input.amount > remaining + 0.001) {
      throw new Error(`Kart işleminde iade edilebilir kalan tutar ${remaining.toFixed(2)}`);
    }
  }

  const { data: refundId, error } = await db.rpc("create_order_refund", {
    p_order_id: input.orderId,
    p_lines: input.lines.map((l: { orderItemId: string; quantity: number; restock: boolean }) => ({
      order_item_id: l.orderItemId,
      quantity: l.quantity,
      restock: l.restock,
    })),
    p_amount: input.amount,
    p_method: input.method,
    p_reason: input.reason,
    p_note: input.note,
    p_idempotency_key: input.idempotencyKey,
    p_actor: userId,
  });
  if (error) throw new Error(error.message);

  return processRefund(db, String(refundId), userId);
}

/** Bekleyen/başarısız iadeyi sağlayıcıya iletir ve sonuçlandırır (tekrar denenebilir). */
export async function processRefund(db: Db, refundId: string, userId: string) {
  const { data: refund, error } = await db
    .from("refunds")
    .select("id, store_id, order_id, amount, currency, status, refund_method, refund_number")
    .eq("id", refundId)
    .maybeSingle();
  if (error || !refund) throw new Error("İade bulunamadı");
  if (refund.status === "processed")
    return { refundId, status: "processed" as const, number: refund.refund_number };

  if (refund.status === "cancelled") throw new Error("İptal edilmiş iade işlenemez");

  const claim = await db.rpc("claim_order_refund", { p_refund_id: refundId, p_actor: userId });
  if (claim.error) throw new Error(claim.error.message);
  const ownership = claim.data as unknown as { claimed: boolean; status: string };
  if (!ownership.claimed) {
    if (ownership.status === "processed")
      return { refundId, status: "processed" as const, number: refund.refund_number };
    const { data: known } = await db
      .from("qnbpay_refunds")
      .select("status, duplicate_of")
      .eq("request_key", `refund:${refundId}`)
      .maybeSingle();
    let confirmed = refund.refund_method !== "original_payment" || known?.status === "completed";
    if (known?.duplicate_of) {
      const { data: canonical } = await db
        .from("qnbpay_refunds")
        .select("status")
        .eq("id", known.duplicate_of)
        .maybeSingle();
      confirmed = canonical?.status === "completed";
    }
    if (confirmed) {
      const result = await db.rpc("finalize_order_refund", {
        p_refund_id: refundId,
        p_success: true,
        p_actor: userId,
        p_message: "Confirmed provider result recovered",
      });
      if (result.error) throw new Error(result.error.message);
      return { refundId, status: "processed" as const, number: refund.refund_number };
    }
    throw new RefundOutcomeUnknownError();
  }

  let ok = true;
  let message: string | null = null;

  if (refund.refund_method === "original_payment" && refund.order_id) {
    const tx = await paidQnbpayTransaction(db, refund.order_id);
    const { data: rtx } = await db
      .from("refund_transactions")
      .insert({
        refund_id: refundId,
        store_id: refund.store_id,
        provider: "qnbpay",
        payment_reference: tx?.id ?? null,
        amount: refund.amount,
        status: "pending",
        attempts: 1,
      })
      .select("id")
      .single();
    if (!rtx) throw new RefundOutcomeUnknownError("Provider request record could not be created");
    try {
      if (!tx) throw new Error("Kart işlemi bulunamadı");
      const { refundTransaction } = await import("@/lib/qnbpay-admin.server");
      const result = await refundTransaction(
        { transactionId: tx.id, amount: Number(refund.amount), requestKey: `refund:${refundId}` },
        userId,
      );
      await db
        .from("refund_transactions")
        .update({
          status: "succeeded",
          provider_refund_id: result.refNo ?? null,
          provider_response: { refNo: result.refNo ?? null },
        })
        .eq("id", rtx!.id);
    } catch (e) {
      if (e instanceof RefundOutcomeUnknownError) throw e;
      ok = false;
      message = e instanceof Error ? e.message : "Sağlayıcı iadesi başarısız";
      await db
        .from("refund_transactions")
        .update({ status: "failed", provider_response: { error: message } })
        .eq("id", rtx!.id);
    }
  }

  const { error: finError } = await db.rpc("finalize_order_refund", {
    p_refund_id: refundId,
    p_success: ok,
    p_actor: userId,
    p_message: message ?? "",
  });
  if (finError) throw new Error(finError.message);

  const { recordAudit } = await import("@/lib/audit.server");
  await recordAudit(
    db as never,
    {
      action: ok ? "refund.processed" : "refund.failed",
      actorId: userId,
      entity: "refunds",
      entityId: refundId,
      newValue: { amount: refund.amount, method: refund.refund_method, message },
    } as never,
  ).catch(() => undefined);

  if (!ok)
    throw new Error(`İade tamamlanamadı: ${message}. Sipariş sayfasından tekrar deneyebilirsiniz.`);

  await notifyCustomer(db, refundId).catch(() => undefined);
  return { refundId, status: "processed" as const, number: refund.refund_number };
}

const METHOD_LABEL: Record<string, string> = {
  original_payment: "Orijinal ödeme yöntemi",
  store_credit: "Mağaza kredisi",
  manual: "Mağaza tarafından manuel",
};

async function notifyCustomer(db: Db, refundId: string) {
  const { data } = await db
    .from("refunds")
    .select("order_id, amount, currency")
    .eq("id", refundId)
    .maybeSingle();
  if (!data?.order_id) return;
  const { formatMoney } = await import("@/lib/mefti");
  const { dispatchCustomerEvent } = await import("@/lib/customer-notify.server");
  await dispatchCustomerEvent(
    data.order_id,
    "REFUND_PROCESSED",
    {
      refundAmount: formatMoney(Number(data.amount), data.currency),
      dedupe: refundId,
    },
    db,
  );
}

export async function cancelRefund(user: Db, userId: string, storeId: string, refundId: string) {
  // Yönetim yetkisi RLS ile doğrulanır: yalnız yöneticiler iade satırını güncelleyebilir.
  const { data } = await user
    .from("refunds")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", refundId)
    .eq("store_id", storeId)
    .select("id")
    .maybeSingle();
  if (!data) throw new Error("İade bulunamadı veya yetkiniz yok");
  const db = await admin();
  const { error } = await db.rpc("cancel_order_refund", { p_refund_id: refundId, p_actor: userId });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function retryRefund(user: Db, userId: string, storeId: string, refundId: string) {
  // Yönetim yetkisi RLS ile doğrulanır: yalnız yöneticiler iade satırını güncelleyebilir.
  const { data } = await user
    .from("refunds")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", refundId)
    .eq("store_id", storeId)
    .select("id")
    .maybeSingle();
  if (!data) throw new Error("İade bulunamadı veya yetkiniz yok");
  return processRefund(await admin(), refundId, userId);
}

/** Sağlayıcı/banka kaydını doğrulamış yöneticinin mutabakatı; yeni para iadesi çağrısı yapmaz. */
export async function reconcileRefund(
  user: Db,
  userId: string,
  storeId: string,
  refundId: string,
  providerReference: string,
) {
  const { assertStoreManager } = await import("@/lib/store-access.server");
  await assertStoreManager(user, storeId, userId);
  const { data: refund, error } = await user
    .from("refunds")
    .select("id, amount, status, refund_method")
    .eq("id", refundId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error || !refund || refund.refund_method !== "original_payment")
    throw new Error("Kart iadesi bulunamadı veya yetkiniz yok");
  if (refund.status === "processed") return { ok: true };
  if (refund.status !== "processing") throw new Error("Bu iade mutabakat beklemiyor");
  const db = await admin();
  const { data: attempt, error: attemptError } = await db
    .from("qnbpay_refunds")
    .select("id, transaction_id, amount")
    .eq("request_key", `refund:${refundId}`)
    .maybeSingle();
  if (attemptError || !attempt || Number(attempt.amount) !== Number(refund.amount))
    throw new Error("Sağlayıcı iade talebi eşleştirilemedi");
  const recorded = await db.rpc("record_qnbpay_refund", {
    p_transaction_id: attempt.transaction_id,
    p_provider_reference: providerReference,
    p_amount: Number(refund.amount),
    p_apply: true,
    p_succeeded: true,
    p_refund_id: attempt.id,
    p_payload: { manualReconciliation: true, actorId: userId },
  });
  if (recorded.error) throw new Error(recorded.error.message);
  const finalized = await db.rpc("finalize_order_refund", {
    p_refund_id: refundId,
    p_success: true,
    p_actor: userId,
    p_message: "Sağlayıcı/banka hareketi açık manuel mutabakatla doğrulandı",
  });
  if (finalized.error) throw new Error(finalized.error.message);
  return { ok: true };
}

export async function orderRefundOverview(user: Db, storeId: string, orderId: string) {
  const [{ data: order }, { data: items }, { data: refunds }] = await Promise.all([
    user
      .from("orders")
      .select("id, order_number, grand_total, currency, payment_status, customer_id")
      .eq("id", orderId)
      .eq("store_id", storeId)
      .maybeSingle(),
    user
      .from("order_items")
      .select("id, title, variant_title, quantity, unit_price, tax_total, variant_id")
      .eq("order_id", orderId),
    user
      .from("refunds")
      .select(
        "id, refund_number, amount, currency, status, refund_method, reason, note, created_at, processed_at, refund_line_items(order_item_id, quantity, restock)",
      )
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
  ]);
  if (!order) throw new Error("Sipariş bulunamadı");
  const active = (refunds ?? []).filter(
    (r) => r.status === "pending" || r.status === "processing" || r.status === "processed",
  );
  const refunded = active.reduce((s, r) => s + Number(r.amount), 0);
  const refundedQty = new Map<string, number>();
  for (const r of active)
    for (const l of (r as any).refund_line_items ?? [])
      refundedQty.set(l.order_item_id, (refundedQty.get(l.order_item_id) ?? 0) + l.quantity);
  return {
    order,
    items: (items ?? []).map((i) => ({
      ...i,
      refundable: i.quantity - (refundedQty.get(i.id) ?? 0),
    })),
    refunds: refunds ?? [],
    refundable: Math.max(0, Number(order.grand_total) - refunded),
    hasCard: Boolean(await paidQnbpayTransaction(await admin(), orderId)),
  };
}
