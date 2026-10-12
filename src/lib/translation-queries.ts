import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { ContentType } from "@/lib/translation";

/** Dil ve Çeviri Merkezi sorguları — tümü RLS ile mağaza kapsamlı. */

export type StoreLocaleRow = Database["public"]["Tables"]["store_locales"]["Row"];
export type TranslationEntryRow = Database["public"]["Tables"]["translation_entries"]["Row"];
export type TranslationSettingsRow = Database["public"]["Tables"]["translation_settings"]["Row"];
export type TranslationJobRow = Database["public"]["Tables"]["translation_jobs"]["Row"];
export type GlossaryRow = Database["public"]["Tables"]["translation_glossary"]["Row"];
export type TranslationUsageRow = Database["public"]["Tables"]["translation_usage"]["Row"];
export type TranslationVersionRow = Database["public"]["Tables"]["translation_versions"]["Row"];

export const storeLocalesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["language-center", storeId, "locales"],
    queryFn: async (): Promise<StoreLocaleRow[]> => {
      const { data, error } = await supabase
        .from("store_locales")
        .select("*")
        .eq("store_id", storeId)
        .order("sort_order")
        .order("locale");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 15_000,
  });

export const translationSettingsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["language-center", storeId, "settings"],
    queryFn: async (): Promise<TranslationSettingsRow | null> => {
      const { data, error } = await supabase
        .from("translation_settings")
        .select("*")
        .eq("store_id", storeId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ?? null;
    },
    staleTime: 15_000,
  });

/** Dil kartlarındaki ilerleme yüzdeleri için durum özeti. */
export const translationProgressQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["language-center", storeId, "progress"],
    queryFn: async (): Promise<{ locale: string; status: string; updated_at: string }[]> => {
      const { data, error } = await supabase
        .from("translation_entries")
        .select("locale, status, updated_at")
        .eq("store_id", storeId)
        .limit(50000);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 10_000,
  });

export const translationEntriesQuery = (
  storeId: string,
  filters: { locale: string; contentType: ContentType | "all"; search: string; status: string },
) =>
  queryOptions({
    queryKey: ["language-center", storeId, "entries", filters],
    queryFn: async (): Promise<TranslationEntryRow[]> => {
      let query = supabase
        .from("translation_entries")
        .select("*")
        .eq("store_id", storeId)
        .eq("locale", filters.locale);
      if (filters.contentType !== "all") query = query.eq("content_type", filters.contentType);
      if (filters.status !== "all")
        query = query.eq("status", filters.status as Database["public"]["Enums"]["translation_status"]);
      if (filters.search.trim()) {
        const term = `%${filters.search.trim()}%`;
        query = query.or(
          `translation_key.ilike.${term},source_value.ilike.${term},translated_value.ilike.${term}`,
        );
      }
      const { data, error } = await query.order("translation_key").limit(300);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 5_000,
    enabled: Boolean(filters.locale),
  });

export const translationJobsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["language-center", storeId, "jobs"],
    queryFn: async (): Promise<TranslationJobRow[]> => {
      const { data, error } = await supabase
        .from("translation_jobs")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    refetchInterval: 8_000,
  });

export const glossaryQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["language-center", storeId, "glossary"],
    queryFn: async (): Promise<GlossaryRow[]> => {
      const { data, error } = await supabase
        .from("translation_glossary")
        .select("*")
        .eq("store_id", storeId)
        .order("term")
        .limit(300);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 15_000,
  });

export const translationUsageQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["language-center", storeId, "usage"],
    queryFn: async (): Promise<TranslationUsageRow[]> => {
      const { data, error } = await supabase
        .from("translation_usage")
        .select("*")
        .eq("store_id", storeId)
        .order("day", { ascending: false })
        .limit(60);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 30_000,
  });

export const translationHistoryQuery = (storeId: string, entryId: string | null) =>
  queryOptions({
    queryKey: ["language-center", storeId, "history", entryId],
    queryFn: async (): Promise<TranslationVersionRow[]> => {
      if (!entryId) return [];
      const { data, error } = await supabase
        .from("translation_versions")
        .select("*")
        .eq("store_id", storeId)
        .eq("entry_id", entryId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: Boolean(entryId),
  });
