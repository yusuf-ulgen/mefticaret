import { readAllPages } from "@/lib/read-all-pages";
import { supplierOwnsItem, supplierOwnershipWithHistory } from "@/lib/supplier-item-ownership";
import { productImageSources } from "@/lib/product-image-sources";
/**
 * Tedarikçi portalı fulfillment masası sunucu katmanı.
 * Sipariş parçalama sonuçları, kargo etiketi verisi, komisyon defteri,
 * ödeme talepleri, performans karnesi ve toplu ürün yükleme işlemleri.
 * Çağıran her zaman kendi tedarikçi kimlikleriyle sınırlandırılır.
 */

import type { SupplierScorecard } from "@/lib/supplier-import";

type Client = { from: (table: string) => any };

export type DeskItem = {
  id: string;
  title: string;
  variantTitle: string | null;
  description: string | null;
  productCode: string | null;
  barcode: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  mine: boolean;
  imageUrl: string | null;
};

export type DeskOrder = {
  dropshipOrderId: string;
  supplierId: string;
  supplierName: string;
  orderId: string;
  orderNumber: string;
  orderCreatedAt: string;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  currency: string;
  customerName: string | null;
  customerPhone: string | null;
  addressLines: string[];
  items: DeskItem[];
  itemsTotal: number | null;
  relationIssue: boolean;
  commissionTotal: number | null;
  netTotal: number | null;
  note: string | null;
  paymentStatus: string | null;
};

export type SupplierCatalogRow = {
  id: string;
  feedId: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  brand: string | null;
  supplierPrice: number;
  configuredSalePrice: number | null;
  suggestedPrice: number | null;
  catalogVisible: boolean;
  salePrice: number;
  stock: number;
  sourceStock: number;
  warehouseReserved: number | null;
  warehouseOnHand: number | null;
  warehouseUpdatedAt: string | null;
  storeStock: number | null;
  sourceUpdatedAt: string;
  storeUpdatedAt: string | null;
  currency: string;
  images: string[];
  description: string | null;
  color: string | null;
  size: string | null;
  productId: string | null;
  variantId: string | null;
  isPublished: boolean;
  updatedAt: string;
};

export type SupplierRfqRow = {
  id: string;
  reference: string;
  companyName: string;
  currency: string;
  total: number;
  status: string;
  validUntil: string | null;
  purchaseOrderId: string | null;
  items: Array<{
    supplierProductId?: string;
    title: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
  }>;
  createdAt: string;
};

export type LedgerSummary = {
  supplierId: string;
  supplierName: string;
  currency: string;
  commissionRate: number;
  iban: string | null;
  accountName: string | null;
  revenue: number;
  commission: number;
  net: number;
  pending: number;
  payable: number;
  paid: number;
  scorecard: SupplierScorecard;
};

export type PayoutRow = {
  id: string;
  supplierId: string;
  amount: number;
  currency: string;
  iban: string;
  status: string;
  note: string | null;
  adminNote: string | null;
  createdAt: string;
  processedAt: string | null;
};

const num = (value: unknown) => Number(value ?? 0) || 0;

function formatAddress(address: unknown): string[] {
  if (!address || typeof address !== "object") return [];
  const record = address as Record<string, unknown>;
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  };
  const lines = [
    pick("full_name", "name", "recipient"),
    pick("address_line1", "line1", "address", "address_line"),
    pick("address_line2", "line2", "neighborhood"),
    [pick("district"), pick("city"), pick("postal_code", "zip")].filter(Boolean).join(" "),
    pick("state", "region"),
    pick("country", "country_code"),
    pick("phone"),
  ];
  return lines.filter((line) => line.length > 0);
}

/** Tedarikçinin kendi kalemleriyle birlikte sipariş listesini hazırlar. */
export async function loadSupplierDeskOrders(
  admin: Client,
  supplierIds: string[],
  limit = 200,
  offset = 0,
): Promise<DeskOrder[]> {
  if (!supplierIds.length) return [];

  const { data: dropship, error } = await admin
    .from("dropship_orders")
    .select(
      "id, supplier_id, order_id, status, carrier, tracking_number, created_at, suppliers(name)",
    )
    .in("supplier_id", supplierIds)
    .order("created_at", { ascending: false })
    .order("id")
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  const rows = (dropship ?? []) as any[];
  if (!rows.length) return [];

  const orderIds = Array.from(new Set(rows.map((row) => row.order_id as string)));

  const [{ data: orders }, { data: items }, { data: commissions }] = await Promise.all([
    readAllPages((from, to) =>
      admin
        .from("orders")
        .select(
          "id, order_number, created_at, currency, shipping_carrier, customer_name, customer_phone, shipping_address, note, payment_status",
        )
        .in("id", orderIds)
        .order("id")
        .range(from, to),
    ),
    readAllPages((from, to) =>
      admin
        .from("order_items")
        .select(
          "id, order_id, product_id, variant_id, title, variant_title, sku, quantity, unit_price, line_total",
        )
        .in("order_id", orderIds)
        .order("id")
        .range(from, to),
    ),
    readAllPages((from, to) =>
      admin
        .from("supplier_commission_entries")
        .select("order_id, supplier_id, order_item_id, gross_amount, commission_amount, net_amount")
        .in("order_id", orderIds)
        .order("id")
        .range(from, to),
    ),
  ]);

  const orderMap = new Map(((orders ?? []) as any[]).map((order) => [order.id as string, order]));
  const itemRows = (items ?? []) as any[];
  const commissionRows = (commissions ?? []) as any[];

  const productIds = Array.from(
    new Set(itemRows.map((item) => item.product_id).filter((id): id is string => Boolean(id))),
  );
  const variantIds = Array.from(
    new Set(itemRows.map((item) => item.variant_id).filter((id): id is string => Boolean(id))),
  );

  const [{ data: products }, { data: variants }, { data: mappings }, { data: images }] =
    await Promise.all([
      productIds.length
        ? readAllPages((from, to) =>
            admin
              .from("products")
              .select("id, description, sku, barcode")
              .in("id", productIds)
              .order("id")
              .range(from, to),
          )
        : Promise.resolve({ data: [] }),
      variantIds.length
        ? readAllPages((from, to) =>
            admin
              .from("product_variants")
              .select("id, sku, barcode")
              .in("id", variantIds)
              .order("id")
              .range(from, to),
          )
        : Promise.resolve({ data: [] }),
      itemRows.length
        ? readAllPages((from, to) =>
            admin
              .from("order_item_suppliers")
              .select("supplier_id, order_item_id")
              .in("order_id", orderIds)
              .order("order_item_id")
              .order("supplier_id")
              .range(from, to),
          )
        : Promise.resolve({ data: [] }),
      productIds.length
        ? readAllPages((from, to) =>
            admin
              .from("product_images")
              .select("product_id, url, position")
              .in("product_id", productIds)
              .order("position")
              .order("id")
              .range(from, to),
          )
        : Promise.resolve({ data: [] }),
    ]);

  const productMap = new Map(((products ?? []) as any[]).map((row) => [row.id as string, row]));
  const variantMap = new Map(((variants ?? []) as any[]).map((row) => [row.id as string, row]));
  const mappingRows = supplierOwnershipWithHistory(
    itemRows,
    (mappings ?? []) as any[],
    commissionRows,
  );
  const imageRows = (images ?? []) as any[];

  const ownsItem = (supplierId: string, item: { id: string }) =>
    supplierOwnsItem(supplierId, item.id, mappingRows);

  return rows.map((row) => {
    const order = orderMap.get(row.order_id as string);
    if (!order) throw new Error("Sipariş ayrıntıları alınamadı. Lütfen tekrar deneyin.");
    const orderItems = itemRows.filter((item) => item.order_id === row.order_id);
    const mine = orderItems.filter((item) => ownsItem(row.supplier_id as string, item));
    const relationIssue =
      !mine.length ||
      orderItems.some(
        (item) => !mappingRows.some((snapshot) => snapshot.order_item_id === item.id),
      );
    const visible = mine;

    const deskItems: DeskItem[] = visible.map((item) => {
      const product = item.product_id ? productMap.get(item.product_id) : undefined;
      const variant = item.variant_id ? variantMap.get(item.variant_id) : undefined;
      return {
        id: item.id,
        title: item.title,
        variantTitle: item.variant_title ?? null,
        description: product?.description ?? null,
        productCode: item.sku ?? variant?.sku ?? product?.sku ?? null,
        barcode: variant?.barcode ?? product?.barcode ?? null,
        quantity: Number(item.quantity ?? 1),
        unitPrice: num(item.unit_price),
        lineTotal: num(item.line_total ?? num(item.unit_price) * Number(item.quantity ?? 1)),
        mine: mine.length ? true : false,
        imageUrl: imageRows.find((image) => image.product_id === item.product_id)?.url ?? null,
      };
    });

    const entries = commissionRows.filter(
      (entry) => entry.order_id === row.order_id && entry.supplier_id === row.supplier_id,
    );

    return {
      dropshipOrderId: row.id as string,
      supplierId: row.supplier_id as string,
      supplierName: row.suppliers?.name ?? "Tedarikçi",
      orderId: row.order_id as string,
      orderNumber: order?.order_number ?? "—",
      orderCreatedAt: order?.created_at ?? row.created_at,
      status: row.status as string,
      carrier: row.carrier ?? order?.shipping_carrier ?? null,
      trackingNumber: row.tracking_number ?? null,
      currency: order?.currency ?? "TRY",
      customerName: order?.customer_name ?? null,
      customerPhone: order?.customer_phone ?? null,
      addressLines: formatAddress(order?.shipping_address),
      items: deskItems,
      itemsTotal: relationIssue
        ? null
        : deskItems.reduce((total, item) => total + item.lineTotal, 0),
      relationIssue,
      commissionTotal: entries.length
        ? entries.reduce((total, entry) => total + num(entry.commission_amount), 0)
        : null,
      netTotal: entries.length
        ? entries.reduce((total, entry) => total + num(entry.net_amount), 0)
        : null,
      note: order?.note ?? null,
      paymentStatus: order?.payment_status ?? null,
    };
  });
}

/** Tedarikçiye ait katalog, cari hesap, RFQ ve stok/fiyat hareketleri. */
export async function loadSupplierWorkspace(
  admin: Client,
  suppliers: { id: string; store_id: string }[],
  catalog: {
    search?: string;
    page?: number;
    category?: string;
    sort?: string;
    filter?: string;
  } = {},
) {
  if (!suppliers.length)
    return {
      products: [] as SupplierCatalogRow[],
      totalProducts: 0,
      pageSize: 25,
      rfqs: [] as SupplierRfqRow[],
      credit: null,
      transactions: [],
      movements: [],
    };
  const supplierIds = suppliers.map((supplier) => supplier.id);
  const storeIds = Array.from(new Set(suppliers.map((supplier) => supplier.store_id)));
  const size = 25;
  let productQuery = admin
    .from("supplier_products")
    .select(
      "id, title, sku, barcode, category, brand, supplier_price, computed_price, suggested_price, catalog_visible, stock, currency, images, raw, product_id, variant_id, updated_at",
      { count: "exact" },
    )
    .in("supplier_id", supplierIds);
  const term = (catalog.search ?? "").trim().replace(/[%,()]/g, " ");
  if (term)
    productQuery = productQuery.or(
      `title.ilike.%${term}%,sku.ilike.%${term}%,barcode.ilike.%${term}%`,
    );
  if (catalog.category)
    productQuery = productQuery.ilike("category", `%${catalog.category.replace(/[%,()]/g, " ")}%`);
  if (catalog.filter === "visible") productQuery = productQuery.eq("catalog_visible", true);
  if (catalog.filter === "hidden") productQuery = productQuery.eq("catalog_visible", false);
  if (catalog.filter === "out") productQuery = productQuery.lte("stock", 0);
  productQuery = productQuery
    .order(
      catalog.sort === "price"
        ? "computed_price"
        : catalog.sort === "stock"
          ? "stock"
          : "updated_at",
      { ascending: catalog.sort === "price" },
    )
    .order("id")
    .range((catalog.page ?? 0) * size, ((catalog.page ?? 0) + 1) * size - 1);
  const [{ data: products, count: totalProducts }, { data: rfqs }, { data: accounts }] =
    await Promise.all(
      [
        productQuery,
        admin
          .from("rfq_requests")
          .select(
            "id, reference, company_name, currency, quoted_total, requested_total, status, valid_until, purchase_order_id, items, created_at",
          )
          .in("supplier_id", supplierIds)
          .order("created_at", { ascending: false })
          .limit(100),
        admin
          .from("b2b_credit_accounts")
          .select(
            "id, supplier_id, company_name, currency, credit_limit, balance, term_days, status",
          )
          .in("supplier_id", supplierIds)
          .limit(10),
      ].map(checkedQuery),
    );
  const productRows = (products ?? []) as any[];
  const productIds = productRows.map((row) => row.product_id).filter(Boolean);
  const variantIds = productRows.map((row) => row.variant_id).filter(Boolean);
  const accountRows = (accounts ?? []) as any[];
  const [
    { data: liveProducts },
    { data: liveVariants },
    { data: transactions },
    { data: movements },
    { data: inventory },
  ] = await Promise.all(
    [
      productIds.length
        ? admin.from("products").select("id, status, base_price, updated_at").in("id", productIds)
        : Promise.resolve({ data: [] }),
      variantIds.length
        ? admin.from("product_variants").select("id, price, stock, updated_at").in("id", variantIds)
        : Promise.resolve({ data: [] }),
      accountRows.length
        ? admin
            .from("b2b_credit_transactions")
            .select("id, account_id, kind, amount, currency, note, created_at")
            .in(
              "account_id",
              accountRows.map((row) => row.id),
            )
            .order("created_at", { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [] }),
      productIds.length
        ? admin
            .from("inventory_movements")
            .select(
              "id, product_id, variant_id, kind, quantity, stock_before, stock_after, reason, created_at",
            )
            .in("store_id", storeIds)
            .in("product_id", productIds)
            .order("created_at", { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [] }),
      variantIds.length
        ? admin
            .from("inventory_levels")
            .select("variant_id, reserved, on_hand, updated_at")
            .in("store_id", storeIds)
            .in("variant_id", variantIds)
        : Promise.resolve({ data: [] }),
    ].map(checkedQuery),
  );
  const liveProductMap = new Map(((liveProducts ?? []) as any[]).map((row) => [row.id, row]));
  const liveVariantMap = new Map(((liveVariants ?? []) as any[]).map((row) => [row.id, row]));
  return {
    totalProducts: totalProducts ?? 0,
    pageSize: size,
    products: productRows.map((row): SupplierCatalogRow => {
      const raw = row.raw && typeof row.raw === "object" ? row.raw : {};
      const liveProduct = row.product_id ? liveProductMap.get(row.product_id) : null;
      const liveVariant = row.variant_id ? liveVariantMap.get(row.variant_id) : null;
      return {
        id: row.id,
        feedId: "",
        title: row.title,
        sku: row.sku,
        barcode: row.barcode,
        category: row.category,
        brand: row.brand,
        supplierPrice: num(row.supplier_price),
        configuredSalePrice: row.computed_price == null ? null : num(row.computed_price),
        suggestedPrice: row.suggested_price == null ? null : num(row.suggested_price),
        catalogVisible: row.catalog_visible !== false,
        salePrice: num(
          row.computed_price ?? liveVariant?.price ?? liveProduct?.base_price ?? row.supplier_price,
        ),
        stock: Number(row.stock ?? 0),
        currency: row.currency ?? "TRY",
        sourceStock: Number(row.stock ?? 0),
        warehouseReserved: (inventory ?? []).some((r: any) => r.variant_id === row.variant_id)
          ? (inventory ?? [])
              .filter((r: any) => r.variant_id === row.variant_id)
              .reduce((sum: number, r: any) => sum + Number(r.reserved ?? 0), 0)
          : null,
        warehouseOnHand: (inventory ?? []).some((r: any) => r.variant_id === row.variant_id)
          ? (inventory ?? [])
              .filter((r: any) => r.variant_id === row.variant_id)
              .reduce((sum: number, r: any) => sum + Number(r.on_hand ?? 0), 0)
          : null,
        warehouseUpdatedAt:
          (inventory ?? [])
            .filter((r: any) => r.variant_id === row.variant_id)
            .map((r: any) => String(r.updated_at))
            .sort()
            .at(-1) ?? null,
        storeStock: liveVariant ? Number(liveVariant.stock) : null,
        sourceUpdatedAt: row.updated_at,
        storeUpdatedAt: liveVariant?.updated_at ?? liveProduct?.updated_at ?? null,
        images: productImageSources(row.images, raw),
        description: typeof raw.description === "string" ? raw.description : null,
        color: typeof raw.color === "string" ? raw.color : null,
        size: typeof raw.size === "string" ? raw.size : null,
        productId: row.product_id,
        variantId: row.variant_id,
        isPublished: liveProduct?.status === "active",
        updatedAt: liveVariant?.updated_at ?? liveProduct?.updated_at ?? row.updated_at,
      };
    }),
    rfqs: ((rfqs ?? []) as any[]).map((row): SupplierRfqRow => ({
      id: row.id,
      reference: row.reference,
      companyName: row.company_name,
      currency: row.currency ?? "TRY",
      total: num(row.quoted_total ?? row.requested_total),
      status: row.status,
      validUntil: row.valid_until,
      purchaseOrderId: row.purchase_order_id,
      items: Array.isArray(row.items) ? row.items : [],
      createdAt: row.created_at,
    })),
    credit: accountRows[0]
      ? {
          id: accountRows[0].id,
          companyName: accountRows[0].company_name,
          currency: accountRows[0].currency,
          creditLimit: num(accountRows[0].credit_limit),
          balance: num(accountRows[0].balance),
          termDays: Number(accountRows[0].term_days ?? 30),
          status: accountRows[0].status,
        }
      : null,
    transactions: (transactions ?? []) as any[],
    movements: (movements ?? []) as any[],
  };
}

/** Komisyon defteri + performans karnesi. */
export async function loadSupplierLedger(
  admin: Client,
  suppliers: { id: string; name: string; store_id: string; currency: string }[],
): Promise<{ ledger: LedgerSummary[]; payouts: PayoutRow[] }> {
  if (!suppliers.length) return { ledger: [], payouts: [] };
  const supplierIds = suppliers.map((supplier) => supplier.id);

  const [{ data: entries }, { data: payouts }, { data: details }, { data: dropship }] =
    await Promise.all([
      admin
        .from("supplier_commission_entries")
        .select("supplier_id, gross_amount, commission_amount, net_amount, status, currency")
        .in("supplier_id", supplierIds),
      admin
        .from("supplier_payout_requests")
        .select(
          "id, supplier_id, amount, currency, iban, status, note, admin_note, created_at, processed_at",
        )
        .in("supplier_id", supplierIds)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("suppliers")
        .select("id, commission_rate, iban, bank_account_name")
        .in("id", supplierIds),
      admin
        .from("dropship_orders")
        .select("supplier_id, status, created_at, updated_at, order_id")
        .in("supplier_id", supplierIds)
        .limit(1000),
    ]);

  const entryRows = (entries ?? []) as any[];
  const detailMap = new Map(((details ?? []) as any[]).map((row) => [row.id as string, row]));
  const dropshipRows = (dropship ?? []) as any[];

  const orderIds = Array.from(new Set(dropshipRows.map((row) => row.order_id as string)));
  const { data: returns } = orderIds.length
    ? await admin.from("return_requests").select("order_id").in("order_id", orderIds)
    : { data: [] };
  const returnOrderIds = new Set(((returns ?? []) as any[]).map((row) => row.order_id as string));

  const ledger: LedgerSummary[] = suppliers.map((supplier) => {
    const mine = entryRows.filter((entry) => entry.supplier_id === supplier.id);
    const sum = (key: string, status?: string) =>
      mine
        .filter((entry) => (status ? entry.status === status : true))
        .reduce((total, entry) => total + num(entry[key]), 0);

    const jobs = dropshipRows.filter((row) => row.supplier_id === supplier.id);
    const shipped = jobs.filter((row) => ["shipped", "delivered"].includes(row.status as string));
    const cancelled = jobs.filter((row) => ["cancelled", "failed"].includes(row.status as string));
    const returned = jobs.filter((row) => returnOrderIds.has(row.order_id as string));
    const shipHours = shipped
      .map(
        (row) =>
          (new Date(row.updated_at).getTime() - new Date(row.created_at).getTime()) / 3_600_000,
      )
      .filter((hours) => Number.isFinite(hours) && hours >= 0);

    const detail = detailMap.get(supplier.id);
    const revenue = sum("gross_amount");
    const commission = sum("commission_amount");

    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      currency: supplier.currency || "TRY",
      commissionRate: num(detail?.commission_rate) || 0.5,
      iban: detail?.iban ?? null,
      accountName: detail?.bank_account_name ?? null,
      revenue,
      commission,
      net: sum("net_amount"),
      pending: sum("net_amount", "pending"),
      payable: sum("net_amount", "payable"),
      paid: sum("net_amount", "paid"),
      scorecard: {
        orders: jobs.length,
        shipped: shipped.length,
        cancelled: cancelled.length,
        returned: returned.length,
        avgShipHours: shipHours.length
          ? Math.round(
              (shipHours.reduce((total, hours) => total + hours, 0) / shipHours.length) * 10,
            ) / 10
          : null,
        cancellationRate: jobs.length
          ? Math.round((cancelled.length / jobs.length) * 1000) / 10
          : 0,
        returnRate: jobs.length ? Math.round((returned.length / jobs.length) * 1000) / 10 : 0,
        revenue,
        commission,
        net: revenue - commission,
      },
    };
  });

  const payoutRows: PayoutRow[] = ((payouts ?? []) as any[]).map((row) => ({
    id: row.id as string,
    supplierId: row.supplier_id as string,
    amount: num(row.amount),
    currency: row.currency as string,
    iban: row.iban as string,
    status: row.status as string,
    note: row.note ?? null,
    adminNote: row.admin_note ?? null,
    createdAt: row.created_at as string,
    processedAt: row.processed_at ?? null,
  }));

  return { ledger, payouts: payoutRows };
}

/** Kargo etiketi / irsaliye için yazdırılabilir veri. */
export function buildCargoLabel(order: DeskOrder) {
  const barcodeValue =
    order.trackingNumber?.trim() || order.orderNumber.replace(/[^A-Za-z0-9-]/g, "");
  return {
    orderNumber: order.orderNumber,
    supplierName: order.supplierName,
    carrier: order.carrier ?? "—",
    trackingNumber: order.trackingNumber ?? null,
    barcodeValue,
    customerName: order.customerName ?? "—",
    customerPhone: order.customerPhone ?? null,
    addressLines: order.addressLines,
    items: order.items.map((item) => ({
      title: item.title + (item.variantTitle ? ` · ${item.variantTitle}` : ""),
      code: item.productCode ?? item.barcode ?? "—",
      quantity: item.quantity,
    })),
    createdAt: order.orderCreatedAt,
  };
}

async function checkedQuery(query: any) {
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return result;
}
