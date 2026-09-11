/**
 * Sağlayıcı modülleri için paylaşılan yardımcılar.
 *
 * `genericNormalize` yaygın REST alan adlarını (title/name, price, stock ...)
 * tanır; böylece benzer sözleşmeye sahip altyapılar tek satırla tanımlanabilir.
 * Alan adları farklı olan altyapılar kendi normalize fonksiyonunu geçer.
 */

import {
  asArray,
  asRecord,
  excerptFrom,
  isoDate,
  pickValue,
  slugify,
  toBool,
  toInt,
  toNum,
  toStr,
  type MigrationCredentialField,
  type MigrationEntity,
  type MigrationExtractResult,
  type MigrationPageCursor,
  type MigrationProviderModule,
  type MigrationRequestSpec,
  type NormalizedContent,
  type NormalizedOrder,
  type NormalizedRecord,
} from "../types";

const ORDER_STATUS_MAP: Record<string, NormalizedOrder["status"]> = {
  pending: "pending",
  "on-hold": "awaiting_payment",
  awaiting_payment: "awaiting_payment",
  unpaid: "awaiting_payment",
  paid: "paid",
  processing: "processing",
  packed: "packed",
  shipped: "shipped",
  "in-transit": "shipped",
  completed: "delivered",
  delivered: "delivered",
  cancelled: "cancelled",
  canceled: "cancelled",
  refunded: "refunded",
  returned: "returned",
};

export const mapOrderStatus = (raw: unknown): NormalizedOrder["status"] => {
  const key = (toStr(raw) ?? "").toLowerCase().replace(/\s+/g, "_");
  return ORDER_STATUS_MAP[key] ?? "pending";
};

export const mapPaymentStatus = (
  status: NormalizedOrder["status"],
  raw?: unknown,
): NormalizedOrder["paymentStatus"] => {
  const key = (toStr(raw) ?? "").toLowerCase();
  if (key.includes("refund")) return "refunded";
  if (key.includes("fail")) return "failed";
  if (["paid", "processing", "packed", "shipped", "delivered"].includes(status)) return "paid";
  if (status === "refunded") return "refunded";
  return "pending";
};

export const mapFulfillmentStatus = (status: NormalizedOrder["status"]): NormalizedOrder["fulfillmentStatus"] => {
  if (status === "delivered" || status === "shipped") return "fulfilled";
  if (status === "returned") return "returned";
  if (status === "packed") return "partially_fulfilled";
  return "unfulfilled";
};

export const addressFrom = (raw: Record<string, unknown>) => {
  const line1 =
    toStr(pickValue(raw, ["address1", "address_1", "line1", "adres", "street", "addressLine1"])) ?? "";
  return {
    label: toStr(pickValue(raw, ["label", "title", "name"])),
    recipient:
      toStr(pickValue(raw, ["name", "recipient", "full_name", "fullName"])) ??
      [toStr(raw["first_name"]), toStr(raw["last_name"])].filter(Boolean).join(" ") ??
      "",
    phone: toStr(pickValue(raw, ["phone", "telefon", "phoneNumber"])),
    country: toStr(pickValue(raw, ["country", "countryCode", "country_code", "ulke"])) ?? "TR",
    city: toStr(pickValue(raw, ["city", "sehir", "province", "state"])),
    district: toStr(pickValue(raw, ["district", "ilce", "state", "region"])),
    line1,
    line2: toStr(pickValue(raw, ["address2", "address_2", "line2", "addressLine2"])),
    postalCode: toStr(pickValue(raw, ["postcode", "postal_code", "zip", "postaKodu"])),
    isDefault: toBool(pickValue(raw, ["is_default", "isDefault", "default"]), false),
  };
};

const contentFrom = (raw: Record<string, unknown>): NormalizedContent => {
  const title =
    toStr(pickValue(raw, ["title", "name", "baslik"])) ??
    toStr(asRecord(raw["title"])["rendered"]) ??
    "Başlıksız";
  const body =
    toStr(pickValue(raw, ["content", "body", "html", "icerik", "description"])) ??
    toStr(asRecord(raw["content"])["rendered"]) ??
    "";
  const excerpt =
    toStr(pickValue(raw, ["excerpt", "summary", "ozet"])) ??
    toStr(asRecord(raw["excerpt"])["rendered"]) ??
    excerptFrom(body);
  const slug = toStr(pickValue(raw, ["slug", "handle", "url", "seoUrl"])) ?? slugify(title);
  const status = (toStr(pickValue(raw, ["status", "state"])) ?? "publish").toLowerCase();
  return {
    externalId: toStr(pickValue(raw, ["id", "_id", "postId", "pageId"])) ?? slug,
    title,
    slug: slugify(slug),
    excerpt,
    body,
    coverUrl: toStr(pickValue(raw, ["cover_url", "coverUrl", "image", "featured_image", "coverImage"])),
    authorName: toStr(pickValue(raw, ["author_name", "authorName", "author"])),
    isPublished: ["publish", "published", "active", "1", "true"].includes(status),
    publishedAt: isoDate(pickValue(raw, ["date", "published_at", "publishedAt", "date_created"])),
    seoTitle: toStr(pickValue(raw, ["seo_title", "metaTitle", "meta_title"])),
    seoDescription: toStr(pickValue(raw, ["seo_description", "metaDescription", "meta_description"])),
    sourcePath: toStr(pickValue(raw, ["link", "permalink", "url"])),
  };
};

/** Yaygın REST alan adlarını tanıyan genel normalize edici. */
export function genericNormalize(
  entity: MigrationEntity,
  raw: Record<string, unknown>,
): NormalizedRecord | null {
  const externalId = toStr(pickValue(raw, ["id", "_id", "Id", "ID", "code", "sku", "uuid"]));

  if (entity === "category") {
    const name = toStr(pickValue(raw, ["name", "title", "categoryName", "Tanim", "isim"]));
    if (!name) return null;
    return {
      entity: "category",
      data: {
        externalId: externalId ?? slugify(name),
        name,
        slug: toStr(pickValue(raw, ["slug", "handle", "seoUrl"])),
        description: toStr(pickValue(raw, ["description", "aciklama"])),
        imageUrl: toStr(pickValue(raw, ["image", "imageUrl", "image_url", "resim"])),
        parentExternalId: toStr(pickValue(raw, ["parent", "parent_id", "parentId", "UstKategoriId"])),
        sortOrder: toInt(pickValue(raw, ["menu_order", "sort_order", "sortOrder", "sira"])),
        isActive: toBool(pickValue(raw, ["is_active", "active", "isActive", "Aktif"]), true),
        seoTitle: toStr(pickValue(raw, ["seo_title", "metaTitle", "meta_title"])),
        seoDescription: toStr(pickValue(raw, ["seo_description", "metaDescription", "meta_description"])),
      },
    };
  }

  if (entity === "product") {
    const title = toStr(pickValue(raw, ["name", "title", "productName", "Tanim", "urunAdi"]));
    if (!title) return null;
    const price = toNum(pickValue(raw, ["price", "sale_price", "salePrice", "SatisFiyati", "fiyat"]));
    const images = [
      ...asArray(raw["images"]).map((img) => ({
        url: toStr(pickValue(img, ["src", "url", "image", "originalSrc"])) ?? "",
        alt: toStr(pickValue(img, ["alt", "altText", "name"])),
      })),
      ...(Array.isArray(raw["imageUrls"])
        ? (raw["imageUrls"] as unknown[]).map((url) => ({ url: toStr(url) ?? "", alt: null }))
        : []),
    ].filter((img) => img.url.length > 0);
    const rawVariants = asArray(pickValue(raw, ["variants", "variations", "Varyantlar"]) ?? []);
    const stock = toInt(pickValue(raw, ["stock_quantity", "stock", "quantity", "StokAdedi"]));
    const status = (toStr(pickValue(raw, ["status", "state"])) ?? "publish").toLowerCase();
    return {
      entity: "product",
      data: {
        externalId: externalId ?? slugify(title),
        title,
        slug: toStr(pickValue(raw, ["slug", "handle", "seoUrl"])),
        description: toStr(pickValue(raw, ["description", "body_html", "aciklama"])),
        status: status === "draft" ? "draft" : status === "archived" ? "archived" : "active",
        vendor: toStr(pickValue(raw, ["vendor", "brand", "Marka", "manufacturer"])),
        productType: toStr(pickValue(raw, ["type", "product_type", "productType"])),
        tags: Array.isArray(raw["tags"])
          ? (raw["tags"] as unknown[]).map((tag) => toStr(asRecord(tag)["name"]) ?? toStr(tag) ?? "").filter(Boolean)
          : [],
        basePrice: price,
        compareAtPrice: toNum(pickValue(raw, ["regular_price", "compare_at_price", "listPrice"]), 0) || null,
        costPrice: toNum(pickValue(raw, ["cost_price", "costPrice", "AlisFiyati"]), 0) || null,
        currency: toStr(pickValue(raw, ["currency", "currencyCode", "ParaBirimi"])),
        sku: toStr(pickValue(raw, ["sku", "StokKodu", "barcode"])),
        barcode: toStr(pickValue(raw, ["barcode", "gtin", "Barkod", "ean"])),
        weightGrams: toInt(pickValue(raw, ["weight_grams", "weightGrams"]), 0) || null,
        taxRate: toNum(pickValue(raw, ["tax_rate", "taxRate", "KdvOrani"]), 0) || null,
        images,
        variants: rawVariants.map((variant, index) => ({
          externalId: toStr(pickValue(variant, ["id", "_id", "sku"])) ?? `${externalId ?? title}-${index}`,
          title: toStr(pickValue(variant, ["title", "name"])) ?? `Varyant ${index + 1}`,
          sku: toStr(pickValue(variant, ["sku", "StokKodu"])),
          barcode: toStr(pickValue(variant, ["barcode", "gtin"])),
          price: toNum(pickValue(variant, ["price", "salePrice"]), price),
          compareAtPrice: toNum(pickValue(variant, ["regular_price", "compare_at_price"]), 0) || null,
          costPrice: toNum(pickValue(variant, ["cost_price"]), 0) || null,
          stock: toInt(pickValue(variant, ["stock_quantity", "stock", "quantity"]), 0),
          weightGrams: toInt(pickValue(variant, ["weight_grams"]), 0) || null,
          options: asRecord(pickValue(variant, ["options", "attributes"]) ?? {}) as Record<string, string>,
        })),
        categoryExternalIds: asArray(pickValue(raw, ["categories", "collections"]) ?? [])
          .map((cat) => toStr(pickValue(cat, ["id", "_id", "name"])))
          .filter((value): value is string => Boolean(value)),
        seoTitle: toStr(pickValue(raw, ["seo_title", "metaTitle", "meta_title"])),
        seoDescription: toStr(pickValue(raw, ["seo_description", "metaDescription", "meta_description"])),
        sourcePath: toStr(pickValue(raw, ["permalink", "link", "url"])),
      },
    };
  }

  if (entity === "customer") {
    const email = toStr(pickValue(raw, ["email", "Email", "eposta"]));
    const first = toStr(pickValue(raw, ["first_name", "firstName", "Ad"]));
    const last = toStr(pickValue(raw, ["last_name", "lastName", "Soyad"]));
    const fullName = toStr(pickValue(raw, ["name", "full_name", "fullName"])) ?? [first, last].filter(Boolean).join(" ");
    if (!email && !fullName) return null;
    const addressRows = [
      ...asArray(pickValue(raw, ["addresses", "Adresler"]) ?? []),
      ...(raw["billing"] ? [asRecord(raw["billing"])] : []),
      ...(raw["shipping"] ? [asRecord(raw["shipping"])] : []),
    ];
    return {
      entity: "customer",
      data: {
        externalId: externalId ?? email ?? slugify(fullName || "musteri"),
        fullName: fullName || email || "Müşteri",
        firstName: first,
        lastName: last,
        email,
        phone: toStr(pickValue(raw, ["phone", "Telefon", "phoneNumber"])) ?? toStr(asRecord(raw["billing"])["phone"]),
        acceptsMarketing: toBool(pickValue(raw, ["accepts_marketing", "acceptsMarketing", "is_paying_customer"]), false),
        notes: toStr(pickValue(raw, ["note", "notes"])),
        tags: [],
        totalSpent: toNum(pickValue(raw, ["total_spent", "totalSpent"])),
        ordersCount: toInt(pickValue(raw, ["orders_count", "ordersCount"])),
        createdAt: isoDate(pickValue(raw, ["date_created", "created_at", "createdAt"])),
        addresses: addressRows
          .map((row) => addressFrom(row))
          .filter((address) => address.line1.length > 0 && address.recipient.length > 0),
      },
    };
  }

  if (entity === "order") {
    const status = mapOrderStatus(pickValue(raw, ["status", "financial_status", "orderStatus", "Durum"]));
    const items = asArray(pickValue(raw, ["line_items", "items", "orderItems", "Urunler"]) ?? []).map((item) => {
      const quantity = Math.max(1, toInt(pickValue(item, ["quantity", "qty", "Adet"]), 1));
      const unitPrice = toNum(pickValue(item, ["price", "unit_price", "unitPrice", "BirimFiyat"]));
      return {
        title: toStr(pickValue(item, ["name", "title", "productName", "Tanim"])) ?? "Ürün",
        variantTitle: toStr(pickValue(item, ["variant_title", "variantTitle"])),
        sku: toStr(pickValue(item, ["sku", "StokKodu"])),
        barcode: toStr(pickValue(item, ["barcode", "gtin"])),
        productExternalId: toStr(pickValue(item, ["product_id", "productId"])),
        quantity,
        unitPrice,
        lineTotal: toNum(pickValue(item, ["total", "line_total", "lineTotal"]), unitPrice * quantity),
        taxRate: toNum(pickValue(item, ["tax_rate", "taxRate", "KdvOrani"])),
        taxTotal: toNum(pickValue(item, ["total_tax", "tax_total", "taxTotal"])),
      };
    });
    const grandTotal = toNum(pickValue(raw, ["total", "total_price", "grandTotal", "ToplamTutar"]));
    const shipping = asRecord(pickValue(raw, ["shipping", "shipping_address", "shippingAddress"]) ?? {});
    const billing = asRecord(pickValue(raw, ["billing", "billing_address", "billingAddress"]) ?? {});
    return {
      entity: "order",
      data: {
        externalId: externalId ?? String(pickValue(raw, ["number", "order_number"]) ?? ""),
        orderNumber:
          toStr(pickValue(raw, ["number", "order_number", "orderNumber", "SiparisNo", "name"])) ?? externalId ?? "",
        status,
        paymentStatus: mapPaymentStatus(status, pickValue(raw, ["financial_status", "payment_status"])),
        fulfillmentStatus: mapFulfillmentStatus(status),
        currency: toStr(pickValue(raw, ["currency", "currency_code", "ParaBirimi"])) ?? "TRY",
        subtotal: toNum(pickValue(raw, ["subtotal", "subtotal_price"]), grandTotal),
        discountTotal: toNum(pickValue(raw, ["discount_total", "total_discounts"])),
        shippingTotal: toNum(pickValue(raw, ["shipping_total", "total_shipping_price_set", "KargoTutari"])),
        taxTotal: toNum(pickValue(raw, ["total_tax", "tax_total"])),
        grandTotal,
        discountCode: toStr(pickValue(raw, ["discount_code", "coupon_code"])),
        customerExternalId: toStr(pickValue(raw, ["customer_id", "customerId"])),
        customerEmail: toStr(pickValue(raw, ["email", "customer_email"])) ?? toStr(billing["email"]),
        customerName:
          toStr(pickValue(raw, ["customer_name", "customerName"])) ??
          [toStr(billing["first_name"]), toStr(billing["last_name"])].filter(Boolean).join(" ") ??
          null,
        customerPhone: toStr(pickValue(raw, ["phone", "customer_phone"])) ?? toStr(billing["phone"]),
        shippingAddress: shipping,
        billingAddress: billing,
        shippingCarrier: toStr(pickValue(raw, ["shipping_carrier", "carrier", "KargoFirma"])),
        trackingNumber: toStr(pickValue(raw, ["tracking_number", "trackingNumber", "KargoTakipNo"])),
        note: toStr(pickValue(raw, ["customer_note", "note"])),
        placedAt:
          isoDate(pickValue(raw, ["date_created", "created_at", "createdAt", "SiparisTarihi", "processed_at"])) ??
          new Date().toISOString(),
        items,
      },
    };
  }

  return { entity, data: contentFrom(raw) } as NormalizedRecord;
}

export interface RestProviderConfig {
  code: string;
  name: string;
  region: string;
  docsUrl: string;
  howTo: string;
  entities: MigrationEntity[];
  credentialFields?: MigrationCredentialField[];
  /** Base URL üretimi; varsayılan `https://<shopDomain>`. */
  baseUrl?: (input: { shopDomain: string; credentials: Record<string, string> }) => string;
  authHeaders?: (credentials: Record<string, string>) => Record<string, string>;
  probePath: string;
  /** Varlık başına yol; `page` ve `perPage` query adları yapılandırılabilir. */
  paths: Partial<Record<MigrationEntity, string>>;
  pageParam?: string;
  perPageParam?: string;
  perPage?: number;
  extraQuery?: Partial<Record<MigrationEntity, Record<string, string>>>;
  /** Yanıt gövdesinde satır dizisinin bulunduğu anahtar (yoksa gövde dizidir). */
  rowsKey?: Partial<Record<MigrationEntity, string>>;
  normalize?: (entity: MigrationEntity, raw: Record<string, unknown>) => NormalizedRecord | null;
}

const DEFAULT_FIELDS: MigrationCredentialField[] = [
  { key: "api_key", label: "API anahtarı / kullanıcı", secret: true },
  { key: "api_secret", label: "API gizli anahtarı / şifre", secret: true, optional: true },
];

export function defineRestProvider(config: RestProviderConfig): MigrationProviderModule {
  const pageParam = config.pageParam ?? "page";
  const perPageParam = config.perPageParam ?? "per_page";
  const perPage = config.perPage ?? 50;

  const build = (entity: MigrationEntity, cursor: MigrationPageCursor): MigrationRequestSpec | null => {
    const path = config.paths[entity];
    if (!path) return null;
    return {
      method: "GET",
      path,
      query: {
        [pageParam]: String(cursor.page),
        [perPageParam]: String(perPage),
        ...(config.extraQuery?.[entity] ?? {}),
      },
    };
  };

  return {
    code: config.code,
    name: config.name,
    region: config.region,
    docsUrl: config.docsUrl,
    howTo: config.howTo,
    entities: config.entities,
    credentialFields: config.credentialFields ?? DEFAULT_FIELDS,
    baseUrl:
      config.baseUrl ??
      (({ shopDomain }) => (shopDomain.startsWith("http") ? shopDomain : `https://${shopDomain}`)),
    authHeaders:
      config.authHeaders ??
      ((credentials) => {
        if (credentials["api_secret"]) {
          const basic = btoa(`${credentials["api_key"] ?? ""}:${credentials["api_secret"]}`);
          return { Authorization: `Basic ${basic}` };
        }
        return { Authorization: `Bearer ${credentials["api_key"] ?? ""}` };
      }),
    probeRequest: () => ({ method: "GET", path: config.probePath, query: { [perPageParam]: "1" } }),
    pageRequest: (entity, cursor) => build(entity, cursor),
    extract: (entity, body): MigrationExtractResult => {
      const key = config.rowsKey?.[entity];
      if (Array.isArray(body)) return { rows: body.map((row) => asRecord(row)) };
      const record = asRecord(body);
      if (key) return { rows: asArray(record[key]) };
      const firstArray = Object.values(record).find((value) => Array.isArray(value));
      return { rows: asArray(firstArray ?? []) };
    },
    normalize: config.normalize ?? genericNormalize,
  };
}
