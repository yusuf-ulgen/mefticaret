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

    // Sunucu önbelleği en geç ~15 sn'de yenilenir; değişiklikten hemen sonra ve
    // önbellek süresi dolunca bir kez daha tazeleriz.
    let late: ReturnType<typeof setTimeout> | undefined;
    const onChange = () => {
      refresh();
      if (late) clearTimeout(late);
      late = setTimeout(refresh, 16_000);
    };
    const byStore = `store_id=eq.${storeId}`;
    let channel = supabase.channel(`storefront-live-${storeId}`);
    for (const table of ["products", "product_variants", "product_images", "collections", "home_maker_profiles"]) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table, filter: byStore }, onChange);
    }
    channel = channel.on("postgres_changes", { event: "*", schema: "public", table: "stores", filter: `id=eq.${storeId}` }, onChange);
    channel.subscribe();

    return () => {
      if (late) clearTimeout(late);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refresh);
      void supabase.removeChannel(channel);
    };
  }, [slug, storeId, queryClient]);
}
