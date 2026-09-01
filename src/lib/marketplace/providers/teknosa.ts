/**
 * Teknosa entegrasyonu — bağımsız connector modülü.
 * Doküman: https://teknosa.com
 */
import { defineMarketplaceConnector } from "../types";

export const teknosaConnector = defineMarketplaceConnector({
  code: "teknosa",
  name: "Teknosa",
  kind: "marketplace",
  region: "TR",
  docsUrl: "https://teknosa.com",
  baseUrl: "https://mpapi.teknosa.com/v1",
  capabilities: ["listing", "price", "stock", "orders", "returns", "commission"],
  sellerIdLabel: "Satıcı kimliği",
  defaultCommissionRate: 0.12,
  credentialFields: [{ key: "api_key", label: "API anahtarı", secret: true }, { key: "api_secret", label: "API gizli anahtarı", secret: true }],
});

export default teknosaConnector;
