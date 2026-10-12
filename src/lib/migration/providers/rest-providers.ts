/**
 * Ortak REST sözleşmesine sahip altyapılar.
 *
 * Alan adları `genericNormalize` tarafından tanınır; farklılıklar
 * `paths`/`rowsKey`/`extraQuery` ile yapılandırılır.
 */
import type { MigrationEntity, MigrationProviderModule } from "../types";
import { asArray, asRecord } from "../types";
import { defineRestProvider, genericNormalize } from "./shared";

export const ticimax = defineRestProvider({
  code: "ticimax",
  name: "Ticimax",
  region: "Türkiye",
  docsUrl: "https://developer.ticimax.com/",
  howTo:
    "Ticimax panelinde Entegrasyonlar → Web Servis bölümünden servis kullanıcı kodunuzu (API key) oluşturun. Ürün, müşteri ve sipariş servislerine okuma izni verin.",
  entities: ["category", "product", "customer", "order"],
  credentialFields: [{ key: "api_key", label: "Web servis anahtarı", secret: true }],
  probePath: "/servis/UrunServis.svc/json/SelectUrun",
  paths: {
    category: "/servis/UrunServis.svc/json/SelectKategori",
    product: "/servis/UrunServis.svc/json/SelectUrun",
    customer: "/servis/UyeServis.svc/json/SelectUye",
    order: "/servis/SiparisServis.svc/json/SelectSiparis",
  },
  pageParam: "SayfaNo",
  perPageParam: "KayitSayisi",
});

export const shopier = defineRestProvider({
  code: "shopier",
  name: "Shopier",
  region: "Türkiye",
  docsUrl: "https://www.shopier.com/",
  howTo:
    "Shopier panelinde Ayarlar → API bölümünden API anahtarı ve gizli anahtarı oluşturun. Shopier yalnızca ürün ve sipariş verisi sunar.",
  entities: ["product", "order"],
  probePath: "/api/v1/products",
  paths: { product: "/api/v1/products", order: "/api/v1/orders" },
  baseUrl: () => "https://www.shopier.com",
});

export const ideasoft = defineRestProvider({
  code: "ideasoft",
  name: "IdeaSoft",
  region: "Türkiye",
  docsUrl: "https://developerdocs.ideasoft.com.tr/",
  howTo:
    "IdeaSoft panelinde Ayarlar → API Yönetimi bölümünden bir uygulama oluşturup erişim tokenı alın (products, customers, orders okuma izni).",
  entities: ["category", "product", "customer", "order", "page"],
  credentialFields: [{ key: "api_key", label: "Erişim tokenı", secret: true }],
  probePath: "/api/categories",
  paths: {
    category: "/api/categories",
    product: "/api/products",
    customer: "/api/customers",
    order: "/api/orders",
    page: "/api/contents",
  },
  perPageParam: "limit",
});

export const tsoft = defineRestProvider({
  code: "tsoft",
  name: "T-Soft",
  region: "Türkiye",
  docsUrl: "https://apidoc.tsoft.com.tr/",
  howTo:
    "T-Soft panelinde Ayarlar → Servis Kullanıcıları bölümünden bir API kullanıcısı oluşturun; kullanıcı adı ve şifresini girin.",
  entities: ["category", "product", "customer", "order"],
  credentialFields: [
    { key: "api_key", label: "Servis kullanıcı adı", secret: true },
    { key: "api_secret", label: "Servis şifresi", secret: true },
  ],
  probePath: "/rest1/category/get",
  paths: {
    category: "/rest1/category/get",
    product: "/rest1/product/get",
    customer: "/rest1/customer/get",
    order: "/rest1/order/get",
  },
  pageParam: "start",
  perPageParam: "limit",
  rowsKey: { category: "data", product: "data", customer: "data", order: "data" },
});

export const prestashop = defineRestProvider({
  code: "prestashop",
  name: "PrestaShop",
  region: "Global",
  docsUrl: "https://devdocs.prestashop-project.org/8/webservice/",
  howTo:
    "PrestaShop yönetiminde Gelişmiş Parametreler → Web Servisi bölümünden bir anahtar oluşturun ve ilgili kaynaklara GET izni verin.",
  entities: ["category", "product", "customer", "order"],
  credentialFields: [{ key: "api_key", label: "Web servis anahtarı", secret: true }],
  authHeaders: (credentials) => ({
    Authorization: `Basic ${btoa(`${credentials["api_key"] ?? ""}:`)}`,
  }),
  probePath: "/api/categories",
  paths: {
    category: "/api/categories",
    product: "/api/products",
    customer: "/api/customers",
    order: "/api/orders",
  },
  perPageParam: "limit",
  extraQuery: {
    category: { output_format: "JSON", display: "full" },
    product: { output_format: "JSON", display: "full" },
    customer: { output_format: "JSON", display: "full" },
    order: { output_format: "JSON", display: "full" },
  },
  rowsKey: { category: "categories", product: "products", customer: "customers", order: "orders" },
});

export const opencart = defineRestProvider({
  code: "opencart",
  name: "OpenCart",
  region: "Global",
  docsUrl: "https://docs.opencart.com/",
  howTo:
    "OpenCart yönetiminde Sistem → Kullanıcılar → API bölümünden bir API kullanıcısı ve anahtarı oluşturun; REST köprü eklentisi kuruluysa ürün ve sipariş verisi okunabilir.",
  entities: ["category", "product", "customer", "order"],
  probePath: "/index.php?route=api/product/list",
  paths: {
    category: "/index.php?route=api/category/list",
    product: "/index.php?route=api/product/list",
    customer: "/index.php?route=api/customer/list",
    order: "/index.php?route=api/order/list",
  },
  perPageParam: "limit",
  rowsKey: { category: "categories", product: "products", customer: "customers", order: "orders" },
});

export const magento = defineRestProvider({
  code: "magento",
  name: "Magento / Adobe Commerce",
  region: "Global",
  docsUrl: "https://developer.adobe.com/commerce/webapi/rest/",
  howTo:
    "Magento yönetiminde Sistem → Entegrasyonlar bölümünden bir entegrasyon oluşturup erişim tokenını alın (catalog, customers, sales okuma izni).",
  entities: ["category", "product", "customer", "order", "page"],
  credentialFields: [{ key: "api_key", label: "Erişim tokenı", secret: true }],
  probePath: "/rest/V1/store/storeConfigs",
  paths: {
    category: "/rest/V1/categories/list",
    product: "/rest/V1/products",
    customer: "/rest/V1/customers/search",
    order: "/rest/V1/orders",
    page: "/rest/V1/cmsPage/search",
  },
  pageParam: "searchCriteria[currentPage]",
  perPageParam: "searchCriteria[pageSize]",
  rowsKey: { category: "items", product: "items", customer: "items", order: "items", page: "items" },
});

/** CSV/XML besleme: tek sayfalık dış kaynak (ürün odaklı). */
const feedBase = defineRestProvider({
  code: "generic-feed",
  name: "CSV / XML besleme",
  region: "Global",
  docsUrl: "https://mefticaret.com/sayfa/hakkimizda",
  howTo:
    "Kaynak alanına ürün beslemesinin tam adresini yazın (JSON, CSV veya XML). Kimlik bilgisi gerekmiyorsa alanları boş bırakın.",
  entities: ["product"],
  credentialFields: [{ key: "api_key", label: "Erişim anahtarı (varsa)", secret: true, optional: true }],
  probePath: "",
  paths: { product: "" },
});

export const genericFeed: MigrationProviderModule = {
  ...feedBase,
  authHeaders: (credentials) =>
    credentials["api_key"] ? { Authorization: `Bearer ${credentials["api_key"]}` } : {},
  pageRequest: (entity, cursor) => (entity === "product" && cursor.page === 1 ? { method: "GET", path: "" } : null),
  extract: (_entity, body) => {
    if (Array.isArray(body)) return { rows: body.map((row) => asRecord(row)) };
    const record = asRecord(body);
    const firstArray = Object.values(record).find((value) => Array.isArray(value));
    return { rows: asArray(firstArray ?? []) };
  },
  normalize: (entity: MigrationEntity, raw) => genericNormalize(entity, raw),
};
