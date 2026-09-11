/** Shopify Admin REST API taşıma adaptörü. */
import {
  asArray,
  asRecord,
  excerptFrom,
  isoDate,
  pickValue,
  slugify,
  toInt,
  toNum,
  toStr,
  type MigrationEntity,
  type MigrationProviderModule,
  type NormalizedRecord,
} from "../types";
import { addressFrom, mapFulfillmentStatus, mapOrderStatus, mapPaymentStatus } from "./shared";

const API_VERSION = "2024-10";

const PATHS: Partial<Record<MigrationEntity, string>> = {
  category: "/custom_collections.json",
  product: "/products.json",
  customer: "/customers.json",
  order: "/orders.json",
  page: "/pages.json",
  post: "/blogs.json",
};

const ROWS_KEY: Partial<Record<MigrationEntity, string>> = {
  category: "custom_collections",
  product: "products",
  customer: "customers",
  order: "orders",
  page: "pages",
  post: "articles",
};

/** Link başlığından `page_info` imlecini okur. */
function nextCursor(headers: Headers): string | null {
  const link = headers.get("link") ?? headers.get("Link");
  if (!link) return null;
  const match = /<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/.exec(link);
  return match?.[1] ?? null;
}

const shopify: MigrationProviderModule = {
  code: "shopify",
  name: "Shopify",
  region: "Global",
  docsUrl: "https://shopify.dev/docs/api/admin-rest",
  howTo:
    "Shopify yöneticinizde Ayarlar → Uygulamalar → Uygulama geliştir bölümünden özel bir uygulama oluşturun, Admin API erişim tokenını alın ve ürün, müşteri, sipariş, içerik okuma izinlerini verin.",
  entities: ["category", "product", "customer", "order", "page"],
  credentialFields: [
    { key: "access_token", label: "Admin API erişim tokenı (shpat_...)", secret: true, placeholder: "shpat_..." },
  ],
  baseUrl: ({ shopDomain }) => {
    const host = shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}/admin/api/${API_VERSION}`;
  },
  authHeaders: (credentials) => ({ "X-Shopify-Access-Token": credentials["access_token"] ?? "" }),
  probeRequest: () => ({ method: "GET", path: "/shop.json" }),
  pageRequest: (entity, cursor) => {
    const path = PATHS[entity];
    if (!path) return null;
    const query: Record<string, string> = { limit: "50" };
    if (cursor.cursor) query["page_info"] = cursor.cursor;
    else if (entity === "order") query["status"] = "any";
    return { method: "GET", path, query };
  },
  extract: (entity, body, headers) => {
    const record = asRecord(body);
    const key = ROWS_KEY[entity] ?? "";
    return { rows: asArray(record[key] ?? []), nextCursor: nextCursor(headers) };
  },
  normalize: (entity, raw): NormalizedRecord | null => {
    const externalId = toStr(pickValue(raw, ["id", "admin_graphql_api_id"]));
    if (!externalId) return null;

    if (entity === "category") {
      const title = toStr(raw["title"]) ?? "Koleksiyon";
      return {
        entity: "category",
        data: {
          externalId,
          name: title,
          slug: toStr(raw["handle"]) ?? slugify(title),
          description: toStr(raw["body_html"]),
          imageUrl: toStr(asRecord(raw["image"])["src"]),
          parentExternalId: null,
          sortOrder: toInt(raw["sort_order"]),
          isActive: true,
          seoTitle: null,
          seoDescription: null,
        },
      };
    }

    if (entity === "product") {
      const title = toStr(raw["title"]) ?? "Ürün";
      const variants = asArray(raw["variants"]);
      const first = variants[0] ?? {};
      const optionNames = asArray(raw["options"]).map((option) => toStr(option["name"]) ?? "");
      return {
        entity: "product",
        data: {
          externalId,
          title,
          slug: toStr(raw["handle"]) ?? slugify(title),
          description: toStr(raw["body_html"]),
          status: toStr(raw["status"]) === "draft" ? "draft" : toStr(raw["status"]) === "archived" ? "archived" : "active",
          vendor: toStr(raw["vendor"]),
          productType: toStr(raw["product_type"]),
          tags: (toStr(raw["tags"]) ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
          basePrice: toNum(first["price"]),
          compareAtPrice: toNum(first["compare_at_price"], 0) || null,
          costPrice: null,
          currency: null,
          sku: toStr(first["sku"]),
          barcode: toStr(first["barcode"]),
          weightGrams: toInt(first["grams"], 0) || null,
          taxRate: null,
          images: asArray(raw["images"]).map((image) => ({
            url: toStr(image["src"]) ?? "",
            alt: toStr(image["alt"]),
          })).filter((image) => image.url.length > 0),
          variants: variants.map((variant, index) => ({
            externalId: toStr(variant["id"]) ?? `${externalId}-${index}`,
            title: toStr(variant["title"]) ?? `Varyant ${index + 1}`,
            sku: toStr(variant["sku"]),
            barcode: toStr(variant["barcode"]),
            price: toNum(variant["price"]),
            compareAtPrice: toNum(variant["compare_at_price"], 0) || null,
            costPrice: null,
            stock: toInt(variant["inventory_quantity"]),
            weightGrams: toInt(variant["grams"], 0) || null,
            options: Object.fromEntries(
              optionNames.map((name, idx) => [name || `Seçenek ${idx + 1}`, toStr(variant[`option${idx + 1}`]) ?? ""]),
            ),
          })),
          categoryExternalIds: [],
          seoTitle: null,
          seoDescription: null,
          sourcePath: `/products/${toStr(raw["handle"]) ?? ""}`,
        },
      };
    }

    if (entity === "customer") {
      const first = toStr(raw["first_name"]);
      const last = toStr(raw["last_name"]);
      const email = toStr(raw["email"]);
      return {
        entity: "customer",
        data: {
          externalId,
          fullName: [first, last].filter(Boolean).join(" ") || email || "Müşteri",
          firstName: first,
          lastName: last,
          email,
          phone: toStr(raw["phone"]),
          acceptsMarketing: toStr(raw["email_marketing_consent"]) !== null,
          notes: toStr(raw["note"]),
          tags: (toStr(raw["tags"]) ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
          totalSpent: toNum(raw["total_spent"]),
          ordersCount: toInt(raw["orders_count"]),
          createdAt: isoDate(raw["created_at"]),
          addresses: asArray(raw["addresses"])
            .map((address) => addressFrom(address))
            .filter((address) => address.line1.length > 0 && address.recipient.length > 0),
        },
      };
    }

    if (entity === "order") {
      const status = mapOrderStatus(raw["fulfillment_status"] ?? raw["financial_status"]);
      const customer = asRecord(raw["customer"]);
      return {
        entity: "order",
        data: {
          externalId,
          orderNumber: toStr(raw["name"]) ?? toStr(raw["order_number"]) ?? externalId,
          status: toStr(raw["cancelled_at"]) ? "cancelled" : status,
          paymentStatus: mapPaymentStatus(status, raw["financial_status"]),
          fulfillmentStatus: mapFulfillmentStatus(status),
          currency: toStr(raw["currency"]) ?? "TRY",
          subtotal: toNum(raw["subtotal_price"]),
          discountTotal: toNum(raw["total_discounts"]),
          shippingTotal: toNum(asRecord(asRecord(raw["total_shipping_price_set"])["shop_money"])["amount"]),
          taxTotal: toNum(raw["total_tax"]),
          grandTotal: toNum(raw["total_price"]),
          discountCode: toStr(asArray(raw["discount_codes"])[0]?.["code"]),
          customerExternalId: toStr(customer["id"]),
          customerEmail: toStr(raw["email"]) ?? toStr(customer["email"]),
          customerName:
            [toStr(customer["first_name"]), toStr(customer["last_name"])].filter(Boolean).join(" ") || null,
          customerPhone: toStr(raw["phone"]) ?? toStr(customer["phone"]),
          shippingAddress: asRecord(raw["shipping_address"]),
          billingAddress: asRecord(raw["billing_address"]),
          shippingCarrier: toStr(asArray(raw["fulfillments"])[0]?.["tracking_company"]),
          trackingNumber: toStr(asArray(raw["fulfillments"])[0]?.["tracking_number"]),
          note: toStr(raw["note"]),
          placedAt: isoDate(raw["created_at"]) ?? new Date().toISOString(),
          items: asArray(raw["line_items"]).map((item) => {
            const quantity = Math.max(1, toInt(item["quantity"], 1));
            const unitPrice = toNum(item["price"]);
            return {
              title: toStr(item["title"]) ?? "Ürün",
              variantTitle: toStr(item["variant_title"]),
              sku: toStr(item["sku"]),
              barcode: null,
              productExternalId: toStr(item["product_id"]),
              quantity,
              unitPrice,
              lineTotal: unitPrice * quantity,
              taxRate: 0,
              taxTotal: toNum(asArray(item["tax_lines"])[0]?.["price"]),
            };
          }),
        },
      };
    }

    const title = toStr(raw["title"]) ?? "Sayfa";
    const bodyHtml = toStr(raw["body_html"]) ?? "";
    return {
      entity,
      data: {
        externalId,
        title,
        slug: toStr(raw["handle"]) ?? slugify(title),
        excerpt: excerptFrom(bodyHtml),
        body: bodyHtml,
        coverUrl: null,
        authorName: toStr(raw["author"]),
        isPublished: Boolean(toStr(raw["published_at"])),
        publishedAt: isoDate(raw["published_at"]),
        seoTitle: null,
        seoDescription: null,
        sourcePath: `/pages/${toStr(raw["handle"]) ?? ""}`,
      },
    } as NormalizedRecord;
  },
};

export default shopify;
