import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type OmniChannelAccount = Database["public"]["Tables"]["omni_channel_accounts"]["Row"];
export type OmniConversation = Database["public"]["Tables"]["omni_conversations"]["Row"];
export type OmniMessage = Database["public"]["Tables"]["omni_messages"]["Row"];
export type OmniQuickReply = Database["public"]["Tables"]["omni_quick_replies"]["Row"];
export type OmniAutoReply = Database["public"]["Tables"]["omni_auto_replies"]["Row"];

export type OmniConversationFilters = {
  channel?: string | null;
  status?: string | null;
  unreadOnly?: boolean;
  search?: string | null;
};

export const omniConversationsQuery = (storeId: string, filters: OmniConversationFilters = {}) =>
  queryOptions({
    queryKey: ["omni-conversations", storeId, filters],
    queryFn: async () => {
      let query = supabase
        .from("omni_conversations")
        .select("*")
        .eq("store_id", storeId)
        .order("last_message_at", { ascending: false })
        .limit(100);

      if (filters.channel) query = query.eq("channel", filters.channel);
      if (filters.status) query = query.eq("status", filters.status);
      if (filters.unreadOnly) query = query.gt("unread_count", 0);
      if (filters.search) {
        const term = filters.search.trim();
        if (term) query = query.or(`participant_name.ilike.%${term}%,participant_handle.ilike.%${term}%`);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export const omniConversationQuery = (conversationId: string | null) =>
  queryOptions({
    queryKey: ["omni-conversation", conversationId],
    enabled: Boolean(conversationId),
    queryFn: async () => {
      if (!conversationId) return null;
      const { data, error } = await supabase
        .from("omni_conversations")
        .select("*")
        .eq("id", conversationId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

export const omniMessagesQuery = (conversationId: string | null) =>
  queryOptions({
    queryKey: ["omni-messages", conversationId],
    enabled: Boolean(conversationId),
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from("omni_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(300);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export const omniQuickRepliesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["omni-quick-replies", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("omni_quick_replies")
        .select("*")
        .eq("store_id", storeId)
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export const omniAutoRepliesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["omni-auto-replies", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("omni_auto_replies")
        .select("*")
        .eq("store_id", storeId)
        .order("kind", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export const omniChannelAccountsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["omni-channel-accounts", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("omni_channel_accounts")
        .select("*")
        .eq("store_id", storeId)
        .order("channel", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export type OmniInboxStats = {
  todayMessages: number;
  unanswered: number;
  avgFirstResponseSeconds: number | null;
  aiAnswered: number;
  convertedToOrder: number;
};

export const omniInboxStatsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["omni-inbox-stats", storeId],
    queryFn: async (): Promise<OmniInboxStats> => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const since = startOfDay.toISOString();

      const [todayMsgs, unanswered, converted, responseTimes, aiMsgs] = await Promise.all([
        supabase
          .from("omni_messages")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .gte("created_at", since),
        supabase
          .from("omni_conversations")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .gt("unread_count", 0),
        supabase
          .from("omni_conversations")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .not("converted_order_id", "is", null),
        supabase
          .from("omni_conversations")
          .select("first_response_seconds")
          .eq("store_id", storeId)
          .not("first_response_seconds", "is", null)
          .limit(500),
        supabase
          .from("omni_messages")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .eq("is_ai", true)
          .gte("created_at", since),
      ]);

      if (todayMsgs.error) throw new Error(todayMsgs.error.message);
      if (unanswered.error) throw new Error(unanswered.error.message);
      if (converted.error) throw new Error(converted.error.message);
      if (responseTimes.error) throw new Error(responseTimes.error.message);
      if (aiMsgs.error) throw new Error(aiMsgs.error.message);

      const times = (responseTimes.data ?? [])
        .map((row) => row.first_response_seconds)
        .filter((value): value is number => typeof value === "number");
      const avg = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;

      return {
        todayMessages: todayMsgs.count ?? 0,
        unanswered: unanswered.count ?? 0,
        avgFirstResponseSeconds: avg,
        aiAnswered: aiMsgs.count ?? 0,
        convertedToOrder: converted.count ?? 0,
      };
    },
  });

export const omniAssigneesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["omni-assignees", storeId],
    queryFn: async () => {
      const { data: members, error } = await supabase
        .from("store_users")
        .select("user_id, role")
        .eq("store_id", storeId);
      if (error) throw new Error(error.message);
      const ids = (members ?? []).map((m) => m.user_id);
      if (ids.length === 0) return [];
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", ids);
      if (profileError) throw new Error(profileError.message);
      return profiles ?? [];
    },
  });
