/**
 * Shopify entegrasyonu — bağımsız connector modülü.
 * Doküman: https://shopify.dev/docs/api/admin-rest
 */
import { defineMarketplaceConnector } from "../types";

export const shopifyConnector = defineMarketplaceConnector({
  code: "shopify",
  name: "Shopify",
  kind: "platform",
  region: "GLOBAL",
  docsUrl: "https://shopify.dev/docs/api/admin-rest",
  baseUrl: "https://magazan.myshopify.com/admin/api/2024-10",
  capabilities: ["listing", "price", "stock", "orders", "payments"],
  sellerIdLabel: "Shop domain",
  defaultCommissionRate: 0.0,
  credentialFields: [{ key: "shop_domain", label: "Shop domain", secret: false }, { key: "access_token", label: "Admin API access token", secret: true }],
  notes: "Admin API access token ile bağlanır.",
});

export default shopifyConnector;
