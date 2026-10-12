import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type ThemeVersion = {
  id: string;
  label: string;
  is_published: boolean;
  created_at: string;
  sectionCount: number;
};

export const themeVersionsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["theme-versions", storeId],
    queryFn: async (): Promise<ThemeVersion[]> => {
      const { data, error } = await supabase
        .from("store_theme_versions")
        .select("id, label, is_published, created_at, snapshot")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((row) => {
        const snapshot = row.snapshot as { sections?: unknown[] } | null;
        return {
          id: row.id,
          label: row.label,
          is_published: row.is_published,
          created_at: row.created_at,
          sectionCount: Array.isArray(snapshot?.sections) ? snapshot.sections.length : 0,
        };
      });
    },
  });
