/**
 * Ödeal Sanal POS entegrasyonu (sunucu tarafı).
 * Token, "Link ile Ödeme" (pay-by-link) ve statü sorgulama akışlarını sarar.
 * clientId/clientSecret yalnızca sunucu ortam değişkenlerinden okunur.
 */

type OdealEnv = "sandbox" | "live";

const ENDPOINTS: Record<OdealEnv, { auth: string; gateway: string }> = {
  sandbox: { auth: "https://auth-sandbox.odeal.com/api/v1", gateway: "https://api-stg.odeal.com/vpos" },
  live: { auth: "https://auth.odeal.com/api/v1", gateway: "https://api.odeal.com/vpos" },
};

let cachedToken: { value: string; expiresAt: number; env: OdealEnv } | null = null;

/** Yapılandırılmış ortam (varsayılan: test/sandbox). */
export function odealEnvironment(): OdealEnv {
  return process.env["ODEAL_ENV"] === "live" ? "live" : "sandbox";
}

/** Ödeal kimlik bilgileri tanımlı mı? */
export function isOdealConfigured(): boolean {
  return Boolean(process.env["ODEAL_CLIENT_ID"] && process.env["ODEAL_CLIENT_SECRET"]);
}

/** Ödemenin sonucunun POST edileceği geri dönüş adresi. */
export function odealReturnUrl(): string {
  const origin = (process.env["ODEAL_RETURN_ORIGIN"] ?? "https://mefticaret.com").replace(/\/$/, "");
  return `${origin}/api/public/odeal-callback`;
}

async function getAccessToken(): Promise<string> {
  const env = odealEnvironment();
  const now = Date.now();
  if (cachedToken && cachedToken.env === env && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  const clientId = process.env["ODEAL_CLIENT_ID"];
  const clientSecret = process.env["ODEAL_CLIENT_SECRET"];
  if (!clientId || !clientSecret) throw new Error("Ödeal kimlik bilgileri tanımlı değil.");

  const response = await fetch(`${ENDPOINTS[env].auth}/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret, grantType: "client_credentials", scope: "vpos" }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Ödeal token alınamadı [${response.status}]: ${text}`);

  const json = JSON.parse(text) as { accessToken?: string; expiresIn?: number };
  if (!json.accessToken) throw new Error("Ödeal token yanıtı geçersiz.");

  cachedToken = {
    value: json.accessToken,
    expiresAt: now + (json.expiresIn ?? 1799) * 1000,
    env,
  };
  return json.accessToken;
}

async function gatewayCall(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const token = await getAccessToken();
  const response = await fetch(`${ENDPOINTS[odealEnvironment()].gateway}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Ödeal isteği başarısız [${response.status}]: ${text}`);
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Ödeal yanıtı okunamadı.");
  }
}

export type PayByLinkInput = {
  amount: number;
  externalId: string;
  currency?: string;
  buyerName?: string | null;
  buyerMail?: string | null;
  phone?: string | null;
};

export type PayByLinkResult = { checkoutUrl: string; paymentId: string | null; raw: unknown };

/** Ödeme linki oluşturur; kart bilgisi hiçbir zaman bizim sistemimize gelmez. */
export async function createPayByLink(input: PayByLinkInput): Promise<PayByLinkResult> {
  const payload: Record<string, unknown> = {
    amount: Number(input.amount.toFixed(2)),
    installment: 1,
    externalId: input.externalId,
    returnUrl: odealReturnUrl(),
    currency: input.currency ?? "TRY",
  };
  if (input.buyerName) payload["buyerName"] = input.buyerName;
  if (input.buyerMail) payload["buyerMail"] = input.buyerMail;
  if (input.phone) payload["phone"] = input.phone;

  const json = await gatewayCall("/pay-by-link", payload);
  const url =
    (json["checkout3DUrl"] as string | undefined) ??
    ((json["result"] as Record<string, unknown> | undefined)?.["checkout3DUrl"] as string | undefined);
  if (!url) throw new Error(`Ödeal ödeme linki alınamadı: ${JSON.stringify(json).slice(0, 500)}`);

  const id = json["id"] ?? (json["result"] as Record<string, unknown> | undefined)?.["id"];
  return { checkoutUrl: url, paymentId: id != null ? String(id) : null, raw: json };
}

export type OdealStatus =
  | "PENDING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "NOTFOUND"
  | "REFUND"
  | "PARTIAL_REFUND";

/** Ödeal'den ödemenin gerçek statüsünü doğrular (callback'e körü körüne güvenilmez). */
export async function checkPaymentStatus(params: {
  id?: string | null;
  externalId?: string | null;
}): Promise<{ status: OdealStatus; raw: unknown }> {
  const body: Record<string, unknown> = {};
  if (params.id) body["id"] = params.id;
  if (params.externalId) body["externalId"] = params.externalId;

  const json = await gatewayCall("/check-status", body);
  const result = (json["result"] as Record<string, unknown> | undefined) ?? json;
  const raw = String(result["payment_status"] ?? "PENDING").toUpperCase().replace(/\s+/g, "_");
  const allowed: OdealStatus[] = [
    "PENDING",
    "COMPLETED",
    "FAILED",
    "CANCELLED",
    "NOTFOUND",
    "REFUND",
    "PARTIAL_REFUND",
  ];
  return {
    status: (allowed.includes(raw as OdealStatus) ? raw : "PENDING") as OdealStatus,
    raw: json,
  };
}

/** Kimlik bilgilerinin geçerliliğini token alarak doğrular. */
export async function verifyOdealCredentials(): Promise<void> {
  await getAccessToken();
}
