import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type AiProviderRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  models: string[];
  default_model: string | null;
  requires_api_key: boolean;
  api_key_secret_name: string | null;
  is_enabled: boolean;
  sort_order: number;
};

export type StoreAiSettingsRow = {
  provider_code: string;
  model: string;
  creativity: number;
  brand_tone: string;
  language: string;
  monthly_token_limit: number;
  is_enabled: boolean;
};

export type AiGenerationRow = {
  id: string;
  task: string;
  provider_code: string;
  model: string;
  output: string | null;
  total_tokens: number;
  duration_ms: number;
  status: string;
  error: string | null;
  created_at: string;
};

export const aiProvidersQuery = () =>
  queryOptions({
    queryKey: ["ai-providers"],
    queryFn: async (): Promise<AiProviderRow[]> => {
      const { data, error } = await supabase
        .from("ai_providers")
        .select(
          "id, code, name, description, models, default_model, requires_api_key, api_key_secret_name, is_enabled, sort_order",
        )
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        ...row,
        models: Array.isArray(row.models) ? (row.models as string[]) : [],
      }));
    },
  });

export const storeAiSettingsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store-ai-settings", storeId],
    queryFn: async (): Promise<StoreAiSettingsRow | null> => {
      const { data, error } = await supabase
        .from("store_ai_settings")
        .select("provider_code, model, creativity, brand_tone, language, monthly_token_limit, is_enabled")
        .eq("store_id", storeId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return { ...data, creativity: Number(data.creativity) };
    },
  });

export const aiGenerationsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["ai-generations", storeId],
    queryFn: async (): Promise<AiGenerationRow[]> => {
      const { data, error } = await supabase
        .from("ai_generations")
        .select("id, task, provider_code, model, output, total_tokens, duration_ms, status, error, created_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export type AiUsageSummary = {
  monthTokens: number;
  monthRequests: number;
  totalTokens: number;
  byTask: { task: string; tokens: number; requests: number }[];
  byProvider: { provider: string; tokens: number; requests: number }[];
};

export const aiUsageQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["ai-usage", storeId],
    queryFn: async (): Promise<AiUsageSummary> => {
      const { data, error } = await supabase
        .from("ai_generations")
        .select("task, provider_code, total_tokens, created_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw new Error(error.message);

      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getTime();
      const taskMap = new Map<string, { tokens: number; requests: number }>();
      const providerMap = new Map<string, { tokens: number; requests: number }>();
      let monthTokens = 0;
      let monthRequests = 0;
      let totalTokens = 0;

      for (const row of data ?? []) {
        const tokens = row.total_tokens ?? 0;
        totalTokens += tokens;
        if (new Date(row.created_at).getTime() >= start) {
          monthTokens += tokens;
          monthRequests += 1;
        }
        const task = taskMap.get(row.task) ?? { tokens: 0, requests: 0 };
        taskMap.set(row.task, { tokens: task.tokens + tokens, requests: task.requests + 1 });
        const provider = providerMap.get(row.provider_code) ?? { tokens: 0, requests: 0 };
        providerMap.set(row.provider_code, { tokens: provider.tokens + tokens, requests: provider.requests + 1 });
      }

      return {
        monthTokens,
        monthRequests,
        totalTokens,
        byTask: [...taskMap.entries()]
          .map(([task, value]) => ({ task, ...value }))
          .sort((a, b) => b.tokens - a.tokens),
        byProvider: [...providerMap.entries()]
          .map(([provider, value]) => ({ provider, ...value }))
          .sort((a, b) => b.tokens - a.tokens),
      };
    },
  });
