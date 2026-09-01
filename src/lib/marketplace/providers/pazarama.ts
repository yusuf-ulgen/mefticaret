/**
 * Pazarama entegrasyonu — bağımsız connector modülü.
 * Doküman: https://isortagimapi.pazarama.com
 */
import { defineMarketplaceConnector } from "../types";

export const pazaramaConnector = defineMarketplaceConnector({
  code: "pazarama",
  name: "Pazarama",
  kind: "marketplace",
  region: "TR",
  docsUrl: "https://isortagimapi.pazarama.com",
  baseUrl: "https://isortagimapi.pazarama.com",
  capabilities: ["listing", "price", "stock", "orders", "returns", "commission"],
  sellerIdLabel: "Satıcı kimliği",
  defaultCommissionRate: 0.12,
  credentialFields: [{ key: "api_key", label: "API anahtarı", secret: true }, { key: "api_secret", label: "API gizli anahtarı", secret: true }],
});

export default pazaramaConnector;
