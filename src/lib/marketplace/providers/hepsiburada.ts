/**
 * Hepsiburada entegrasyonu — bağımsız connector modülü.
 * Doküman: https://developers.hepsiburada.com
 */
import { defineMarketplaceConnector } from "../types";

export const hepsiburadaConnector = defineMarketplaceConnector({
  code: "hepsiburada",
  name: "Hepsiburada",
  kind: "marketplace",
  region: "TR",
  docsUrl: "https://developers.hepsiburada.com",
  baseUrl: "https://mpop.hepsiburada.com",
  capabilities: ["listing", "price", "stock", "orders", "payments", "returns", "commission"],
  sellerIdLabel: "Merchant ID",
  defaultCommissionRate: 0.14,
  credentialFields: [{ key: "api_key", label: "API anahtarı", secret: true }, { key: "api_secret", label: "API gizli anahtarı", secret: true }],
  notes: "Listing ve stok/fiyat servisleri ayrıdır.",
});

export default hepsiburadaConnector;
