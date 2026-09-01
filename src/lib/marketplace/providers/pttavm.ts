/**
 * PTT AVM entegrasyonu — bağımsız connector modülü.
 * Doküman: https://ptt-avm.gitbook.io
 */
import { defineMarketplaceConnector } from "../types";

export const pttavmConnector = defineMarketplaceConnector({
  code: "pttavm",
  name: "PTT AVM",
  kind: "marketplace",
  region: "TR",
  docsUrl: "https://ptt-avm.gitbook.io",
  baseUrl: "https://ecommerceapi.pttavm.com",
  capabilities: ["listing", "price", "stock", "orders", "returns"],
  sellerIdLabel: "Satıcı kodu",
  defaultCommissionRate: 0.1,
  credentialFields: [{ key: "api_key", label: "API anahtarı", secret: true }, { key: "api_secret", label: "API gizli anahtarı", secret: true }],
});

export default pttavmConnector;
