/**
 * WooCommerce entegrasyonu — bağımsız connector modülü.
 * Doküman: https://woocommerce.github.io/woocommerce-rest-api-docs
 */
import { defineMarketplaceConnector } from "../types";

export const woocommerceConnector = defineMarketplaceConnector({
  code: "woocommerce",
  name: "WooCommerce",
  kind: "platform",
  region: "GLOBAL",
  docsUrl: "https://woocommerce.github.io/woocommerce-rest-api-docs",
  baseUrl: "https://magazan.com/wp-json/wc/v3",
  capabilities: ["listing", "price", "stock", "orders", "payments"],
  sellerIdLabel: "Consumer key",
  defaultCommissionRate: 0.0,
  credentialFields: [{ key: "store_url", label: "Mağaza adresi", secret: false }, { key: "consumer_key", label: "Consumer key", secret: true }, { key: "consumer_secret", label: "Consumer secret", secret: true }],
  notes: "Kendi WordPress mağazan; consumer key/secret ile bağlanır.",
});

export default woocommerceConnector;
