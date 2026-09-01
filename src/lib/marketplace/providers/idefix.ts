/**
 * İdefix entegrasyonu — bağımsız connector modülü.
 * Doküman: https://idefix.com
 */
import { defineMarketplaceConnector } from "../types";

export const idefixConnector = defineMarketplaceConnector({
  code: "idefix",
  name: "İdefix",
  kind: "marketplace",
  region: "TR",
  docsUrl: "https://idefix.com",
  baseUrl: "https://merchantapi.idefix.com",
  capabilities: ["listing", "price", "stock", "orders", "returns"],
  sellerIdLabel: "Satıcı kimliği",
  defaultCommissionRate: 0.13,
  credentialFields: [{ key: "api_key", label: "API anahtarı", secret: true }, { key: "api_secret", label: "API gizli anahtarı", secret: true }],
});

export default idefixConnector;
