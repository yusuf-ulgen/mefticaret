/**
 * Vodafone Yanımda entegrasyonu — bağımsız connector modülü.
 * Doküman: https://vodafone.com.tr
 */
import { defineMarketplaceConnector } from "../types";

export const vodafoneYanimdaConnector = defineMarketplaceConnector({
  code: "vodafone_yanimda",
  name: "Vodafone Yanımda",
  kind: "marketplace",
  region: "TR",
  docsUrl: "https://vodafone.com.tr",
  baseUrl: "https://api.vfmarket.com.tr/v1",
  capabilities: ["listing", "price", "stock", "orders"],
  sellerIdLabel: "Satıcı kimliği",
  defaultCommissionRate: 0.12,
  credentialFields: [{ key: "api_key", label: "API anahtarı", secret: true }, { key: "api_secret", label: "API gizli anahtarı", secret: true }],
});

export default vodafoneYanimdaConnector;
