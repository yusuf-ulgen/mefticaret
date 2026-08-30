import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  deleteWebhook,
  dispatchWebhook,
  idSchema,
  listDeliveries,
  listNotifications,
  listWebhooks,
  markNotificationsRead,
  markReadSchema,
  saveWebhook,
  saveWebhookSchema,
  storeIdSchema,
} from "@/lib/webhooks.server";

export const getStoreWebhooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => listWebhooks(context.supabase, data.storeId));

export const saveStoreWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => saveWebhookSchema.parse(data))
  .handler(async ({ data, context }) => saveWebhook(context.supabase, data));

export const deleteStoreWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => idSchema.parse(data))
  .handler(async ({ data, context }) => deleteWebhook(context.supabase, data.id));

export const testStoreWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => idSchema.parse(data))
  .handler(async ({ data, context }) =>
    dispatchWebhook(context.supabase, data.id, "webhook.test", { ping: true }),
  );

export const getStoreWebhookDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => listDeliveries(context.supabase, data.storeId));

export const getStoreNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => listNotifications(context.supabase, data.storeId));

export const markStoreNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => markReadSchema.parse(data))
  .handler(async ({ data, context }) => markNotificationsRead(context.supabase, data));

export const webhookEventSchema = z.enum([
  "order.created",
  "order.updated",
  "order.fulfilled",
  "order.cancelled",
  "product.created",
  "product.updated",
  "inventory.low_stock",
  "customer.created",
  "payout.paid",
]);
