/**
 * Trendyol entegrasyonu — bağımsız connector modülü.
 * Doküman: https://developers.trendyol.com
 */
import { defineMarketplaceConnector } from "../types";

export const trendyolConnector = defineMarketplaceConnector({
  code: "trendyol",
  name: "Trendyol",
  kind: "marketplace",
  region: "TR",
  docsUrl: "https://developers.trendyol.com",
  baseUrl: "https://api.trendyol.com/sapigw",
  capabilities: ["listing", "price", "stock", "orders", "payments", "returns", "commission"],
  sellerIdLabel: "Satıcı (supplier) kimliği",
  defaultCommissionRate: 0.15,
  credentialFields: [{ key: "api_key", label: "API anahtarı", secret: true }, { key: "api_secret", label: "API gizli anahtarı", secret: true }],
  notes: "Fiyat ve stok tek uç noktadan toplu güncellenir.",
});

export default trendyolConnector;
