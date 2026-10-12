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

/**
 * Oturum sahibini istek başlığından çözer.
 *
 * Token yoksa veya geçersizse hata atmak yerine `null` döner; böylece panel
 * kapıları 500 yerine düzenli bir "erişim yok" yanıtı üretir.
 */
export async function resolveCaller(): Promise<{
  supabase: import("@supabase/supabase-js").SupabaseClient<
    import("@/integrations/supabase/types").Database
  >;
  userId: string;
} | null> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;

  let token: string | null = null;
  try {
    const header = getRequest().headers.get("authorization");
    if (header?.startsWith("Bearer ")) token = header.slice(7).trim() || null;
  } catch {
    return null;
  }
  if (!token || token.split(".").length !== 3) return null;

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient<import("@/integrations/supabase/types").Database>(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data, error } = await supabase.auth.getClaims(token);
    const userId = data?.claims?.sub;
    if (error || !userId) return null;
    return { supabase, userId };
  } catch {
    return null;
  }
}
