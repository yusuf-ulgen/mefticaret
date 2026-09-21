/**
 * AI kredi paketi satın alma — tahsilat QNBpay üzerinden yapılır.
 * Fiyat ve kredi adedi yalnızca sunucudaki `ai_credit_packages` tablosundan okunur.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { recordAudit } from "@/lib/audit.server";

type Admin = SupabaseClient<Database>;

type CreditTransaction = {
  id: string;
  store_id: string | null;
  amount: number | string | null;
  currency: string | null;
  qnbpay_invoice_id: string;
  request_summary: unknown;
};

/** Satıcı için kredi paketi ödeme bağlantısı üretir. */
export async function startAiCreditCheckout(
  supabase: SupabaseClient<Database>,
  input: { storeId: string; packageId: string },
  userId: string,
): Promise<{ link: string; amount: number; currency: string; credits: number; packageName: string }> {
  const { assertStoreManager } = await import("@/lib/store-access.server");
  await assertStoreManager(supabase, input.storeId, userId);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as Admin;

  const { data: pack, error } = await db
    .from("ai_credit_packages")
    .select("id, code, name, credits, price, currency, is_active")
    .eq("id", input.packageId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!pack || !pack.is_active) throw new Error("Kredi paketi bulunamadı");

  const amount = Number(pack.price);
  if (!(amount > 0)) throw new Error("Bu paket için çevrimiçi ödeme alınmıyor.");
  const currency = (["TRY", "USD", "EUR"] as const).includes((pack.currency ?? "TRY") as "TRY")
    ? ((pack.currency ?? "TRY") as "TRY" | "USD" | "EUR")
    : "TRY";

  const { data: store } = await db.from("stores").select("name").eq("id", input.storeId).maybeSingle();
  const buyer = (store?.name ?? "Mefticaret").trim().split(" ");

  const { createChargeLink } = await import("@/lib/qnbpay-admin.server");
  const result = await createChargeLink(
    {
      purpose: "other",
      amount,
      currency,
      description: `${pack.name} — ${pack.credits} AI kredisi`,
      buyerName: buyer[0] || "Mefticaret",
      buyerSurname: buyer.slice(1).join(" ") || "Magaza",
      storeId: input.storeId,
    },
    userId,
  );

  await db
    .from("qnbpay_transactions")
    .update({
      request_summary: {
        purpose: "ai_credit",
        packageId: pack.id,
        packageCode: pack.code,
        credits: pack.credits,
        storeId: input.storeId,
      } as never,
    })
    .eq("id", result.id);

  await db.from("ai_credit_orders").insert({
    store_id: input.storeId,
    package_id: pack.id,
    package_code: pack.code,
    credits: pack.credits,
    amount,
    currency,
    status: "pending",
    transaction_id: result.id,
    created_by: userId,
  });

  return { link: result.link, amount, currency, credits: pack.credits, packageName: pack.name };
}

/** Ödemesi onaylanan kredi paketini mağaza cüzdanına yükler. */
export async function fulfillAiCreditOrder(
  db: Admin,
  transaction: CreditTransaction,
): Promise<{ handled: boolean }> {
  const summary = (transaction.request_summary ?? {}) as Record<string, unknown>;
  const storeId = transaction.store_id;
  const credits = Number(summary["credits"] ?? 0);
  if (!storeId || !(credits > 0)) return { handled: false };

  const { data: order } = await db
    .from("ai_credit_orders")
    .select("id, status")
    .eq("transaction_id", transaction.id)
    .maybeSingle();
  if (order?.status === "paid") return { handled: true };

  const { grantAiCredits } = await import("@/lib/ai-credits.server");
  const balance = await grantAiCredits({
    storeId,
    credits,
    reason: "purchase",
    meta: { transactionId: transaction.id, packageCode: summary["packageCode"] ?? null },
  });

  if (order) {
    await db
      .from("ai_credit_orders")
      .update({ status: "paid", fulfilled_at: new Date().toISOString() })
      .eq("id", order.id);
  }

  await db.rpc("emit_notification", {
    _store_id: storeId,
    _kind: "billing",
    _title: `${credits} AI kredisi yüklendi`,
    _message: `Yeni bakiyeniz ${balance} kredi.`,
    _entity: "ai_credit_orders",
    _entity_id: order?.id ?? transaction.id,
    _meta: { credits, provider: "qnbpay" },
  } as never);

  await recordAudit(db as never, {
    action: "ai_credit.purchase.settled",
    actorId: null,
    entity: "qnbpay_transactions",
    entityId: transaction.id,
    newValue: { credits, balance },
    storeId,
  });

  return { handled: true };
}
