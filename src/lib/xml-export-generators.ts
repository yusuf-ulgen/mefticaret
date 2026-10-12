/**
 * Pazaryeri XML üreticileri ve doğrulama kuralları.
 *
 * Her pazaryeri kendi şemasını ve zorunlu alan kurallarını tanımlar:
 * Trendyol, Hepsiburada, N11, Amazon, Google Shopping ve genel XML.
 * Bu dosya saftır (tarayıcıda da çalışır) — indirme/yükleme sunucudadır.
 */

import type { XmlPlatform } from "@/lib/xml-integrator";

export type ExportProduct = {
  id: string;
  sku: string | null;
  barcode: string | null;
  title: string;
  description: string | null;
  brand: string | null;
  categoryName: string | null;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  taxRate: number;
  stock: number;
  weightGrams: number | null;
  images: string[];
  productUrl: string | null;
  options: Record<string, string>;
};

export type ExportIssue = { productId: string; title: string; reason: string };

export type GeneratedExport = {
  platform: XmlPlatform;
  xml: string;
  included: number;
  skipped: number;
  issues: ExportIssue[];
  contentType: string;
};

/* ------------------------------- yardımcılar ------------------------------ */

/** XML metin kaçışı. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Kontrol karakterlerini temizler (pazaryerleri reddeder). */
export function cleanText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
}

/** HTML etiketlerini sökerek düz metin üretir. */
export function stripHtml(value: string): string {
  return cleanText(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));
}

const tag = (name: string, value: string | number | null | undefined) =>
  value === null || value === undefined || value === "" ? "" : `<${name}>${escapeXml(String(value))}</${name}>`;

const cdata = (name: string, value: string | null | undefined) =>
  !value ? "" : `<${name}><![CDATA[${value.replace(/]]>/g, "]] >")}]]></${name}>`;

const money = (value: number) => value.toFixed(2);

const isHttps = (url: string) => /^https:\/\//i.test(url);
const isNumericBarcode = (value: string) => /^\d{8,14}$/.test(value);

/* ------------------------------- doğrulama -------------------------------- */

export type ValidationRule = {
  code: string;
  label: string;
  check: (product: ExportProduct) => string | null;
};

const requireBarcode = (numeric: boolean): ValidationRule => ({
  code: "barcode",
  label: numeric ? "Barkod zorunlu ve yalnızca 8-14 haneli sayı olmalı" : "Barkod zorunlu",
  check: (product) => {
    const barcode = (product.barcode ?? "").trim();
    if (!barcode) return "barkod boş";
    if (numeric && !isNumericBarcode(barcode)) return `barkod sayısal değil (${barcode})`;
    return null;
  },
});

const requireTitleLength = (max: number): ValidationRule => ({
  code: "title",
  label: `Ürün adı zorunlu, en fazla ${max} karakter`,
  check: (product) => {
    const title = cleanText(product.title);
    if (!title) return "ürün adı boş";
    if (title.length > max) return `ürün adı ${title.length} karakter (en fazla ${max})`;
    return null;
  },
});

const requireHttpsImages = (min: number): ValidationRule => ({
  code: "images",
  label: `En az ${min} görsel ve tüm görseller HTTPS olmalı`,
  check: (product) => {
    const images = product.images.filter(Boolean);
    if (images.length < min) return "görsel yok";
    const insecure = images.find((url) => !isHttps(url));
    if (insecure) return `görsel HTTPS değil (${insecure.slice(0, 60)})`;
    return null;
  },
});

const requirePrice: ValidationRule = {
  code: "price",
  label: "Satış fiyatı sıfırdan büyük olmalı",
  check: (product) => (product.price > 0 ? null : "fiyat sıfır veya geçersiz"),
};

const requireStock: ValidationRule = {
  code: "stock",
  label: "Stok adedi negatif olamaz",
  check: (product) => (product.stock >= 0 ? null : "stok negatif"),
};

const requireSku: ValidationRule = {
  code: "sku",
  label: "Stok kodu (SKU) zorunlu",
  check: (product) => ((product.sku ?? "").trim() ? null : "stok kodu boş"),
};

const requireBrand: ValidationRule = {
  code: "brand",
  label: "Marka zorunlu",
  check: (product) => ((product.brand ?? "").trim() ? null : "marka boş"),
};

const requireCategory: ValidationRule = {
  code: "category",
  label: "Kategori zorunlu",
  check: (product) => ((product.categoryName ?? "").trim() ? null : "kategori boş"),
};

const requireDescription = (min: number): ValidationRule => ({
  code: "description",
  label: `Açıklama zorunlu (en az ${min} karakter)`,
  check: (product) => {
    const description = stripHtml(product.description ?? "");
    return description.length >= min ? null : "açıklama çok kısa";
  },
});

/* ------------------------------- üreticiler ------------------------------- */

export type GeneratorDefinition = {
  platform: XmlPlatform;
  label: string;
  rules: ValidationRule[];
  root: (items: string[], context: ExportContext) => string;
  item: (product: ExportProduct, context: ExportContext) => string;
};

export type ExportContext = {
  storeName: string;
  storeUrl: string | null;
  currency: string;
  generatedAt: string;
};

const header = '<?xml version="1.0" encoding="UTF-8"?>';

/** Trendyol — resmi ürün beslemesi şeması. */
const trendyol: GeneratorDefinition = {
  platform: "trendyol",
  label: "Trendyol",
  rules: [
    requireSku,
    requireBarcode(true),
    requireTitleLength(100),
    requireHttpsImages(1),
    requirePrice,
    requireStock,
    requireBrand,
    requireCategory,
  ],
  root: (items, context) =>
    `${header}\n<Products generatedAt="${escapeXml(context.generatedAt)}" store="${escapeXml(context.storeName)}">\n${items.join("\n")}\n</Products>`,
  item: (product) => {
    const images = product.images
      .slice(0, 8)
      .map((url, index) => `      <Image Order="${index + 1}">${escapeXml(url)}</Image>`)
      .join("\n");
    const attributes = Object.entries(product.options)
      .slice(0, 10)
      .map(
        ([name, value]) =>
          `      <Attribute><Name>${escapeXml(name)}</Name><Value>${escapeXml(value)}</Value></Attribute>`,
      )
      .join("\n");
    return [
      "  <Product>",
      `    ${tag("Barcode", product.barcode)}`,
      `    ${tag("ProductMainId", product.sku ?? product.barcode)}`,
      `    ${tag("StockCode", product.sku ?? product.barcode)}`,
      `    ${tag("Title", cleanText(product.title).slice(0, 100))}`,
      `    ${cdata("Description", product.description ?? "")}`,
      `    ${tag("Brand", product.brand)}`,
      `    ${tag("CategoryName", product.categoryName)}`,
      `    ${tag("ListPrice", money(product.compareAtPrice ?? product.price))}`,
      `    ${tag("SalePrice", money(product.price))}`,
      `    ${tag("VatRate", Math.round(product.taxRate))}`,
      `    ${tag("CurrencyType", product.currency)}`,
      `    ${tag("Quantity", product.stock)}`,
      product.weightGrams ? `    ${tag("DimensionalWeight", (product.weightGrams / 1000).toFixed(2))}` : "",
      images ? `    <Images>\n${images}\n    </Images>` : "",
      attributes ? `    <Attributes>\n${attributes}\n    </Attributes>` : "",
      "  </Product>",
    ]
      .filter((line) => line.trim())
      .join("\n");
  },
};

/** Hepsiburada — ürün listeleme beslemesi. */
const hepsiburada: GeneratorDefinition = {
  platform: "hepsiburada",
  label: "Hepsiburada",
  rules: [
    requireSku,
    requireBarcode(true),
    requireTitleLength(150),
    requireHttpsImages(1),
    requirePrice,
    requireStock,
    requireBrand,
    requireDescription(20),
  ],
  root: (items, context) =>
    `${header}\n<listing generatedAt="${escapeXml(context.generatedAt)}">\n  <items>\n${items.join("\n")}\n  </items>\n</listing>`,
  item: (product) => {
    const images = product.images
      .slice(0, 5)
      .map((url, index) => `        ${tag(`image${index + 1}`, url)}`)
      .join("\n");
    return [
      "    <item>",
      `      ${tag("merchantSku", product.sku)}`,
      `      ${tag("barcode", product.barcode)}`,
      `      ${tag("productName", cleanText(product.title).slice(0, 150))}`,
      `      ${tag("brand", product.brand)}`,
      `      ${tag("categoryName", product.categoryName)}`,
      `      ${cdata("description", product.description ?? "")}`,
      `      ${tag("price", money(product.price))}`,
      `      ${tag("currencyType", product.currency)}`,
      `      ${tag("vatRate", Math.round(product.taxRate))}`,
      `      ${tag("stock", product.stock)}`,
      product.weightGrams ? `      ${tag("weight", (product.weightGrams / 1000).toFixed(2))}` : "",
      images,
      "    </item>",
    ]
      .filter((line) => line.trim())
      .join("\n");
  },
};

/** N11 — ürün beslemesi. */
const n11: GeneratorDefinition = {
  platform: "n11",
  label: "N11",
  rules: [
    requireSku,
    requireTitleLength(65),
    requireHttpsImages(1),
    requirePrice,
    requireStock,
    requireCategory,
    requireDescription(20),
  ],
  root: (items, context) =>
    `${header}\n<products generatedAt="${escapeXml(context.generatedAt)}" currency="${escapeXml(context.currency)}">\n${items.join("\n")}\n</products>`,
  item: (product) => {
    const images = product.images
      .slice(0, 8)
      .map((url, index) => `      <image><url>${escapeXml(url)}</url><order>${index + 1}</order></image>`)
      .join("\n");
    const attributes = Object.entries(product.options)
      .slice(0, 10)
      .map(
        ([name, value]) =>
          `      <attribute><name>${escapeXml(name)}</name><value>${escapeXml(value)}</value></attribute>`,
      )
      .join("\n");
    return [
      "  <product>",
      `    ${tag("productSellerCode", product.sku)}`,
      `    ${tag("gtin", product.barcode)}`,
      `    ${tag("title", cleanText(product.title).slice(0, 65))}`,
      `    ${cdata("subtitle", product.brand ?? "")}`,
      `    ${cdata("description", product.description ?? "")}`,
      `    ${tag("categoryName", product.categoryName)}`,
      `    ${tag("price", money(product.price))}`,
      `    ${tag("currencyType", product.currency)}`,
      `    ${tag("quantity", product.stock)}`,
      product.productUrl ? `    ${tag("productUrl", product.productUrl)}` : "",
      images ? `    <images>\n${images}\n    </images>` : "",
      attributes ? `    <attributes>\n${attributes}\n    </attributes>` : "",
      "  </product>",
    ]
      .filter((line) => line.trim())
      .join("\n");
  },
};

/** Amazon — envanter beslemesi (flat product feed). */
const amazon: GeneratorDefinition = {
  platform: "amazon",
  label: "Amazon",
  rules: [
    requireSku,
    requireBarcode(true),
    requireTitleLength(200),
    requireHttpsImages(1),
    requirePrice,
    requireStock,
    requireBrand,
    requireDescription(30),
  ],
  root: (items, context) =>
    [
      header,
      '<AmazonEnvelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="amzn-envelope.xsd">',
      "  <Header>",
      "    <DocumentVersion>1.01</DocumentVersion>",
      `    ${tag("MerchantIdentifier", context.storeName)}`,
      "  </Header>",
      "  <MessageType>Product</MessageType>",
      items.join("\n"),
      "</AmazonEnvelope>",
    ].join("\n"),
  item: (product, context) => {
    const bullets = stripHtml(product.description ?? "")
      .split(". ")
      .filter(Boolean)
      .slice(0, 5)
      .map((line) => `        ${tag("BulletPoint", line.slice(0, 500))}`)
      .join("\n");
    return [
      "  <Message>",
      `    ${tag("MessageID", product.id)}`,
      "    <OperationType>Update</OperationType>",
      "    <Product>",
      `      ${tag("SKU", product.sku)}`,
      product.barcode
        ? `      <StandardProductID><Type>EAN</Type><Value>${escapeXml(product.barcode)}</Value></StandardProductID>`
        : "",
      `      <DescriptionData>`,
      `        ${tag("Title", cleanText(product.title).slice(0, 200))}`,
      `        ${tag("Brand", product.brand)}`,
      `        ${cdata("Description", stripHtml(product.description ?? "").slice(0, 2000))}`,
      bullets,
      product.weightGrams
        ? `        <PackageWeight unitOfMeasure="GR">${Math.round(product.weightGrams)}</PackageWeight>`
        : "",
      `      </DescriptionData>`,
      `      <Offer>`,
      `        <Price currency="${escapeXml(product.currency || context.currency)}">${money(product.price)}</Price>`,
      `        ${tag("Quantity", product.stock)}`,
      `      </Offer>`,
      product.images.length
        ? `      <Images>\n${product.images
            .slice(0, 8)
            .map((url) => `        ${tag("URL", url)}`)
            .join("\n")}\n      </Images>`
        : "",
      "    </Product>",
      "  </Message>",
    ]
      .filter((line) => line.trim())
      .join("\n");
  },
};

/** Google Shopping — RSS 2.0 + g: ad alanı. */
const google: GeneratorDefinition = {
  platform: "google_shopping",
  label: "Google Shopping",
  rules: [requireSku, requireTitleLength(150), requireHttpsImages(1), requirePrice, requireDescription(10)],
  root: (items, context) =>
    [
      header,
      '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
      "  <channel>",
      `    ${tag("title", context.storeName)}`,
      context.storeUrl ? `    ${tag("link", context.storeUrl)}` : "",
      `    ${tag("description", `${context.storeName} ürün beslemesi`)}`,
      items.join("\n"),
      "  </channel>",
      "</rss>",
    ]
      .filter((line) => line.trim())
      .join("\n"),
  item: (product) =>
    [
      "    <item>",
      `      ${tag("g:id", product.sku ?? product.id)}`,
      `      ${tag("g:gtin", product.barcode)}`,
      `      ${tag("title", cleanText(product.title).slice(0, 150))}`,
      `      ${cdata("description", stripHtml(product.description ?? "").slice(0, 5000))}`,
      product.productUrl ? `      ${tag("link", product.productUrl)}` : "",
      product.images[0] ? `      ${tag("g:image_link", product.images[0])}` : "",
      `      ${tag("g:price", `${money(product.price)} ${product.currency}`)}`,
      `      ${tag("g:availability", product.stock > 0 ? "in_stock" : "out_of_stock")}`,
      `      ${tag("g:brand", product.brand)}`,
      `      ${tag("g:condition", "new")}`,
      "    </item>",
    ]
      .filter((line) => line.trim())
      .join("\n"),
};

/** Genel XML — tedarikçi/entegratör dostu düz şema. */
const generic: GeneratorDefinition = {
  platform: "generic",
  label: "Genel XML",
  rules: [requireTitleLength(500), requirePrice],
  root: (items, context) =>
    `${header}\n<products generatedAt="${escapeXml(context.generatedAt)}">\n${items.join("\n")}\n</products>`,
  item: (product) =>
    [
      "  <product>",
      `    ${tag("id", product.id)}`,
      `    ${tag("sku", product.sku)}`,
      `    ${tag("barcode", product.barcode)}`,
      `    ${tag("name", cleanText(product.title))}`,
      `    ${cdata("description", product.description ?? "")}`,
      `    ${tag("brand", product.brand)}`,
      `    ${tag("category", product.categoryName)}`,
      `    ${tag("price", money(product.price))}`,
      `    ${tag("listPrice", product.compareAtPrice === null ? null : money(product.compareAtPrice))}`,
      `    ${tag("currency", product.currency)}`,
      `    ${tag("taxRate", Math.round(product.taxRate))}`,
      `    ${tag("stock", product.stock)}`,
      `    ${tag("weightGrams", product.weightGrams)}`,
      product.productUrl ? `    ${tag("url", product.productUrl)}` : "",
      product.images.length
        ? `    <images>\n${product.images.map((url) => `      ${tag("image", url)}`).join("\n")}\n    </images>`
        : "",
      Object.keys(product.options).length
        ? `    <options>\n${Object.entries(product.options)
            .map(([name, value]) => `      <option name="${escapeXml(name)}">${escapeXml(value)}</option>`)
            .join("\n")}\n    </options>`
        : "",
      "  </product>",
    ]
      .filter((line) => line.trim())
      .join("\n"),
};

export const EXPORT_GENERATORS: GeneratorDefinition[] = [
  trendyol,
  hepsiburada,
  n11,
  amazon,
  google,
  generic,
];

/** Platform için üreticiyi döndürür; tanımsız platformlarda genel şema kullanılır. */
export function generatorFor(platform: XmlPlatform): GeneratorDefinition {
  return EXPORT_GENERATORS.find((item) => item.platform === platform) ?? generic;
}

/** Pazaryerinin doğrulama kurallarının okunabilir listesi (arayüzde gösterilir). */
export function validationRulesFor(platform: XmlPlatform): Array<{ code: string; label: string }> {
  return generatorFor(platform).rules.map((rule) => ({ code: rule.code, label: rule.label }));
}

/** Tek ürünü doğrular; sorun listesini döndürür. */
export function validateProduct(platform: XmlPlatform, product: ExportProduct): string[] {
  const reasons: string[] = [];
  for (const rule of generatorFor(platform).rules) {
    const reason = rule.check(product);
    if (reason) reasons.push(reason);
  }
  return reasons;
}

/** Ürün listesinden pazaryeri XML'i üretir; kural dışı ürünler atlanır. */
export function generateExportXml(
  platform: XmlPlatform,
  products: ExportProduct[],
  context: ExportContext,
): GeneratedExport {
  const generator = generatorFor(platform);
  const items: string[] = [];
  const issues: ExportIssue[] = [];

  for (const product of products) {
    const reasons = validateProduct(platform, product);
    if (reasons.length) {
      issues.push({
        productId: product.id,
        title: product.title,
        reason: reasons.join("; "),
      });
      continue;
    }
    items.push(generator.item(product, context));
  }

  return {
    platform,
    xml: generator.root(items, context),
    included: items.length,
    skipped: issues.length,
    issues,
    contentType: "application/xml; charset=utf-8",
  };
}
