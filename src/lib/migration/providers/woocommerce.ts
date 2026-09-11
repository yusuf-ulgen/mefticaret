/** WooCommerce / WordPress taşıma adaptörü (WC REST v3 + WP REST v2). */
import type { MigrationEntity, MigrationProviderModule } from "../types";
import { asArray, asRecord } from "../types";
import { defineRestProvider, genericNormalize } from "./shared";

const WC_PATHS: Partial<Record<MigrationEntity, string>> = {
  category: "/wp-json/wc/v3/products/categories",
  product: "/wp-json/wc/v3/products",
  customer: "/wp-json/wc/v3/customers",
  order: "/wp-json/wc/v3/orders",
  post: "/wp-json/wp/v2/posts",
  page: "/wp-json/wp/v2/pages",
};

const base = defineRestProvider({
  code: "woocommerce",
  name: "WooCommerce / WordPress",
  region: "Global",
  docsUrl: "https://woocommerce.github.io/woocommerce-rest-api-docs/",
  howTo:
    "WooCommerce → Ayarlar → Gelişmiş → REST API bölümünden salt okunur bir anahtar çifti oluşturun (Consumer key ve Consumer secret). Blog ve sayfalar WordPress REST API üzerinden okunur.",
  entities: ["category", "product", "customer", "order", "post", "page"],
  credentialFields: [
    { key: "api_key", label: "Consumer key (ck_...)", secret: true, placeholder: "ck_..." },
    { key: "api_secret", label: "Consumer secret (cs_...)", secret: true, placeholder: "cs_..." },
  ],
  probePath: "/wp-json/wc/v3/system_status",
  paths: WC_PATHS,
  extraQuery: { order: { status: "any" }, post: { status: "publish,draft" }, page: { status: "publish,draft" } },
});

const woocommerce: MigrationProviderModule = {
  ...base,
  extract: (_entity, body) => ({
    rows: Array.isArray(body) ? body.map((row) => asRecord(row)) : asArray(asRecord(body)["data"] ?? []),
  }),
  normalize: genericNormalize,
};

export default woocommerce;
