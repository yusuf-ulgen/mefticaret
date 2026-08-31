import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { TeamAuditInput, TeamEventInput, TeamMemberInput } from "@/lib/team-performance";

/** Personel performansı verisi: sipariş olayları, denetim kayıtları ve ekip listesi. */
export const teamPerformanceDataQuery = (storeId: string, days = 90) =>
  queryOptions({
    queryKey: ["team-performance", storeId, days],
    queryFn: async (): Promise<{
      events: TeamEventInput[];
      audits: TeamAuditInput[];
      members: TeamMemberInput[];
    }> => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const [eventRes, auditRes, memberRes] = await Promise.all([
        supabase
          .from("order_events")
          .select("id, actor_id, kind, created_at, order_id")
          .eq("store_id", storeId)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(6000),
        supabase
          .from("audit_logs")
          .select("id, actor_id, action, entity, created_at")
          .eq("store_id", storeId)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(6000),
        supabase.from("store_users").select("user_id, role, invited_email").eq("store_id", storeId),
      ]);

      if (eventRes.error) throw eventRes.error;
      if (auditRes.error) throw auditRes.error;
      if (memberRes.error) throw memberRes.error;

      return {
        events: (eventRes.data ?? []).map((row) => ({
          id: String(row.id),
          actorId: row.actor_id ? String(row.actor_id) : null,
          kind: String(row.kind),
          createdAt: String(row.created_at),
          orderId: String(row.order_id),
        })),
        audits: (auditRes.data ?? []).map((row) => ({
          id: String(row.id),
          actorId: row.actor_id ? String(row.actor_id) : null,
          action: String(row.action),
          entity: row.entity ? String(row.entity) : null,
          createdAt: String(row.created_at),
        })),
        members: (memberRes.data ?? []).map((row) => ({
          userId: String(row.user_id),
          role: String(row.role),
          invitedEmail: row.invited_email ? String(row.invited_email) : null,
        })),
      };
    },
    staleTime: 60_000,
  });
