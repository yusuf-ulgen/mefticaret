import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Vitrin canlı güncellemesi.
 * Mağazanın ürün ve varyant satırlarındaki değişiklikler (fiyat, stok, açıklama,
 * yayın durumu) anında vitrine yansır. RLS sunucu tarafında geçerli olduğu için
 * ziyaretçi yalnızca görebildiği yayınlanmış ürünlerin güncellemesini alır.
 * Ek olarak mobilde sekme/uygulama yeniden öne geldiğinde veri tazelenir.
 */
export function useStorefrontLive(slug: string, storeId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!slug) return;

    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["storefront", slug] });
    };

    // Mobil tarayıcılar sekmeyi dondurduğunda realtime bağlantısı kopabilir;
    // ekran yeniden görünür olduğunda vitrini tazeleriz.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", refresh);

    if (!storeId) {
      return () => {
        document.removeEventListener("visibilitychange", onVisible);
        window.removeEventListener("online", refresh);
      };
    }

    const channel = supabase
      .channel(`storefront-live-${storeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products", filter: `store_id=eq.${storeId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "product_variants",
          filter: `store_id=eq.${storeId}`,
        },
        refresh,
      )
      .subscribe();

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refresh);
      void supabase.removeChannel(channel);
    };
  }, [slug, storeId, queryClient]);
}
