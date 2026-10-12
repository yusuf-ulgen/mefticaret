import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { GiftCardRecord, GiftTxRecord } from "@/lib/gift-liability";

export type GiftLiabilityData = {
  cards: GiftCardRecord[];
  transactions: GiftTxRecord[];
};

/** Hediye kartı yükümlülük analizi: kartlar ve tüm bakiye hareketleri. */
export const giftLiabilityQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["gift-liability", storeId],
    queryFn: async (): Promise<GiftLiabilityData> => {
      const [cardsRes, txRes] = await Promise.all([
        supabase
          .from("gift_cards")
          .select("id, code, status, initial_amount, balance, created_at, expires_at")
          .eq("store_id", storeId)
          .limit(5000),
        supabase
          .from("gift_card_transactions")
          .select("id, gift_card_id, kind, amount, created_at")
          .eq("store_id", storeId)
          .order("created_at", { ascending: true })
          .limit(10000),
      ]);

      if (cardsRes.error) throw cardsRes.error;
      if (txRes.error) throw txRes.error;

      const cards: GiftCardRecord[] = (cardsRes.data ?? []).map((row) => ({
        id: String(row.id),
        code: String(row.code),
        status: String(row.status),
        initialAmount: Number(row.initial_amount ?? 0),
        balance: Number(row.balance ?? 0),
        createdAt: String(row.created_at),
        expiresAt: row.expires_at ? String(row.expires_at) : null,
      }));

      const transactions: GiftTxRecord[] = (txRes.data ?? []).map((row) => ({
        id: String(row.id),
        giftCardId: String(row.gift_card_id),
        kind: String(row.kind),
        amount: Number(row.amount ?? 0),
        createdAt: String(row.created_at),
      }));

      return { cards, transactions };
    },
  });
