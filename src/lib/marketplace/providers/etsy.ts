/**
 * Etsy entegrasyonu — bağımsız connector modülü.
 * Doküman: https://developers.etsy.com/documentation
 */
import { defineMarketplaceConnector } from "../types";

export const etsyConnector = defineMarketplaceConnector({
  code: "etsy",
  name: "Etsy",
  kind: "marketplace",
  region: "GLOBAL",
  docsUrl: "https://developers.etsy.com/documentation",
  baseUrl: "https://openapi.etsy.com/v3/application",
  capabilities: ["listing", "price", "stock", "orders", "payments", "commission"],
  sellerIdLabel: "Shop ID",
  defaultCommissionRate: 0.065,
  credentialFields: [{ key: "client_id", label: "Client ID", secret: true }, { key: "client_secret", label: "Client secret", secret: true }, { key: "refresh_token", label: "Refresh token", secret: true }],
  notes: "OAuth2 erişim tokenı gereklidir.",
});

export default etsyConnector;
