import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Immutable finansal defter sunucu fonksiyonları.
 * Kayıtlar yalnızca sunucu tarafında oluşturulur; güncelleme/silme veritabanı
 * tetikleyicileriyle engellenir. Düzeltme yalnızca ters kayıt (reversal) ile yapılır.
 */

const TX_KINDS = [
  "customer_payment",
  "seller_earning",
  "marketplace_commission",
  "refund",
  "withdrawal",
  "platform_fee",
] as const;

/** Her işlem tipinin defter yönü (mağaza hesabı perspektifi). */
const TX_DIRECTION: Record<(typeof TX_KINDS)[number], "credit" | "debit"> = {
  customer_payment: "credit",
  seller_earning: "credit",
  marketplace_commission: "debit",
  refund: "debit",
  withdrawal: "debit",
  platform_fee: "debit",
};

/** İşlem tipine karşılık gelen hesap türü. */
const TX_ACCOUNT: Record<(typeof TX_KINDS)[number], "store" | "seller" | "platform" | "customer"> = {
  customer_payment: "store",
  seller_earning: "seller",
  marketplace_commission: "platform",
  refund: "store",
  withdrawal: "store",
  platform_fee: "platform",
};

async function assertStoreAccess(supabase: { from: typeof import("@/integrations/supabase/client").supabase.from }, storeId: string) {
  const { data, error } = await supabase.from("stores").select("id, currency").eq("id", storeId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Mağaza bulunamadı veya yetkiniz yok");
  return data;
}

export const postLedgerEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        kind: z.enum(TX_KINDS),
        amount: z.number().positive().max(100_000_000),
        currency: z.string().trim().length(3).optional(),
        reference: z.string().trim().max(120).optional(),
        description: z.string().trim().max(500).optional(),
        status: z.enum(["pending", "posted"]).default("posted"),
        occurredAt: z.string().optional(),
        orderId: z.guid().optional(),
        sellerId: z.guid().optional(),
        customerId: z.guid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const store = await assertStoreAccess(context.supabase as never, data.storeId);
    const currency = (data.currency ?? store.currency ?? "TRY").toUpperCase();

    if (data.kind === "seller_earning" && !data.sellerId) {
      throw new Error("Satıcı kazancı için satıcı seçilmelidir");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const accountKind = TX_ACCOUNT[data.kind];
    const { data: accountId, error: accountError } = await supabaseAdmin.rpc("ensure_ledger_account", {
      _store_id: data.storeId,
      _kind: accountKind,
      _currency: currency,
      ...(accountKind === "seller" && data.sellerId ? { _seller_id: data.sellerId } : {}),
      ...(accountKind === "customer" && data.customerId ? { _customer_id: data.customerId } : {}),
    });
    if (accountError) throw new Error(accountError.message);

    const { data: storeAccountId, error: storeAccountError } = await supabaseAdmin.rpc("ensure_ledger_account", {
      _store_id: data.storeId,
      _kind: "store",
      _currency: currency,
    });
    if (storeAccountError) throw new Error(storeAccountError.message);

    const { data: inserted, error } = await supabaseAdmin
      .from("ledger_entries")
      .insert({
        store_id: data.storeId,
        account_id: accountId as string,
        counter_account_id: accountId === storeAccountId ? null : (storeAccountId as string),
        kind: data.kind,
        direction: TX_DIRECTION[data.kind],
        amount: Number(data.amount.toFixed(2)),
        currency,
        status: data.status,
        reference: data.reference?.length ? data.reference : null,
        description: data.description?.length ? data.description : null,
        occurred_at: data.occurredAt ?? new Date().toISOString(),
        order_id: data.orderId ?? null,
        seller_id: data.sellerId ?? null,
        customer_id: data.customerId ?? null,
      })
      .select("id, amount, currency, status")
      .single();
    if (error) throw new Error(error.message);

    return { entryId: inserted.id, amount: Number(inserted.amount ?? 0), currency: inserted.currency };
  });

/** Bir defter kaydını ters kayıtla düzeltir; orijinal kayıt değişmez. */
export const reverseLedgerEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        entryId: z.guid(),
        reason: z.string().trim().max(300).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStoreAccess(context.supabase as never, data.storeId);

    const { data: original, error: readError } = await context.supabase
      .from("ledger_entries")
      .select(
        "id, store_id, account_id, counter_account_id, kind, direction, amount, currency, status, order_id, seller_id, customer_id, reverses_entry_id",
      )
      .eq("id", data.entryId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!original) throw new Error("Defter kaydı bulunamadı");
    if (original.reverses_entry_id) throw new Error("Ters kaydın tersi alınamaz");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("ledger_entries")
      .select("id")
      .eq("reverses_entry_id", original.id)
      .maybeSingle();
    if (existing) throw new Error("Bu kayıt için zaten ters kayıt var");

    const { data: inserted, error } = await supabaseAdmin
      .from("ledger_entries")
      .insert({
        store_id: original.store_id,
        account_id: original.account_id,
        counter_account_id: original.counter_account_id,
        kind: original.kind,
        direction: original.direction === "credit" ? "debit" : "credit",
        amount: original.amount,
        currency: original.currency,
        status: "posted",
        description: `Ters kayıt${data.reason ? ` — ${data.reason}` : ""}`,
        occurred_at: new Date().toISOString(),
        order_id: original.order_id,
        seller_id: original.seller_id,
        customer_id: original.customer_id,
        reverses_entry_id: original.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { entryId: inserted.id };
  });

/** Bekleyen bir kaydı kesinleştirir (yalnızca durum alanı değişebilir). */
export const settleLedgerEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        entryId: z.guid(),
        status: z.enum(["posted", "cancelled", "failed"]),
        reference: z.string().trim().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStoreAccess(context.supabase as never, data.storeId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ledger_entries")
      .update({
        status: data.status,
        ...(data.reference?.length ? { reference: data.reference } : {}),
      })
      .eq("id", data.entryId)
      .eq("store_id", data.storeId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);

    return { ok: true };
  });
