import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type AiCreditPackageRow = {
  id: string;
  code: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
  sort_order: number;
};

export type AiCreditWallet = {
  balance: number;
  lifetimePurchased: number;
  lifetimeUsed: number;
};

export type AiCreditLedgerRow = {
  id: string;
  delta: number;
  balance_after: number;
  reason: string;
  task: string | null;
  created_at: string;
};

export const aiCreditPackagesQuery = () =>
  queryOptions({
    queryKey: ["ai-credit-packages"],
    queryFn: async (): Promise<AiCreditPackageRow[]> => {
      const { data, error } = await supabase
        .from("ai_credit_packages")
        .select("id, code, name, credits, price, currency, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({ ...row, price: Number(row.price) }));
    },
  });

export const aiCreditWalletQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["ai-credit-wallet", storeId],
    queryFn: async (): Promise<AiCreditWallet> => {
      const { data, error } = await supabase
        .from("store_ai_credits")
        .select("balance, lifetime_purchased, lifetime_used")
        .eq("store_id", storeId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return {
        balance: data?.balance ?? 0,
        lifetimePurchased: data?.lifetime_purchased ?? 0,
        lifetimeUsed: data?.lifetime_used ?? 0,
      };
    },
  });

export const aiCreditLedgerQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["ai-credit-ledger", storeId],
    queryFn: async (): Promise<AiCreditLedgerRow[]> => {
      const { data, error } = await supabase
        .from("ai_credit_ledger")
        .select("id, delta, balance_after, reason, task, created_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
