import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getKolayFinance } from "@/lib/kolay-finance.functions";

/** Kolay Panel finans okuma katmanı: kazanç sunucuda, talep listesi RLS altında. */

export const kolayFinanceQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["kolay-finance", storeId],
    staleTime: 30_000,
    queryFn: () => getKolayFinance({ data: { storeId } }),
  });

export type PayoutRequestRow = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
};

export const kolayPayoutsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["kolay-payouts", storeId],
    staleTime: 30_000,
    queryFn: async (): Promise<PayoutRequestRow[]> => {
      const { data, error } = await supabase
        .from("payout_requests")
        .select("id, amount, currency, status, created_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        amount: Number(row.amount),
        currency: row.currency,
        status: row.status,
        created_at: row.created_at,
      }));
    },
  });
