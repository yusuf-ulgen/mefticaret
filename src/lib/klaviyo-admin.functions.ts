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
    const { verifyKlaviyo, listKlaviyoLists } = await import("@/lib/klaviyo.server");
    const key = process.env["KLAVIYO_PRIVATE_API_KEY"];
    let platform: { connected: boolean; message: string; lists: { id: string; name: string }[] } = {
      connected: false,
      message: "Platform Klaviyo anahtarı eklenmemiş",
      lists: [],
    };
    if (key) {
      try {
        const info = await verifyKlaviyo(key);
        platform = {
          connected: true,
          message: `Bağlı${info.organization ? `: ${info.organization}` : ""}`,
          lists: await listKlaviyoLists(key),
        };
      } catch (error) {
        platform = { connected: false, message: (error as Error).message, lists: [] };
      }
    }
    const { data: setting } = await context.supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "klaviyo_merchant_list")
      .maybeSingle();

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
    return {
      platform,
      merchantListId: ((setting?.value as any)?.list_id as string | undefined) ?? "",
      stores,
    };
  });

export const saveKlaviyoMerchantList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ listId: z.string().trim().min(2).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("platform_settings").upsert(
      {
        key: "klaviyo_merchant_list",
        value: { list_id: data.listId } as never,
        label: "Klaviyo satıcı listesi",
        is_public: false,
        updated_by: context.userId,
      },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Tüm mağaza sahiplerini platform Klaviyo listesine abone eder. */
export const syncMerchantsToKlaviyo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const key = process.env["KLAVIYO_PRIVATE_API_KEY"];
    if (!key) throw new Error("Platform Klaviyo anahtarı eklenmemiş");
    const { data: setting } = await context.supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "klaviyo_merchant_list")
      .maybeSingle();
    const listId = (setting?.value as any)?.list_id as string | undefined;
    if (!listId) throw new Error("Önce satıcı listesini seçin");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: stores } = await supabaseAdmin.from("stores").select("owner_id, name").limit(10000);
    const owners = new Map<string, string>();
    for (const s of stores ?? []) if (s.owner_id) owners.set(s.owner_id, s.name);
    const profiles: { email: string; properties: Record<string, unknown> }[] = [];
    let page = 1;
    while (page < 50) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      const users = list?.users ?? [];
      for (const u of users) {
        if (u.email && owners.has(u.id)) profiles.push({ email: u.email, properties: { mef_store: owners.get(u.id) } });
      }
      if (users.length < 1000) break;
      page += 1;
    }
    if (!profiles.length) throw new Error("Aktarılacak satıcı bulunamadı");
    const { subscribeProfiles } = await import("@/lib/klaviyo.server");
    await subscribeProfiles(key, listId, profiles);
    return { count: profiles.length };
  });
