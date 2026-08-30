import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type MenuKind = "home" | "collection" | "page" | "product" | "cart" | "account" | "url";

export type MenuItem = {
  id: string;
  location: "header" | "footer";
  label: string;
  kind: MenuKind;
  target: string | null;
  position: number;
  is_visible: boolean;
};

export const MENU_KIND_LABELS: Record<MenuKind, string> = {
  home: "Vitrin ana sayfa",
  collection: "Koleksiyon",
  page: "İçerik sayfası",
  product: "Ürün",
  cart: "Sepet",
  account: "Hesabım",
  url: "Özel bağlantı",
};

export const MENU_LOCATION_LABELS = {
  header: "Üst menü",
  footer: "Alt menü",
} as const;

/** Yönetim paneli: mağazanın tüm menü bağlantıları. */
export const storeMenuItemsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store-menu-items", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_menu_items")
        .select("id, location, label, kind, target, position, is_visible")
        .eq("store_id", storeId)
        .order("location")
        .order("position");
      if (error) throw error;
      return (data ?? []) as MenuItem[];
    },
  });

/** Vitrin: yayınlanmış mağazanın görünür menü bağlantıları (anon okuma). */
export const storefrontMenuQuery = (slug: string) =>
  queryOptions({
    queryKey: ["storefront-menu", slug],
    queryFn: async () => {
      const { data: store, error: storeError } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (storeError) throw storeError;
      if (!store) return [] as MenuItem[];

      const { data, error } = await supabase
        .from("store_menu_items")
        .select("id, location, label, kind, target, position, is_visible")
        .eq("store_id", store.id)
        .eq("is_visible", true)
        .order("position");
      if (error) throw error;
      return (data ?? []) as MenuItem[];
    },
    staleTime: 60_000,
  });
