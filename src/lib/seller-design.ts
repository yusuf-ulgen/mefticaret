import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Satıcı paneli v2 tasarım bayrağı (platform_settings, herkese açık okunur; yalnız platform yöneticisi değiştirir). */
export const SELLER_DESIGN_FLAG = "v2_seller_design";

export function useSellerDesignV2(): boolean {
  const { data } = useQuery({
    queryKey: ["flag", SELLER_DESIGN_FLAG],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", SELLER_DESIGN_FLAG)
        .maybeSingle();
      return Boolean((data?.value as { enabled?: boolean } | null)?.enabled);
    },
  });
  const enabled = data === true;

  // Menü, açılır pencere gibi gövdeye taşınan katmanlar da aynı tasarımı alsın; panelden çıkınca kaldırılır.
  useEffect(() => {
    if (!enabled) return;
    document.body.classList.add("seller-v2");
    return () => document.body.classList.remove("seller-v2");
  }, [enabled]);

  return enabled;
}
