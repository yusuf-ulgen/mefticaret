/**
 * PrestaShop entegrasyonu — bağımsız connector modülü.
 * Doküman: https://devdocs.prestashop-project.org
 */
import { defineMarketplaceConnector } from "../types";

export const prestashopConnector = defineMarketplaceConnector({
  code: "prestashop",
  name: "PrestaShop",
  kind: "platform",
  region: "GLOBAL",
  docsUrl: "https://devdocs.prestashop-project.org",
  baseUrl: "https://magazan.com/api",
  capabilities: ["listing", "price", "stock", "orders"],
  sellerIdLabel: "Webservice anahtarı",
  defaultCommissionRate: 0.0,
  credentialFields: [{ key: "store_url", label: "Mağaza adresi", secret: false }, { key: "api_key", label: "Webservice/API anahtarı", secret: true }],
  notes: "Webservice XML tabanlıdır; taşıyıcı katman dönüşümü yapar.",
});

export default prestashopConnector;
