import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { findMyCustomer } from "@/lib/account.server";

/**
 * Müşteri puan ve kampanya bilgisi (yalnızca sunucu).
 * Puan kayıtları RLS altında yalnızca müşterinin kendi kayıtlarıdır.
 * Kampanya (indirim kodu) listesi müşteriye gösterilmek üzere sınırlı
 * kolonlarla okunur.
 */

type Client = SupabaseClient<Database>;

export type MyLoyaltyAccount = {
  points_balance: number;
  lifetime_points: number;
  tier: string;
};

export type MyLoyaltyTransaction = {
  id: string;
  kind: string;
  points: number;
  description: string | null;
  created_at: string;
};

export type MyCampaign = {
  id: string;
  code: string;
  title: string;
  type: string;
  value: number;
  min_subtotal: number | null;
  ends_at: string | null;
};

export type MyLoyalty = {
  account: MyLoyaltyAccount;
  transactions: MyLoyaltyTransaction[];
  campaigns: MyCampaign[];
};

export const TIER_LABELS: Record<string, string> = {
  classic: "Klasik Üye",
  gold: "Gold Üye",
  vip: "VIP Üye",
};

export async function listMyLoyalty(supabase: Client, userId: string, storeId: string): Promise<MyLoyalty> {
  const empty: MyLoyalty = {
    account: { points_balance: 0, lifetime_points: 0, tier: "classic" },
    transactions: [],
    campaigns: [],
  };
  const customer = await findMyCustomer(supabase, userId, storeId);
  if (!customer) return empty;

  const [accountResult, txResult] = await Promise.all([
    supabase
      .from("loyalty_accounts")
      .select("points_balance, lifetime_points, tier")
      .eq("store_id", storeId)
      .eq("customer_id", customer.id)
      .maybeSingle(),
    supabase
      .from("loyalty_transactions")
      .select("id, kind, points, description, created_at")
      .eq("store_id", storeId)
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  if (accountResult.error) throw new Error(accountResult.error.message);
  if (txResult.error) throw new Error(txResult.error.message);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();
  const { data: campaigns } = await supabaseAdmin
    .from("discounts")
    .select("id, code, title, type, value, min_subtotal, ends_at")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("created_at", { ascending: false })
    .limit(12);

  return {
    account: accountResult.data ?? empty.account,
    transactions: txResult.data ?? [],
    campaigns: (campaigns ?? []) as MyCampaign[],
  };
}
