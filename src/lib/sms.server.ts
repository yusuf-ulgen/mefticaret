import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/**
 * Verimor SMS API entegrasyonu.
 * Kimlik bilgileri mağazanın kurulu "verimor-sms" uygulamasından okunur;
 * uygulama kurulu değilse mesaj kuyrukta bekletilir.
 */

type Client = SupabaseClient<Database>;

const BASE = "https://sms.verimor.com.tr/v2";
export const VERIMOR_APP_CODE = "verimor-sms";

export type VerimorCredentials = {
  username: string;
  password: string;
  sourceAddr: string;
  validForMinutes: number | null;
};

export type SmsSendResult = {
  status: Database["public"]["Enums"]["message_delivery_status"];
  campaignId: string | null;
  error: string | null;
};

const str = (settings: Record<string, unknown>, key: string) =>
  String(settings[key] ?? "").trim();

/** Mağazanın kurulu Verimor uygulamasından kimlik bilgilerini okur. */
export async function getVerimorCredentials(
  supabase: Client,
  storeId: string,
): Promise<VerimorCredentials | null> {
  const { data, error } = await supabase
    .from("app_installations")
    .select("settings, status, apps!inner(code)")
    .eq("store_id", storeId)
    .eq("apps.code", VERIMOR_APP_CODE)
    .maybeSingle();
  if (error || !data || data.status !== "installed") return null;

  const settings = (data.settings ?? {}) as Record<string, unknown>;
  const username = str(settings, "username");
  const password = str(settings, "password");
  const sourceAddr = str(settings, "source_addr");
  if (!username || !password || !sourceAddr) return null;

  const validFor = Number(settings["valid_for_minutes"] ?? 0);
  return {
    username,
    password,
    sourceAddr,
    validForMinutes: Number.isFinite(validFor) && validFor > 0 ? Math.floor(validFor) : null,
  };
}

/** Telefon numarasını Verimor'un beklediği biçime (905xxxxxxxxx) çevirir. */
export function normalizeMsisdn(raw: string): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("90") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `9${digits}`;
  if (digits.length === 10) return `90${digits}`;
  if (digits.length > 12) return digits;
  return digits.length >= 11 ? digits : null;
}

async function call(path: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${BASE}${path}`, { ...init, signal: controller.signal });
    const body = (await response.text()).trim();
    return { ok: response.ok, status: response.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

/** Kredi bakiyesini sorgular (bağlantı testi için de kullanılır). */
export async function getVerimorBalance(credentials: {
  username: string;
  password: string;
}): Promise<{ ok: boolean; balance: number | null; message: string }> {
  try {
    const result = await call(
      `/balance?username=${encodeURIComponent(credentials.username)}&password=${encodeURIComponent(
        credentials.password,
      )}`,
      { headers: { Accept: "application/json" } },
    );
    if (!result.ok) {
      return {
        ok: false,
        balance: null,
        message: `Verimor ${result.status} döndü: ${result.body || "ayrıntı yok"}`,
      };
    }
    const parsed = Number(JSON.parse(result.body || "{}")?.balance ?? NaN);
    const balance = Number.isFinite(parsed) ? parsed : null;
    return {
      ok: true,
      balance,
      message:
        balance === null
          ? "Verimor hesabı doğrulandı"
          : `Verimor hesabı doğrulandı. Kredi: ${balance}`,
    };
  } catch (cause) {
    return {
      ok: false,
      balance: null,
      message: `Verimor'a ulaşılamadı: ${(cause as Error).message}`,
    };
  }
}

/** Tek bir SMS gönderir. */
export async function sendSms(
  supabase: Client,
  input: { storeId: string; to: string; body: string },
): Promise<SmsSendResult> {
  const credentials = await getVerimorCredentials(supabase, input.storeId);
  if (!credentials) {
    return {
      status: "queued",
      campaignId: null,
      error: "Verimor SMS uygulaması kurulu değil; mesaj kuyrukta bekliyor",
    };
  }

  const dest = normalizeMsisdn(input.to);
  if (!dest) {
    return { status: "failed", campaignId: null, error: "Geçersiz telefon numarası" };
  }

  const message = input.body.trim();
  if (!message) {
    return { status: "failed", campaignId: null, error: "Mesaj içeriği boş" };
  }

  try {
    const payload: Record<string, unknown> = {
      username: credentials.username,
      password: credentials.password,
      source_addr: credentials.sourceAddr,
      messages: [{ msg: message, dest }],
    };
    if (credentials.validForMinutes) payload["valid_for"] = `${credentials.validForMinutes}m`;

    const result = await call("/send.json", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });

    if (!result.ok) {
      return {
        status: "failed",
        campaignId: null,
        error: `Verimor ${result.status}: ${result.body || "ayrıntı yok"}`,
      };
    }
    return { status: "sent", campaignId: result.body || null, error: null };
  } catch (cause) {
    return { status: "failed", campaignId: null, error: (cause as Error).message };
  }
}

/** Aynı metni birden çok alıcıya tek istekte gönderir (Verimor çoklu mesaj). */
export async function sendSmsBulk(
  supabase: Client,
  input: { storeId: string; to: string[]; body: string },
): Promise<{ status: SmsSendResult["status"]; campaignId: string | null; error: string | null }> {
  const credentials = await getVerimorCredentials(supabase, input.storeId);
  if (!credentials) return { status: "failed", campaignId: null, error: "Verimor SMS uygulaması kurulu değil" };
  const message = input.body.trim();
  if (!message || input.to.length === 0) return { status: "failed", campaignId: null, error: "Alıcı veya mesaj yok" };
  try {
    const payload: Record<string, unknown> = {
      username: credentials.username,
      password: credentials.password,
      source_addr: credentials.sourceAddr,
      messages: [{ msg: message, dest: input.to.join(",") }],
    };
    if (credentials.validForMinutes) payload["valid_for"] = `${credentials.validForMinutes}m`;
    const result = await call("/send.json", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    if (!result.ok) return { status: "failed", campaignId: null, error: `Verimor ${result.status}: ${result.body || "ayrıntı yok"}` };
    return { status: "sent", campaignId: result.body || null, error: null };
  } catch (cause) {
    return { status: "failed", campaignId: null, error: (cause as Error).message };
  }
}
