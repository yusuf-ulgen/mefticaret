import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  appSettingsSchema,
  connectionTestSchema,
  installApp,
  installAppSchema,
  installStatusSchema,
  listApps,
  listInstallations,
  saveAppSettings,
  setInstallStatus,
  testAppConnection,
  storeIdSchema,
} from "@/lib/apps.server";

/** Uygulama mağazası server function'ları. */

export const getAppCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listApps(context.supabase));

export const getStoreAppInstallations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => listInstallations(context.supabase, data.storeId));

export const installStoreApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => installAppSchema.parse(data))
  .handler(async ({ data, context }) => installApp(context.supabase, context.userId, data));

export const setStoreAppStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => installStatusSchema.parse(data))
  .handler(async ({ data, context }) => setInstallStatus(context.supabase, context.userId, data));

export const saveStoreAppSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => appSettingsSchema.parse(data))
  .handler(async ({ data, context }) => saveAppSettings(context.supabase, data));

export const testStoreAppConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => connectionTestSchema.parse(data))
  .handler(async ({ data, context }) => testAppConnection(context.supabase, data));
