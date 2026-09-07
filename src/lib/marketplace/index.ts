/**
 * Pazaryeri connector kayıt defteri.
 *
 * Yeni bir entegrasyon eklemek için `providers/<code>.ts` dosyası oluşturup
 * aşağıdaki listeye eklemek yeterlidir; başka hiçbir dosya değişmez.
 */
import type {
  MarketplaceCapability,
  MarketplaceConnectorModule,
} from "./types";

import aliexpress from "./providers/aliexpress";
import amazon from "./providers/amazon";
import azall from "./providers/azall";
import ciceksepeti from "./providers/ciceksepeti";
import etsy from "./providers/etsy";
import hepsiburada from "./providers/hepsiburada";
import idefix from "./providers/idefix";
import ikas from "./providers/ikas";
import kmk from "./providers/kmk";
import koctas from "./providers/koctas";
import megabutik from "./providers/megabutik";
import n11 from "./providers/n11";
import opencart from "./providers/opencart";
import ozon from "./providers/ozon";
import pazarama from "./providers/pazarama";
import prestashop from "./providers/prestashop";
import pttavm from "./providers/pttavm";
import shopify from "./providers/shopify";
import teknosa from "./providers/teknosa";
import trendyol from "./providers/trendyol";
import vodafoneYanimda from "./providers/vodafone-yanimda";
import woocommerce from "./providers/woocommerce";

export const MARKETPLACE_CONNECTORS: MarketplaceConnectorModule[] = [
  trendyol,
  hepsiburada,
  n11,
  ciceksepeti,
  amazon,
  aliexpress,
  pttavm,
  pazarama,
  idefix,
  teknosa,
  koctas,
  kmk,
  megabutik,
  azall,
  vodafoneYanimda,
  ozon,
  etsy,
  shopify,
  woocommerce,
  opencart,
  prestashop,
  ikas,
];

export const CAPABILITY_LABELS: Record<MarketplaceCapability, string> = {
  listing: "Ürün listeleme",
  price: "Fiyat güncelleme",
  stock: "Stok takibi",
  orders: "Sipariş yönetimi",
  payments: "Ödeme entegrasyonu",
  returns: "İade yönetimi",
  commission: "Komisyon hesabı",
};

export function getMarketplaceConnector(code: string): MarketplaceConnectorModule | null {
  return MARKETPLACE_CONNECTORS.find((connector) => connector.code === code) ?? null;
}

export function requireMarketplaceConnector(code: string): MarketplaceConnectorModule {
  const connector = getMarketplaceConnector(code);
  if (!connector) throw new Error(`Bilinmeyen pazaryeri connector: ${code}`);
  return connector;
}

export function connectorSupports(code: string, capability: MarketplaceCapability): boolean {
  return getMarketplaceConnector(code)?.capabilities.includes(capability) ?? false;
}

export type { MarketplaceCapability, MarketplaceConnectorModule } from "./types";
export type {
  MarketplaceListingInput,
  MarketplacePricePayload,
  MarketplaceStockPayload,
  NormalizedMarketplaceOrder,
} from "./types";
