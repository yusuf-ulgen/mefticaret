/** Wix Stores / Blog taşıma adaptörü. */
import {
  asArray,
  asRecord,
  excerptFrom,
  isoDate,
  slugify,
  toInt,
  toNum,
  toStr,
  type MigrationEntity,
  type MigrationProviderModule,
  type NormalizedRecord,
} from "../types";
import { addressFrom, mapFulfillmentStatus, mapOrderStatus, mapPaymentStatus } from "./shared";

const LIMIT = 50;

const wix: MigrationProviderModule = {
  code: "wix",
  name: "Wix",
  region: "Global",
  docsUrl: "https://dev.wix.com/docs/rest",
  howTo:
    "Wix hesabınızda Ayarlar → Wix Apps → Headless / API Keys bölümünden bir API anahtarı oluşturun ve Site ID değerini kopyalayın. Anahtara Stores, Contacts, Orders ve Blog okuma izinleri verin.",
  entities: ["category", "product", "customer", "order", "post"],
  credentialFields: [
    { key: "api_key", label: "Wix API anahtarı", secret: true },
    { key: "site_id", label: "Site ID", secret: false },
  ],
  baseUrl: () => "https://www.wixapis.com",
  authHeaders: (credentials) => ({
    Authorization: credentials["api_key"] ?? "",
    "wix-site-id": credentials["site_id"] ?? "",
    "Content-Type": "application/json",
  }),
  probeRequest: () => ({
    method: "POST",
    path: "/stores-reader/v1/products/query",
    body: { query: { paging: { limit: 1, offset: 0 } } },
  }),
  pageRequest: (entity, cursor) => {
    const offset = (cursor.page - 1) * LIMIT;
    const paging = { limit: LIMIT, offset };
    switch (entity) {
      case "category":
        return {
          method: "POST",
          path: "/stores-reader/v1/collections/query",
          body: { query: { paging } },
        };
      case "product":
        return {
          method: "POST",
          path: "/stores-reader/v1/products/query",
          body: { query: { paging }, includeVariants: true },
        };
      case "customer":
        return {
          method: "GET",
          path: "/contacts/v4/contacts",
          query: { "paging.limit": String(LIMIT), "paging.offset": String(offset) },
        };
      case "order":
        return {
          method: "POST",
          path: "/ecom/v1/orders/search",
          body: { search: { cursorPaging: { limit: LIMIT } } },
        };
      case "post":
        return {
          method: "GET",
          path: "/blog/v3/posts",
          query: { "paging.limit": String(LIMIT), "paging.offset": String(offset) },
        };
      default:
        return null;
    }
  },
  extract: (entity, body) => {
    const record = asRecord(body);
    const key =
      entity === "category"
        ? "collections"
        : entity === "product"
          ? "products"
          : entity === "customer"
            ? "contacts"
            : entity === "order"
              ? "orders"
              : "posts";
    return { rows: asArray(record[key] ?? []) };
  },
  normalize: (entity, raw): NormalizedRecord | null => {
    const externalId = toStr(raw["id"]) ?? toStr(raw["_id"]);
    if (!externalId) return null;

    if (entity === "category") {
      const name = toStr(raw["name"]) ?? "Koleksiyon";
      return {
        entity: "category",
        data: {
          externalId,
          name,
          slug: toStr(raw["slug"]) ?? slugify(name),
          description: toStr(raw["description"]),
          imageUrl: toStr(asRecord(raw["media"])["mainMedia"]),
          parentExternalId: null,
          sortOrder: 0,
          isActive: true,
          seoTitle: null,
          seoDescription: null,
        },
      };
    }

    if (entity === "product") {
      const title = toStr(raw["name"]) ?? "Ürün";
      const priceData = asRecord(raw["priceData"]);
      const stock = asRecord(raw["stock"]);
      const variants = asArray(raw["variants"]);
      const items = asArray(asRecord(raw["media"])["items"]);
      return {
        entity: "product",
        data: {
          externalId,
          title,
          slug: toStr(raw["slug"]) ?? slugify(title),
          description: toStr(raw["description"]),
          status: toStr(raw["visible"]) === "false" ? "draft" : "active",
          vendor: toStr(raw["brand"]),
          productType: toStr(raw["productType"]),
          tags: [],
          basePrice: toNum(priceData["discountedPrice"], 0) || toNum(priceData["price"]),
          compareAtPrice: toNum(priceData["price"], 0) || null,
          costPrice: toNum(asRecord(raw["costAndProfitData"])["itemCost"], 0) || null,
          currency: toStr(priceData["currency"]),
          sku: toStr(raw["sku"]),
          barcode: null,
          weightGrams: toInt(toNum(raw["weight"]) * 1000, 0) || null,
          taxRate: null,
          images: items
            .map((item) => ({
              url: toStr(asRecord(item["image"])["url"]) ?? "",
              alt: toStr(asRecord(item["image"])["altText"]),
            }))
            .filter((image) => image.url.length > 0),
          variants: variants.map((variant, index) => {
            const variantPrice = asRecord(variant["variant"]);
            return {
              externalId: toStr(variant["id"]) ?? `${externalId}-${index}`,
              title:
                Object.values(asRecord(variant["choices"]))
                  .map((value) => toStr(value) ?? "")
                  .filter(Boolean)
                  .join(" / ") || `Varyant ${index + 1}`,
              sku: toStr(variantPrice["sku"]),
              barcode: null,
              price: toNum(variantPrice["price"], toNum(priceData["price"])),
              compareAtPrice: null,
              costPrice: null,
              stock: toInt(asRecord(variant["stock"])["quantity"]),
              weightGrams: null,
              options: Object.fromEntries(
                Object.entries(asRecord(variant["choices"])).map(([key, value]) => [key, toStr(value) ?? ""]),
              ),
            };
          }),
          categoryExternalIds: asArray(raw["collectionIds"])
            .map((value) => toStr(value))
            .filter((value): value is string => Boolean(value)),
          seoTitle: null,
          seoDescription: null,
          sourcePath: toStr(raw["productPageUrl"]),
          ...(toInt(stock["quantity"], 0) ? {} : {}),
        },
      };
    }

    if (entity === "customer") {
      const info = asRecord(raw["info"]);
      const name = asRecord(info["name"]);
      const emails = asArray(info["emails"]);
      const phones = asArray(info["phones"]);
      const first = toStr(name["first"]);
      const last = toStr(name["last"]);
      const email = toStr(emails[0]?.["email"]);
      return {
        entity: "customer",
        data: {
          externalId,
          fullName: [first, last].filter(Boolean).join(" ") || email || "Müşteri",
          firstName: first,
          lastName: last,
          email,
          phone: toStr(phones[0]?.["phone"]),
          acceptsMarketing: false,
          notes: null,
          tags: [],
          totalSpent: 0,
          ordersCount: 0,
          createdAt: isoDate(raw["createdDate"]),
          addresses: asArray(info["addresses"])
            .map((entry) => {
              const address = asRecord(entry["address"]);
              return addressFrom({
                ...address,
                name: [first, last].filter(Boolean).join(" "),
                address1: toStr(address["addressLine"]) ?? toStr(address["addressLine1"]),
                address2: toStr(address["addressLine2"]),
                city: toStr(address["city"]),
                postcode: toStr(address["postalCode"]),
                country: toStr(address["country"]),
              });
            })
            .filter((address) => address.line1.length > 0 && address.recipient.length > 0),
        },
      };
    }

    if (entity === "order") {
      const status = mapOrderStatus(raw["fulfillmentStatus"] ?? raw["status"]);
      const buyer = asRecord(asRecord(raw["billingInfo"])["contactDetails"]);
      const totals = asRecord(raw["priceSummary"]);
      const money = (value: unknown) => toNum(asRecord(value)["amount"]);
      return {
        entity: "order",
        data: {
          externalId,
          orderNumber: toStr(raw["number"]) ?? externalId,
          status,
          paymentStatus: mapPaymentStatus(status, raw["paymentStatus"]),
          fulfillmentStatus: mapFulfillmentStatus(status),
          currency: toStr(raw["currency"]) ?? "TRY",
          subtotal: money(totals["subtotal"]),
          discountTotal: money(totals["discount"]),
          shippingTotal: money(totals["shipping"]),
          taxTotal: money(totals["tax"]),
          grandTotal: money(totals["total"]),
          discountCode: null,
          customerExternalId: toStr(asRecord(raw["buyerInfo"])["contactId"]),
          customerEmail: toStr(asRecord(raw["buyerInfo"])["email"]),
          customerName: [toStr(buyer["firstName"]), toStr(buyer["lastName"])].filter(Boolean).join(" ") || null,
          customerPhone: toStr(buyer["phone"]),
          shippingAddress: asRecord(asRecord(asRecord(raw["shippingInfo"])["logistics"])["shippingDestination"]),
          billingAddress: asRecord(asRecord(raw["billingInfo"])["address"]),
          shippingCarrier: null,
          trackingNumber: null,
          note: toStr(raw["buyerNote"]),
          placedAt: isoDate(raw["createdDate"]) ?? new Date().toISOString(),
          items: asArray(raw["lineItems"]).map((item) => {
            const quantity = Math.max(1, toInt(item["quantity"], 1));
            const unitPrice = money(item["price"]);
            return {
              title: toStr(asRecord(item["productName"])["original"]) ?? "Ürün",
              variantTitle: null,
              sku: toStr(item["physicalProperties"]) ?? toStr(item["sku"]),
              barcode: null,
              productExternalId: toStr(asRecord(item["catalogReference"])["catalogItemId"]),
              quantity,
              unitPrice,
              lineTotal: unitPrice * quantity,
              taxRate: 0,
              taxTotal: 0,
            };
          }),
        },
      };
    }

    const title = toStr(raw["title"]) ?? "Yazı";
    const body = toStr(raw["contentText"]) ?? toStr(raw["excerpt"]) ?? "";
    return {
      entity,
      data: {
        externalId,
        title,
        slug: toStr(raw["slug"]) ?? slugify(title),
        excerpt: toStr(raw["excerpt"]) ?? excerptFrom(body),
        body,
        coverUrl: toStr(asRecord(raw["media"])["wixMedia"]),
        authorName: null,
        isPublished: toStr(raw["status"]) !== "DRAFT",
        publishedAt: isoDate(raw["firstPublishedDate"]),
        seoTitle: null,
        seoDescription: null,
        sourcePath: toStr(asRecord(raw["url"])["path"]),
      },
    } as NormalizedRecord;
  },
};

export default wix;
