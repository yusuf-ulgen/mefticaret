/**
 * MegaButik entegrasyonu — bağımsız connector modülü.
 * Doküman: https://panel.megabutik.com
 */
import { defineMarketplaceConnector } from "../types";

export const megabutikConnector = defineMarketplaceConnector({
  code: "megabutik",
  name: "MegaButik",
  kind: "marketplace",
  region: "TR",
  docsUrl: "https://panel.megabutik.com",
  baseUrl: "https://api.megabutik.com",
  capabilities: ["listing", "price", "stock", "orders", "payments", "returns", "commission"],
  sellerIdLabel: "Satıcı ID",
  defaultCommissionRate: 0.1,
  credentialFields: [
    { key: "api_key", label: "API anahtarı", secret: true },
    { key: "api_secret", label: "API gizli anahtarı", secret: true },
  ],
  notes: "MegaButik satıcı API'si ile ürün, stok, fiyat ve sipariş senkronizasyonu.",
});

export default megabutikConnector;
