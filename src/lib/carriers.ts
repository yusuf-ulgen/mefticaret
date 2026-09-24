/** Kargo firmaları — istemci ve sunucuda ortak. */

export const CARRIERS = [
  { key: "yurtici", name: "Yurtiçi Kargo", trackUrl: "https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code={n}" },
  { key: "aras", name: "Aras Kargo", trackUrl: "https://kargotakip.araskargo.com.tr/mainpage.aspx?code={n}" },
  { key: "mng", name: "MNG Kargo", trackUrl: "https://www.mngkargo.com.tr/gonderi-takip/?takipNo={n}" },
  { key: "ptt", name: "PTT Kargo", trackUrl: "https://gonderitakip.ptt.gov.tr/Track/Verify?q={n}" },
  { key: "surat", name: "Sürat Kargo", trackUrl: "https://suratkargo.com.tr/KargoTakip/?kargotakipno={n}" },
  { key: "dhl", name: "DHL", trackUrl: "https://www.dhl.com/tr-tr/home/tracking.html?tracking-id={n}" },
  { key: "ups", name: "UPS", trackUrl: "https://www.ups.com/track?tracknum={n}" },
  { key: "fedex", name: "FedEx", trackUrl: "https://www.fedex.com/fedextrack/?trknbr={n}" },
] as const;

export type CarrierKey = (typeof CARRIERS)[number]["key"];
export const CARRIER_KEYS = CARRIERS.map((c) => c.key) as [CarrierKey, ...CarrierKey[]];

/** Gerçek API bağlantısı olan firmalar (diğerleri elle güncellenir). */
export const API_CARRIERS: CarrierKey[] = ["aras"];

export function carrierName(key: string | null | undefined, fallback?: string | null) {
  return CARRIERS.find((c) => c.key === key)?.name ?? fallback ?? "Kargo";
}

export function carrierTrackUrl(key: string | null | undefined, tracking: string) {
  const c = CARRIERS.find((x) => x.key === key);
  return c ? c.trackUrl.replace("{n}", encodeURIComponent(tracking)) : null;
}

/** Serbest metin firma adından anahtar tahmini (eski kayıtlar için). */
export function guessCarrierKey(name: string | null | undefined): CarrierKey | null {
  const n = (name ?? "").toLocaleLowerCase("tr");
  if (n.includes("yurti")) return "yurtici";
  if (n.includes("aras")) return "aras";
  if (n.includes("mng")) return "mng";
  if (n.includes("ptt")) return "ptt";
  if (n.includes("sürat") || n.includes("surat")) return "surat";
  if (n.includes("dhl")) return "dhl";
  if (n.includes("ups")) return "ups";
  if (n.includes("fedex")) return "fedex";
  return null;
}

export const SHIPMENT_STATUSES = [
  "pending",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "failed",
  "returned",
  "cancelled",
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> & Record<string, string> = {
  pending: "Hazırlanıyor",
  picked_up: "Kargoya verildi",
  in_transit: "Yolda",
  out_for_delivery: "Dağıtımda",
  delivered: "Teslim edildi",
  failed: "Teslim edilemedi",
  returned: "İade edildi",
  cancelled: "İptal edildi",
};

export const ACTIVE_SHIPMENT_STATUSES: ShipmentStatus[] = ["pending", "picked_up", "in_transit", "out_for_delivery"];
