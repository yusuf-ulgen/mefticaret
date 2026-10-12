/**
 * Azall entegrasyonu — bağımsız connector modülü.
 * Doküman: https://azall.com
 */
import { defineMarketplaceConnector } from "../types";

export const azallConnector = defineMarketplaceConnector({
  code: "azall",
  name: "Azall",
  kind: "marketplace",
  region: "TR",
  docsUrl: "https://azall.com",
  baseUrl: "https://api.azall.com/v1",
  capabilities: ["listing", "price", "stock", "orders"],
  sellerIdLabel: "Satıcı kimliği",
  defaultCommissionRate: 0.1,
  credentialFields: [{ key: "api_key", label: "API anahtarı", secret: true }, { key: "api_secret", label: "API gizli anahtarı", secret: true }],
});

export default azallConnector;
