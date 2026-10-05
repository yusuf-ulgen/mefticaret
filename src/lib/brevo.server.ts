/**
 * Brevo (bağlayıcı geçidi üzerinden) — pazarlama e-postası ve SMS gönderimi.
 * Yalnız sunucuda kullanılır; anahtarlar istemciye asla açılmaz.
 */
const GATEWAY_URL = "https://connector-gateway.lovable.dev/brevo";
const SENDER_EMAIL = "utebaylargrup@gmail.com";
const SMS_SENDER = "Mefticaret";

function keys() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const brevo = process.env["BREVO_API_KEY"];
  return lovable && brevo ? { lovable, brevo } : null;
}

export function brevoReady(): boolean {
  return keys() !== null;
}

async function call(path: string, body: unknown): Promise<{ ok: boolean; status: number; text: string }> {
  const k = keys();
  if (!k) return { ok: false, status: 0, text: "Brevo bağlı değil" };
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${k.lovable}`,
      "X-Connection-Api-Key": k.brevo,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) console.error(`Brevo ${path} [${res.status}]: ${text}`);
  return { ok: res.ok, status: res.status, text };
}

export async function sendBrevoEmail(input: {
  to: string;
  fromName: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await call("/smtp/email", {
    sender: { name: input.fromName.slice(0, 70), email: SENDER_EMAIL },
    to: [{ email: input.to }],
    subject: input.subject,
    htmlContent: input.html,
    textContent: input.text,
    ...(input.unsubscribeUrl ? { headers: { "List-Unsubscribe": `<${input.unsubscribeUrl}>` } } : {}),
  });
  return r.ok ? { ok: true } : { ok: false, error: `Brevo ${r.status}: ${r.text.slice(0, 300)}` };
}

/** Tek alıcıya pazarlama SMS'i. Numara uluslararası biçimde (90…) olmalı. */
export async function sendBrevoSms(to: string, content: string): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  const r = await call("/transactionalSMS/sms", {
    sender: SMS_SENDER,
    recipient: to.replace(/^\+/, ""),
    content,
    type: "marketing",
  });
  if (!r.ok) return { ok: false, error: `Brevo ${r.status}: ${r.text.slice(0, 300)}` };
  try {
    return { ok: true, id: String((JSON.parse(r.text) as { messageId?: number }).messageId ?? "") || null };
  } catch {
    return { ok: true, id: null };
  }
}
