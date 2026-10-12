import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Immutable finans defteri sorguları (hesaplar, bakiyeler, kayıtlar). */

export const LEDGER_ACCOUNT_KIND_LABELS: Record<string, string> = {
  store: "Mağaza kasası",
  seller: "Satıcı hesabı",
  platform: "Platform hesabı",
  customer: "Müşteri cüzdanı",
  payment_provider: "Ödeme sağlayıcı",
  gateway: "Gateway",
};

export const LEDGER_TX_LABELS: Record<string, string> = {
  sale: "Satış",
  shipping: "Kargo geliri",
  discount: "İndirim",
  platform_fee: "Platform ücreti",
  payment_fee: "Ödeme sağlayıcı ücreti",
  refund: "İade",
  payout: "Ödeme aktarımı",
  adjustment: "Düzeltme",
  customer_payment: "Müşteri ödemesi",
  seller_earning: "Satıcı kazancı",
  marketplace_commission: "Marketplace komisyonu",
  withdrawal: "Para çekme",
  wallet_in: "Cüzdan girişi",
  wallet_out: "Cüzdan çıkışı",
};

export const LEDGER_STATUS_LABELS: Record<string, string> = {
  pending: "Bekliyor",
  posted: "Kesinleşti",
  cancelled: "İptal",
  failed: "Başarısız",
};

/** Kullanıcının elle oluşturabileceği işlem tipleri. */
export const LEDGER_MANUAL_TX = [
  "customer_payment",
  "seller_earning",
  "marketplace_commission",
  "refund",
  "withdrawal",
  "platform_fee",
] as const;

export type LedgerManualTx = (typeof LEDGER_MANUAL_TX)[number];

export type LedgerBalanceRow = {
  account_id: string;
  account_kind: string;
  account_name: string;
  currency: string;
  seller_id: string | null;
  credit: number;
  debit: number;
  balance: number;
  pending: number;
};

export const ledgerAccountsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["ledger-accounts", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ledger_accounts")
        .select("id, kind, name, currency, seller_id, customer_id, is_active")
        .eq("store_id", storeId)
        .order("kind", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

export const ledgerBalancesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["ledger-balances", storeId],
    queryFn: async (): Promise<LedgerBalanceRow[]> => {
      const { data, error } = await supabase.rpc("ledger_store_balances", { _store_id: storeId });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        account_id: String(row.account_id),
        account_kind: String(row.account_kind),
        account_name: String(row.account_name),
        currency: String(row.currency ?? "TRY"),
        seller_id: row.seller_id ? String(row.seller_id) : null,
        credit: Number(row.credit ?? 0),
        debit: Number(row.debit ?? 0),
        balance: Number(row.balance ?? 0),
        pending: Number(row.pending ?? 0),
      }));
    },
  });

export const ledgerEntriesQuery = (
  storeId: string,
  filters: { days: number; accountId?: string; kind?: string; status?: string },
) =>
  queryOptions({
    queryKey: ["ledger-entries", storeId, filters],
    queryFn: async () => {
      const since = new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000).toISOString();
      let query = supabase
        .from("ledger_entries")
        .select(
          "id, account_id, counter_account_id, kind, direction, amount, currency, status, reference, description, occurred_at, order_id, seller_id, customer_id, reverses_entry_id",
        )
        .eq("store_id", storeId)
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false })
        .limit(500);
      if (filters.accountId) query = query.eq("account_id", filters.accountId);
      if (filters.kind) query = query.eq("kind", filters.kind as never);
      if (filters.status) query = query.eq("status", filters.status as never);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
