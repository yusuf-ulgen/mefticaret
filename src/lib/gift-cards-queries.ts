import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const giftCardsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["gift-cards", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gift_cards")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

export const giftCardTransactionsQuery = (giftCardId: string | null) =>
  queryOptions({
    queryKey: ["gift-card-transactions", giftCardId],
    enabled: Boolean(giftCardId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gift_card_transactions")
        .select("*, orders(order_number)")
        .eq("gift_card_id", giftCardId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
