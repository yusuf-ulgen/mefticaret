/**
 * n11 entegrasyonu — bağımsız connector modülü.
 * Doküman: https://api.n11.com/rest
 */
import { defineMarketplaceConnector } from "../types";

export const n11Connector = defineMarketplaceConnector({
  code: "n11",
  name: "n11",
  kind: "marketplace",
  region: "TR",
  docsUrl: "https://api.n11.com/rest",
  baseUrl: "https://api.n11.com/ms",
  capabilities: ["listing", "price", "stock", "orders", "payments", "returns", "commission"],
  sellerIdLabel: "n11 mağaza kimliği",
  defaultCommissionRate: 0.11,
  credentialFields: [{ key: "api_key", label: "API anahtarı", secret: true }, { key: "api_secret", label: "API gizli anahtarı", secret: true }],
  notes: "REST API; appKey/appSecret başlıkla gönderilir.",
});

export default n11Connector;
