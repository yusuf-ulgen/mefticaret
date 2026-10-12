import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  authorizeSchema,
  clientIdSchema,
  createClientSchema,
  createOAuthClient,
  deleteOAuthClient,
  describeOAuthClient,
  issueAuthorizationCode,
  listOAuthClients,
  listOAuthTokens,
  revokeOAuthToken,
  setOAuthClientActive,
  storeScopeSchema,
  tokenIdSchema,
} from "@/lib/oauth.server";

/** OAuth istemci yönetimi ve onay akışı server function'ları. */

export const getOAuthClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeScopeSchema.parse(data))
  .handler(async ({ data, context }) => listOAuthClients(context.supabase, data.storeId));

export const getOAuthTokens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeScopeSchema.parse(data))
  .handler(async ({ data, context }) => listOAuthTokens(context.supabase, data.storeId));

export const createOAuthApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => createClientSchema.parse(data))
  .handler(async ({ data, context }) =>
    createOAuthClient(context.supabase, context.userId, data),
  );

export const toggleOAuthApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => clientIdSchema.extend({ isActive: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => setOAuthClientActive(context.supabase, data));

export const deleteOAuthApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => clientIdSchema.parse(data))
  .handler(async ({ data, context }) => deleteOAuthClient(context.supabase, data));

export const revokeOAuthAccessToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => tokenIdSchema.parse(data))
  .handler(async ({ data, context }) => revokeOAuthToken(context.supabase, data));

export const describeOAuthApplication = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ clientId: z.string().trim().min(4) }).parse(data))
  .handler(async ({ data, context }) => describeOAuthClient(context.supabase, data.clientId));

export const approveOAuthAuthorization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => authorizeSchema.parse(data))
  .handler(async ({ data, context }) =>
    issueAuthorizationCode(context.supabase, context.userId, data),
  );
