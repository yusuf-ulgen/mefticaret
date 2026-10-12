/**
 * Tedarikçi paneli sunucu katmanı. Erişim, çağıran kullanıcının RLS bağlamında
 * okunabildiği (portal_user_id = auth.uid()) tedarikçi kayıtlarıyla sınırlıdır;
 * sipariş verisi yalnızca doğrulanan tedarikçi kimlikleri için okunur.
 */

type Client = { from: (table: string) => any };

export type SupplierPortalOrderLine = {
  dropshipOrderId: string;
  supplierId: string;
  supplierName: string;
  orderNumber: string;
  orderCreatedAt: string;
  dropshipStatus: string;
  carrier: string | null;
  trackingNumber: string | null;
  currency: string;
  items: {
    id: string;
    title: string;
    variantTitle: string | null;
    description: string | null;
    productCode: string | null;
    stockCode: string | null;
    quantity: number;
    unitPrice: number;
  }[];
};

/** Çağıranın portal erişimi olan tedarikçi kayıtlarını döndürür. */
export async function listPortalSuppliers(
  supabase: Client,
  userId: string,
): Promise<{ id: string; name: string; store_id: string; currency: string; lead_time_days: number }[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, store_id, currency, lead_time_days, portal_user_id, portal_enabled")
    .eq("portal_user_id", userId)
    .eq("portal_enabled", true);
  if (error) throw new Error(error.message);
  return (data ?? []) as never;
}

/** Tedarikçinin göreceği sipariş satırlarını hazırlar. */
export async function loadSupplierPortalOrders(
  admin: Client,
  supplierIds: string[],
  limit = 100,
): Promise<SupplierPortalOrderLine[]> {
  if (!supplierIds.length) return [];

  const { data: dropshipOrders, error } = await admin
    .from("dropship_orders")
    .select("id, supplier_id, order_id, status, carrier, tracking_number, created_at, suppliers(name)")
    .in("supplier_id", supplierIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const rows = (dropshipOrders ?? []) as {
    id: string;
    supplier_id: string;
    order_id: string;
    status: string;
    carrier: string | null;
    tracking_number: string | null;
    created_at: string;
    suppliers: { name: string } | null;
  }[];
  if (!rows.length) return [];

  const orderIds = Array.from(new Set(rows.map((row) => row.order_id)));

  const { data: orders } = await admin
    .from("orders")
    .select("id, order_number, created_at, currency, shipping_carrier")
    .in("id", orderIds);
  const orderMap = new Map(
    ((orders ?? []) as {
      id: string;
      order_number: string;
      created_at: string;
      currency: string;
      shipping_carrier: string | null;
    }[]).map((order) => [order.id, order]),
  );

  const { data: items } = await admin
    .from("order_items")
    .select("id, order_id, product_id, variant_id, title, variant_title, sku, quantity, unit_price")
    .in("order_id", orderIds);
  const itemRows = (items ?? []) as {
    id: string;
    order_id: string;
    product_id: string | null;
    variant_id: string | null;
    title: string;
    variant_title: string | null;
    sku: string | null;
    quantity: number;
    unit_price: number;
  }[];

  const productIds = Array.from(
    new Set(itemRows.map((item) => item.product_id).filter((id): id is string => Boolean(id))),
  );
  const variantIds = Array.from(
    new Set(itemRows.map((item) => item.variant_id).filter((id): id is string => Boolean(id))),
  );

  const { data: products } = productIds.length
    ? await admin.from("products").select("id, description, sku, barcode").in("id", productIds)
    : { data: [] };
  const productMap = new Map(
    ((products ?? []) as { id: string; description: string | null; sku: string | null; barcode: string | null }[]).map(
      (product) => [product.id, product],
    ),
  );

  const { data: variants } = variantIds.length
    ? await admin.from("product_variants").select("id, sku, barcode").in("id", variantIds)
    : { data: [] };
  const variantMap = new Map(
    ((variants ?? []) as { id: string; sku: string | null; barcode: string | null }[]).map((variant) => [
      variant.id,
      variant,
    ]),
  );

  return rows.map((row) => {
    const order = orderMap.get(row.order_id);
    return {
      dropshipOrderId: row.id,
      supplierId: row.supplier_id,
      supplierName: row.suppliers?.name ?? "Tedarikçi",
      orderNumber: order?.order_number ?? "—",
      orderCreatedAt: order?.created_at ?? row.created_at,
      dropshipStatus: row.status,
      carrier: row.carrier ?? order?.shipping_carrier ?? null,
      trackingNumber: row.tracking_number,
      currency: order?.currency ?? "TRY",
      items: itemRows
        .filter((item) => item.order_id === row.order_id)
        .map((item) => {
          const product = item.product_id ? productMap.get(item.product_id) : undefined;
          const variant = item.variant_id ? variantMap.get(item.variant_id) : undefined;
          return {
            id: item.id,
            title: item.title,
            variantTitle: item.variant_title,
            description: product?.description ?? null,
            productCode: item.sku ?? variant?.sku ?? product?.sku ?? null,
            stockCode: variant?.barcode ?? product?.barcode ?? null,
            quantity: item.quantity,
            unitPrice: Number(item.unit_price),
          };
        }),
    };
  });
}
