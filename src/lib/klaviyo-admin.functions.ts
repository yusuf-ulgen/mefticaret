import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Süper yönetici Klaviyo paneli: platform hesabı + mağaza kullanımları. */

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "platform_admin")
    .maybeSingle();
  if (!data) throw new Error("Bu alana yalnızca süper yönetici erişebilir");
}

export const getKlaviyoAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: installs } = await supabaseAdmin
      .from("app_installations")
      .select("status, settings, installed_at, stores(id, name, slug), apps!inner(code)")
      .eq("apps.code", "klaviyo");
    const stores = (installs ?? []).map((row: any) => {
      const s = (row.settings ?? {}) as Record<string, unknown>;
      return {
        storeId: row.stores?.id as string,
        name: row.stores?.name as string,
        slug: row.stores?.slug as string,
        status: row.status as string,
        connection: String(s["_connection_status"] ?? "—"),
        message: String(s["_connection_message"] ?? ""),
        sendCampaigns: s["send_campaigns"] === true,
        installedAt: row.installed_at as string,
      };
    });
    return { stores };
  });

