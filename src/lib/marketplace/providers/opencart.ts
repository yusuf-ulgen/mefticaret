/**
 * OpenCart entegrasyonu — bağımsız connector modülü.
 * Doküman: https://docs.opencart.com
 */
import { defineMarketplaceConnector } from "../types";

export const opencartConnector = defineMarketplaceConnector({
  code: "opencart",
  name: "OpenCart",
  kind: "platform",
  region: "GLOBAL",
  docsUrl: "https://docs.opencart.com",
  baseUrl: "https://magazan.com/index.php?route=api",
  capabilities: ["listing", "price", "stock", "orders"],
  sellerIdLabel: "API kullanıcısı",
  defaultCommissionRate: 0.0,
  credentialFields: [{ key: "store_url", label: "Mağaza adresi", secret: false }, { key: "api_key", label: "Webservice/API anahtarı", secret: true }],
  notes: "Kendi mağazan; base URL mağaza adresine göre değişir.",
});

export default opencartConnector;
