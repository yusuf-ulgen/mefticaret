import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { API_SCOPES, API_VERSIONS } from "@/lib/api-keys";

/** API anahtarı sunucu mantığı: üretim, doğrulama, iptal ve istek kaydı. */

type Client = SupabaseClient<Database>;

export const storeIdSchema = z.object({ storeId: z.string().uuid() });

export const createKeySchema = z.object({
  storeId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  apiVersion: z.enum(API_VERSIONS).default("v1"),
  scopes: z.array(z.enum(API_SCOPES)).min(1),
  expiresInDays: z.number().int().min(1).max(3650).optional(),
});

export const keyIdSchema = z.object({ storeId: z.string().uuid(), id: z.string().uuid() });

export function hashApiKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export async function listApiKeys(supabase: Client, storeId: string) {
  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listApiLogs(supabase: Client, storeId: string) {
  const { data, error } = await supabase
    .from("api_request_logs")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createApiKey(
  supabase: Client,
  userId: string,
  input: z.infer<typeof createKeySchema>,
) {
  const secret = randomBytes(24).toString("base64url");
  const prefix = `mk_${input.apiVersion}_${randomBytes(4).toString("hex")}`;
  const rawKey = `${prefix}.${secret}`;

  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString()
    : null;

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      store_id: input.storeId,
      name: input.name,
      api_version: input.apiVersion,
      key_prefix: prefix,
      key_hash: hashApiKey(rawKey),
      scopes: input.scopes as string[],
      expires_at: expiresAt,
      created_by: userId,
    })
    .select("id, key_prefix")
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("audit_logs").insert({
    store_id: input.storeId,
    actor_id: userId,
    action: "api_key.created",
    entity: "api_keys",
    entity_id: data.id,
    new_value: { name: input.name, scopes: input.scopes, version: input.apiVersion },
  });

  // Anahtar yalnızca bu yanıtta açık gösterilir; veritabanında sadece SHA-256 özeti saklanır.
  return { id: data.id, apiKey: rawKey, prefix: data.key_prefix };
}

export async function revokeApiKey(
  supabase: Client,
  userId: string,
  input: z.infer<typeof keyIdSchema>,
) {
  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("store_id", input.storeId);
  if (error) throw new Error(error.message);

  await supabase.from("audit_logs").insert({
    store_id: input.storeId,
    actor_id: userId,
    action: "api_key.revoked",
    entity: "api_keys",
    entity_id: input.id,
  });

  return { ok: true as const };
}

export async function deleteApiKey(supabase: Client, input: z.infer<typeof keyIdSchema>) {
  const { error } = await supabase
    .from("api_keys")
    .delete()
    .eq("id", input.id)
    .eq("store_id", input.storeId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export type AuthedApiKey = {
  id: string;
  storeId: string;
  scopes: string[];
  apiVersion: string;
};

/** Bearer/x-api-key başlığındaki anahtarı doğrular; iptal ve süre kontrolü yapar. */
export async function authenticateApiKey(rawKey: string): Promise<AuthedApiKey | null> {
  if (!rawKey || rawKey.length < 16) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, store_id, scopes, api_version, revoked_at, expires_at, request_count")
    .eq("key_hash", hashApiKey(rawKey))
    .maybeSingle();
  if (error || !data) return null;
  if (data.revoked_at) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;

  await supabaseAdmin
    .from("api_keys")
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

export async function logApiRequest(input: {
  storeId: string;
  apiKeyId: string | null;
  apiVersion: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ipAddress?: string | null;
  errorMessage?: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("api_request_logs").insert({
    store_id: input.storeId,
    api_key_id: input.apiKeyId,
    api_version: input.apiVersion,
    method: input.method,
    path: input.path,
    status_code: input.statusCode,
    duration_ms: input.durationMs,
    ip_address: input.ipAddress ?? null,
    error_message: input.errorMessage ?? null,
  });
}
