import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { playNotifySound } from "@/lib/notify-sounds";
import { formatMoney } from "@/lib/mefti";

type LiveEvent = {
  id: string;
  kind: "order" | "notification";
  title: string;
  detail: string;
  at: string;
};

/**
 * Mağaza için canlı sipariş ve bildirim akışı.
 * Realtime kanalı yalnızca ilgili store_id satırlarını dinler; RLS sunucu tarafında geçerlidir.
 */
export function useStoreRealtime(storeId: string, options?: { notify?: boolean }) {
  const queryClient = useQueryClient();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const notify = options?.notify ?? true;

  useEffect(() => {
    if (!storeId) return;

    const channel = supabase
      .channel(`store-live-${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            order_number: string;
            customer_name: string | null;
            grand_total: number;
            currency: string;
            placed_at: string;
          };
          const detail = `${row.customer_name ?? "Misafir"} · ${formatMoney(
            Number(row.grand_total ?? 0),
            row.currency,
          )}`;
          setEvents((current) =>
            [
              {
                id: row.id,
                kind: "order" as const,
                title: `Yeni sipariş ${row.order_number}`,
                detail,
                at: row.placed_at ?? new Date().toISOString(),
              },
              ...current,
            ].slice(0, 10),
          );
          if (notify) {
            toast.success(`Yeni sipariş ${row.order_number}`, { description: detail });
            playNotifySound("order");
          }
          void queryClient.invalidateQueries({ queryKey: ["store", storeId] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            title: string;
            message: string | null;
            created_at: string;
            kind: string;
          };
          if (row.kind === "order") return; // sipariş bildirimi zaten yukarıda işlendi
          setEvents((current) =>
            [
              {
                id: row.id,
                kind: "notification" as const,
                title: row.title,
                detail: row.message ?? "",
                at: row.created_at ?? new Date().toISOString(),
              },
              ...current,
            ].slice(0, 10),
          );
          if (notify) playNotifySound("info");
          void queryClient.invalidateQueries({ queryKey: ["store", storeId, "notifications"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [storeId, notify, queryClient]);

  return events;
}
