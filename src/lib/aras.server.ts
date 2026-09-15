import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/**
 * Aras Kargo gerçek entegrasyonu (SOAP).
 * Kimlik bilgileri yalnızca sunucu tarafındaki gizli anahtarlardan okunur; istemciye
 * hiçbir zaman gönderilmez. Gönderi oluşturma ve durum sorgulama Aras servislerine
 * doğrudan yapılır, sonuçlar shipments/orders tablolarına yazılır.
 */

type Client = SupabaseClient<Database>;

const DEFAULT_ORDER_URL = "https://customerws.araskargo.com.tr/arascargoservice.asmx";
const DEFAULT_QUERY_URL =
  "https://appls-srvc.araskargo.com.tr/arascargoservice/arascargoservice.asmx";

export const ARAS_CARRIER = "Aras Kargo";

type ArasConfig = {
  username: string;
  password: string;
  customerCode: string;
  orderUrl: string;
  queryUrl: string;
};

/** Gizli anahtarlar yalnızca handler içinde okunur (Worker env'i istek anında enjekte eder). */
export function readArasConfig(): ArasConfig {
  const username = process.env["ARAS_KARGO_USERNAME"];
  const password = process.env["ARAS_KARGO_PASSWORD"];
  const customerCode = process.env["ARAS_KARGO_CUSTOMER_CODE"];
  if (!username || !password || !customerCode) {
    throw new Error(
      "Aras Kargo bağlantı bilgileri tanımlı değil. Kullanıcı adı, şifre ve müşteri kodunu kaydedin.",
    );
  }
  return {
    username,
    password,
    customerCode,
    orderUrl: process.env["ARAS_KARGO_ORDER_URL"] || DEFAULT_ORDER_URL,
    queryUrl: process.env["ARAS_KARGO_QUERY_URL"] || DEFAULT_QUERY_URL,
  };
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decode(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** İlk eşleşen etiketin içeriğini döndürür (namespace önekleri yok sayılır). */
function tag(xml: string, name: string): string | null {
  const match = new RegExp(`<(?:\\w+:)?${name}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`, "i").exec(
    xml,
  );
  if (!match?.[1]) return null;
  const raw = match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
  return raw ? decode(raw) : null;
}

async function soapCall(url: string, action: string, body: string) {
  const envelope = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${body}</soap:Body></soap:Envelope>`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: `http://tempuri.org/${action}`,
    },
    body: envelope,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Aras Kargo servisi yanıt vermedi (${response.status}). ${tag(text, "faultstring") ?? ""}`.trim(),
    );
  }
  const fault = tag(text, "faultstring");
  if (fault) throw new Error(`Aras Kargo hatası: ${fault}`);
  return text;
}

export type ArasOrderInput = {
  integrationCode: string;
  receiverName: string;
  receiverAddress: string;
  receiverPhone: string;
  receiverCity: string;
  receiverTown: string;
  pieceCount: number;
  description: string;
  codAmount?: number;
  codCurrency?: string;
};

/** Aras'a gönderi (sipariş) kaydı açar; başarılı olursa entegrasyon kodunu döndürür. */
export async function createArasOrder(input: ArasOrderInput) {
  const config = readArasConfig();
  const order = `<Order>
      <UserName>${xmlEscape(config.username)}</UserName>
      <Password>${xmlEscape(config.password)}</Password>
      <TradingWaybillNumber>${xmlEscape(input.integrationCode)}</TradingWaybillNumber>
      <IntegrationCode>${xmlEscape(input.integrationCode)}</IntegrationCode>
      <ReceiverName>${xmlEscape(input.receiverName)}</ReceiverName>
      <ReceiverAddress>${xmlEscape(input.receiverAddress)}</ReceiverAddress>
      <ReceiverPhone1>${xmlEscape(input.receiverPhone)}</ReceiverPhone1>
      <ReceiverCityName>${xmlEscape(input.receiverCity)}</ReceiverCityName>
      <ReceiverTownName>${xmlEscape(input.receiverTown)}</ReceiverTownName>
      <PieceCount>${input.pieceCount}</PieceCount>
      <PayorTypeCode>1</PayorTypeCode>
      <IsWorldWide>0</IsWorldWide>
      <Description>${xmlEscape(input.description)}</Description>
      ${
        input.codAmount && input.codAmount > 0
          ? `<TtInvoiceAmount>${input.codAmount.toFixed(2)}</TtInvoiceAmount><TtCollectionType>0</TtCollectionType>`
          : ""
      }
    </Order>`;

  const xml = await soapCall(
    config.orderUrl,
    "SetOrder",
    `<SetOrder xmlns="http://tempuri.org/"><orderInfo>${order}</orderInfo><userName>${xmlEscape(
      config.username,
    )}</userName><password>${xmlEscape(config.password)}</password></SetOrder>`,
  );

  const resultCode = tag(xml, "ResultCode") ?? tag(xml, "OrderResultCode");
  const resultMessage =
    tag(xml, "ResultMessage") ?? tag(xml, "OrderResultMessage") ?? tag(xml, "Description");
  if (resultCode && resultCode !== "0" && !/basar|success|ok/i.test(resultMessage ?? "")) {
    throw new Error(`Aras Kargo gönderiyi kabul etmedi: ${resultMessage ?? resultCode}`);
  }

  return {
    integrationCode: input.integrationCode,
    trackingNumber: tag(xml, "CargoTrackingNumber") ?? tag(xml, "TrackingNumber"),
    message: resultMessage,
  };
}

export type ArasTracking = {
  trackingNumber: string | null;
  statusText: string | null;
  status: Database["public"]["Enums"]["shipment_status"];
  deliveredAt: string | null;
};

const DELIVERED = /teslim edildi|delivered|teslim_edildi/i;
const RETURNED = /iade|return/i;
const CANCELLED = /iptal|cancel/i;
const TRANSIT = /yolda|transfer|çıkış|cikis|dağıtım|dagitim|transit|şube|sube|kabul/i;

function mapStatus(text: string | null): Database["public"]["Enums"]["shipment_status"] {
  if (!text) return "pending";
  if (DELIVERED.test(text)) return "delivered";
  if (RETURNED.test(text)) return "returned";
  if (CANCELLED.test(text)) return "cancelled";
  if (TRANSIT.test(text)) return "in_transit";
  return "pending";
}

/** Entegrasyon koduna göre Aras'tan gönderi durumunu sorgular. */
export async function queryArasShipment(integrationCode: string): Promise<ArasTracking> {
  const config = readArasConfig();
  const xml = await soapCall(
    config.queryUrl,
    "GetQueryJSON",
    `<GetQueryJSON xmlns="http://tempuri.org/"><loginInfo><UserName>${xmlEscape(
      config.username,
    )}</UserName><Password>${xmlEscape(config.password)}</Password><CustomerCode>${xmlEscape(
      config.customerCode,
    )}</CustomerCode></loginInfo><queryInfo><QueryType>2</QueryType><Integration_Code>${xmlEscape(
      integrationCode,
    )}</Integration_Code></queryInfo></GetQueryJSON>`,
  );

  const statusText =
    tag(xml, "DURUMU") ??
    tag(xml, "CARGO_STATUS") ??
    tag(xml, "KARGO_DURUMU") ??
    tag(xml, "STATUS_DESCRIPTION") ??
    tag(xml, "Status");
  const trackingNumber =
    tag(xml, "KARGO_TAKIP_NO") ??
    tag(xml, "CARGO_TRACKING_NO") ??
    tag(xml, "TRACKINGNUMBER") ??
    tag(xml, "CargoTrackingNumber");
  const deliveryDate = tag(xml, "TESLIM_TARIHI") ?? tag(xml, "DELIVERY_DATE");
  const status = mapStatus(statusText);

  let deliveredAt: string | null = null;
  if (status === "delivered") {
    const parsed = deliveryDate ? new Date(deliveryDate) : null;
    deliveredAt =
      parsed && !Number.isNaN(parsed.getTime())
        ? parsed.toISOString()
        : new Date().toISOString();
  }

  return { trackingNumber, statusText, status, deliveredAt };
}

export function arasTrackingUrl(trackingNumber: string | null, integrationCode: string) {
  const code = trackingNumber || integrationCode;
  return `https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${encodeURIComponent(code)}`;
}

/**
 * Bekleyen/yolda olan Aras gönderilerini sorgular, takip numarası ve durumu günceller;
 * teslim edilenlerde siparişi "teslim edildi" durumuna geçirir ve müşteriye bilgi verir.
 */
export async function syncArasShipments(
  supabase: Client,
  options: { storeId?: string; limit?: number } = {},
) {
  let query = supabase
    .from("shipments")
    .select("id, store_id, order_id, tracking_number, status, note, shipped_at")
    .eq("carrier", ARAS_CARRIER)
    .in("status", ["pending", "in_transit"])
    .order("created_at", { ascending: true })
    .limit(options.limit ?? 50);
  if (options.storeId) query = query.eq("store_id", options.storeId);

  const { data: shipments, error } = await query;
  if (error) throw new Error(error.message);

  let checked = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const shipment of shipments ?? []) {
    const integrationCode = (shipment.note ?? "").trim() || shipment.tracking_number;
    if (!integrationCode) continue;
    checked += 1;
    try {
      const info = await queryArasShipment(integrationCode);
      const patch: Record<string, unknown> = {};
      if (info.trackingNumber && info.trackingNumber !== shipment.tracking_number) {
        patch["tracking_number"] = info.trackingNumber;
        patch["tracking_url"] = arasTrackingUrl(info.trackingNumber, integrationCode);
      }
      if (info.status !== shipment.status) {
        patch["status"] = info.status;
        if (info.status !== "pending" && !shipment.shipped_at) {
          patch["shipped_at"] = new Date().toISOString();
        }
        if (info.status === "delivered") patch["delivered_at"] = info.deliveredAt;
      }
      if (Object.keys(patch).length === 0) continue;

      const { error: updateError } = await supabase
        .from("shipments")
        .update(patch as never)
        .eq("id", shipment.id);
      if (updateError) throw new Error(updateError.message);
      updated += 1;

      const orderPatch: Record<string, unknown> = {};
      if (patch["tracking_number"]) {
        orderPatch["tracking_number"] = patch["tracking_number"];
        orderPatch["shipping_carrier"] = ARAS_CARRIER;
      }
      if (info.status === "in_transit") {
        orderPatch["status"] = "shipped";
        orderPatch["fulfillment_status"] = "fulfilled";
      }
      if (info.status === "delivered") {
        orderPatch["status"] = "delivered";
        orderPatch["fulfillment_status"] = "fulfilled";
      }
      if (Object.keys(orderPatch).length > 0) {
        await supabase.from("orders").update(orderPatch as never).eq("id", shipment.order_id);
      }

      await supabase.from("order_events").insert({
        order_id: shipment.order_id,
        store_id: shipment.store_id,
        kind: "shipment",
        message: `Aras Kargo durumu: ${info.statusText ?? info.status}`,
        meta: {
          shipment_id: shipment.id,
          status: info.status,
          tracking_number: info.trackingNumber ?? shipment.tracking_number,
        },
      } as never);

      if (info.status === "in_transit" || info.status === "delivered") {
        await notifyCustomer(supabase, shipment.store_id, shipment.order_id, info);
      }
    } catch (cause) {
      errors.push(cause instanceof Error ? cause.message : "bilinmeyen hata");
    }
  }

  return { checked, updated, errors };
}

/** Müşteriye kargo durumunu WhatsApp'tan bildirir; hata durumunda akışı bozmaz. */
async function notifyCustomer(
  supabase: Client,
  storeId: string,
  orderId: string,
  info: ArasTracking,
) {
  try {
    const { data: order } = await supabase
      .from("orders")
      .select("order_number, customer_name, customer_phone, customer_id")
      .eq("id", orderId)
      .maybeSingle();
    const phone = (order?.customer_phone ?? "").replace(/\D/g, "");
    if (!order || !phone) return;
    const waId = phone.startsWith("90") ? phone : `90${phone.replace(/^0/, "")}`;
    const { sendWhatsAppMessage } = await import("@/lib/whatsapp.server");
    const body =
      info.status === "delivered"
        ? `Merhaba, ${order.order_number} numaralı siparişiniz Aras Kargo ile teslim edildi. Bizi seçtiğiniz için teşekkürler.`
        : `Merhaba, ${order.order_number} numaralı siparişiniz Aras Kargo'ya teslim edildi. Takip numarası: ${
            info.trackingNumber ?? "-"
          }`;
    await sendWhatsAppMessage(supabase, {
      storeId,
      waId,
      body,
      contactName: order.customer_name,
      customerId: order.customer_id,
    });
  } catch {
    // Bildirim başarısız olsa da kargo güncellemesi geçerli kalır.
  }
}
