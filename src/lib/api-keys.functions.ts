import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createApiKey,
  createKeySchema,
  deleteApiKey,
  keyIdSchema,
  listApiKeys,
  listApiLogs,
  revokeApiKey,
  storeIdSchema,
} from "@/lib/api-keys.server";

/** API anahtarı server function'ları. */

export const getStoreApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => listApiKeys(context.supabase, data.storeId));

export const getStoreApiLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => listApiLogs(context.supabase, data.storeId));

export const createStoreApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => createKeySchema.parse(data))
  .handler(async ({ data, context }) => createApiKey(context.supabase, context.userId, data));

export const revokeStoreApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => keyIdSchema.parse(data))
  .handler(async ({ data, context }) => revokeApiKey(context.supabase, context.userId, data));

export const deleteStoreApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => keyIdSchema.parse(data))
  .handler(async ({ data, context }) => deleteApiKey(context.supabase, data));
