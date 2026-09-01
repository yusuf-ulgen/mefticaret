/**
 * Koçtaş entegrasyonu — bağımsız connector modülü.
 * Doküman: https://koctas.com.tr
 */
import { defineMarketplaceConnector } from "../types";

export const koctasConnector = defineMarketplaceConnector({
  code: "koctas",
  name: "Koçtaş",
  kind: "marketplace",
  region: "TR",
  docsUrl: "https://koctas.com.tr",
  baseUrl: "https://api.koctas.com.tr/marketplace/v1",
  capabilities: ["listing", "price", "stock", "orders", "returns", "commission"],
  sellerIdLabel: "Satıcı kimliği",
  defaultCommissionRate: 0.13,
  credentialFields: [{ key: "api_key", label: "API anahtarı", secret: true }, { key: "api_secret", label: "API gizli anahtarı", secret: true }],
});

export default koctasConnector;
