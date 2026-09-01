import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  OAUTH_ACCESS_TOKEN_TTL_SECONDS,
  OAUTH_CODE_TTL_SECONDS,
  OAUTH_GRANT_TYPES,
  OAUTH_REFRESH_TOKEN_TTL_SECONDS,
  OAUTH_SCOPES,
} from "@/lib/oauth";
import { API_VERSIONS } from "@/lib/api-keys";
import { insertAuditRow } from "./audit.server";

/** OAuth 2.0 sunucu mantığı: istemci yönetimi, kod/token üretimi ve doğrulama. */

type Client = SupabaseClient<Database>;

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export const storeScopeSchema = z.object({ storeId: z.string().uuid() });

export const createClientSchema = z.object({
  storeId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  redirectUris: z.array(z.string().trim().url().max(400)).max(10).default([]),
  scopes: z.array(z.enum(OAUTH_SCOPES)).min(1),
  grantTypes: z.array(z.enum(OAUTH_GRANT_TYPES)).min(1),
  apiVersion: z.enum(API_VERSIONS).default("v1"),
});

export const clientIdSchema = z.object({
  storeId: z.string().uuid(),
  id: z.string().uuid(),
});

export const tokenIdSchema = z.object({
  storeId: z.string().uuid(),
  id: z.string().uuid(),
});

export const authorizeSchema = z.object({
  clientId: z.string().trim().min(8).max(120),
  redirectUri: z.string().trim().url().max(400),
  scopes: z.array(z.enum(OAUTH_SCOPES)).min(1),
  state: z.string().trim().max(300).optional(),
  codeChallenge: z.string().trim().max(200).optional(),
  codeChallengeMethod: z.enum(["S256", "plain"]).optional(),
});

export async function listOAuthClients(supabase: Client, storeId: string) {
  const { data, error } = await supabase
    .from("oauth_clients")
    .select(
      "id, name, description, client_id, secret_prefix, redirect_uris, allowed_scopes, grant_types, is_active, created_at",
    )
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listOAuthTokens(supabase: Client, storeId: string) {
  const { data, error } = await supabase
    .from("oauth_access_tokens")
    .select(
      "id, client_id, scopes, grant_type, api_version, expires_at, refresh_expires_at, revoked_at, last_used_at, request_count, created_at",
    )
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createOAuthClient(
  supabase: Client,
  userId: string,
  input: z.infer<typeof createClientSchema>,
) {
  const clientId = `mfc_${randomBytes(12).toString("hex")}`;
  const secret = randomBytes(32).toString("base64url");
  const prefix = secret.slice(0, 8);

  const { data, error } = await supabase
    .from("oauth_clients")
    .insert({
      store_id: input.storeId,
      name: input.name,
      description: input.description ?? null,
      client_id: clientId,
      client_secret_hash: sha256(secret),
      secret_prefix: prefix,
      redirect_uris: input.redirectUris,
      allowed_scopes: input.scopes as string[],
      grant_types: input.grantTypes as string[],
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await insertAuditRow(supabase, {
    store_id: input.storeId,
    actor_id: userId,
    action: "oauth_client.created",
    entity: "oauth_clients",
    entity_id: data.id,
    new_value: { name: input.name, scopes: input.scopes, grant_types: input.grantTypes },
  });

  // Gizli anahtar yalnızca bu yanıtta gösterilir; veritabanında SHA-256 özeti saklanır.
  return { id: data.id, clientId, clientSecret: secret };
}

export async function setOAuthClientActive(
  supabase: Client,
  input: z.infer<typeof clientIdSchema> & { isActive: boolean },
) {
  const { error } = await supabase
    .from("oauth_clients")
    .update({ is_active: input.isActive })
    .eq("id", input.id)
    .eq("store_id", input.storeId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function deleteOAuthClient(
  supabase: Client,
  input: z.infer<typeof clientIdSchema>,
) {
  const { error } = await supabase
    .from("oauth_clients")
    .delete()
    .eq("id", input.id)
    .eq("store_id", input.storeId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function revokeOAuthToken(
  supabase: Client,
  input: z.infer<typeof tokenIdSchema>,
) {
  const { error } = await supabase
    .from("oauth_access_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("store_id", input.storeId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

/** Onay ekranı için istemci bilgisi (gizli veri döndürmez). */
export async function describeOAuthClient(supabase: Client, clientId: string) {
  const { data, error } = await supabase
    .from("oauth_clients")
    .select("id, name, description, client_id, redirect_uris, allowed_scopes, grant_types, is_active, store_id")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Kullanıcı onayı sonrası tek kullanımlık yetkilendirme kodu üretir. */
export async function issueAuthorizationCode(
  supabase: Client,
  userId: string,
  input: z.infer<typeof authorizeSchema>,
) {
  const client = await describeOAuthClient(supabase, input.clientId);
  if (!client || !client.is_active) throw new Error("Geçersiz OAuth istemcisi");
  if (!(client.grant_types ?? []).includes("authorization_code")) {
    throw new Error("Bu istemci yetkilendirme kodu akışını desteklemiyor");
  }
  if (!(client.redirect_uris ?? []).includes(input.redirectUri)) {
    throw new Error("Yönlendirme adresi kayıtlı değil");
  }
  const invalid = input.scopes.filter((scope) => !(client.allowed_scopes ?? []).includes(scope));
  if (invalid.length > 0) throw new Error(`İzin verilmeyen scope: ${invalid.join(", ")}`);

  const code = randomBytes(32).toString("base64url");
  const { error } = await supabase.from("oauth_authorization_codes").insert({
    client_id: client.id,
    store_id: client.store_id,
    user_id: userId,
    code_hash: sha256(code),
    redirect_uri: input.redirectUri,
    scopes: input.scopes as string[],
    code_challenge: input.codeChallenge ?? null,
    code_challenge_method: input.codeChallengeMethod ?? null,
    expires_at: new Date(Date.now() + OAUTH_CODE_TTL_SECONDS * 1000).toISOString(),
  });
  if (error) throw new Error(error.message);

  const url = new URL(input.redirectUri);
  url.searchParams.set("code", code);
  if (input.state) url.searchParams.set("state", input.state);
  return { code, redirectTo: url.toString() };
}

type TokenBundle = {
  access_token: string;
  refresh_token?: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
};

async function persistTokens(input: {
  clientRowId: string;
  storeId: string | null;
  userId: string | null;
  scopes: string[];
  grantType: string;
  apiVersion: string;
  withRefresh: boolean;
}): Promise<TokenBundle> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const accessToken = `mat_${randomBytes(32).toString("base64url")}`;
  const refreshToken = input.withRefresh ? `mrt_${randomBytes(32).toString("base64url")}` : null;

  const { error } = await supabaseAdmin.from("oauth_access_tokens").insert({
    client_id: input.clientRowId,
    store_id: input.storeId,
    user_id: input.userId,
    token_hash: sha256(accessToken),
    refresh_token_hash: refreshToken ? sha256(refreshToken) : null,
    scopes: input.scopes,
    grant_type: input.grantType,
    api_version: input.apiVersion,
    expires_at: new Date(Date.now() + OAUTH_ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString(),
    refresh_expires_at: refreshToken
      ? new Date(Date.now() + OAUTH_REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString()
      : null,
  });
  if (error) throw new Error(error.message);

  return {
    access_token: accessToken,
    ...(refreshToken ? { refresh_token: refreshToken } : {}),
    token_type: "Bearer",
    expires_in: OAUTH_ACCESS_TOKEN_TTL_SECONDS,
    scope: input.scopes.join(" "),
  };
}

export type TokenRequest = {
  grantType: string;
  clientId: string;
  clientSecret: string;
  code?: string;
  redirectUri?: string;
  codeVerifier?: string;
  refreshToken?: string;
  scope?: string;
};

export type TokenError = { error: string; error_description: string; status: number };

/** Token endpoint mantığı; her akış için istemci kimlik doğrulaması zorunludur. */
export async function exchangeToken(
  request: TokenRequest,
): Promise<TokenBundle | TokenError> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: client } = await supabaseAdmin
    .from("oauth_clients")
    .select(
      "id, store_id, client_secret_hash, allowed_scopes, grant_types, is_active, redirect_uris",
    )
    .eq("client_id", request.clientId)
    .maybeSingle();

  if (!client || !client.is_active) {
    return { error: "invalid_client", error_description: "İstemci bulunamadı", status: 401 };
  }
  if (!safeEqual(sha256(request.clientSecret), client.client_secret_hash)) {
    return { error: "invalid_client", error_description: "İstemci doğrulaması başarısız", status: 401 };
  }
  if (!(client.grant_types ?? []).includes(request.grantType)) {
    return {
      error: "unauthorized_client",
      error_description: "Bu grant tipi istemci için etkin değil",
      status: 400,
    };
  }

  if (request.grantType === "client_credentials") {
    const requested = request.scope
      ? request.scope.split(/\s+/).filter(Boolean)
      : (client.allowed_scopes ?? []);
    const invalid = requested.filter((scope) => !(client.allowed_scopes ?? []).includes(scope));
    if (invalid.length > 0) {
      return { error: "invalid_scope", error_description: invalid.join(", "), status: 400 };
    }
    return persistTokens({
      clientRowId: client.id,
      storeId: client.store_id,
      userId: null,
      scopes: requested,
      grantType: "client_credentials",
      apiVersion: "v1",
      withRefresh: false,
    });
  }

  if (request.grantType === "authorization_code") {
    if (!request.code || !request.redirectUri) {
      return { error: "invalid_request", error_description: "code ve redirect_uri zorunlu", status: 400 };
    }
    const { data: codeRow } = await supabaseAdmin
      .from("oauth_authorization_codes")
      .select("id, client_id, store_id, user_id, scopes, redirect_uri, code_challenge, code_challenge_method, expires_at, consumed_at")
      .eq("code_hash", sha256(request.code))
      .maybeSingle();

    if (!codeRow || codeRow.client_id !== client.id) {
      return { error: "invalid_grant", error_description: "Kod geçersiz", status: 400 };
    }
    if (codeRow.consumed_at) {
      return { error: "invalid_grant", error_description: "Kod daha önce kullanıldı", status: 400 };
    }
    if (new Date(codeRow.expires_at).getTime() < Date.now()) {
      return { error: "invalid_grant", error_description: "Kodun süresi doldu", status: 400 };
    }
    if (codeRow.redirect_uri !== request.redirectUri) {
      return { error: "invalid_grant", error_description: "redirect_uri eşleşmiyor", status: 400 };
    }
    if (codeRow.code_challenge) {
      const verifier = request.codeVerifier ?? "";
      const computed =
        codeRow.code_challenge_method === "plain"
          ? verifier
          : createHash("sha256").update(verifier).digest("base64url");
      if (!verifier || !safeEqual(computed, codeRow.code_challenge)) {
        return { error: "invalid_grant", error_description: "PKCE doğrulaması başarısız", status: 400 };
      }
    }

    await supabaseAdmin
      .from("oauth_authorization_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", codeRow.id);

    return persistTokens({
      clientRowId: client.id,
      storeId: codeRow.store_id,
      userId: codeRow.user_id,
      scopes: codeRow.scopes ?? [],
      grantType: "authorization_code",
      apiVersion: "v1",
      withRefresh: true,
    });
  }

  if (request.grantType === "refresh_token") {
    if (!request.refreshToken) {
      return { error: "invalid_request", error_description: "refresh_token zorunlu", status: 400 };
    }
    const { data: tokenRow } = await supabaseAdmin
      .from("oauth_access_tokens")
      .select("id, client_id, store_id, user_id, scopes, api_version, refresh_expires_at, revoked_at")
      .eq("refresh_token_hash", sha256(request.refreshToken))
      .maybeSingle();

    if (!tokenRow || tokenRow.client_id !== client.id || tokenRow.revoked_at) {
      return { error: "invalid_grant", error_description: "Yenileme belirteci geçersiz", status: 400 };
    }
    if (tokenRow.refresh_expires_at && new Date(tokenRow.refresh_expires_at).getTime() < Date.now()) {
      return { error: "invalid_grant", error_description: "Yenileme belirtecinin süresi doldu", status: 400 };
    }

    // Rotasyon: eski belirteç iptal edilir, yenisi verilir.
    await supabaseAdmin
      .from("oauth_access_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", tokenRow.id);

    return persistTokens({
      clientRowId: client.id,
      storeId: tokenRow.store_id,
      userId: tokenRow.user_id,
      scopes: tokenRow.scopes ?? [],
      grantType: "refresh_token",
      apiVersion: tokenRow.api_version,
      withRefresh: true,
    });
  }

  return {
    error: "unsupported_grant_type",
    error_description: `Desteklenmeyen grant tipi: ${request.grantType}`,
    status: 400,
  };
}

/** REST API için erişim belirteci doğrulaması. */
export async function authenticateAccessToken(rawToken: string) {
  if (!rawToken.startsWith("mat_")) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data } = await supabaseAdmin
    .from("oauth_access_tokens")
    .select("id, store_id, scopes, api_version, expires_at, revoked_at, request_count")
    .eq("token_hash", sha256(rawToken))
    .maybeSingle();

  if (!data || data.revoked_at || !data.store_id) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;

  await supabaseAdmin
    .from("oauth_access_tokens")
    .update({
      last_used_at: new Date().toISOString(),
      request_count: (data.request_count ?? 0) + 1,
    })
    .eq("id", data.id);

  return {
    id: data.id,
    storeId: data.store_id,
    scopes: data.scopes ?? [],
    apiVersion: data.api_version,
  };
}

/** Token iptali (RFC 7009 benzeri). */
export async function revokeRawToken(clientId: string, clientSecret: string, token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: client } = await supabaseAdmin
    .from("oauth_clients")
    .select("id, client_secret_hash")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!client || !safeEqual(sha256(clientSecret), client.client_secret_hash)) return false;

  const hash = sha256(token);
  await supabaseAdmin
    .from("oauth_access_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("client_id", client.id)
    .or(`token_hash.eq.${hash},refresh_token_hash.eq.${hash}`);
  return true;
}
