import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { insertAuditRow } from "./audit.server";

/** Uygulama mağazası sunucu mantığı: katalog, kurulum ve uygulama ayarları. */

type Client = SupabaseClient<Database>;

export const storeIdSchema = z.object({ storeId: z.string().uuid() });

export const installAppSchema = z.object({
  storeId: z.string().uuid(),
  appId: z.string().uuid(),
});

export const installStatusSchema = z.object({
  storeId: z.string().uuid(),
  appId: z.string().uuid(),
  status: z.enum(["installed", "paused", "uninstalled"]),
});

export const appSettingsSchema = z.object({
  storeId: z.string().uuid(),
  appId: z.string().uuid(),
  settings: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

export async function listApps(supabase: Client) {
  const { data, error } = await supabase
    .from("apps")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listInstallations(supabase: Client, storeId: string) {
  const { data, error } = await supabase
    .from("app_installations")
    .select("*, apps(code, name, category, version, developer, logo_emoji, permissions)")
    .eq("store_id", storeId)
    .order("installed_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function installApp(
  supabase: Client,
  userId: string,
  input: z.infer<typeof installAppSchema>,
) {
  const { data: app, error: appError } = await supabase
    .from("apps")
    .select("id, name, permissions, is_active")
    .eq("id", input.appId)
    .maybeSingle();
  if (appError) throw new Error(appError.message);
  if (!app || !app.is_active) throw new Error("Uygulama bulunamadı veya yayında değil");

  const { error } = await supabase.from("app_installations").upsert(
    {
      store_id: input.storeId,
      app_id: app.id,
      status: "installed",
      granted_permissions: app.permissions ?? [],
      installed_by: userId,
      installed_at: new Date().toISOString(),
      uninstalled_at: null,
    },
    { onConflict: "store_id,app_id" },
  );
  if (error) throw new Error(error.message);

  await insertAuditRow(supabase, {
    store_id: input.storeId,
    actor_id: userId,
    action: "app.installed",
    entity: "apps",
    entity_id: app.id,
    new_value: { name: app.name },
  });

  return { ok: true as const, appName: app.name };
}

export async function setInstallStatus(
  supabase: Client,
  userId: string,
  input: z.infer<typeof installStatusSchema>,
) {
  const { error } = await supabase
    .from("app_installations")
    .update({
      status: input.status,
      uninstalled_at: input.status === "uninstalled" ? new Date().toISOString() : null,
    })
    .eq("store_id", input.storeId)
    .eq("app_id", input.appId);
  if (error) throw new Error(error.message);

  await insertAuditRow(supabase, {
    store_id: input.storeId,
    actor_id: userId,
    action: `app.${input.status}`,
    entity: "apps",
    entity_id: input.appId,
    new_value: { status: input.status },
  });

  return { ok: true as const, status: input.status };
}

export async function saveAppSettings(
  supabase: Client,
  input: z.infer<typeof appSettingsSchema>,
) {
  const { error } = await supabase
    .from("app_installations")
    .update({ settings: input.settings as never })
    .eq("store_id", input.storeId)
    .eq("app_id", input.appId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}
