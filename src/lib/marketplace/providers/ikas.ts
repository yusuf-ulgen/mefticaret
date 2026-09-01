/**
 * İkas entegrasyonu — bağımsız connector modülü.
 * Doküman: https://ikas.dev
 */
import { defineMarketplaceConnector } from "../types";

export const ikasConnector = defineMarketplaceConnector({
  code: "ikas",
  name: "İkas",
  kind: "platform",
  region: "TR",
  docsUrl: "https://ikas.dev",
  baseUrl: "https://api.myikas.com/api/v1/admin",
  capabilities: ["listing", "price", "stock", "orders", "payments"],
  sellerIdLabel: "Mağaza kimliği",
  defaultCommissionRate: 0.0,
  credentialFields: [{ key: "client_id", label: "Client ID", secret: true }, { key: "client_secret", label: "Client secret", secret: true }, { key: "refresh_token", label: "Refresh token", secret: true }],
  notes: "GraphQL Admin API; taşıyıcı katman sorgu üretir.",
});

export default ikasConnector;
