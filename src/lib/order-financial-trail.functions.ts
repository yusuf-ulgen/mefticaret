import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getOrderFinancialTrail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ storeId: z.guid(), orderId: z.guid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const order = await context.supabase
      .from("orders")
      .select("id, grand_total, currency, payment_status")
      .eq("id", data.orderId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (order.error) throw new Error(order.error.message);
    if (!order.data) throw new Error("Sipariş bulunamadı veya yetkiniz yok");
    const currentOrder = order.data;
    const { readAllPages } = await import("@/lib/read-all-pages");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const [receipts, payments, refunds, ledger, commissions] = await Promise.all([
      readAllPages((from, to) =>
        db
          .from("kolay_receipt_checks")
          .select("id, status, bank_transaction_reference, reviewed_at, created_at")
          .eq("store_id", data.storeId)
          .eq("order_id", data.orderId)
          .order("id")
          .range(from, to),
      ),
      readAllPages((from, to) =>
        db
          .from("qnbpay_transactions")
          .select("id, status, amount, refunded_amount, currency, transaction_id, created_at")
          .eq("store_id", data.storeId)
          .or(`order_id.eq.${data.orderId},request_summary->>orderId.eq.${data.orderId}`)
          .order("id")
          .range(from, to),
      ),
      readAllPages((from, to) =>
        db
          .from("refunds")
          .select("id, status, amount, currency, provider_reference, refund_method, created_at")
          .eq("store_id", data.storeId)
          .eq("order_id", data.orderId)
          .order("id")
          .range(from, to),
      ),
      readAllPages((from, to) =>
        db
          .from("ledger_entries")
          .select("id, kind, status, amount, currency, direction, reference, created_at")
          .eq("store_id", data.storeId)
          .eq("order_id", data.orderId)
          .order("id")
          .range(from, to),
      ),
      readAllPages((from, to) =>
        db
          .from("supplier_commission_entries")
          .select("id, status, net_amount, currency, payout_request_id, created_at")
          .eq("store_id", data.storeId)
          .eq("order_id", data.orderId)
          .order("id")
          .range(from, to),
      ),
    ]);
    type Movement = {
      id: string;
      source: string;
      status: string;
      amount: number | null;
      currency: string;
      reference: string | null;
      createdAt: string;
    };
    const items: Movement[] = [
      ...(receipts.data ?? []).map((row) => ({
        id: `receipt:${row.id}`,
        source: "Dekont incelemesi",
        status: row.status,
        amount: null,
        currency: currentOrder.currency,
        reference: row.bank_transaction_reference,
        createdAt: row.reviewed_at ?? row.created_at,
      })),
      ...(payments.data ?? []).map((row) => ({
        id: `payment:${row.id}`,
        source: "Kart tahsilatı",
        status: row.status,
        amount: Number(row.amount),
        currency: row.currency,
        reference: row.transaction_id,
        createdAt: row.created_at,
      })),
      ...(refunds.data ?? []).map((row) => ({
        id: `refund:${row.id}`,
        source: `İade · ${row.refund_method === "original_payment" ? "kart" : row.refund_method === "manual" ? "manuel" : "mağaza kredisi"}`,
        status: row.status,
        amount: Number(row.amount),
        currency: row.currency,
        reference: row.provider_reference,
        createdAt: row.created_at,
      })),
      ...(ledger.data ?? []).map((row) => ({
        id: `ledger:${row.id}`,
        source: `Finans defteri · ${row.direction === "credit" ? "alacak" : "borç"}`,
        status: row.status,
        amount: Number(row.amount),
        currency: row.currency,
        reference: row.reference,
        createdAt: row.created_at,
      })),
      ...(commissions.data ?? []).map((row) => ({
        id: `commission:${row.id}`,
        source: "Tedarikçi hakedişi",
        status: row.status,
        amount: Number(row.net_amount),
        currency: row.currency,
        reference: row.payout_request_id,
        createdAt: row.created_at,
      })),
    ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return {
      order: currentOrder,
      items,
      measuredAt: new Date().toISOString(),
      pendingReconciliation: (refunds.data ?? []).some((row) => row.status === "processing"),
    };
  });
