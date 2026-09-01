import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { resolveSections, type ThemeSectionRow } from "@/lib/theme-sections";

export const themeSectionsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["theme-sections", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_theme_sections")
        .select("id, store_id, type, position, is_enabled, settings")
        .eq("store_id", storeId)
        .order("position");
      if (error) throw error;
      return resolveSections((data ?? []) as ThemeSectionRow[]);
    },
  });
