import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const storeThemeQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store-theme", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_themes")
        .select("*")
        .eq("store_id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
