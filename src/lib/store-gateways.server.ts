import { createHmac, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/**
 * Satıcının Uygulama Mağazası'ndan kurduğu ödeme sağlayıcıları (iyzico, PayTR)
 * ile vitrin siparişlerinin tahsilatı. Kimlik bilgileri yalnız sunucuda okunur,
 * tutar yalnız `orders.grand_total` üzerinden hesaplanır, ödeme yalnız
 * sağlayıcı teyidi (iyzico retrieve / PayTR imzalı bildirim) sonrası işlenir.
 */

type Db = SupabaseClient<Database>;
type Settings = Record<string, unknown>;

export const GATEWAY_APPS = {
  "iyzico-pay": { connector: "iyzico", label: "Kredi / banka kartı (iyzico)" },
  "paytr-pay": { connector: "paytr", label: "Kredi / banka kartı (PayTR)" },
} as const;
export type GatewayAppCode = keyof typeof GATEWAY_APPS;
type GatewayConnector = (typeof GATEWAY_APPS)[GatewayAppCode]["connector"];

const str = (s: Settings, k: string) => String(s[k] ?? "").trim();
const isTest = (s: Settings, k: string) => !(s[k] === false || str(s, k) === "false");

export function isGatewayApp(code: string): code is GatewayAppCode {
  return code in GATEWAY_APPS;
}

/** Kurulum/ayar/durum değişiminde vitrin ödeme yöntemini eşitler. */
export async function syncGatewayPaymentMethod(
  supabase: Db,
  storeId: string,
  appCode: GatewayAppCode,
  active: boolean,
): Promise<void> {
  const meta = GATEWAY_APPS[appCode];
  const { data: connector } = await supabase
    .from("connectors")
    .select("id")
    .eq("code", meta.connector)
    .maybeSingle();
  if (!connector) return;
  const { data: existing } = await supabase
    .from("store_payment_methods")
    .select("id")
    .eq("store_id", storeId)
    .eq("connector_id", connector.id)
    .maybeSingle();
  if (existing) {
    await supabase.from("store_payment_methods").update({ is_active: active }).eq("id", existing.id);
    return;
  }
  if (!active) return;
  await supabase.from("store_payment_methods").insert({
    store_id: storeId,
    connector_id: connector.id,
    display_name: meta.label,
    instructions: "Sipariş sonrası güvenli ödeme sayfasında kartınızla ödeyin.",
    is_active: true,
    installments_enabled: true,
  } as never);
}

/** Siparişte seçilen yöntemin sağlayıcısını ve mağazanın kurulum ayarlarını bulur. */
export async function resolveOrderGateway(
  db: Db,
  storeId: string,
  paymentMethodId: string | null,
): Promise<{ connector: GatewayConnector; settings: Settings } | null> {
  if (!paymentMethodId) return null;
  const { data: method } = await db
    .from("store_payment_methods")
    .select("id, is_active, connectors(code)")
    .eq("id", paymentMethodId)
    .eq("store_id", storeId)
    .maybeSingle();
  const code = (method?.connectors as { code?: string } | null)?.code;
  const appCode = (Object.keys(GATEWAY_APPS) as GatewayAppCode[]).find(
    (key) => GATEWAY_APPS[key].connector === code,
  );
  if (!method || !appCode) return null;
  const settings = await loadGatewaySettings(db, storeId, appCode);
  if (!settings) return null;
  return { connector: GATEWAY_APPS[appCode].connector, settings };
}

export async function loadGatewaySettings(
  db: Db,
  storeId: string,
  appCode: GatewayAppCode,
): Promise<Settings | null> {
  const { data } = await db
    .from("app_installations")
    .select("settings, status, apps!inner(code)")
    .eq("store_id", storeId)
    .eq("apps.code", appCode)
    .maybeSingle();
  if (!data || data.status !== "installed") return null;
  return (data.settings ?? {}) as Settings;
}

/** Siparişin ödeme yöntemi kimliği sipariş olayından okunur. */
export async function orderPaymentMethodId(db: Db, orderId: string): Promise<string | null> {
  const { data } = await db
    .from("order_events")
    .select("meta")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true })
    .limit(5);
  for (const row of data ?? []) {
    const id = (row.meta as Record<string, unknown> | null)?.["payment_method_id"];
    if (typeof id === "string") return id;
  }
  return null;
}

export type GatewayOrder = {
  id: string;
  storeId: string;
  slug: string;
  orderNumber: string;
  amount: number;
  currency: string;
  email: string;
  name: string;
  phone: string;
  address: Record<string, unknown>;
};

// ---------------- iyzico ----------------

function iyzicoHost(s: Settings) {
  return isTest(s, "sandbox") ? "https://sandbox-api.iyzipay.com" : "https://api.iyzipay.com";
}

async function iyzicoCall(s: Settings, path: string, payload: unknown) {
  const body = JSON.stringify(payload);
  const rnd = `${Date.now()}${randomBytes(4).toString("hex")}`;
  const sig = createHmac("sha256", str(s, "secret_key")).update(rnd + path + body).digest("hex");
  const auth = Buffer.from(`apiKey:${str(s, "api_key")}&randomKey:${rnd}&signature:${sig}`).toString(
    "base64",
  );
  const res = await fetch(`${iyzicoHost(s)}${path}`, {
    method: "POST",
    headers: {
      Authorization: `IYZWSv2 ${auth}`,
      "x-iyzi-rnd": rnd,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body,
  });
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

const money = (n: number) => n.toFixed(2);

export async function createIyzicoPayment(
  s: Settings,
  order: GatewayOrder,
  ctx: { origin: string; ip: string; callbackUrl?: string },
): Promise<string> {
  const [first, ...rest] = (order.name || "Müşteri").split(" ");
  const addr = order.address;
  const city = String(addr["city"] ?? "Istanbul") || "Istanbul";
  const country = String(addr["country"] ?? "Turkey") || "Turkey";
  const line = String(addr["line1"] ?? addr["address"] ?? city) || city;
  const address = { contactName: order.name || "Müşteri", city, country, address: line };
  const price = money(order.amount);
  const json = await iyzicoCall(s, "/payment/iyzipos/checkoutform/initialize/auth/ecom", {
    locale: "tr",
    conversationId: order.id,
    price,
    paidPrice: price,
    currency: order.currency === "TRY" ? "TRY" : order.currency,
    basketId: order.id,
    paymentGroup: "PRODUCT",
    callbackUrl: ctx.callbackUrl ?? `${ctx.origin}/api/public/pay/iyzico/${order.id}`,
    enabledInstallments: [1, 2, 3, 6, 9],
    buyer: {
      id: order.email,
      name: first || "Müşteri",
      surname: rest.join(" ") || first || "Müşteri",
      gsmNumber: order.phone || undefined,
      email: order.email,
      identityNumber: "11111111111",
      registrationAddress: line,
      ip: ctx.ip,
      city,
      country,
    },
    shippingAddress: address,
    billingAddress: address,
    basketItems: [
      {
        id: order.orderNumber,
        name: `Sipariş ${order.orderNumber}`,
        category1: "Genel",
        itemType: "PHYSICAL",
        price,
      },
    ],
  });
  if (json["status"] !== "success" || typeof json["paymentPageUrl"] !== "string") {
    throw new Error(`iyzico ödeme sayfası açılamadı: ${String(json["errorMessage"] ?? "bilinmeyen hata")}`);
  }
  return json["paymentPageUrl"];
}

/** iyzico dönüş token'ını sağlayıcıdan doğrular. */
export async function verifyIyzicoPayment(s: Settings, token: string, orderId: string) {
  const json = await iyzicoCall(s, "/payment/iyzipos/checkoutform/auth/ecom/detail", {
    locale: "tr",
    conversationId: orderId,
    token,
  });
  const ok =
    json["status"] === "success" &&
    json["paymentStatus"] === "SUCCESS" &&
    json["basketId"] === orderId;
  return {
    ok,
    amount: Number(json["paidPrice"] ?? 0),
    reference: String(json["paymentId"] ?? token),
    message: String(json["errorMessage"] ?? ""),
  };
}

// ---------------- PayTR ----------------

export const paytrOid = (orderId: string) => orderId.replace(/-/g, "");
export function orderIdFromPaytrOid(oid: string): string | null {
  if (!/^[0-9a-f]{32}$/i.test(oid)) return null;
  return `${oid.slice(0, 8)}-${oid.slice(8, 12)}-${oid.slice(12, 16)}-${oid.slice(16, 20)}-${oid.slice(20)}`;
}

export async function createPaytrPayment(
  s: Settings,
  order: GatewayOrder,
  ctx: { origin: string; ip: string; backUrl?: string },
): Promise<string> {
  const merchantId = str(s, "merchant_id");
  const key = str(s, "merchant_key");
  const salt = str(s, "merchant_salt");
  const oid = paytrOid(order.id);
  const amount = String(Math.round(order.amount * 100));
  const basket = Buffer.from(
    JSON.stringify([[`Sipariş ${order.orderNumber}`, money(order.amount), 1]]),
  ).toString("base64");
  const noInstallment = "0";
  const maxInstallment = "0";
  const currency = order.currency === "TRY" ? "TL" : order.currency;
  const testMode = isTest(s, "test_mode") ? "1" : "0";
  const hashStr = `${merchantId}${ctx.ip}${oid}${order.email}${amount}${basket}${noInstallment}${maxInstallment}${currency}${testMode}`;
  const token = createHmac("sha256", key).update(hashStr + salt).digest("base64");
  const back = ctx.backUrl ?? `${ctx.origin}/s/${order.slug}/order?no=${encodeURIComponent(order.orderNumber)}&email=${encodeURIComponent(order.email)}`;
  const addr = order.address;
  const form = new URLSearchParams({
    merchant_id: merchantId,
    user_ip: ctx.ip,
    merchant_oid: oid,
    email: order.email,
    payment_amount: amount,
    paytr_token: token,
    user_basket: basket,
    debug_on: testMode,
    no_installment: noInstallment,
    max_installment: maxInstallment,
    user_name: order.name || "Müşteri",
    user_address: String(addr["line1"] ?? addr["city"] ?? "-") || "-",
    user_phone: order.phone || "0000000000",
    merchant_ok_url: back,
    merchant_fail_url: back,
    timeout_limit: "30",
    currency,
    test_mode: testMode,
    lang: "tr",
  });
  const res = await fetch("https://www.paytr.com/odeme/api/get-token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const json = (await res.json().catch(() => ({}))) as { status?: string; token?: string; reason?: string };
  if (json.status !== "success" || !json.token) {
    throw new Error(`PayTR ödeme sayfası açılamadı: ${json.reason ?? "bilinmeyen hata"}`);
  }
  return `https://www.paytr.com/odeme/guvenli/${json.token}`;
}

export function verifyPaytrHash(
  s: Settings,
  p: { merchant_oid: string; status: string; total_amount: string; hash: string },
): boolean {
  const expected = createHmac("sha256", str(s, "merchant_key"))
    .update(`${p.merchant_oid}${str(s, "merchant_salt")}${p.status}${p.total_amount}`)
    .digest("base64");
  return expected.length === p.hash.length && expected === p.hash;
}

// ---------------- Ortak ----------------

/** Sağlayıcı teyidi alınmış ödemeyi siparişe uygular (tekrar çağrılarda güvenli). */
export async function applyGatewayPayment(
  db: Db,
  orderId: string,
  provider: GatewayConnector,
  amount: number,
  reference: string,
): Promise<void> {
  const { data: order } = await db
    .from("orders")
    .select("id, store_id, payment_status, status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.payment_status === "paid") return;

  await db
    .from("orders")
    .update({
      payment_status: "paid",
      status: ["pending", "awaiting_payment"].includes(order.status) ? "paid" : order.status,
    })
    .eq("id", order.id);
  await db.from("order_events").insert({
    order_id: order.id,
    store_id: order.store_id,
    kind: "payment",
    message: `Kart ödemesi onaylandı (${provider === "iyzico" ? "iyzico" : "PayTR"})`,
    meta: { provider, amount, reference },
  });
  await db.from("payments").insert({
    store_id: order.store_id,
    order_id: order.id,
    provider,
    method: "card",
    status: "paid",
    amount,
    captured_at: new Date().toISOString(),
    provider_reference: reference,
  } as never);

  try {
    const { notifyDigitalOrderPaid } = await import("@/lib/digital-delivery.server");
    await notifyDigitalOrderPaid(db as never, order.id);
    const { dispatchCustomerEvent } = await import("@/lib/customer-notify.server");
    await dispatchCustomerEvent(order.id, "ORDER_CONFIRMED", {}, db as never);
  } catch {
    // Bildirim hatası ödemeyi etkilemez.
  }
}
