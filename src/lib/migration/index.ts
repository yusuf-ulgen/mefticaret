/**
 * Mağaza Taşıma sağlayıcı kayıt defteri.
 *
 * Yeni bir kaynak altyapı eklemek için `providers/<code>.ts` dosyası oluşturup
 * aşağıdaki listeye eklemek yeterlidir.
 */
import ikas from "./providers/ikas";
import {
  genericFeed,
  ideasoft,
  magento,
  opencart,
  prestashop,
  shopier,
  ticimax,
  tsoft,
} from "./providers/rest-providers";
import shopify from "./providers/shopify";
import wix from "./providers/wix";
import woocommerce from "./providers/woocommerce";
import type { MigrationProviderModule } from "./types";

export const MIGRATION_PROVIDERS: MigrationProviderModule[] = [
  shopify,
  ikas,
  wix,
  woocommerce,
  ticimax,
  ideasoft,
  tsoft,
  shopier,
  prestashop,
  opencart,
  magento,
  genericFeed,
];

export function getMigrationProvider(code: string): MigrationProviderModule | null {
  return MIGRATION_PROVIDERS.find((provider) => provider.code === code) ?? null;
}

export function requireMigrationProvider(code: string): MigrationProviderModule {
  const provider = getMigrationProvider(code);
  if (!provider) throw new Error(`Bilinmeyen taşıma kaynağı: ${code}`);
  return provider;
}

export * from "./types";
