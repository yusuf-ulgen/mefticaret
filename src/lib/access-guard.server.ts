import { getRequest } from "@tanstack/react-start/server";

import { requestIp } from "./audit.server";

/**
 * Yetkilendirme denetim kayıtları.
 *
 * Panel erişim denemeleri (izin verilen ve reddedilen) `security_events`
 * tablosuna servis rolüyle yazılır; RLS altındaki istemci bu tabloya yazamaz.
 */

export type SecurityEventInput = {
  userId: string | null;
  storeId?: string | null;
  kind: string;
  severity: "info" | "warning" | "critical";
  meta?: Record<string, unknown>;
};

export async function logSecurityEvent(entry: SecurityEventInput): Promise<void> {
  let ip: string | null = null;
  let userAgent: string | null = null;
  try {
    const request = getRequest();
    ip = requestIp(request);
    userAgent = request.headers.get("user-agent");
  } catch {
    // İstek bağlamı yoksa kayıt IP olmadan yazılır.
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("security_events").insert({
      user_id: entry.userId,
      store_id: entry.storeId ?? null,
      kind: entry.kind,
      severity: entry.severity,
      ip,
      user_agent: userAgent,
      meta: JSON.parse(JSON.stringify(entry.meta ?? {})) as never,
    });
    if (error) console.error("security_events insert failed", error);
  } catch (error) {
    console.error("security_events insert threw", error);
  }
}
