import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Süper yönetici: gelen iletişim mesajları listesi (RLS ile korunur). */

export const platformContactMessagesQuery = () =>
  queryOptions({
    queryKey: ["platform-contact-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_contact_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });
