/**
 * Çiçeksepeti entegrasyonu — bağımsız connector modülü.
 * Doküman: https://apis.ciceksepeti.com
 */
import { defineMarketplaceConnector } from "../types";

export const ciceksepetiConnector = defineMarketplaceConnector({
  code: "ciceksepeti",
  name: "Çiçeksepeti",
  kind: "marketplace",
  region: "TR",
  docsUrl: "https://apis.ciceksepeti.com",
  baseUrl: "https://apis.ciceksepeti.com/api/v1",
  capabilities: ["listing", "price", "stock", "orders", "returns", "commission"],
  sellerIdLabel: "Satıcı kodu",
  defaultCommissionRate: 0.14,
  credentialFields: [{ key: "api_key", label: "API anahtarı", secret: true }, { key: "api_secret", label: "API gizli anahtarı", secret: true }],
});

export default ciceksepetiConnector;
