import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createSystemNotification,
  listChannelDeliveries,
  listSettings,
  saveSetting,
  saveSettingSchema,
  storeIdSchema,
  systemNotificationSchema,
} from "@/lib/notifications.server";

export const getNotificationSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => listSettings(context.supabase, data.storeId));

export const saveNotificationSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => saveSettingSchema.parse(data))
  .handler(async ({ data, context }) => saveSetting(context.supabase, data));

export const getNotificationDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => listChannelDeliveries(context.supabase, data.storeId));

export const sendSystemNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => systemNotificationSchema.parse(data))
  .handler(async ({ data, context }) => createSystemNotification(context.supabase, data));
