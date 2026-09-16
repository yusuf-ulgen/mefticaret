import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Kolay Panel finans uçları.
 *
 * Kazanç ve çekilebilir bakiye daima veritabanındaki gerçek siparişlerden
 * hesaplanır; istemciden gelen tutara asla güvenilmez. Para çekme talebi
 * mağaza ekibi tarafından oluşturulur, durumu yalnızca platform yöneticisi
 * değiştirebilir (RLS).
 */

type Money = { amount: number; currency: string };

async function computeBalance(
  supabase: { from: (table: string) => any },
  storeId: string,
): Promise<{
  currency: string;
  today: number;
  paidTotal: number;
  requested: number;
  withdrawable: number;
}> {
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, currency")
    .eq("id", storeId)
    .maybeSingle();
  if (storeError) throw new Error(storeError.message);
  if (!store) throw new Error("Mağaza bulunamadı veya yetkiniz yok");

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("grand_total, placed_at, payment_status, status")
    .eq("store_id", storeId)
    .eq("payment_status", "paid")
    .limit(2000);
  if (ordersError) throw new Error(ordersError.message);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  let today = 0;
  let paidTotal = 0;
  for (const order of orders ?? []) {
    if (["cancelled", "refunded", "returned"].includes(String(order.status))) continue;
    const total = Number(order.grand_total ?? 0);
    paidTotal += total;
    const placed = order.placed_at ? new Date(order.placed_at) : null;
    if (placed && placed.getTime() >= startOfDay.getTime()) today += total;
  }

  const { data: requests, error: requestsError } = await supabase
    .from("payout_requests")
    .select("amount, status")
    .eq("store_id", storeId)
    .limit(500);
  if (requestsError) throw new Error(requestsError.message);

  const requested = (requests ?? [])
    .filter((row: { status: string }) => row.status !== "rejected")
    .reduce((sum: number, row: { amount: number }) => sum + Number(row.amount ?? 0), 0);

  return {
    currency: String(store.currency ?? "TRY"),
    today: Number(today.toFixed(2)),
    paidTotal: Number(paidTotal.toFixed(2)),
    requested: Number(requested.toFixed(2)),
    withdrawable: Number(Math.max(0, paidTotal - requested).toFixed(2)),
  };
}

/** Bugünün kazancı ve çekilebilir bakiye (gerçek ödenmiş siparişlerden). */
export const getKolayFinance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => computeBalance(context.supabase as never, data.storeId));

/** Para çekme (hakediş) talebi oluşturur; tutar sunucuda doğrulanır. */
export const requestKolayPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        amount: z.number().positive().max(1_000_000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const balance = await computeBalance(supabase as never, data.storeId);

    const amount = Number((data.amount ?? balance.withdrawable).toFixed(2));
    if (!(amount > 0)) throw new Error("Şu anda çekilebilir bakiyeniz yok");
    if (amount > balance.withdrawable) {
      throw new Error(`Çekilebilir bakiyeniz ${balance.withdrawable} ${balance.currency}`);
    }

    const { data: settings } = await supabase
      .from("store_settings")
      .select("bank_iban, bank_account_holder")
      .eq("store_id", data.storeId)
      .maybeSingle();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("payout_requests")
      .insert({
        store_id: data.storeId,
        amount,
        currency: balance.currency,
        status: "pending",
        iban: settings?.bank_iban ?? null,
        account_holder: settings?.bank_account_holder ?? null,
        requested_by: userId,
      } as never)
      .select("id, amount, currency, status, created_at")
      .single();
    if (error) throw new Error(error.message);

    return {
      request: row as unknown as {
        id: string;
        amount: number;
        currency: string;
        status: string;
        created_at: string;
      },
      balance: { amount: balance.withdrawable - amount, currency: balance.currency } as Money,
    };
  });
