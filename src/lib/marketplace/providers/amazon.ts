/**
 * Amazon entegrasyonu — bağımsız connector modülü.
 * Doküman: https://developer-docs.amazon.com/sp-api
 */
import { defineMarketplaceConnector } from "../types";

export const amazonConnector = defineMarketplaceConnector({
  code: "amazon",
  name: "Amazon",
  kind: "marketplace",
  region: "GLOBAL",
  docsUrl: "https://developer-docs.amazon.com/sp-api",
  baseUrl: "https://sellingpartnerapi-eu.amazon.com",
  capabilities: ["listing", "price", "stock", "orders", "payments", "returns", "commission"],
  sellerIdLabel: "Seller ID",
  defaultCommissionRate: 0.15,
  credentialFields: [{ key: "client_id", label: "Client ID", secret: true }, { key: "client_secret", label: "Client secret", secret: true }, { key: "refresh_token", label: "Refresh token", secret: true }],
  notes: "SP-API; LWA token yenilemesi sunucu tarafında yapılır.",
});

export default amazonConnector;
