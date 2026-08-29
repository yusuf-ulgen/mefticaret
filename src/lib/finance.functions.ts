import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Finans sunucu fonksiyonları: dönem kapatma (payout) ve durum güncelleme. */

export const createPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        reference: z.string().trim().max(120).optional(),
        note: z.string().trim().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, currency")
      .eq("id", data.storeId)
      .maybeSingle();
    if (storeError) throw new Error(storeError.message);
    if (!store) throw new Error("Mağaza bulunamadı veya yetkiniz yok");

    const { data: entries, error: entryError } = await supabase
      .from("ledger_entries")
      .select("id, kind, direction, amount")
      .eq("store_id", data.storeId)
      .is("payout_id", null)
      .gte("occurred_at", `${data.periodStart}T00:00:00.000Z`)
      .lte("occurred_at", `${data.periodEnd}T23:59:59.999Z`);
    if (entryError) throw new Error(entryError.message);
    if (!entries || entries.length === 0) throw new Error("Bu dönemde kapatılacak finans kaydı yok");

    let gross = 0;
    let fees = 0;
    let refunds = 0;
    let net = 0;
    for (const entry of entries) {
      const amount = Number(entry.amount ?? 0);
      if (entry.direction === "credit") {
        gross += amount;
        net += amount;
      } else {
        net -= amount;
        if (entry.kind === "platform_fee" || entry.kind === "payment_fee") fees += amount;
        if (entry.kind === "refund") refunds += amount;
      }
    }

    const { data: payout, error: payoutError } = await supabase
      .from("payouts")
      .insert({
        store_id: data.storeId,
        period_start: data.periodStart,
        period_end: data.periodEnd,
        gross_amount: Number(gross.toFixed(2)),
        fee_amount: Number(fees.toFixed(2)),
        refund_amount: Number(refunds.toFixed(2)),
        net_amount: Number(net.toFixed(2)),
        currency: store.currency ?? "TRY",
        status: "pending",
        reference: data.reference?.length ? data.reference : null,
        note: data.note?.length ? data.note : null,
      })
      .select("id, net_amount")
      .single();
    if (payoutError) throw new Error(payoutError.message);

    return { payoutId: payout.id, net: Number(payout.net_amount ?? 0), entries: entries.length };
  });

export const updatePayoutStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        payoutId: z.string().uuid(),
        status: z.enum(["pending", "processing", "paid", "failed"]),
        reference: z.string().trim().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("payouts")
      .update({
        status: data.status,
        paid_at: data.status === "paid" ? new Date().toISOString() : null,
        ...(data.reference?.length ? { reference: data.reference } : {}),
      })
      .eq("id", data.payoutId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
