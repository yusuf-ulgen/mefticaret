import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Satıcı paneli v2 tasarım bayrağı (platform_settings, herkese açık okunur; yalnız platform yöneticisi değiştirir). */
export const SELLER_DESIGN_FLAG = "v2_seller_design";
const PREVIEW_KEY = "mefti:seller-v2-preview"; // yalnız bu tarayıcıda önizleme (?seller_v2=1 / 0)
const DARK_KEY = "mefti:seller-v2-dark";
const COLLAPSE_KEY = "mefti:seller-v2-collapsed";

export type SellerDesign = {
  enabled: boolean;
  dark: boolean;
  collapsed: boolean;
  toggleDark: () => void;
  toggleCollapsed: () => void;
};

export function useSellerDesignV2(): SellerDesign {
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

  const [preview, setPreview] = useState<boolean | null>(null);
  const [dark, setDark] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("seller_v2");
    if (q === "1") localStorage.setItem(PREVIEW_KEY, "1");
    if (q === "0") localStorage.setItem(PREVIEW_KEY, "0");
    const p = localStorage.getItem(PREVIEW_KEY);
    setPreview(p === "1" ? true : p === "0" ? false : null);
    setDark(localStorage.getItem(DARK_KEY) === "1");
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  const enabled = preview ?? data === true;

  // Gövdeye taşınan katmanlar (menü, pencere, çekmece) da aynı tasarımı alsın; panelden çıkınca kaldırılır.
  useEffect(() => {
    if (!enabled) return;
    const b = document.body.classList;
    b.add("seller-v2");
    b.toggle("dark", dark);
    return () => {
      b.remove("seller-v2");
      b.remove("dark");
    };
  }, [enabled, dark]);

  const toggleDark = useCallback(() => {
    setDark((d) => {
      localStorage.setItem(DARK_KEY, d ? "0" : "1");
      return !d;
    });
  }, []);
  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      return !c;
    });
  }, []);

  return { enabled, dark, collapsed, toggleDark, toggleCollapsed };
}
