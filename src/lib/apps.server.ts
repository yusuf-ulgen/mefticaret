import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { insertAuditRow } from "./audit.server";
import { runConnectionCheck } from "./app-connectors.server";

/** Uygulama mağazası sunucu mantığı: katalog, kurulum ve uygulama ayarları. */

type Client = SupabaseClient<Database>;

export const storeIdSchema = z.object({ storeId: z.guid() });

const settingsValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const installAppSchema = z.object({
  storeId: z.guid(),
  appId: z.guid(),
  settings: z.record(z.string(), settingsValueSchema).optional(),
});

export const connectionTestSchema = z.object({
  storeId: z.guid(),
  appId: z.guid(),
});

export const installStatusSchema = z.object({
  storeId: z.guid(),
  appId: z.guid(),
  status: z.enum(["installed", "paused", "uninstalled"]),
});

export const appSettingsSchema = z.object({
  storeId: z.guid(),
  appId: z.guid(),
  settings: z.record(z.string(), settingsValueSchema),
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
    .select("id, code, name, permissions, is_active")
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
      settings: (input.settings ?? {}) as never,
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

  const check = await runConnectionCheck(app.code, input.settings ?? {});
  await persistConnection(supabase, input.storeId, app.id, input.settings ?? {}, check);
  await syncGateway(supabase, input.storeId, app.code, check.status !== "error");

  return { ok: true as const, appName: app.name, connection: check };
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

  const { data: appRow } = await supabase.from("apps").select("code").eq("id", input.appId).maybeSingle();
  if (appRow) await syncGateway(supabase, input.storeId, appRow.code, input.status === "installed");

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

async function persistConnection(
  supabase: Client,
  storeId: string,
  appId: string,
  settings: Record<string, unknown>,
  check: { status: string; message: string },
) {
  const next = {
    ...settings,
    _connection_status: check.status,
    _connection_message: check.message,
    _connection_checked_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("app_installations")
    .update({ settings: next as never })
    .eq("store_id", storeId)
    .eq("app_id", appId);
  if (error) throw new Error(error.message);
}

/** Kurulu bir uygulamanın sağlayıcı bağlantısını sunucu tarafında test eder. */
export async function testAppConnection(
  supabase: Client,
  input: z.infer<typeof connectionTestSchema>,
) {
  const { data, error } = await supabase
    .from("app_installations")
    .select("settings, apps(code)")
    .eq("store_id", input.storeId)
    .eq("app_id", input.appId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Uygulama bu mağazada kurulu değil");

  const settings = (data.settings ?? {}) as Record<string, unknown>;
  const code = (data.apps as { code?: string } | null)?.code ?? "";
  const check = await runConnectionCheck(code, settings);
  await persistConnection(supabase, input.storeId, input.appId, settings, check);
  await syncGateway(supabase, input.storeId, code, check.status !== "error");
  return check;
}

/** iyzico / PayTR kurulumunu vitrin ödeme seçeneklerine yansıtır. */
async function syncGateway(supabase: Client, storeId: string, appCode: string, active: boolean) {
  const { isGatewayApp, syncGatewayPaymentMethod } = await import("./store-gateways.server");
  if (!isGatewayApp(appCode)) return;
  await syncGatewayPaymentMethod(supabase, storeId, appCode, active);
}
