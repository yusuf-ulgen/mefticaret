/**
 * AliExpress entegrasyonu — bağımsız connector modülü.
 * Doküman: https://openservice.aliexpress.com
 */
import { defineMarketplaceConnector } from "../types";

export const aliexpressConnector = defineMarketplaceConnector({
  code: "aliexpress",
  name: "AliExpress",
  kind: "marketplace",
  region: "GLOBAL",
  docsUrl: "https://openservice.aliexpress.com",
  baseUrl: "https://api-sg.aliexpress.com/sync",
  capabilities: ["listing", "price", "stock", "orders", "returns"],
  sellerIdLabel: "Satıcı kimliği",
  defaultCommissionRate: 0.08,
  credentialFields: [{ key: "client_id", label: "Client ID", secret: true }, { key: "client_secret", label: "Client secret", secret: true }, { key: "refresh_token", label: "Refresh token", secret: true }],
  notes: "Sistem imzası (sign) taşıyıcı katmanında üretilir.",
});

export default aliexpressConnector;
