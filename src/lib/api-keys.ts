/** API sistemi sabitleri: sürümler, scope izinleri ve kaynak tanımları. */

export const API_VERSIONS = ["v1", "v2"] as const;
export type ApiVersion = (typeof API_VERSIONS)[number];

export const API_SCOPES = [
  "read_products",
  "write_products",
  "read_orders",
  "write_orders",
  "read_customers",
  "write_customers",
  "read_inventory",
  "write_inventory",
  "read_store",
  "read_categories",
  "read_payments",
  "read_shipping",
  "read_analytics",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export const API_SCOPE_LABELS: Record<ApiScope, string> = {
  read_products: "Ürünleri oku",
  write_products: "Ürünleri yaz",
  read_orders: "Siparişleri oku",
  write_orders: "Siparişleri yaz",
  read_customers: "Müşterileri oku",
  write_customers: "Müşterileri yaz",
  read_inventory: "Stokları oku",
  write_inventory: "Stokları yaz",
  read_store: "Mağaza bilgisini oku",
  read_categories: "Kategorileri oku",
  read_payments: "Ödeme yöntemlerini oku",
  read_shipping: "Kargo tarifelerini oku",
  read_analytics: "Analitik verilerini oku",
};

export const API_RESOURCES = [
  { path: "products", label: "Ürünler", read: "read_products", write: "write_products" },
  { path: "orders", label: "Siparişler", read: "read_orders", write: "write_orders" },
  { path: "customers", label: "Müşteriler", read: "read_customers", write: "write_customers" },
  { path: "inventory", label: "Stok", read: "read_inventory", write: "write_inventory" },
  { path: "store", label: "Mağaza", read: "read_store", write: null },
  { path: "categories", label: "Kategoriler", read: "read_categories", write: null },
  { path: "payments", label: "Ödeme yöntemleri", read: "read_payments", write: null },
  { path: "shipping", label: "Kargo tarifeleri", read: "read_shipping", write: null },
] as const;
