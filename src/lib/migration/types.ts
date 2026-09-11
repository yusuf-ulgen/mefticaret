/**
 * Mağaza Taşıma (store migration) sözleşmesi.
 *
 * Her kaynak altyapı `src/lib/migration/providers/<code>.ts` altında saf bir
 * modül olarak tanımlanır: HTTP çağrısı yapmaz, yalnızca sayfalama isteği
 * üretir ve gelen ham kaydı ortak modele normalize eder. Gerçek istekler
 * sunucu tarafındaki taşıyıcı katmanında (`migration.server.ts`) yapılır.
 */

export type MigrationEntity =
  | "category"
  | "product"
  | "customer"
  | "order"
  | "post"
  | "page";

export const MIGRATION_ENTITIES: MigrationEntity[] = [
  "category",
  "product",
  "customer",
  "order",
  "post",
  "page",
];

export const ENTITY_LABELS: Record<MigrationEntity, string> = {
  category: "Kategoriler",
  product: "Ürünler (varyant, stok, görsel, SEO)",
  customer: "Müşteriler ve adresler",
  order: "Siparişler ve kalemleri",
  post: "Blog yazıları",
  page: "İçerik sayfaları",
};

/** Taşıma sırası — bağımlılıklar bu sırayla çözülür. */
export const ENTITY_ORDER: MigrationEntity[] = [
  "category",
  "product",
  "customer",
  "order",
  "post",
  "page",
];

export interface MigrationCredentialField {
  key: string;
  label: string;
  secret?: boolean;
  optional?: boolean;
  placeholder?: string;
}

export interface MigrationRequestSpec {
  method: "GET" | "POST";
  /** Base URL'e eklenecek yol. */
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface MigrationPageCursor {
  /** 1 tabanlı sayfa numarası. */
  page: number;
  /** İmleç tabanlı sayfalama kullanan sağlayıcılar için. */
  cursor?: string | null;
}

export interface MigrationExtractResult {
  rows: Record<string, unknown>[];
  nextCursor?: string | null;
}

export interface NormalizedCategory {
  externalId: string;
  name: string;
  slug: string | null;
  description: string | null;
  imageUrl: string | null;
  parentExternalId: string | null;
  sortOrder: number;
  isActive: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface NormalizedVariant {
  externalId: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  compareAtPrice: number | null;
  costPrice: number | null;
  stock: number;
  weightGrams: number | null;
  options: Record<string, string>;
}

export interface NormalizedProduct {
  externalId: string;
  title: string;
  slug: string | null;
  description: string | null;
  status: "draft" | "active" | "archived";
  vendor: string | null;
  productType: string | null;
  tags: string[];
  basePrice: number;
  compareAtPrice: number | null;
  costPrice: number | null;
  currency: string | null;
  sku: string | null;
  barcode: string | null;
  weightGrams: number | null;
  taxRate: number | null;
  images: { url: string; alt: string | null }[];
  variants: NormalizedVariant[];
  categoryExternalIds: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  /** Kaynak altyapıdaki ürün adresi — 301 yönlendirme için. */
  sourcePath: string | null;
}

export interface NormalizedAddress {
  label: string | null;
  recipient: string;
  phone: string | null;
  country: string;
  city: string | null;
  district: string | null;
  line1: string;
  line2: string | null;
  postalCode: string | null;
  isDefault: boolean;
}

export interface NormalizedCustomer {
  externalId: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  acceptsMarketing: boolean;
  notes: string | null;
  tags: string[];
  totalSpent: number;
  ordersCount: number;
  createdAt: string | null;
  addresses: NormalizedAddress[];
}

export interface NormalizedOrderItem {
  title: string;
  variantTitle: string | null;
  sku: string | null;
  barcode: string | null;
  productExternalId: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  taxRate: number;
  taxTotal: number;
}

export interface NormalizedOrder {
  externalId: string;
  orderNumber: string;
  status:
    | "pending"
    | "awaiting_payment"
    | "paid"
    | "processing"
    | "packed"
    | "shipped"
    | "delivered"
    | "cancelled"
    | "returned"
    | "refunded";
  paymentStatus: "pending" | "paid" | "partially_refunded" | "refunded" | "failed";
  fulfillmentStatus: "unfulfilled" | "partially_fulfilled" | "fulfilled" | "returned";
  currency: string;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  grandTotal: number;
  discountCode: string | null;
  customerExternalId: string | null;
  customerEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  shippingAddress: Record<string, unknown>;
  billingAddress: Record<string, unknown>;
  shippingCarrier: string | null;
  trackingNumber: string | null;
  note: string | null;
  placedAt: string;
  items: NormalizedOrderItem[];
}

export interface NormalizedContent {
  externalId: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  coverUrl: string | null;
  authorName: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  sourcePath: string | null;
}

export type NormalizedRecord =
  | { entity: "category"; data: NormalizedCategory }
  | { entity: "product"; data: NormalizedProduct }
  | { entity: "customer"; data: NormalizedCustomer }
  | { entity: "order"; data: NormalizedOrder }
  | { entity: "post"; data: NormalizedContent }
  | { entity: "page"; data: NormalizedContent };

export interface MigrationProviderModule {
  code: string;
  name: string;
  region: string;
  docsUrl: string;
  /** Kısa kurulum açıklaması (kullanıcıya gösterilir). */
  howTo: string;
  entities: MigrationEntity[];
  credentialFields: MigrationCredentialField[];
  /** Mağaza adresinden API kök adresi üretir. */
  baseUrl: (input: { shopDomain: string; credentials: Record<string, string> }) => string;
  authHeaders: (credentials: Record<string, string>) => Record<string, string>;
  /** Bağlantı testi isteği. */
  probeRequest: (credentials: Record<string, string>) => MigrationRequestSpec;
  /** null → bu varlık bu sağlayıcıda desteklenmiyor. */
  pageRequest: (
    entity: MigrationEntity,
    cursor: MigrationPageCursor,
    credentials: Record<string, string>,
  ) => MigrationRequestSpec | null;
  /** Yanıt gövdesinden satırları ve sonraki imleci çıkarır. */
  extract: (entity: MigrationEntity, body: unknown, headers: Headers) => MigrationExtractResult;
  normalize: (entity: MigrationEntity, raw: Record<string, unknown>) => NormalizedRecord | null;
}

/* ------------------------------- yardımcılar ------------------------------ */

export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export const asArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.map((row) => asRecord(row)) : [];

export const pickValue = (raw: Record<string, unknown>, keys: string[]): unknown => {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
};

export const toStr = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

export const toNum = (value: unknown, fallback = 0): number => {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(",", ".")) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const toBool = (value: unknown, fallback = false): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["1", "true", "yes", "evet", "active"].includes(value.toLowerCase());
  if (typeof value === "number") return value !== 0;
  return fallback;
};

export const toInt = (value: unknown, fallback = 0): number => Math.round(toNum(value, fallback));

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "kayit";

/** HTML gövdeyi düz metne indirger (özet üretimi için). */
export const excerptFrom = (html: string | null, length = 180): string | null => {
  if (!html) return null;
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
};

export const isoDate = (value: unknown): string | null => {
  const raw = toStr(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
