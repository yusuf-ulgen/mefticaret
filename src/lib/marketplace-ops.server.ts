import { insertAuditRow } from "@/lib/audit.server";

/**
 * Pazaryeri Operasyon sunucu mantığı. Tüm sorgular store_id ile sınırlıdır;
 * tenant izolasyonu ayrıca RLS ile zorlanır.
 */

type AnySupabase = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const DAY_MS = 86_400_000;

/** Mağazanın varsayılan (öncelikli, aktif) deposunu getirir. */
async function getDefaultWarehouse(supabase: AnySupabase, storeId: string) {
  const { data } = await supabase
    .from("warehouses")
    .select("id, is_default, priority")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("priority", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data as { id: string } | null;
}

export type ResolveReturnAction = "approve" | "reject" | "receive";

/** Pazaryeri iade/değişim talebini onaylar, reddeder veya teslim alınmış işaretler. */
export async function resolveMarketplaceReturn(
  supabase: AnySupabase,
  params: {
    storeId: string;
    returnId: string;
    action: ResolveReturnAction;
    actorId: string | null;
    staffNote?: string | null;
  },
) {
  const { data: current, error: currentError } = await supabase
    .from("marketplace_returns")
    .select("*")
    .eq("id", params.returnId)
    .eq("store_id", params.storeId)
    .maybeSingle();
  if (currentError) throw new Error(currentError.message);
  if (!current) throw new Error("İade/değişim kaydı bulunamadı");

  const nextStatus =
    params.action === "approve" ? "approved" : params.action === "reject" ? "rejected" : "received";

  const patch: Record<string, unknown> = {
    status: nextStatus,
    resolved_at: new Date().toISOString(),
    resolved_by: params.actorId,
  };
  const { data: updated, error } = await supabase
    .from("marketplace_returns")
    .update(patch)
    .eq("id", current.id)
    .eq("store_id", params.storeId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) throw new Error("İade güncellenemedi");

  // Onay + otomatik stok artırma: kalemleri stoğa geri ekle (varyant/ürün + inventory_levels).
  if (params.action === "approve" && current.auto_restock) {
    const items = Array.isArray(current.items) ? (current.items as any[]) : [];
    const warehouse = await getDefaultWarehouse(supabase, params.storeId);

    for (const item of items) {
      const variantId = item?.variant_id ?? item?.variantId ?? null;
      const productId = item?.product_id ?? item?.productId ?? null;
      const quantity = Number(item?.quantity ?? 0);
      if (quantity <= 0) continue;

      if (variantId) {
        const { data: variant } = await supabase
          .from("product_variants")
          .select("id, product_id, stock")
          .eq("id", variantId)
          .maybeSingle();
        if (variant) {
          const before = Number(variant.stock ?? 0);
          const after = before + quantity;
          await supabase.from("product_variants").update({ stock: after }).eq("id", variant.id);
          await supabase.from("inventory_movements").insert({
            store_id: params.storeId,
            product_id: variant.product_id,
            variant_id: variant.id,
            warehouse_id: warehouse?.id ?? null,
            kind: "return",
            quantity,
            stock_before: before,
            stock_after: after,
            reason: `Pazaryeri iadesi ${current.external_return_id ?? current.id}`,
            actor_id: params.actorId,
          });

          if (warehouse) {
            const { data: level } = await supabase
              .from("inventory_levels")
              .select("id, on_hand, available")
              .eq("store_id", params.storeId)
              .eq("variant_id", variant.id)
              .eq("warehouse_id", warehouse.id)
              .maybeSingle();
            if (level) {
              await supabase
                .from("inventory_levels")
                .update({
                  on_hand: Number(level.on_hand ?? 0) + quantity,
                  available: Number(level.available ?? 0) + quantity,
                })
                .eq("id", level.id);
            } else {
              await supabase.from("inventory_levels").insert({
                store_id: params.storeId,
                product_id: productId,
                variant_id: variant.id,
                warehouse_id: warehouse.id,
                on_hand: quantity,
                available: quantity,
              });
            }
          }
        }
      }
    }
  }

  await insertAuditRow(supabase, {
    store_id: params.storeId,
    actor_id: params.actorId,
    action: `marketplace_return.${params.action}`,
    entity: "marketplace_returns",
    entity_id: current.id,
    old_value: { status: current.status },
    new_value: { status: nextStatus, staff_note: params.staffNote ?? null },
  });

  return updated;
}

/** Seçili siparişleri toplu olarak "processing" durumuna alır (store scoped). */
export async function bulkMarkOrdersProcessing(
  supabase: AnySupabase,
  params: { storeId: string; orderIds: string[]; actorId: string | null },
) {
  if (params.orderIds.length === 0) return { updated: 0 };

  const { data: orders, error: fetchError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("store_id", params.storeId)
    .in("id", params.orderIds);
  if (fetchError) throw new Error(fetchError.message);

  const eligible = (orders ?? []).filter((o: any) => o.status !== "processing");
  if (eligible.length === 0) return { updated: 0 };

  const { error } = await supabase
    .from("orders")
    .update({ status: "processing" })
    .eq("store_id", params.storeId)
    .in(
      "id",
      eligible.map((o: any) => o.id),
    );
  if (error) throw new Error(error.message);

  // order_status_history trigger'ı yoksa manuel kayıt tutarız (idempotent değilse hata yutulur).
  for (const order of eligible) {
    await supabase
      .from("order_status_history")
      .insert({
        store_id: params.storeId,
        order_id: order.id,
        from_status: order.status,
        to_status: "processing",
        actor_id: params.actorId,
        note: "Toplu işleme alındı (Pazaryeri Operasyon)",
      })
      .then(() => undefined, () => undefined);
  }

  await insertAuditRow(supabase, {
    store_id: params.storeId,
    actor_id: params.actorId,
    action: "order.bulk_processing",
    entity: "orders",
    entity_id: null,
    new_value: { order_ids: eligible.map((o: any) => o.id) },
  });

  return { updated: eligible.length };
}

export type StockDepletionRow = {
  variantId: string;
  productId: string | null;
  title: string;
  sku: string | null;
  sellableStock: number;
  avgDailySales: number;
  daysToStockout: number | null;
  isOutOfStock: boolean;
  estimatedDailyRevenueLoss: number;
};

/** Aktif ürün/varyantlar için satış hızı, kalan stok, tükenme günü ve kayıp ciro tahmini. */
export async function stockDepletionAnalysis(
  supabase: AnySupabase,
  storeId: string,
  days: number,
): Promise<StockDepletionRow[]> {
  const since = new Date(Date.now() - days * DAY_MS).toISOString();

  const [variantsRes, productsRes, itemsRes, ordersRes] = await Promise.all([
    supabase
      .from("product_variants")
      .select("id, product_id, title, sku, stock, price")
      .eq("store_id", storeId)
      .limit(5000),
    supabase.from("products").select("id, title, status").eq("store_id", storeId).limit(3000),
    supabase
      .from("order_items")
      .select("order_id, variant_id, product_id, quantity, unit_price, created_at")
      .eq("store_id", storeId)
      .gte("created_at", since)
      .limit(20000),
    supabase
      .from("orders")
      .select("id, payment_status")
      .eq("store_id", storeId)
      .gte("created_at", since)
      .limit(20000),
  ]);
  if (variantsRes.error) throw new Error(variantsRes.error.message);
  if (productsRes.error) throw new Error(productsRes.error.message);
  if (itemsRes.error) throw new Error(itemsRes.error.message);
  if (ordersRes.error) throw new Error(ordersRes.error.message);

  const paidOrderIds = new Set(
    (ordersRes.data ?? [])
      .filter((o: any) => ["paid", "partially_refunded", "refunded"].includes(o.payment_status))
      .map((o: any) => o.id),
  );

  const productMap = new Map((productsRes.data ?? []).map((p: any) => [String(p.id), p]));

  const soldByVariant = new Map<string, number>();
  for (const item of itemsRes.data ?? []) {
    if (!item.variant_id) continue;
    if (!paidOrderIds.has(item.order_id)) continue;
    const key = String(item.variant_id);
    soldByVariant.set(key, (soldByVariant.get(key) ?? 0) + Number(item.quantity ?? 0));
  }

  const rows: StockDepletionRow[] = [];
  for (const variant of variantsRes.data ?? []) {
    const product = variant.product_id ? productMap.get(String(variant.product_id)) : null;
    if (product && product.status === "archived") continue;

    const sold = soldByVariant.get(String(variant.id)) ?? 0;
    const avgDailySales = days > 0 ? sold / days : 0;
    const stock = Number(variant.stock ?? 0);
    const isOutOfStock = stock <= 0;
    const daysToStockout = avgDailySales > 0 ? stock / avgDailySales : null;
    const estimatedDailyRevenueLoss = isOutOfStock ? avgDailySales * Number(variant.price ?? 0) : 0;

    rows.push({
      variantId: String(variant.id),
      productId: variant.product_id ? String(variant.product_id) : null,
      title: product?.title ? `${product.title} — ${variant.title ?? "Varsayılan"}` : String(variant.title ?? "Varsayılan"),
      sku: variant.sku ? String(variant.sku) : null,
      sellableStock: stock,
      avgDailySales,
      daysToStockout,
      isOutOfStock,
      estimatedDailyRevenueLoss,
    });
  }

  return rows.sort((a, b) => {
    if (a.isOutOfStock !== b.isOutOfStock) return a.isOutOfStock ? -1 : 1;
    return b.estimatedDailyRevenueLoss - a.estimatedDailyRevenueLoss;
  });
}

export type OrderAnalysisResult = {
  byCity: { city: string; orders: number; revenue: number }[];
  byHour: { hour: number; orders: number; revenue: number }[];
  byChannel: { channel: string; orders: number; revenue: number }[];
  totalOrders: number;
  totalRevenue: number;
  dailyAverageRevenue: number;
  last7DayAverageRevenue: number;
};

/** Sipariş analizi: şehir/saat/kanal kırılımı ve ciro trend karşılaştırması. */
export async function orderAnalysis(
  supabase: AnySupabase,
  storeId: string,
  from: string,
  to: string,
): Promise<OrderAnalysisResult> {
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, grand_total, currency, created_at, status")
    .eq("store_id", storeId)
    .gte("created_at", from)
    .lte("created_at", to)
    .neq("status", "cancelled")
    .limit(20000);
  if (ordersError) throw new Error(ordersError.message);

  const orderIds = (orders ?? []).map((o: any) => o.id);
  const [addressesRes, listingsRes] = await Promise.all([
    orderIds.length
      ? supabase
          .from("order_addresses")
          .select("order_id, city, kind")
          .eq("store_id", storeId)
          .in("order_id", orderIds)
      : Promise.resolve({ data: [], error: null } as any),
    supabase
      .from("channel_listings")
      .select("id, channel_id, marketplace_channels(name, provider)")
      .eq("store_id", storeId)
      .limit(5000),
  ]);
  if (addressesRes.error) throw new Error(addressesRes.error.message);
  if (listingsRes.error) throw new Error(listingsRes.error.message);

  const cityByOrder = new Map<string, string>();
  for (const address of addressesRes.data ?? []) {
    if (address.kind === "shipping" || !cityByOrder.has(address.order_id)) {
      cityByOrder.set(address.order_id, address.city);
    }
  }

  const cityAgg = new Map<string, { orders: number; revenue: number }>();
  const hourAgg = new Map<number, { orders: number; revenue: number }>();

  let totalRevenue = 0;
  for (const order of orders ?? []) {
    const revenue = Number(order.grand_total ?? 0);
    totalRevenue += revenue;

    const city = cityByOrder.get(order.id) ?? "Bilinmiyor";
    const cityRow = cityAgg.get(city) ?? { orders: 0, revenue: 0 };
    cityRow.orders += 1;
    cityRow.revenue += revenue;
    cityAgg.set(city, cityRow);

    const hour = new Date(order.created_at).getHours();
    const hourRow = hourAgg.get(hour) ?? { orders: 0, revenue: 0 };
    hourRow.orders += 1;
    hourRow.revenue += revenue;
    hourAgg.set(hour, hourRow);
  }

  // Kanal kırılımı: pazaryeri siparişleri doğrudan orders tablosunda channel ilişkisi
  // olmadığından marketplace_returns/settlements üzerinden değil, mevcut kanal
  // dağıtımını channel_listings üzerinden temsili olarak veremeyiz; bu yüzden
  // toplam siparişleri "Doğrudan Satış" olarak, kanal bazlı ciroyu settlements'tan alıyoruz.
  const { data: settlements, error: settlementsError } = await supabase
    .from("marketplace_settlements")
    .select("marketplace, gross_amount, period_start, period_end")
    .eq("store_id", storeId)
    .gte("period_start", from)
    .lte("period_end", to)
    .limit(2000);
  if (settlementsError) throw new Error(settlementsError.message);

  const channelAgg = new Map<string, { orders: number; revenue: number }>();
  for (const settlement of settlements ?? []) {
    const key = settlement.marketplace ?? "Diğer";
    const row = channelAgg.get(key) ?? { orders: 0, revenue: 0 };
    row.revenue += Number(settlement.gross_amount ?? 0);
    channelAgg.set(key, row);
  }
  if (channelAgg.size === 0) {
    channelAgg.set("Tüm siparişler", { orders: orders?.length ?? 0, revenue: totalRevenue });
  }
  void listingsRes;

  const days = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / DAY_MS));
  const dailyAverageRevenue = totalRevenue / days;

  const last7Start = new Date(Date.now() - 7 * DAY_MS).toISOString();
  const last7Revenue = (orders ?? [])
    .filter((o: any) => o.created_at >= last7Start)
    .reduce((sum: number, o: any) => sum + Number(o.grand_total ?? 0), 0);
  const last7DayAverageRevenue = last7Revenue / 7;

  return {
    byCity: Array.from(cityAgg.entries())
      .map(([city, v]) => ({ city, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 30),
    byHour: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      orders: hourAgg.get(hour)?.orders ?? 0,
      revenue: hourAgg.get(hour)?.revenue ?? 0,
    })),
    byChannel: Array.from(channelAgg.entries()).map(([channel, v]) => ({ channel, ...v })),
    totalOrders: orders?.length ?? 0,
    totalRevenue,
    dailyAverageRevenue,
    last7DayAverageRevenue,
  };
}

export type ProductAnalysisRow = {
  productId: string;
  title: string;
  unitsSold: number;
  revenue: number;
  avgUnitPrice: number;
  avgCommission: number | null;
  avgUnitProfit: number | null;
};

/** Ürün bazlı satış adedi, ciro, ortalama komisyon ve kâr analizi. */
export async function productAnalysis(
  supabase: AnySupabase,
  storeId: string,
  from: string,
  to: string,
): Promise<ProductAnalysisRow[]> {
  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("id, order_id, product_id, title, quantity, unit_price, line_total, created_at")
    .eq("store_id", storeId)
    .gte("created_at", from)
    .lte("created_at", to)
    .limit(20000);
  if (itemsError) throw new Error(itemsError.message);

  const productIds = Array.from(
    new Set((items ?? []).map((i: any) => i.product_id).filter(Boolean)),
  );
  const itemIds = (items ?? []).map((i: any) => i.id);

  const [productsRes, commissionsRes] = await Promise.all([
    productIds.length
      ? supabase.from("products").select("id, title, cost_price").in("id", productIds)
      : Promise.resolve({ data: [], error: null } as any),
    itemIds.length
      ? supabase
          .from("commissions")
          .select("order_item_id, commission_amount, base_amount")
          .eq("store_id", storeId)
          .in("order_item_id", itemIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);
  if (productsRes.error) throw new Error(productsRes.error.message);
  if (commissionsRes.error) throw new Error(commissionsRes.error.message);

  const productMap = new Map((productsRes.data ?? []).map((p: any) => [String(p.id), p]));
  const commissionByItem = new Map(
    (commissionsRes.data ?? []).map((c: any) => [String(c.order_item_id), c]),
  );

  const agg = new Map<
    string,
    { title: string; unitsSold: number; revenue: number; commissionTotal: number; commissionCount: number; costPrice: number | null }
  >();

  for (const item of items ?? []) {
    if (!item.product_id) continue;
    const key = String(item.product_id);
    const product = productMap.get(key);
    const row = agg.get(key) ?? {
      title: product?.title ?? item.title,
      unitsSold: 0,
      revenue: 0,
      commissionTotal: 0,
      commissionCount: 0,
      costPrice: product?.cost_price != null ? Number(product.cost_price) : null,
    };
    row.unitsSold += Number(item.quantity ?? 0);
    row.revenue += Number(item.line_total ?? 0);

    const commission = commissionByItem.get(String(item.id));
    if (commission) {
      row.commissionTotal += Number(commission.commission_amount ?? 0);
      row.commissionCount += 1;
    }
    agg.set(key, row);
  }

  return Array.from(agg.entries())
    .map(([productId, row]) => {
      const avgUnitPrice = row.unitsSold > 0 ? row.revenue / row.unitsSold : 0;
      const avgCommission = row.commissionCount > 0 ? row.commissionTotal / row.commissionCount : null;
      const avgUnitProfit =
        row.costPrice != null
          ? avgUnitPrice - row.costPrice - (avgCommission ?? 0) / Math.max(1, row.unitsSold)
          : null;
      return {
        productId,
        title: row.title,
        unitsSold: row.unitsSold,
        revenue: row.revenue,
        avgUnitPrice,
        avgCommission,
        avgUnitProfit,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export type SettlementSummaryRow = {
  marketplace: string;
  gross: number;
  commission: number;
  shipping: number;
  fees: number;
  net: number;
  count: number;
};

/** Mutabakat özeti — pazaryeri bazında brüt/komisyon/kargo/kesinti/net toplamları. */
export async function settlementSummary(
  supabase: AnySupabase,
  storeId: string,
  from: string,
  to: string,
): Promise<SettlementSummaryRow[]> {
  const { data, error } = await supabase
    .from("marketplace_settlements")
    .select(
      "marketplace, gross_amount, commission_amount, shipping_amount, service_fee, other_deductions, net_amount, period_start",
    )
    .eq("store_id", storeId)
    .gte("period_start", from)
    .lte("period_end", to)
    .limit(5000);
  if (error) throw new Error(error.message);

  const agg = new Map<string, SettlementSummaryRow>();
  for (const row of data ?? []) {
    const key = row.marketplace ?? "Diğer";
    const current = agg.get(key) ?? {
      marketplace: key,
      gross: 0,
      commission: 0,
      shipping: 0,
      fees: 0,
      net: 0,
      count: 0,
    };
    current.gross += Number(row.gross_amount ?? 0);
    current.commission += Number(row.commission_amount ?? 0);
    current.shipping += Number(row.shipping_amount ?? 0);
    current.fees += Number(row.service_fee ?? 0) + Number(row.other_deductions ?? 0);
    current.net += Number(row.net_amount ?? 0);
    current.count += 1;
    agg.set(key, current);
  }

  return Array.from(agg.values()).sort((a, b) => b.gross - a.gross);
}
