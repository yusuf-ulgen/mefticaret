import { EmailAPIError, sendLovableEmail } from "@lovable.dev/email-js";

/**
 * Sunucuya özel pazarlama e-postası gönderimi ve takip bağlantıları.
 * Yalnızca sunucu tarafında import edilir (LOVABLE_API_KEY okur).
 */

const SENDER_DOMAIN = "destek.mefticaret.com";
const FROM_DOMAIN = "mefticaret.com";

export const PUBLIC_SITE_URL = "https://mefticaret.com";

export function trackingUrls(token: string) {
  return {
    pixel: `${PUBLIC_SITE_URL}/api/public/email/open/${token}.png`,
    unsubscribe: `${PUBLIC_SITE_URL}/api/public/email/unsubscribe/${token}`,
    click: (url: string) =>
      `${PUBLIC_SITE_URL}/api/public/email/click/${token}?u=${encodeURIComponent(url)}`,
  };
}

export type MarketingSendResult =
  | { sent: true }
  | { sent: false; reason: "recipient_suppressed" | "missing_api_key" | "error"; message?: string };

/** Hazır HTML'i pazarlama amaçlı gönderir; bastırılmış alıcı beklenen bir sonuçtur. */
export async function sendMarketingEmail(input: {
  to: string;
  fromName: string;
  subject: string;
  html: string;
  text: string;
  label: string;
  idempotencyKey: string;
  unsubscribeUrl?: string;
}): Promise<MarketingSendResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { sent: false, reason: "missing_api_key" };

  try {
    await sendLovableEmail(
      {
        to: input.to,
        from: `${input.fromName} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: input.subject,
        html: input.html,
        text: input.text,
        purpose: "marketing",
        label: input.label,
        idempotency_key: input.idempotencyKey,
        ...(input.unsubscribeUrl ? { unsubscribe_url: input.unsubscribeUrl } : {}),
      } as never,
      { apiKey, sendUrl: process.env["LOVABLE_SEND_URL"] },
    );
  } catch (error) {
    if (error instanceof EmailAPIError && error.code === "recipient_suppressed") {
      return { sent: false, reason: "recipient_suppressed" };
    }
    if (error instanceof EmailAPIError && (error.code === "missing_parameter" || error.status === 400)) {
      return { sent: false, reason: "error", message: "Mefticaret e-posta sistemi toplu kampanya göndermeyi desteklemiyor; kampanyalar için bir pazarlama sağlayıcısı (ör. Brevo) gerekir." };
    }
    return { sent: false, reason: "error", message: error instanceof Error ? error.message : "gönderim hatası" };
  }
  return { sent: true };
}
