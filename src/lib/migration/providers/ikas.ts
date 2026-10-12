/** ikas Admin GraphQL taşıma adaptörü. */
import {
  asArray,
  asRecord,
  isoDate,
  slugify,
  toInt,
  toNum,
  toStr,
  type MigrationEntity,
  type MigrationProviderModule,
  type NormalizedRecord,
} from "../types";
import { addressFrom, genericNormalize, mapFulfillmentStatus, mapOrderStatus, mapPaymentStatus } from "./shared";

const QUERIES: Partial<Record<MigrationEntity, string>> = {
  category: `query($p:Int!){listCategory{id name description categoryPath{id name} imageId}}`,
  product: `query($p:Int!){listProduct(pagination:{page:$p,limit:50}){data{id name description type brand{name} tags{name} categories{id name} metaData{slug pageTitle description} variants{id sku barcode prices{sellPrice buyPrice discountPrice} stocks{stockCount} unit{amount} variantValues{variationName valueName}} } page limit count}}`,
  customer: `query($p:Int!){listCustomer(pagination:{page:$p,limit:50}){data{id firstName lastName email phone note isEmailVerified createdAt addresses{title firstName lastName phone addressLine1 addressLine2 city{name} district{name} country{name} postalCode isDefault}} page count}}`,
  order: `query($p:Int!){listOrder(pagination:{page:$p,limit:50}){data{id orderNumber status orderPaymentStatus orderPackageStatus currencyCode totalPrice totalFinalPrice shippingLines{price} customer{id firstName lastName email phone} orderLineItems{id quantity finalPrice price variant{name sku barcode productId}} shippingAddress{firstName lastName phone addressLine1 city{name} district{name} country{name} postalCode} billingAddress{firstName lastName addressLine1 city{name} country{name}} orderedAt note}page count}}`,
};

const ROOT: Partial<Record<MigrationEntity, string>> = {
  category: "listCategory",
  product: "listProduct",
  customer: "listCustomer",
  order: "listOrder",
};

const flatAddress = (raw: Record<string, unknown>) => ({
  ...raw,
  name: [toStr(raw["firstName"]), toStr(raw["lastName"])].filter(Boolean).join(" "),
  city: toStr(asRecord(raw["city"])["name"]),
  district: toStr(asRecord(raw["district"])["name"]),
  country: toStr(asRecord(raw["country"])["name"]) ?? "TR",
  address1: toStr(raw["addressLine1"]),
  address2: toStr(raw["addressLine2"]),
  postcode: toStr(raw["postalCode"]),
});

const ikas: MigrationProviderModule = {
  code: "ikas",
  name: "ikas",
  region: "Türkiye",
  docsUrl: "https://ikas.dev/docs/api/admin-api",
  howTo:
    "ikas panelinizde Ayarlar → Uygulamalar → Özel uygulama oluşturun; Client ID ve Client Secret ile alınan erişim tokenını buraya girin (ürün, müşteri ve sipariş okuma yetkisi gerekir).",
  entities: ["category", "product", "customer", "order"],
  credentialFields: [{ key: "access_token", label: "Admin API erişim tokenı", secret: true }],
  baseUrl: () => "https://api.myikas.com/api/v1/admin",
  authHeaders: (credentials) => ({
    Authorization: `Bearer ${credentials["access_token"] ?? ""}`,
    "Content-Type": "application/json",
  }),
  probeRequest: () => ({
    method: "POST",
    path: "/graphql",
    body: { query: `query{listCategory{id name}}` },
  }),
  pageRequest: (entity, cursor) => {
    const query = QUERIES[entity];
    if (!query) return null;
    return { method: "POST", path: "/graphql", body: { query, variables: { p: cursor.page } } };
  },
  extract: (entity, body) => {
    const data = asRecord(asRecord(body)["data"]);
    const root = data[ROOT[entity] ?? ""];
    if (Array.isArray(root)) return { rows: root.map((row) => asRecord(row)) };
    return { rows: asArray(asRecord(root)["data"] ?? []) };
  },
  normalize: (entity, raw): NormalizedRecord | null => {
    const externalId = toStr(raw["id"]);
    if (!externalId) return null;

    if (entity === "category") {
      const name = toStr(raw["name"]) ?? "Kategori";
      const path = asArray(raw["categoryPath"]);
      return {
        entity: "category",
        data: {
          externalId,
          name,
          slug: slugify(name),
          description: toStr(raw["description"]),
          imageUrl: null,
          parentExternalId: path.length > 1 ? toStr(path[path.length - 2]?.["id"]) : null,
          sortOrder: 0,
          isActive: true,
          seoTitle: null,
          seoDescription: null,
        },
      };
    }

    if (entity === "product") {
      const title = toStr(raw["name"]) ?? "Ürün";
      const meta = asRecord(raw["metaData"]);
      const variants = asArray(raw["variants"]);
      const priceOf = (variant: Record<string, unknown>) => {
        const price = asArray(variant["prices"])[0] ?? {};
        const sell = toNum(price["discountPrice"], 0) || toNum(price["sellPrice"]);
        return { sell, list: toNum(price["sellPrice"]), cost: toNum(price["buyPrice"], 0) || null };
      };
      const firstPrice = variants[0] ? priceOf(variants[0]) : { sell: 0, list: 0, cost: null };
      return {
        entity: "product",
        data: {
          externalId,
          title,
          slug: toStr(meta["slug"]) ?? slugify(title),
          description: toStr(raw["description"]),
          status: "active",
          vendor: toStr(asRecord(raw["brand"])["name"]),
          productType: toStr(raw["type"]),
          tags: asArray(raw["tags"]).map((tag) => toStr(tag["name"]) ?? "").filter(Boolean),
          basePrice: firstPrice.sell,
          compareAtPrice: firstPrice.list > firstPrice.sell ? firstPrice.list : null,
          costPrice: firstPrice.cost,
          currency: null,
          sku: toStr(variants[0]?.["sku"]),
          barcode: toStr(variants[0]?.["barcode"]),
          weightGrams: null,
          taxRate: null,
          images: [],
          variants: variants.map((variant, index) => {
            const price = priceOf(variant);
            return {
              externalId: toStr(variant["id"]) ?? `${externalId}-${index}`,
              title:
                asArray(variant["variantValues"])
                  .map((value) => toStr(value["valueName"]) ?? "")
                  .filter(Boolean)
                  .join(" / ") || `Varyant ${index + 1}`,
              sku: toStr(variant["sku"]),
              barcode: toStr(variant["barcode"]),
              price: price.sell,
              compareAtPrice: price.list > price.sell ? price.list : null,
              costPrice: price.cost,
              stock: asArray(variant["stocks"]).reduce((sum, stock) => sum + toInt(stock["stockCount"]), 0),
              weightGrams: null,
              options: Object.fromEntries(
                asArray(variant["variantValues"]).map((value) => [
                  toStr(value["variationName"]) ?? "Seçenek",
                  toStr(value["valueName"]) ?? "",
                ]),
              ),
            };
          }),
          categoryExternalIds: asArray(raw["categories"])
            .map((category) => toStr(category["id"]))
            .filter((value): value is string => Boolean(value)),
          seoTitle: toStr(meta["pageTitle"]),
          seoDescription: toStr(meta["description"]),
          sourcePath: null,
        },
      };
    }

    if (entity === "customer") {
      const first = toStr(raw["firstName"]);
      const last = toStr(raw["lastName"]);
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
          acceptsMarketing: false,
          notes: toStr(raw["note"]),
          tags: [],
          totalSpent: 0,
          ordersCount: 0,
          createdAt: isoDate(raw["createdAt"]),
          addresses: asArray(raw["addresses"])
            .map((address) => addressFrom(flatAddress(address)))
            .filter((address) => address.line1.length > 0 && address.recipient.length > 0),
        },
      };
    }

    if (entity === "order") {
      const status = mapOrderStatus(raw["orderPackageStatus"] ?? raw["status"]);
      const customer = asRecord(raw["customer"]);
      const grandTotal = toNum(raw["totalFinalPrice"], 0) || toNum(raw["totalPrice"]);
      return {
        entity: "order",
        data: {
          externalId,
          orderNumber: toStr(raw["orderNumber"]) ?? externalId,
          status,
          paymentStatus: mapPaymentStatus(status, raw["orderPaymentStatus"]),
          fulfillmentStatus: mapFulfillmentStatus(status),
          currency: toStr(raw["currencyCode"]) ?? "TRY",
          subtotal: toNum(raw["totalPrice"], grandTotal),
          discountTotal: 0,
          shippingTotal: asArray(raw["shippingLines"]).reduce((sum, line) => sum + toNum(line["price"]), 0),
          taxTotal: 0,
          grandTotal,
          discountCode: null,
          customerExternalId: toStr(customer["id"]),
          customerEmail: toStr(customer["email"]),
          customerName: [toStr(customer["firstName"]), toStr(customer["lastName"])].filter(Boolean).join(" ") || null,
          customerPhone: toStr(customer["phone"]),
          shippingAddress: flatAddress(asRecord(raw["shippingAddress"])),
          billingAddress: flatAddress(asRecord(raw["billingAddress"])),
          shippingCarrier: null,
          trackingNumber: null,
          note: toStr(raw["note"]),
          placedAt: isoDate(raw["orderedAt"]) ?? new Date().toISOString(),
          items: asArray(raw["orderLineItems"]).map((item) => {
            const variant = asRecord(item["variant"]);
            const quantity = Math.max(1, toInt(item["quantity"], 1));
            const unitPrice = toNum(item["finalPrice"], 0) || toNum(item["price"]);
            return {
              title: toStr(variant["name"]) ?? "Ürün",
              variantTitle: null,
              sku: toStr(variant["sku"]),
              barcode: toStr(variant["barcode"]),
              productExternalId: toStr(variant["productId"]),
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

    return genericNormalize(entity, raw);
  },
};

export default ikas;
