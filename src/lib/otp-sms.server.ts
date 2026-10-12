/**
 * Ev hanımları portalı telefon doğrulama SMS'i.
 *
 * Kimlik bilgileri platform ayarlarındaki `home_maker_otp_sms` kaydından
 * okunur (Verimor). Ayar yoksa mesaj gönderilmiş gibi davranılmaz; çağıran
 * tarafa açık hata döner.
 */

type OtpSmsCredentials = {
  username: string;
  password: string;
  sourceAddr: string;
};

const BASE = "https://sms.verimor.com.tr/v2";

async function loadCredentials(): Promise<OtpSmsCredentials | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("platform_settings")
    .select("value")
    .eq("key", "home_maker_otp_sms")
    .maybeSingle();
  if (error || !data) return null;

  const raw = (data.value ?? {}) as Record<string, unknown>;
  const username = String(raw["username"] ?? "").trim();
  const password = String(raw["password"] ?? "").trim();
  const sourceAddr = String(raw["source_addr"] ?? "").trim();
  if (!username || !password || !sourceAddr) return null;
  return { username, password, sourceAddr };
}

/** Doğrulama kodunu SMS ile gönderir. */
export async function sendOtpSms(
  dest: string,
  code: string,
): Promise<{ ok: boolean; error: string | null }> {
  const credentials = await loadCredentials();
  if (!credentials) {
    return {
      ok: false,
      error:
        "SMS gönderimi henüz açılmadı. Lütfen e-posta ile giriş yapın veya kısa süre sonra tekrar deneyin.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${BASE}/send.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        username: credentials.username,
        password: credentials.password,
        source_addr: credentials.sourceAddr,
        valid_for: "5m",
        messages: [
          {
            msg: `Mefticaret giris kodunuz: ${code}. Kod 5 dakika gecerlidir.`,
            dest,
          },
        ],
      }),
    });
    if (!response.ok) {
      const body = (await response.text()).slice(0, 200);
      return { ok: false, error: `SMS gönderilemedi (${response.status}): ${body}` };
    }
    return { ok: true, error: null };
  } catch (cause) {
    return { ok: false, error: (cause as Error).message };
  } finally {
    clearTimeout(timeout);
  }
}
