import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type WhatsAppAccountRow = Database["public"]["Tables"]["whatsapp_accounts"]["Row"];
export type WhatsAppConversation = Database["public"]["Tables"]["whatsapp_conversations"]["Row"];
export type WhatsAppMessage = Database["public"]["Tables"]["whatsapp_messages"]["Row"];
export type WhatsAppAutoReply = Database["public"]["Tables"]["whatsapp_auto_replies"]["Row"];

export const whatsappAccountQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["whatsapp-account", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_accounts")
        .select("*")
        .eq("store_id", storeId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

export const whatsappInboxQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["whatsapp-inbox", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .select("*")
        .eq("store_id", storeId)
        .order("last_message_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export const whatsappMessagesQuery = (conversationId: string | null) =>
  queryOptions({
    queryKey: ["whatsapp-messages", conversationId],
    enabled: Boolean(conversationId),
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export const whatsappAutoRepliesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["whatsapp-auto-replies", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_auto_replies")
        .select("*")
        .eq("store_id", storeId)
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
