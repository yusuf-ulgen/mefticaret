/**
 * Pazaryeri connector sözleşmesi.
 *
 * Her pazaryeri/platform entegrasyonu `src/lib/marketplace/providers/<code>.ts`
 * altında bağımsız bir modül olarak tanımlanır. Modüller saf (pure) olmalıdır:
 * HTTP çağrısı yapmaz, yalnızca payload üretir ve dış veriyi normalize eder.
 * Gerçek istekler sunucu tarafındaki taşıyıcı (transport) katmanında yapılır,
 * böylece her entegrasyon tek başına test edilebilir ve değiştirilebilir.
 */

export type MarketplaceCapability =
  | "listing"
  | "price"
  | "stock"
  | "orders"
  | "payments"
  | "returns"
  | "commission";

export type MarketplaceKind = "marketplace" | "platform";

export interface MarketplaceCredentialField {
  key: string;
  label: string;
  /** true → değer yalnızca sunucu tarafı secret store'da tutulur. */
  secret: boolean;
  optional?: boolean;
}

export interface MarketplaceListingInput {
  productId: string;
  title: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  brand: string | null;
  category: string | null;
  basePrice: number;
  salePrice: number | null;
  currency: string;
  stock: number;
  images: string[];
  /** Kanal bazlı fiyat marjı (0.1 → %10). */
  markupRate: number;
  sellerId: string | null;
}

export interface MarketplacePricePayload {
  externalId: string;
  price: number;
  listPrice: number;
  currency: string;
}

export interface MarketplaceStockPayload {
  externalId: string;
  quantity: number;
}

export interface NormalizedMarketplaceOrder {
  externalId: string;
  orderNumber: string;
  status: string;
  currency: string;
  total: number;
  customerName: string | null;
  customerEmail: string | null;
  placedAt: string;
  items: Array<{
    sku: string | null;
    barcode: string | null;
    title: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface MarketplaceRequestSpec {
  method: "GET" | "POST" | "PUT" | "PATCH";
  /** Base URL'e eklenecek yol. */
  path: string;
  body?: unknown;
  query?: Record<string, string>;
}

export interface MarketplaceConnectorModule {
  code: string;
  name: string;
  kind: MarketplaceKind;
  region: string;
  /** Sağlayıcı geliştirici dokümanı. */
  docsUrl: string;
  /** API kök adresi (kimlik bilgileri sunucu tarafında eklenir). */
  baseUrl: string;
  capabilities: MarketplaceCapability[];
  credentialFields: MarketplaceCredentialField[];
  sellerIdLabel: string;
  /** Varsayılan komisyon oranı (0.12 → %12); yalnızca tahmin amaçlıdır. */
  defaultCommissionRate: number;
  notes?: string;

  /** Ürün listeleme isteği. */
  buildListingRequest: (input: MarketplaceListingInput) => MarketplaceRequestSpec;
  /** Fiyat güncelleme isteği. */
  buildPriceRequest: (payload: MarketplacePricePayload) => MarketplaceRequestSpec;
  /** Stok güncelleme isteği. */
  buildStockRequest: (payload: MarketplaceStockPayload) => MarketplaceRequestSpec;
  /** Sipariş çekme isteği. */
  buildOrdersRequest: (input: { sellerId: string | null; since: string }) => MarketplaceRequestSpec;
  /** Sağlayıcı sipariş kaydını platform modeline çevirir. */
  normalizeOrder: (raw: Record<string, unknown>) => NormalizedMarketplaceOrder;
  /** Dış kimlik üretimi (sağlayıcı yanıt vermeden önce yerel eşleştirme için). */
  externalIdFor: (input: MarketplaceListingInput) => string;
  /** Kanal fiyatı: marj + sağlayıcı yuvarlama kuralı. */
  computeChannelPrice: (input: MarketplaceListingInput) => number;
}

export type MarketplaceConnectorDefinition = Pick<
  MarketplaceConnectorModule,
  "code" | "name" | "kind" | "region" | "docsUrl" | "baseUrl" | "capabilities"
> &
  Partial<Omit<MarketplaceConnectorModule, "code" | "name" | "kind" | "region" | "docsUrl" | "baseUrl" | "capabilities">>;

const num = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

const str = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

/** Sağlayıcı yanıtındaki ilk mevcut alanı okur. */
export const pick = (raw: Record<string, unknown>, keys: string[]): unknown => {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
};

export const defaultNormalizeOrder = (
  raw: Record<string, unknown>,
): NormalizedMarketplaceOrder => {
  const rawItems = pick(raw, ["items", "lines", "orderItems", "line_items"]);
  const items = Array.isArray(rawItems) ? rawItems : [];
  return {
    externalId: String(pick(raw, ["id", "orderId", "order_id", "externalId"]) ?? ""),
    orderNumber: String(pick(raw, ["orderNumber", "order_number", "code", "id"]) ?? ""),
    status: String(pick(raw, ["status", "orderStatus", "state"]) ?? "pending"),
    currency: String(pick(raw, ["currency", "currencyCode", "currency_code"]) ?? "TRY"),
    total: num(pick(raw, ["totalPrice", "total", "grandTotal", "amount"])),
    customerName: str(pick(raw, ["customerName", "customer_name", "buyerName", "customer"])),
    customerEmail: str(pick(raw, ["customerEmail", "customer_email", "buyerEmail", "email"])),
    placedAt: String(
      pick(raw, ["orderDate", "createdAt", "created_at", "placedAt"]) ?? new Date().toISOString(),
    ),
    items: items.map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;
      return {
        sku: str(pick(row, ["sku", "merchantSku", "stockCode", "sellerStockCode"])),
        barcode: str(pick(row, ["barcode", "gtin", "ean"])),
        title: String(pick(row, ["title", "name", "productName"]) ?? "Ürün"),
        quantity: Math.max(1, Math.round(num(pick(row, ["quantity", "qty", "amount"]), 1))),
        unitPrice: num(pick(row, ["price", "unitPrice", "unit_price", "salePrice"])),
      };
    }),
  };
};

/** Modül tanımını varsayılan davranışlarla tamamlar. */
export function defineMarketplaceConnector(
  definition: MarketplaceConnectorDefinition,
): MarketplaceConnectorModule {
  const computeChannelPrice =
    definition.computeChannelPrice ??
    ((input: MarketplaceListingInput) => {
      const base = input.salePrice ?? input.basePrice;
      return Math.round(base * (1 + input.markupRate) * 100) / 100;
    });

  return {
    sellerIdLabel: "Satıcı kimliği",
    defaultCommissionRate: 0.12,
    credentialFields: [
      { key: "api_key", label: "API anahtarı", secret: true },
      { key: "api_secret", label: "API gizli anahtarı", secret: true },
    ],
    buildListingRequest: (input) => ({
      method: "POST",
      path: "/products",
      body: {
        sellerId: input.sellerId,
        title: input.title,
        description: input.description,
        sku: input.sku,
        barcode: input.barcode,
        brand: input.brand,
        category: input.category,
        price: computeChannelPrice(input),
        listPrice: input.basePrice,
        currency: input.currency,
        quantity: input.stock,
        images: input.images,
      },
    }),
    buildPriceRequest: (payload) => ({
      method: "PUT",
      path: `/products/${encodeURIComponent(payload.externalId)}/price`,
      body: { price: payload.price, listPrice: payload.listPrice, currency: payload.currency },
    }),
    buildStockRequest: (payload) => ({
      method: "PUT",
      path: `/products/${encodeURIComponent(payload.externalId)}/stock`,
      body: { quantity: payload.quantity },
    }),
    buildOrdersRequest: ({ sellerId, since }) => ({
      method: "GET",
      path: "/orders",
      query: { ...(sellerId ? { sellerId } : {}), since },
    }),
    normalizeOrder: defaultNormalizeOrder,
    externalIdFor: (input) =>
      `${definition.code}-${(input.sku ?? input.productId).slice(0, 24).toLowerCase()}`,
    computeChannelPrice,
    ...definition,
  };
}
