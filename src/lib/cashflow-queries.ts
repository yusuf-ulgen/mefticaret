import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { CashLedgerInput, CashPayoutInput } from "@/lib/cashflow";

/** Nakit akışı verisi: finans defteri kayıtları + hakedişler. */
export const cashflowDataQuery = (storeId: string, days = 365) =>
  queryOptions({
    queryKey: ["cashflow-data", storeId, days],
    queryFn: async (): Promise<{ entries: CashLedgerInput[]; payouts: CashPayoutInput[] }> => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const [ledgerRes, payoutRes] = await Promise.all([
        supabase
          .from("ledger_entries")
          .select("id, kind, direction, amount, occurred_at, description")
          .eq("store_id", storeId)
          .gte("occurred_at", since)
          .order("occurred_at", { ascending: false })
          .limit(8000),
        supabase
          .from("payouts")
          .select("id, status, net_amount, period_start, period_end, paid_at")
          .eq("store_id", storeId)
          .order("period_start", { ascending: false })
          .limit(200),
      ]);

      if (ledgerRes.error) throw ledgerRes.error;
      if (payoutRes.error) throw payoutRes.error;

      return {
        entries: (ledgerRes.data ?? []).map((row) => ({
          id: String(row.id),
          kind: String(row.kind),
          direction: row.direction === "debit" ? "debit" : "credit",
          amount: Number(row.amount ?? 0),
          occurredAt: String(row.occurred_at),
          description: row.description ? String(row.description) : null,
        })),
        payouts: (payoutRes.data ?? []).map((row) => ({
          id: String(row.id),
          status: String(row.status),
          netAmount: Number(row.net_amount ?? 0),
          periodStart: String(row.period_start),
          periodEnd: String(row.period_end),
          paidAt: row.paid_at ? String(row.paid_at) : null,
        })),
      };
    },
    staleTime: 60_000,
  });
