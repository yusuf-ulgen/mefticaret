/**
 * Tedarikçi portalı fulfillment masası sunucu katmanı.
 * Sipariş parçalama sonuçları, kargo etiketi verisi, komisyon defteri,
 * ödeme talepleri, performans karnesi ve toplu ürün yükleme işlemleri.
 * Çağıran her zaman kendi tedarikçi kimlikleriyle sınırlandırılır.
 */

import type { ImportRow, SupplierScorecard } from "@/lib/supplier-import";

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
  itemsTotal: number;
  commissionTotal: number;
  netTotal: number;
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

export type ImportJobRow = {
  id: string;
  supplierId: string;
  source: string;
  fileName: string | null;
  sourceUrl: string | null;
  format: string;
  rowCount: number;
  validCount: number;
  errorCount: number;
  createdCount: number;
  updatedCount: number;
  status: string;
  createdAt: string;
};

export type FeedRow = {
  id: string;
  supplierId: string;
  name: string;
  kind: string;
  sourceUrl: string | null;
  schedule: string;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
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
): Promise<DeskOrder[]> {
  if (!supplierIds.length) return [];

  const { data: dropship, error } = await admin
    .from("dropship_orders")
    .select("id, supplier_id, order_id, status, carrier, tracking_number, created_at, suppliers(name)")
    .in("supplier_id", supplierIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const rows = (dropship ?? []) as any[];
  if (!rows.length) return [];

  const orderIds = Array.from(new Set(rows.map((row) => row.order_id as string)));

  const [{ data: orders }, { data: items }, { data: commissions }] = await Promise.all([
    admin
      .from("orders")
      .select(
        "id, order_number, created_at, currency, shipping_carrier, customer_name, customer_phone, shipping_address",
      )
      .in("id", orderIds),
    admin
      .from("order_items")
      .select(
        "id, order_id, product_id, variant_id, title, variant_title, sku, quantity, unit_price, line_total",
      )
      .in("order_id", orderIds),
    admin
      .from("supplier_commission_entries")
      .select("order_id, supplier_id, order_item_id, gross_amount, commission_amount, net_amount")
      .in("order_id", orderIds)
      .in("supplier_id", supplierIds),
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

  const [{ data: products }, { data: variants }, { data: mappings }] = await Promise.all([
    productIds.length
      ? admin.from("products").select("id, description, sku, barcode").in("id", productIds)
      : Promise.resolve({ data: [] }),
    variantIds.length
      ? admin.from("product_variants").select("id, sku, barcode").in("id", variantIds)
      : Promise.resolve({ data: [] }),
    productIds.length || variantIds.length
      ? admin
          .from("supplier_products")
          .select("supplier_id, product_id, variant_id")
          .in("supplier_id", supplierIds)
      : Promise.resolve({ data: [] }),
  ]);

  const productMap = new Map(((products ?? []) as any[]).map((row) => [row.id as string, row]));
  const variantMap = new Map(((variants ?? []) as any[]).map((row) => [row.id as string, row]));
  const mappingRows = (mappings ?? []) as any[];

  const ownsItem = (supplierId: string, item: any) =>
    mappingRows.some(
      (map) =>
        map.supplier_id === supplierId &&
        ((item.variant_id && map.variant_id === item.variant_id) ||
          (!item.variant_id && map.product_id === item.product_id)),
    ) ||
    commissionRows.some((entry) => entry.supplier_id === supplierId && entry.order_item_id === item.id);

  return rows.map((row) => {
    const order = orderMap.get(row.order_id as string);
    const orderItems = itemRows.filter((item) => item.order_id === row.order_id);
    const mine = orderItems.filter((item) => ownsItem(row.supplier_id as string, item));
    const visible = mine.length ? mine : orderItems;

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
      itemsTotal: deskItems.reduce((total, item) => total + item.lineTotal, 0),
      commissionTotal: entries.reduce((total, entry) => total + num(entry.commission_amount), 0),
      netTotal: entries.reduce((total, entry) => total + num(entry.net_amount), 0),
    };
  });
}

/** Komisyon defteri + performans karnesi. */
export async function loadSupplierLedger(
  admin: Client,
  suppliers: { id: string; name: string; store_id: string; currency: string }[],
): Promise<{ ledger: LedgerSummary[]; payouts: PayoutRow[] }> {
  if (!suppliers.length) return { ledger: [], payouts: [] };
  const supplierIds = suppliers.map((supplier) => supplier.id);

  const [{ data: entries }, { data: payouts }, { data: details }, { data: dropship }] = await Promise.all([
    admin
      .from("supplier_commission_entries")
      .select("supplier_id, gross_amount, commission_amount, net_amount, status, currency")
      .in("supplier_id", supplierIds),
    admin
      .from("supplier_payout_requests")
      .select("id, supplier_id, amount, currency, iban, status, note, admin_note, created_at, processed_at")
      .in("supplier_id", supplierIds)
      .order("created_at", { ascending: false })
      .limit(50),
    admin.from("suppliers").select("id, commission_rate, iban, bank_account_name").in("id", supplierIds),
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
      .map((row) => (new Date(row.updated_at).getTime() - new Date(row.created_at).getTime()) / 3_600_000)
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
          ? Math.round((shipHours.reduce((total, hours) => total + hours, 0) / shipHours.length) * 10) / 10
          : null,
        cancellationRate: jobs.length ? Math.round((cancelled.length / jobs.length) * 1000) / 10 : 0,
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

/** Portal içi besleme ayarları ve yükleme geçmişi. */
export async function loadSupplierFeeds(
  admin: Client,
  supplierIds: string[],
): Promise<{ feeds: FeedRow[]; jobs: ImportJobRow[] }> {
  if (!supplierIds.length) return { feeds: [], jobs: [] };
  const [{ data: feeds }, { data: jobs }] = await Promise.all([
    admin
      .from("supplier_feeds")
      .select("id, supplier_id, name, kind, source_url, schedule, is_active, last_run_at, next_run_at, last_status, last_error")
      .in("supplier_id", supplierIds)
      .order("created_at", { ascending: false }),
    admin
      .from("supplier_import_jobs")
      .select(
        "id, supplier_id, source, file_name, source_url, format, row_count, valid_count, error_count, created_count, updated_count, status, created_at",
      )
      .in("supplier_id", supplierIds)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  return {
    feeds: ((feeds ?? []) as any[]).map((row) => ({
      id: row.id as string,
      supplierId: row.supplier_id as string,
      name: row.name as string,
      kind: row.kind as string,
      sourceUrl: row.source_url ?? null,
      schedule: row.schedule as string,
      isActive: Boolean(row.is_active),
      lastRunAt: row.last_run_at ?? null,
      nextRunAt: row.next_run_at ?? null,
      lastStatus: row.last_status ?? null,
      lastError: row.last_error ?? null,
    })),
    jobs: ((jobs ?? []) as any[]).map((row) => ({
      id: row.id as string,
      supplierId: row.supplier_id as string,
      source: row.source as string,
      fileName: row.file_name ?? null,
      sourceUrl: row.source_url ?? null,
      format: row.format as string,
      rowCount: Number(row.row_count ?? 0),
      validCount: Number(row.valid_count ?? 0),
      errorCount: Number(row.error_count ?? 0),
      createdCount: Number(row.created_count ?? 0),
      updatedCount: Number(row.updated_count ?? 0),
      status: row.status as string,
      createdAt: row.created_at as string,
    })),
  };
}

/** Doğrulanmış satırları tedarikçi kataloğuna yazar (supplier_products). */
export async function applySupplierImport(
  admin: Client,
  input: {
    storeId: string;
    supplierId: string;
    feedId: string;
    rows: ImportRow[];
    currency: string;
  },
): Promise<{ created: number; updated: number }> {
  const valid = input.rows.filter((row) => row.errors.length === 0);
  if (!valid.length) return { created: 0, updated: 0 };

  const skus = valid.map((row) => row.sku);
  const { data: existing } = await admin
    .from("supplier_products")
    .select("id, sku")
    .eq("supplier_id", input.supplierId)
    .in("sku", skus);
  const existingMap = new Map(((existing ?? []) as any[]).map((row) => [row.sku as string, row.id as string]));

  const now = new Date().toISOString();
  const payload = valid.map((row) => ({
    id: existingMap.get(row.sku),
    store_id: input.storeId,
    feed_id: input.feedId,
    supplier_id: input.supplierId,
    external_id: row.sku,
    sku: row.sku,
    barcode: row.barcode,
    title: row.title,
    brand: row.brand,
    category: row.category,
    supplier_price: row.costPrice,
    currency: row.currency || input.currency || "TRY",
    computed_price: row.retailPrice ?? null,
    stock: row.stock,
    images: row.images,
    raw: {
      description: row.description,
      color: row.color,
      size: row.size,
      retail_price: row.retailPrice,
    },
    last_seen_at: now,
    updated_at: now,
  }));

  const inserts = payload.filter((row) => !row.id).map(({ id: _id, ...rest }) => rest);
  const updates = payload.filter((row) => row.id);

  if (inserts.length) {
    for (let index = 0; index < inserts.length; index += 400) {
      const { error } = await admin.from("supplier_products").insert(inserts.slice(index, index + 400));
      if (error) throw new Error(error.message);
    }
  }
  for (const row of updates) {
    const { id, ...rest } = row;
    const { error } = await admin.from("supplier_products").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
  }

  return { created: inserts.length, updated: updates.length };
}

/** Kargo etiketi / irsaliye için yazdırılabilir veri. */
export function buildCargoLabel(order: DeskOrder) {
  const barcodeValue = order.trackingNumber?.trim() || order.orderNumber.replace(/[^A-Za-z0-9-]/g, "");
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
