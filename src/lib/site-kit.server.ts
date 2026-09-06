import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  SITE_KIT_PROVIDER_IDS,
  siteKitProvider,
  validateSiteKitValues,
  type SiteKitConfigRow,
  type SiteKitStatus,
} from "@/lib/site-kit";

/**
 * Site Kit sunucu katmanı. Gizli alanlar (CAPI erişim token vb.) yalnızca burada
 * okunur/yazılır; istemciye asla dönmez. Tenant izolasyonu RLS ile zorlanır.
 */

type Client = SupabaseClient<Database>;

export const storeIdSchema = z.object({ storeId: z.guid() });

export const saveSiteKitSchema = z.object({
  storeId: z.guid(),
  provider: z.enum(SITE_KIT_PROVIDER_IDS as [string, ...string[]]),
  isEnabled: z.boolean(),
  values: z.record(z.string(), z.string().trim().max(4000)),
});

export const toggleSiteKitSchema = z.object({
  storeId: z.guid(),
  provider: z.enum(SITE_KIT_PROVIDER_IDS as [string, ...string[]]),
  isEnabled: z.boolean(),
});

export const testSiteKitSchema = z.object({
  storeId: z.guid(),
  provider: z.enum(SITE_KIT_PROVIDER_IDS as [string, ...string[]]),
});

function toRow(row: Database["public"]["Tables"]["store_site_kit"]["Row"]): SiteKitConfigRow {
  const provider = siteKitProvider(row.provider);
  const publicConfig = (row.public_config ?? {}) as Record<string, string>;
  const secretConfig = (row.secret_config ?? {}) as Record<string, string>;
  const secretsFilled: Record<string, boolean> = {};
  for (const field of provider?.fields ?? []) {
    if (field.secret) secretsFilled[field.key] = Boolean(secretConfig[field.key]);
  }
  return {
    provider: row.provider,
    isEnabled: row.is_enabled,
    status: (row.status as SiteKitStatus) ?? "unconfigured",
    publicConfig,
    secretsFilled,
    lastTestedAt: row.last_tested_at,
    lastTestResult: row.last_test_result,
  };
}

export async function listSiteKit(supabase: Client, data: z.infer<typeof storeIdSchema>) {
  const { data: rows, error } = await supabase
    .from("store_site_kit")
    .select("*")
    .eq("store_id", data.storeId);
  if (error) throw new Error(error.message);
  return (rows ?? []).map(toRow);
}

async function loadRow(supabase: Client, storeId: string, provider: string) {
  const { data, error } = await supabase
    .from("store_site_kit")
    .select("*")
    .eq("store_id", storeId)
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function saveSiteKit(supabase: Client, data: z.infer<typeof saveSiteKitSchema>) {
  const provider = siteKitProvider(data.provider);
  if (!provider) throw new Error("Bilinmeyen servis");
  if (provider.availability === "soon") throw new Error("Bu servis yakında kullanıma açılacak");

  const existing = await loadRow(supabase, data.storeId, data.provider);
  const existingSecrets = (existing?.secret_config ?? {}) as Record<string, string>;
  const secretsFilled: Record<string, boolean> = {};
  for (const field of provider.fields) {
    if (field.secret) secretsFilled[field.key] = Boolean(existingSecrets[field.key]);
  }

  const invalid = validateSiteKitValues(data.provider, data.values, { secretsAlreadyFilled: secretsFilled });
  if (invalid) throw new Error(invalid);

  const publicConfig: Record<string, string> = {};
  const secretConfig: Record<string, string> = { ...existingSecrets };
  for (const field of provider.fields) {
    const value = (data.values[field.key] ?? "").trim();
    if (field.secret) {
      // Boş gönderilen gizli alan mevcut değeri korur (maskeli form davranışı).
      if (value) secretConfig[field.key] = value;
      continue;
    }
    if (value) publicConfig[field.key] = value;
  }

  const status: SiteKitStatus = data.isEnabled ? "connected" : "paused";

  const { error } = await supabase.from("store_site_kit").upsert(
    {
      store_id: data.storeId,
      provider: data.provider,
      is_enabled: data.isEnabled,
      status,
      public_config: publicConfig,
      secret_config: secretConfig,
    },
    { onConflict: "store_id,provider" },
  );
  if (error) throw new Error(error.message);
  return { ok: true, status };
}

export async function toggleSiteKit(supabase: Client, data: z.infer<typeof toggleSiteKitSchema>) {
  const existing = await loadRow(supabase, data.storeId, data.provider);
  if (!existing) throw new Error("Önce servisi yapılandırın");
  const { error } = await supabase
    .from("store_site_kit")
    .update({ is_enabled: data.isEnabled, status: data.isEnabled ? "connected" : "paused" })
    .eq("id", existing.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteSiteKit(supabase: Client, data: z.infer<typeof toggleSiteKitSchema>) {
  const { error } = await supabase
    .from("store_site_kit")
    .delete()
    .eq("store_id", data.storeId)
    .eq("provider", data.provider);
  if (error) throw new Error(error.message);
  return { ok: true };
}

async function reachable(url: string) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return { ok: false, detail: `HTTP ${response.status}` };
    const body = await response.text();
    if (!body.trim()) return { ok: false, detail: "Boş yanıt" };
    return { ok: true, detail: `Script erişilebilir (${body.length} bayt)` };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "Ağ hatası" };
  }
}

/** Gerçek doğrulama: script erişimi ya da sağlayıcı API çağrısı. */
export async function testSiteKit(supabase: Client, data: z.infer<typeof testSiteKitSchema>) {
  const provider = siteKitProvider(data.provider);
  if (!provider) throw new Error("Bilinmeyen servis");
  const existing = await loadRow(supabase, data.storeId, data.provider);
  if (!existing) throw new Error("Önce servisi yapılandırın");

  const publicConfig = (existing.public_config ?? {}) as Record<string, string>;
  const secretConfig = (existing.secret_config ?? {}) as Record<string, string>;

  let result: { ok: boolean; detail: string };
  switch (data.provider) {
    case "google_analytics_4":
      result = await reachable(
        `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(publicConfig["measurementId"] ?? "")}`,
      );
      break;
    case "google_tag_manager":
      result = await reachable(
        `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(publicConfig["containerId"] ?? "")}`,
      );
      break;
    case "facebook_capi": {
      const pixelId = publicConfig["pixelId"] ?? "";
      const token = secretConfig["accessToken"] ?? "";
      if (!pixelId || !token) {
        result = { ok: false, detail: "Pixel ID veya erişim token eksik" };
        break;
      }
      try {
        const response = await fetch(
          `https://graph.facebook.com/v19.0/${encodeURIComponent(pixelId)}?fields=id,name&access_token=${encodeURIComponent(token)}`,
          { signal: AbortSignal.timeout(8000) },
        );
        const payload = (await response.json()) as { name?: string; error?: { message?: string } };
        result = response.ok
          ? { ok: true, detail: `Meta bağlantısı doğrulandı${payload.name ? ` (${payload.name})` : ""}` }
          : { ok: false, detail: payload.error?.message ?? `HTTP ${response.status}` };
      } catch (error) {
        result = { ok: false, detail: error instanceof Error ? error.message : "Ağ hatası" };
      }
      break;
    }
    default: {
      const invalid = validateSiteKitValues(data.provider, publicConfig, {
        secretsAlreadyFilled: Object.fromEntries(
          provider.fields.filter((f) => f.secret).map((f) => [f.key, Boolean(secretConfig[f.key])]),
        ),
      });
      result = invalid
        ? { ok: false, detail: invalid }
        : { ok: true, detail: "Kimlik biçimi doğrulandı, etiket vitrine yerleştirilmeye hazır" };
    }
  }

  const { error } = await supabase
    .from("store_site_kit")
    .update({
      last_tested_at: new Date().toISOString(),
      last_test_result: `${result.ok ? "ok" : "error"}: ${result.detail}`.slice(0, 400),
      status: result.ok ? (existing.is_enabled ? "connected" : "pending") : "error",
    })
    .eq("id", existing.id);
  if (error) throw new Error(error.message);

  return result;
}

/**
 * Meta Conversions API sunucu taraflı olay gönderimi. Tarayıcı pixel olayıyla
 * aynı eventId kullanılır; Meta tekrarları otomatik tekilleştirir.
 */
export async function dispatchServerConversion(
  admin: Client,
  input: {
    storeId: string;
    eventName: string;
    eventId: string;
    eventSourceUrl?: string | undefined;
    value?: number | undefined;
    currency?: string | undefined;
  },
) {
  const { data: row } = await admin
    .from("store_site_kit")
    .select("is_enabled, public_config, secret_config")
    .eq("store_id", input.storeId)
    .eq("provider", "facebook_capi")
    .maybeSingle();
  if (!row?.is_enabled) return { sent: false };

  const publicConfig = (row.public_config ?? {}) as Record<string, string>;
  const secretConfig = (row.secret_config ?? {}) as Record<string, string>;
  const pixelId = publicConfig["pixelId"];
  const token = secretConfig["accessToken"];
  if (!pixelId || !token) return { sent: false };

  try {
    const response = await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(pixelId)}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        access_token: token,
        ...(secretConfig["testEventCode"] ? { test_event_code: secretConfig["testEventCode"] } : {}),
        data: [
          {
            event_name: input.eventName,
            event_time: Math.floor(Date.now() / 1000),
            event_id: input.eventId,
            action_source: "website",
            ...(input.eventSourceUrl ? { event_source_url: input.eventSourceUrl } : {}),
            user_data: {},
            custom_data: {
              ...(input.value !== undefined ? { value: input.value } : {}),
              ...(input.currency ? { currency: input.currency } : {}),
            },
          },
        ],
      }),
    });
    return { sent: response.ok };
  } catch {
    return { sent: false };
  }
}
