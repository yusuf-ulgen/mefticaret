/**
 * Ozon entegrasyonu — bağımsız connector modülü.
 * Doküman: https://docs.ozon.ru/api/seller
 */
import { defineMarketplaceConnector } from "../types";

export const ozonConnector = defineMarketplaceConnector({
  code: "ozon",
  name: "Ozon",
  kind: "marketplace",
  region: "GLOBAL",
  docsUrl: "https://docs.ozon.ru/api/seller",
  baseUrl: "https://api-seller.ozon.ru",
  capabilities: ["listing", "price", "stock", "orders", "payments", "commission"],
  sellerIdLabel: "Client-Id",
  defaultCommissionRate: 0.12,
  credentialFields: [{ key: "client_id", label: "Client-Id", secret: true }, { key: "api_key", label: "Api-Key", secret: true }],
  notes: "Client-Id ve Api-Key başlıkları kullanılır.",
});

export default ozonConnector;
