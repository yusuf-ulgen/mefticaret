import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Finans sorguları: ledger ve payout kayıtları (RLS ile mağaza izolasyonu). */

export const LEDGER_KIND_LABELS: Record<string, string> = {
  sale: "Satış",
  shipping: "Kargo geliri",
  discount: "İndirim",
  platform_fee: "Platform komisyonu",
  payment_fee: "Ödeme sağlayıcı ücreti",
  refund: "İade",
  payout: "Ödeme aktarımı",
  adjustment: "Düzeltme",
};

export const PAYOUT_STATUS_LABELS: Record<string, string> = {
  pending: "Bekliyor",
  processing: "İşleniyor",
  paid: "Ödendi",
  failed: "Başarısız",
};

export const ledgerQuery = (storeId: string, days: number) =>
  queryOptions({
    queryKey: ["ledger", storeId, days],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("id, kind, direction, amount, currency, description, occurred_at, order_id, meta")
        .eq("store_id", storeId)
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

export const payoutsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["payouts", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payouts")
        .select("*")
        .eq("store_id", storeId)
        .order("period_start", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

export type LedgerRow = {
  kind: string;
  direction: string;
  amount: number | string;
};

export function summarizeLedger(rows: LedgerRow[]) {
  let credit = 0;
  let debit = 0;
  const byKind = new Map<string, number>();
  for (const row of rows) {
    const amount = Number(row.amount ?? 0);
    if (row.direction === "credit") credit += amount;
    else debit += amount;
    byKind.set(row.kind, (byKind.get(row.kind) ?? 0) + amount);
  }
  return {
    credit,
    debit,
    net: credit - debit,
    fees: (byKind.get("platform_fee") ?? 0) + (byKind.get("payment_fee") ?? 0),
    refunds: byKind.get("refund") ?? 0,
    byKind: [...byKind.entries()].sort((a, b) => b[1] - a[1]),
  };
}
