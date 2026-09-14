import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { safeFetch } from "@/lib/safe-fetch.server";

/**
 * QNBpay (Sipay altyapılı) sanal POS servis katmanı.
 * Dokümantasyon: https://apidocs.qnbpay.com.tr
 *
 * Bu katman yalnızca sunucuda çalışır. Kart verisi veritabanına yazılmaz;
 * yalnızca maskeli kart numarası ve servis yanıt özetleri saklanır.
 */

export type QnbpayEnv = "test" | "live";

const BASE_URLS: Record<QnbpayEnv, string> = {
  test: "https://test.qnbpay.com.tr/ccpayment",
  live: "https://portal.qnbpay.com.tr/ccpayment",
};

/** Dokümanda herkese açık olarak yayınlanan test üye işyeri bilgileri. */
const TEST_DEFAULTS = {
  merchantKey: "$2y$10$N9IJkgazXMUwCzpn7NJrZePy3v.dIFOQUyW4yGfT3eWry6m.KxanK",
  appId: "07fb70f9d8de575f32baa6518e38c5d6",
  appSecret: "61d97b2cac247069495be4b16f8604db",
};

export type QnbpayCredentials = {
  environment: QnbpayEnv;
  baseUrl: string;
  merchantKey: string;
  appId: string;
  appSecret: string;
};

export type QnbpaySettingsRow = {
  environment: string;
  is_enabled: boolean;
  test_merchant_key: string;
  test_app_id: string;
  live_merchant_key: string;
  live_app_id: string;
  currency_code: string;
  max_installments: number;
  selected_installments: number[] | null;
  is_commission_from_user: boolean;
  transaction_type: string;
  payment_completed_by: string;
  force_3d: boolean;
  sale_webhook_key: string | null;
  refund_webhook_key: string | null;
  return_origin: string | null;
};

/** Ortama göre üye işyeri anahtarı, uygulama kimliği ve gizli anahtarı çözer. */
export function resolveCredentials(settings: QnbpaySettingsRow): QnbpayCredentials {
  const environment: QnbpayEnv = settings.environment === "live" ? "live" : "test";
  const isLive = environment === "live";
  const appSecret =
    (isLive
      ? process.env["QNBPAY_LIVE_APP_SECRET"] ?? process.env["QNBPAY_APP_SECRET"]
      : process.env["QNBPAY_APP_SECRET"]) ?? (isLive ? "" : TEST_DEFAULTS.appSecret);

  const merchantKey =
    (isLive ? settings.live_merchant_key : settings.test_merchant_key) ||
    (isLive ? "" : TEST_DEFAULTS.merchantKey);
  const appId =
    (isLive ? settings.live_app_id : settings.test_app_id) || (isLive ? "" : TEST_DEFAULTS.appId);

  return { environment, baseUrl: BASE_URLS[environment], merchantKey, appId, appSecret };
}

export function isConfigured(credentials: QnbpayCredentials): boolean {
  return Boolean(credentials.merchantKey && credentials.appId && credentials.appSecret);
}

/* ------------------------------------------------------------------ */
/* Hash üretimi ve doğrulaması (dokümandaki AES-256-CBC şeması)         */
/* ------------------------------------------------------------------ */

/** İşlem verisinden hash_key üretir: iv:salt:base64(encrypted), '/' → '__'. */
export function generateHashKey(data: string, appSecret: string): string {
  const iv = createHash("sha1").update(randomBytes(16)).digest("hex").slice(0, 16);
  const salt = createHash("sha1").update(randomBytes(16)).digest("hex").slice(0, 4);
  const password = createHash("sha1").update(appSecret, "utf8").digest("hex");
  const saltWithPassword = createHash("sha256").update(password + salt, "utf8").digest("hex");
  const key = Buffer.from(saltWithPassword.slice(0, 32), "utf8");
  const cipher = createCipheriv("aes-256-cbc", key, Buffer.from(iv, "utf8"));
  const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]).toString("base64");
  return `${iv}:${salt}:${encrypted}`.replace(/\//g, "__");
}

export type ValidatedHash = {
  status: string;
  total: string;
  invoiceId: string;
  orderId: string;
  currencyCode: string;
};

/** Webhook / 3D dönüşünde gelen hash_key değerini çözer ve alanlarına ayırır. */
export function validateHashKey(hashKey: string, appSecret: string): ValidatedHash | null {
  try {
    const normalized = hashKey.replace(/__/g, "/");
    const parts = normalized.split(":");
    if (parts.length < 3) return null;
    const [iv, salt, ...rest] = parts;
    if (!iv || !salt) return null;
    const encrypted = rest.join(":");
    const password = createHash("sha1").update(appSecret, "utf8").digest("hex");
    const saltWithPassword = createHash("sha256").update(password + salt, "utf8").digest("hex");
    const key = Buffer.from(saltWithPassword.slice(0, 32), "utf8");
    const decipher = createDecipheriv("aes-256-cbc", key, Buffer.from(iv, "utf8"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64")),
      decipher.final(),
    ]).toString("utf8");
    const fields = decrypted.split("|");
    if (fields.length < 5) return null;
    return {
      status: fields[0] ?? "",
      total: fields[1] ?? "",
      invoiceId: fields[2] ?? "",
      orderId: fields[3] ?? "",
      currencyCode: fields[4] ?? "",
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* HTTP taşıyıcı                                                       */
/* ------------------------------------------------------------------ */

type TokenCache = { token: string; expiresAt: number };
const tokenCache = new Map<string, TokenCache>();

async function request<T>(
  credentials: QnbpayCredentials,
  path: string,
  body: Record<string, unknown>,
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
  };
  if (token) headers["authorization"] = `Bearer ${token}`;

  const response = await safeFetch(`${credentials.baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`QNBpay yanıtı okunamadı (${response.status}): ${text.slice(0, 300)}`);
  }
  if (!response.ok) {
    const message =
      (parsed as { status_description?: string; message?: string })?.status_description ??
      (parsed as { message?: string })?.message ??
      `HTTP ${response.status}`;
    throw new Error(`QNBpay hata: ${message}`);
  }
  return parsed as T;
}

/** /api/token — 2 saat geçerli erişim jetonu; ortam bazlı önbelleklenir. */
export async function getToken(credentials: QnbpayCredentials): Promise<string> {
  const cacheKey = `${credentials.environment}:${credentials.appId}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const result = await request<{
    status_code?: number;
    status_description?: string;
    data?: { token?: string; is_3d?: number; expires_at?: string };
  }>(credentials, "/api/token", {
    app_id: credentials.appId,
    app_secret: credentials.appSecret,
  });

  const token = result.data?.token;
  if (!token) throw new Error(result.status_description ?? "QNBpay jetonu alınamadı.");
  const expiresAt = result.data?.expires_at ? Date.parse(result.data.expires_at) : Number.NaN;
  tokenCache.set(cacheKey, {
    token,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : Date.now() + 100 * 60 * 1000,
  });
  return token;
}

/** Bağlantı testi: jeton alır ve 3D modunu döner. */
export async function verifyConnection(credentials: QnbpayCredentials): Promise<{
  is3d: number | null;
  expiresAt: string | null;
}> {
  const result = await request<{
    data?: { token?: string; is_3d?: number; expires_at?: string };
    status_description?: string;
  }>(credentials, "/api/token", {
    app_id: credentials.appId,
    app_secret: credentials.appSecret,
  });
  if (!result.data?.token) throw new Error(result.status_description ?? "Jeton alınamadı.");
  return { is3d: result.data.is_3d ?? null, expiresAt: result.data.expires_at ?? null };
}

/* ------------------------------------------------------------------ */
/* Taksit, komisyon ve pos bilgisi                                     */
/* ------------------------------------------------------------------ */

export type InstallmentOption = {
  installment: number;
  amount: number;
  amountToBePaid: number;
  cardProgram: string | null;
  posName: string | null;
  commissionRate: number | null;
  currency: string | null;
};

/** /api/getpos — kart ön ekine göre taksit ve komisyon bilgisi. */
export async function getPos(
  credentials: QnbpayCredentials,
  input: { creditCard: string; amount: number; currencyCode: string; commissionFromUser: boolean },
): Promise<InstallmentOption[]> {
  const token = await getToken(credentials);
  const result = await request<{
    data?: { installment?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
    status_description?: string;
  }>(
    credentials,
    "/api/getpos",
    {
      credit_card: input.creditCard.replace(/\D/g, "").slice(0, 8),
      amount: input.amount,
      currency_code: input.currencyCode,
      merchant_key: credentials.merchantKey,
      is_2d: 0,
      is_comission_from_user: input.commissionFromUser ? "1" : "0",
    },
    token,
  );

  const raw = Array.isArray(result.data)
    ? result.data
    : Array.isArray(result.data?.installment)
      ? result.data.installment
      : [];

  return raw.map((row) => ({
    installment: Number(row["installments_number"] ?? row["installment"] ?? 1),
    amount: Number(row["amount"] ?? 0),
    amountToBePaid: Number(row["amount_to_be_paid"] ?? row["amount"] ?? 0),
    cardProgram: (row["card_program"] as string | undefined) ?? null,
    posName: (row["pos_name"] as string | undefined) ?? null,
    commissionRate: row["commission_rate"] != null ? Number(row["commission_rate"]) : null,
    currency: (row["currency_code"] as string | undefined) ?? null,
  }));
}

/** /ccpayment/api/commissions — üye işyeri komisyon oranları. */
export async function getCommissions(
  credentials: QnbpayCredentials,
  currencyCode: string,
): Promise<Record<string, unknown>> {
  const token = await getToken(credentials);
  return request<Record<string, unknown>>(
    credentials,
    "/api/commissions",
    { merchant_key: credentials.merchantKey, currency_code: currencyCode },
    token,
  );
}

/** /ccpayment/api/installments — üye işyerinin aktif taksit seçenekleri. */
export async function getActiveInstallments(
  credentials: QnbpayCredentials,
  input: { currencyCode: string; amount: number },
): Promise<Record<string, unknown>> {
  const token = await getToken(credentials);
  return request<Record<string, unknown>>(
    credentials,
    "/api/installments",
    {
      merchant_key: credentials.merchantKey,
      currency_code: input.currencyCode,
      amount: input.amount,
    },
    token,
  );
}

/* ------------------------------------------------------------------ */
/* Ödeme başlatma                                                      */
/* ------------------------------------------------------------------ */

export type CartItem = { name: string; price: number; quantity: number; description: string };

export type PurchaseLinkInput = {
  invoiceId: string;
  description: string;
  total: number;
  currencyCode: string;
  returnUrl: string;
  cancelUrl: string;
  name: string;
  surname: string;
  items: CartItem[];
  commissionFromUser: boolean;
  selectedInstallments?: number[];
};

/** /purchase/link — hazır QNBpay ödeme sayfası bağlantısı üretir. */
export async function createPaymentLink(
  credentials: QnbpayCredentials,
  input: PurchaseLinkInput,
): Promise<{ link: string; orderId: string | null; raw: Record<string, unknown> }> {
  const token = await getToken(credentials);
  const body: Record<string, unknown> = {
    merchant_key: credentials.merchantKey,
    currency_code: input.currencyCode,
    invoice: {
      invoice_id: input.invoiceId,
      invoice_description: input.description,
      total: input.total,
      return_url: input.returnUrl,
      cancel_url: input.cancelUrl,
      response_method: "POST",
    },
    items: input.items.map((item) => ({
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      description: item.description,
    })),
    name: input.name,
    surname: input.surname,
    is_comission_from_user: input.commissionFromUser ? "1" : "0",
  };
  if (input.selectedInstallments?.length) {
    body["selected_installments"] = input.selectedInstallments;
  }

  const result = await request<{
    status?: boolean;
    status_code?: number;
    status_description?: string;
    link?: string;
    order_id?: string | number;
  }>(credentials, "/purchase/link", body, token);

  if (!result.link) throw new Error(result.status_description ?? "Ödeme bağlantısı oluşturulamadı.");
  return {
    link: result.link,
    orderId: result.order_id != null ? String(result.order_id) : null,
    raw: result as Record<string, unknown>,
  };
}

export type CardPaymentInput = {
  invoiceId: string;
  description: string;
  total: number;
  currencyCode: string;
  installment: number;
  cardHolderName: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  name: string;
  surname: string;
  items: CartItem[];
  commissionFromUser: boolean;
  transactionType: "Auth" | "PreAuth";
  returnUrl?: string;
  cancelUrl?: string;
  ip?: string;
  billEmail?: string;
  billPhone?: string;
  identityNumber?: string;
  saleWebhookKey?: string | null;
  storeCard?: { customerId: string } | null;
};

function cardBody(credentials: QnbpayCredentials, input: CardPaymentInput) {
  const hashData = `${input.total}|${input.installment}|${input.currencyCode}|${credentials.merchantKey}|${input.invoiceId}`;
  const body: Record<string, unknown> = {
    cc_holder_name: input.cardHolderName,
    cc_no: input.cardNumber.replace(/\s/g, ""),
    expiry_month: input.expiryMonth,
    expiry_year: input.expiryYear,
    cvv: input.cvv,
    currency_code: input.currencyCode,
    installments_number: input.installment,
    invoice_id: input.invoiceId,
    invoice_description: input.description,
    name: input.name,
    surname: input.surname,
    total: input.total,
    merchant_key: credentials.merchantKey,
    items: input.items,
    hash_key: generateHashKey(hashData, credentials.appSecret),
    transaction_type: input.transactionType,
  };
  if (input.returnUrl) body["return_url"] = input.returnUrl;
  if (input.cancelUrl) body["cancel_url"] = input.cancelUrl;
  if (input.ip) body["ip"] = input.ip;
  if (input.billEmail) body["bill_email"] = input.billEmail;
  if (input.billPhone) body["bill_phone"] = input.billPhone;
  if (input.identityNumber) body["identity_number"] = input.identityNumber;
  if (input.saleWebhookKey) body["sale_web_hook_key"] = input.saleWebhookKey;
  if (input.commissionFromUser && input.installment > 1) body["is_comission_from_user"] = "1";
  if (input.storeCard) {
    body["is_stored_card"] = 1;
    body["card_customer_id"] = input.storeCard.customerId;
  }
  return body;
}

/** /api/paySmart3D — 3D Secure akışı; banka doğrulama formu HTML olarak döner. */
export async function paySmart3D(
  credentials: QnbpayCredentials,
  input: CardPaymentInput,
): Promise<{ html: string | null; json: Record<string, unknown> | null }> {
  const token = await getToken(credentials);
  const response = await safeFetch(`${credentials.baseUrl}/api/paySmart3D`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(cardBody(credentials, input)),
  });
  const text = await response.text();
  try {
    return { html: null, json: JSON.parse(text) as Record<string, unknown> };
  } catch {
    return { html: text, json: null };
  }
}

/** /api/paySmart2D — Non-Secure (2D) ödeme. */
export async function paySmart2D(
  credentials: QnbpayCredentials,
  input: CardPaymentInput,
): Promise<Record<string, unknown>> {
  const token = await getToken(credentials);
  return request<Record<string, unknown>>(
    credentials,
    "/api/paySmart2D",
    cardBody(credentials, input),
    token,
  );
}

export type TokenPaymentInput = {
  cardId: string;
  cardCustomerId: string;
  cvv?: string;
  expiryYear?: string;
  invoiceId: string;
  description: string;
  total: number;
  currencyCode: string;
  installment: number;
  name: string;
  surname: string;
  items: CartItem[];
  transactionType: "Auth" | "PreAuth";
  commissionFromUser: boolean;
  secure3d: boolean;
  returnUrl?: string;
  cancelUrl?: string;
};

/** /api/PayByToken ve /api/PayByToken3D — saklı kart ile ödeme. */
export async function payByToken(
  credentials: QnbpayCredentials,
  input: TokenPaymentInput,
): Promise<{ html: string | null; json: Record<string, unknown> | null }> {
  const token = await getToken(credentials);
  const hashData = `${input.total}|${input.installment}|${input.currencyCode}|${credentials.merchantKey}|${input.invoiceId}`;
  const body: Record<string, unknown> = {
    card_id: input.cardId,
    card_customer_id: input.cardCustomerId,
    currency_code: input.currencyCode,
    installments_number: input.installment,
    invoice_id: input.invoiceId,
    invoice_description: input.description,
    total: input.total,
    merchant_key: credentials.merchantKey,
    items: input.items,
    name: input.name,
    surname: input.surname,
    hash_key: generateHashKey(hashData, credentials.appSecret),
    transaction_type: input.transactionType,
  };
  if (input.cvv) body["cvv"] = input.cvv;
  if (input.expiryYear) body["expiry_year"] = input.expiryYear;
  if (input.returnUrl) body["return_url"] = input.returnUrl;
  if (input.cancelUrl) body["cancel_url"] = input.cancelUrl;
  if (input.commissionFromUser && input.installment > 1) body["is_comission_from_user"] = "1";

  const path = input.secure3d ? "/api/PayByToken3D" : "/api/PayByToken";
  const response = await safeFetch(`${credentials.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  try {
    return { html: null, json: JSON.parse(text) as Record<string, unknown> };
  } catch {
    return { html: text, json: null };
  }
}

/* ------------------------------------------------------------------ */
/* Tamamlama, durum, ön provizyon ve iade                              */
/* ------------------------------------------------------------------ */

/** /api/complete — ödemeyi üye işyeri tarafında tamamlar veya iptal eder. */
export async function completePayment(
  credentials: QnbpayCredentials,
  input: { invoiceId: string; orderId: string; status: "complete" | "cancel" },
): Promise<Record<string, unknown>> {
  const token = await getToken(credentials);
  const hashData = `${credentials.merchantKey}|${input.invoiceId}|${input.orderId}|${input.status}`;
  return request<Record<string, unknown>>(
    credentials,
    "/api/complete",
    {
      merchant_key: credentials.merchantKey,
      invoice_id: input.invoiceId,
      order_id: input.orderId,
      status: input.status,
      hash_key: generateHashKey(hashData, credentials.appSecret),
    },
    token,
  );
}

/** /api/confirmPayment — ön provizyonlu işlemi onaylar (1) veya iptal eder (2). */
export async function confirmPayment(
  credentials: QnbpayCredentials,
  input: { invoiceId: string; status: 1 | 2; total?: number },
): Promise<Record<string, unknown>> {
  const token = await getToken(credentials);
  const hashData = `${input.invoiceId}|${credentials.merchantKey}`;
  const body: Record<string, unknown> = {
    invoice_id: input.invoiceId,
    merchant_key: credentials.merchantKey,
    status: input.status,
    hash_key: generateHashKey(hashData, credentials.appSecret),
  };
  if (input.total != null) body["total"] = input.total;
  return request<Record<string, unknown>>(credentials, "/api/confirmPayment", body, token);
}

export type StatusResult = {
  transactionStatus: string | null;
  orderId: string | null;
  orderNo: string | null;
  transactionId: string | null;
  statusCode: number | null;
  statusDescription: string | null;
  paymentStatus: number | null;
  mdStatus: number | null;
  creditCardNo: string | null;
  merchantCommission: number | null;
  userCommission: number | null;
  transactionType: string | null;
  errorCode: string | null;
  error: string | null;
  bankErrorCode: string | null;
  bankErrorDescription: string | null;
  raw: Record<string, unknown>;
};

function pickNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/** /api/checkstatus — işlem durumu sorgulama. */
export async function checkStatus(
  credentials: QnbpayCredentials,
  input: { invoiceId: string; includePending?: boolean },
): Promise<StatusResult> {
  const token = await getToken(credentials);
  const hashData = `${input.invoiceId}|${credentials.merchantKey}`;
  const result = await request<{
    status_code?: number;
    status_description?: string;
    data?: Record<string, unknown>;
  }>(
    credentials,
    "/api/checkstatus",
    {
      invoice_id: input.invoiceId,
      merchant_key: credentials.merchantKey,
      include_pending_status: input.includePending ? "true" : "false",
      hash_key: generateHashKey(hashData, credentials.appSecret),
    },
    token,
  );

  const data = result.data ?? (result as Record<string, unknown>);
  return {
    transactionStatus: (data["transaction_status"] as string | undefined) ?? null,
    orderId: data["order_id"] != null ? String(data["order_id"]) : null,
    orderNo: data["order_no"] != null ? String(data["order_no"]) : null,
    transactionId: data["transaction_id"] != null ? String(data["transaction_id"]) : null,
    statusCode: pickNumber(data["status_code"] ?? result.status_code),
    statusDescription:
      (data["status_description"] as string | undefined) ?? result.status_description ?? null,
    paymentStatus: pickNumber(data["payment_status"]),
    mdStatus: pickNumber(data["md_status"]),
    creditCardNo: (data["credit_card_no"] as string | undefined) ?? null,
    merchantCommission: pickNumber(data["merchant_commission"]),
    userCommission: pickNumber(data["user_commission"]),
    transactionType: (data["transaction_type"] as string | undefined) ?? null,
    errorCode: data["error_code"] != null ? String(data["error_code"]) : null,
    error: (data["error"] as string | undefined) ?? null,
    bankErrorCode: (data["original_bank_error_code"] as string | undefined) ?? null,
    bankErrorDescription: (data["original_bank_error_description"] as string | undefined) ?? null,
    raw: data,
  };
}

/** /api/refund — tam veya kısmi iade. */
export async function refundPayment(
  credentials: QnbpayCredentials,
  input: { invoiceId: string; amount: number; refundWebhookKey?: string | null },
): Promise<{
  statusCode: number | null;
  statusDescription: string | null;
  refNo: string | null;
  orderNo: string | null;
  raw: Record<string, unknown>;
}> {
  const token = await getToken(credentials);
  const hashData = `${input.amount}|${input.invoiceId}|${credentials.merchantKey}`;
  const body: Record<string, unknown> = {
    invoice_id: input.invoiceId,
    amount: input.amount,
    merchant_key: credentials.merchantKey,
    hash_key: generateHashKey(hashData, credentials.appSecret),
  };
  if (input.refundWebhookKey) body["refund_web_hook_key"] = input.refundWebhookKey;

  const result = await request<{
    status_code?: number;
    status_description?: string;
    data?: Record<string, unknown>;
    ref_no?: string;
    order_no?: string;
  }>(credentials, "/api/refund", body, token);

  const data = result.data ?? (result as Record<string, unknown>);
  return {
    statusCode: pickNumber(data["status_code"] ?? result.status_code),
    statusDescription:
      (data["status_description"] as string | undefined) ?? result.status_description ?? null,
    refNo: data["ref_no"] != null ? String(data["ref_no"]) : null,
    orderNo: data["order_no"] != null ? String(data["order_no"]) : null,
    raw: data,
  };
}

/* ------------------------------------------------------------------ */
/* Durum kodu sözlükleri (dokümandaki sunucu/uygulama kodları)          */
/* ------------------------------------------------------------------ */

export const STATUS_CODES: Record<string, string> = {
  "100": "İşlem başarılı",
  "1": "Genel hata",
  "2": "Geçersiz istek",
  "3": "Yetkisiz istek",
  "11": "Geçersiz üye işyeri anahtarı",
  "12": "Geçersiz hash bilgisi",
  "13": "Geçersiz tutar",
  "14": "Geçersiz para birimi",
  "15": "Geçersiz taksit sayısı",
  "16": "Tekrarlanan fatura numarası",
  "17": "Kart bilgileri geçersiz",
  "18": "Banka reddi",
  "19": "3D doğrulama başarısız",
  "20": "İşlem bulunamadı",
  "33": "Yetersiz bakiye",
  "41": "İade edilemez işlem",
  "42": "İade tutarı işlem tutarından büyük",
  "69": "İşlem zaman aşımı",
  "99": "Tanımsız hata",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  "0": "Başarısız",
  "1": "Başarılı",
  "2": "İptal",
  "3": "İade",
};

export const TRANSACTION_STATUS_LABELS: Record<string, string> = {
  Completed: "Tamamlandı",
  Pending: "Beklemede",
  Failed: "Başarısız",
  Refunded: "İade edildi",
  Cancelled: "İptal edildi",
};

export function describeStatusCode(code: number | string | null | undefined): string {
  if (code == null) return "—";
  return STATUS_CODES[String(code)] ?? `Kod ${code}`;
}

/** Test kartları (yalnızca test ortamı için, dokümandan). */
export const TEST_CARDS = [
  { number: "4022 7805 2066 9303", cvv: "276", expiry: "01/50", bank: "QNB" },
  { number: "5456 1601 4022 5418", cvv: "276", expiry: "01/50", bank: "MasterCard" },
  { number: "6587 5801 8523 4399", cvv: "988", expiry: "01/50", bank: "Troy" },
];
