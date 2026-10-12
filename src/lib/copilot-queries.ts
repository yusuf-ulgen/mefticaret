import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Copilot sohbet listesi ve mesaj sorguları (RLS ile mağaza kapsamlı). */

export type CopilotConversationRow = {
  id: string;
  title: string;
  last_message_at: string;
  created_at: string;
};

export type CopilotMessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model: string | null;
  total_tokens: number;
  created_at: string;
};

export const copilotConversationsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["copilot", "conversations", storeId],
    queryFn: async (): Promise<CopilotConversationRow[]> => {
      const { data, error } = await supabase
        .from("copilot_conversations")
        .select("id, title, last_message_at, created_at")
        .eq("store_id", storeId)
        .order("last_message_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []) as CopilotConversationRow[];
    },
  });

export const copilotMessagesQuery = (conversationId: string | null) =>
  queryOptions({
    queryKey: ["copilot", "messages", conversationId],
    enabled: Boolean(conversationId),
    queryFn: async (): Promise<CopilotMessageRow[]> => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from("copilot_messages")
        .select("id, role, content, model, total_tokens, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as CopilotMessageRow[];
    },
  });
