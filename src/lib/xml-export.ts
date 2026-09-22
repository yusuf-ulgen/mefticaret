/**
 * XML Entegratör v2 — pazaryeri XML üreteçleri (saf fonksiyonlar).
 *
 * Trendyol, Hepsiburada, N11, Amazon ve genel XML formatları üretilir.
 * Her platformun kendi doğrulama kuralları vardır; kuralı geçemeyen ürün
 * çıktıya yazılmaz ve hata listesine eklenir (işlem durmaz).
 */

export type ExportPlatform = "trendyol" | "hepsiburada" | "n11" | "amazon" | "xml_generic";

export const EXPORT_PLATFORMS: Array<{ code: ExportPlatform; label: string; hint: string }> = [
  { code: "trendyol", label: "Trendyol", hint: "<Products><Product> · başlık 100 karakter, barkod 8-13 hane" },
  { code: "hepsiburada", label: "Hepsiburada", hint: "<listing> · ürün adı 255 karakter, alfanümerik MerchantSku" },
  { code: "n11", label: "N11", hint: "<products><product> · başlık 150 karakter, 2 ondalık fiyat" },
  { code: "amazon", label: "Amazon", hint: "Flat-file XML · SKU + EAN zorunlu" },
  { code: "xml_generic", label: "Genel XML", hint: "Yapılandırılabilir genel ürün akışı" },
];

export type ExportVariant = {
  sku: string;
  barcode: string | null;
  title: string;
  price: number;
  listPrice: number | null;
  stock: number;
  options: Array<{ name: string; value: string }>;
};

export type ExportProduct = {
  id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  description: string;
  brand: string | null;
  category: string;
  categoryId: string | null;
  price: number;
  listPrice: number | null;
  currency: string;
  taxRate: number | null;
  stock: number;
  link: string;
  images: string[];
  weight: number | null;
  variants: ExportVariant[];
};

export type ExportIssue = { productId: string; sku: string | null; code: string; message: string };

export type ExportResult = { xml: string; exported: number; failed: number; issues: ExportIssue[] };

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // XML 1.0'da geçersiz kontrol karakterleri temizlenir
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

const cdata = (value: string): string => `<![CDATA[${value.replace(/]]>/g, "]]&gt;")}]]>`;

const money = (value: number, decimals = 2): string => Number(value || 0).toFixed(decimals);

const httpsImages = (images: string[]): string[] => images.filter((url) => /^https:\/\//i.test(url));

/* ------------------------------------------------------------------ */
/* Doğrulamalar                                                       */
/* ------------------------------------------------------------------ */

function validate(product: ExportProduct, platform: ExportPlatform): ExportIssue[] {
  const issues: ExportIssue[] = [];
  const push = (code: string, message: string) =>
    issues.push({ productId: product.id, sku: product.sku, code, message });

  if (!product.title.trim()) push("VALIDATION_ERROR", "Ürün adı boş");
  if (product.price <= 0) push("VALIDATION_ERROR", "Fiyat 0'dan büyük olmalı");
  if (product.stock < 0) push("VALIDATION_ERROR", "Stok negatif olamaz");

  if (platform === "trendyol") {
    if (product.title.length > 100) push("VALIDATION_ERROR", "Trendyol başlığı en fazla 100 karakter olabilir");
    const barcode = (product.barcode ?? "").trim();
    if (!/^\d{8,13}$/.test(barcode)) push("VALIDATION_ERROR", "Trendyol barkodu 8-13 haneli sayı olmalı");
    if (!httpsImages(product.images).length) push("VALIDATION_ERROR", "En az 1 HTTPS görsel adresi gerekli");
  }

  if (platform === "hepsiburada") {
    if (product.title.length > 255) push("VALIDATION_ERROR", "Hepsiburada ürün adı en fazla 255 karakter olabilir");
    const merchantSku = (product.sku ?? "").trim();
    if (!/^[A-Za-z0-9._-]{1,50}$/.test(merchantSku)) {
      push("VALIDATION_ERROR", "MerchantSku alfanümerik olmalı (harf, sayı, . _ -)");
    }
  }

  if (platform === "n11") {
    if (product.title.length > 150) push("VALIDATION_ERROR", "N11 başlığı en fazla 150 karakter olabilir");
  }

  if (platform === "amazon") {
    if (!(product.sku ?? "").trim()) push("VALIDATION_ERROR", "Amazon için SKU zorunlu");
    if (!/^\d{8,14}$/.test((product.barcode ?? "").trim())) push("VALIDATION_ERROR", "Amazon için EAN/UPC zorunlu");
  }

  return issues;
}

/* ------------------------------------------------------------------ */
/* Üreteçler                                                          */
/* ------------------------------------------------------------------ */

function trendyolItem(product: ExportProduct): string {
  const images = httpsImages(product.images)
    .slice(0, 8)
    .map((url) => `      <Image Path="${escapeXml(url)}" />`)
    .join("\n");
  const variants = product.variants.length
    ? product.variants
        .map(
          (variant) => `      <Variant>
        <Barcode>${escapeXml(variant.barcode ?? variant.sku)}</Barcode>
        <StockCode>${escapeXml(variant.sku)}</StockCode>
        <Quantity>${Math.max(0, variant.stock)}</Quantity>
        <SalePrice>${money(variant.price)}</SalePrice>
        <ListPrice>${money(variant.listPrice ?? variant.price)}</ListPrice>
${variant.options
  .map(
    (option) => `        <Attribute>
          <Name>${escapeXml(option.name)}</Name>
          <Value>${escapeXml(option.value)}</Value>
        </Attribute>`,
  )
  .join("\n")}
      </Variant>`,
        )
        .join("\n")
    : "";

  return `  <Product>
    <Barcode>${escapeXml(product.barcode ?? product.sku ?? product.id)}</Barcode>
    <Title>${escapeXml(product.title)}</Title>
    <ProductMainId>${escapeXml(product.sku ?? product.id)}</ProductMainId>
    <BrandName>${escapeXml(product.brand ?? "")}</BrandName>
    <CategoryName>${escapeXml(product.categoryId ?? product.category)}</CategoryName>
    <Quantity>${Math.max(0, product.stock)}</Quantity>
    <StockCode>${escapeXml(product.sku ?? product.id)}</StockCode>
    <Description>${cdata(product.description)}</Description>
    <CurrencyType>${escapeXml(product.currency)}</CurrencyType>
    <ListPrice>${money(product.listPrice ?? product.price)}</ListPrice>
    <SalePrice>${money(product.price)}</SalePrice>
    <VatRate>${Math.round(product.taxRate ?? 20)}</VatRate>
    <ProductUrl>${escapeXml(product.link)}</ProductUrl>
    <Images>
${images}
    </Images>${variants ? `\n    <Variants>\n${variants}\n    </Variants>` : ""}
  </Product>`;
}

function hepsiburadaItem(product: ExportProduct): string {
  const image = httpsImages(product.images)[0] ?? product.images[0] ?? "";
  const extraImages = product.images
    .slice(1, 6)
    .map((url, index) => `    <Image${index + 2}>${escapeXml(url)}</Image${index + 2}>`)
    .join("\n");
  return `  <listing>
    <MerchantSku>${escapeXml(product.sku ?? product.id)}</MerchantSku>
    <Barcode>${escapeXml(product.barcode ?? "")}</Barcode>
    <ProductName>${escapeXml(product.title)}</ProductName>
    <Brand>${escapeXml(product.brand ?? "")}</Brand>
    <CategoryName>${escapeXml(product.categoryId ?? product.category)}</CategoryName>
    <Price>${money(product.price)}</Price>
    <ListPrice>${money(product.listPrice ?? product.price)}</ListPrice>
    <Currency>${escapeXml(product.currency)}</Currency>
    <AvailableStock>${Math.max(0, product.stock)}</AvailableStock>
    <VatRate>${Math.round(product.taxRate ?? 20)}</VatRate>
    <Description>${cdata(product.description)}</Description>
    <ProductUrl>${escapeXml(product.link)}</ProductUrl>
    <Image1>${escapeXml(image)}</Image1>
${extraImages}
  </listing>`;
}

function n11Item(product: ExportProduct): string {
  const images = product.images
    .slice(0, 8)
    .map((url, index) => `      <image><url>${escapeXml(url)}</url><order>${index + 1}</order></image>`)
    .join("\n");
  const stockItems = (product.variants.length ? product.variants : [null])
    .map((variant) => {
      const sku = variant ? variant.sku : product.sku ?? product.id;
      const quantity = variant ? variant.stock : product.stock;
      const price = variant ? variant.price : product.price;
      const attributes = variant?.options.length
        ? `\n        <attributes>${variant.options
            .map(
              (option) =>
                `<attribute><name>${escapeXml(option.name)}</name><value>${escapeXml(option.value)}</value></attribute>`,
            )
            .join("")}</attributes>`
        : "";
      return `      <stockItem>
        <sellerStockCode>${escapeXml(sku)}</sellerStockCode>
        <quantity>${Math.max(0, quantity)}</quantity>
        <optionPrice>${money(price)}</optionPrice>${attributes}
      </stockItem>`;
    })
    .join("\n");

  return `  <product>
    <productSellerCode>${escapeXml(product.sku ?? product.id)}</productSellerCode>
    <title>${escapeXml(product.title)}</title>
    <subtitle>${escapeXml(product.title.slice(0, 65))}</subtitle>
    <description>${cdata(product.description)}</description>
    <category><name>${escapeXml(product.categoryId ?? product.category)}</name></category>
    <price>${money(product.price)}</price>
    <currencyType>${escapeXml(product.currency)}</currencyType>
    <productionDate />
    <preparingDay>2</preparingDay>
    <brand>${escapeXml(product.brand ?? "")}</brand>
    <images>
${images}
    </images>
    <stockItems>
${stockItems}
    </stockItems>
  </product>`;
}

function amazonItem(product: ExportProduct, index: number): string {
  return `  <Message>
    <MessageID>${index + 1}</MessageID>
    <OperationType>Update</OperationType>
    <Product>
      <SKU>${escapeXml(product.sku ?? product.id)}</SKU>
      <StandardProductID>
        <Type>EAN</Type>
        <Value>${escapeXml(product.barcode ?? "")}</Value>
      </StandardProductID>
      <DescriptionData>
        <Title>${escapeXml(product.title)}</Title>
        <Brand>${escapeXml(product.brand ?? "")}</Brand>
        <Description>${cdata(product.description)}</Description>
        <MerchantCatalogNumber>${escapeXml(product.sku ?? product.id)}</MerchantCatalogNumber>
        ${product.weight ? `<ItemWeight unitOfMeasure="KG">${money(product.weight, 3)}</ItemWeight>` : ""}
        <ItemType>${escapeXml(product.categoryId ?? product.category)}</ItemType>
      </DescriptionData>
      <Price>
        <StandardPrice currency="${escapeXml(product.currency)}">${money(product.price)}</StandardPrice>
      </Price>
      <Inventory>
        <Quantity>${Math.max(0, product.stock)}</Quantity>
      </Inventory>
      <Images>
${product.images
  .slice(0, 8)
  .map((url) => `        <Image>${escapeXml(url)}</Image>`)
  .join("\n")}
      </Images>
    </Product>
  </Message>`;
}

function genericItem(product: ExportProduct): string {
  return `  <item>
    <id>${escapeXml(product.id)}</id>
    <sku>${escapeXml(product.sku ?? "")}</sku>
    <barcode>${escapeXml(product.barcode ?? "")}</barcode>
    <title>${escapeXml(product.title)}</title>
    <description>${cdata(product.description)}</description>
    <brand>${escapeXml(product.brand ?? "")}</brand>
    <category>${escapeXml(product.categoryId ?? product.category)}</category>
    <price currency="${escapeXml(product.currency)}">${money(product.price)}</price>
    <list_price>${money(product.listPrice ?? product.price)}</list_price>
    <vat_rate>${Math.round(product.taxRate ?? 20)}</vat_rate>
    <stock>${Math.max(0, product.stock)}</stock>
    <link>${escapeXml(product.link)}</link>
    <images>
${product.images
  .slice(0, 12)
  .map((url) => `      <image>${escapeXml(url)}</image>`)
  .join("\n")}
    </images>${
      product.variants.length
        ? `\n    <variants>\n${product.variants
            .map(
              (variant) => `      <variant>
        <sku>${escapeXml(variant.sku)}</sku>
        <barcode>${escapeXml(variant.barcode ?? "")}</barcode>
        <title>${escapeXml(variant.title)}</title>
        <price>${money(variant.price)}</price>
        <stock>${Math.max(0, variant.stock)}</stock>
${variant.options
  .map((option) => `        <option name="${escapeXml(option.name)}">${escapeXml(option.value)}</option>`)
  .join("\n")}
      </variant>`,
            )
            .join("\n")}\n    </variants>`
        : ""
    }
  </item>`;
}

/** Seçili platform için XML çıktısını üretir ve geçersiz ürünleri raporlar. */
export function buildMarketplaceXml(
  platform: ExportPlatform,
  products: ExportProduct[],
  meta: { storeName: string; storeUrl: string; generatedAt?: string },
): ExportResult {
  const issues: ExportIssue[] = [];
  const valid: ExportProduct[] = [];
  for (const product of products) {
    const productIssues = validate(product, platform);
    if (productIssues.length) {
      issues.push(...productIssues);
      continue;
    }
    valid.push(product);
  }

  const generatedAt = meta.generatedAt ?? new Date().toISOString();
  const header = `<?xml version="1.0" encoding="UTF-8"?>`;
  let body = "";

  if (platform === "trendyol") {
    body = `<Products generatedAt="${escapeXml(generatedAt)}" store="${escapeXml(meta.storeName)}">
${valid.map(trendyolItem).join("\n")}
</Products>`;
  } else if (platform === "hepsiburada") {
    body = `<listings generatedAt="${escapeXml(generatedAt)}" store="${escapeXml(meta.storeName)}">
${valid.map(hepsiburadaItem).join("\n")}
</listings>`;
  } else if (platform === "n11") {
    body = `<products generatedAt="${escapeXml(generatedAt)}" store="${escapeXml(meta.storeName)}">
${valid.map(n11Item).join("\n")}
</products>`;
  } else if (platform === "amazon") {
    body = `<AmazonEnvelope>
  <Header>
    <DocumentVersion>1.02</DocumentVersion>
    <MerchantIdentifier>${escapeXml(meta.storeName)}</MerchantIdentifier>
  </Header>
  <MessageType>Product</MessageType>
${valid.map((product, index) => amazonItem(product, index)).join("\n")}
</AmazonEnvelope>`;
  } else {
    body = `<feed generatedAt="${escapeXml(generatedAt)}">
  <store>
    <name>${escapeXml(meta.storeName)}</name>
    <url>${escapeXml(meta.storeUrl)}</url>
  </store>
${valid.map(genericItem).join("\n")}
</feed>`;
  }

  const failedIds = new Set(issues.map((issue) => issue.productId));
  return { xml: `${header}\n${body}`, exported: valid.length, failed: failedIds.size, issues };
}

/** "trendyol-feed-{date}.xml" gibi şablonları çözer. */
export function resolveOutputFilename(pattern: string | null | undefined, platform: ExportPlatform): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 19).replace(/:/g, "");
  const template = (pattern ?? `${platform}-feed-{date}.xml`).trim() || `${platform}-feed-{date}.xml`;
  const resolved = template
    .replace(/\{date\}/gi, date)
    .replace(/\{time\}/gi, time)
    .replace(/\{platform\}/gi, platform)
    .replace(/[^A-Za-z0-9._{}-]/g, "-");
  return resolved.toLowerCase().endsWith(".xml") ? resolved : `${resolved}.xml`;
}
