/**
 * KMK entegrasyonu — bağımsız connector modülü.
 * Doküman: https://kmk.com.tr
 */
import { defineMarketplaceConnector } from "../types";

export const kmkConnector = defineMarketplaceConnector({
  code: "kmk",
  name: "KMK",
  kind: "marketplace",
  region: "TR",
  docsUrl: "https://kmk.com.tr",
  baseUrl: "https://api.kmk.com.tr/v1",
  capabilities: ["listing", "price", "stock", "orders"],
  sellerIdLabel: "Satıcı kimliği",
  defaultCommissionRate: 0.1,
  credentialFields: [{ key: "api_key", label: "API anahtarı", secret: true }, { key: "api_secret", label: "API gizli anahtarı", secret: true }],
});

export default kmkConnector;
