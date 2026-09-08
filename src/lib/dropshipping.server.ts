/**
 * Tedarikçi besleme senkronizasyon motoru (XML / CSV / API) ve dropshipping
 * sipariş gönderimi. Tenant izolasyonu çağıran istemcinin RLS bağlamıyla
 * sağlanır; bu katman yalnızca iş kurallarını uygular.
 */

import {
  applyMapping,
  computeSalePrice,
  computeStock,
  matchValueOf,
  nextRunAt,
  passesFilters,
  normalizeFeedItem,
  parseFeedPayload,
  type FieldMap,
  type FilterRules,
  type PriceRules,
  type StockRules,
  type SupplierFeedItem,
  type SupplierFeedKind,
  type SupplierFeedSchedule,
  type SupplierMatchKey,
} from "@/lib/dropshipping";

type Client = { from: (table: string) => any };

export type FeedRow = {
  id: string;
  store_id: string;
  supplier_id: string | null;
  name: string;
  kind: SupplierFeedKind;
  source_url: string;
  auth_header: string | null;
  schedule: SupplierFeedSchedule;
  match_key: SupplierMatchKey;
  item_path: string | null;
  field_map: FieldMap;
  category_map: Record<string, string>;
  brand_map: Record<string, string>;
  price_rules: PriceRules;
  stock_rules: StockRules;
  filter_rules?: FilterRules;
  import_images: boolean;
  create_missing: boolean;
};

export type FeedTotals = {
  fetched: number;
  imported: number;
  matched: number;
  created: number;
  priceUpdated: number;
  stockUpdated: number;
  skipped: number;
};

const emptyTotals = (): FeedTotals => ({
  fetched: 0,
  imported: 0,
  matched: 0,
  created: 0,
  priceUpdated: 0,
  stockUpdated: 0,
  skipped: 0,
});

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "urun";

async function fetchFeedBody(feed: FeedRow): Promise<string> {
  let url: URL;
  try {
    url = new URL(feed.source_url);
  } catch {
    throw new Error("Geçersiz besleme adresi");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Yalnızca http/https adresleri desteklenir");
  }

  const headers: Record<string, string> = {
    accept: feed.kind === "api" ? "application/json" : "application/xml, text/csv, */*",
    "user-agent": "Mefticaret-FeedSync/1.0",
  };
  if (feed.auth_header) {
    const [name, ...rest] = feed.auth_header.split(":");
    if (name && rest.length) headers[name.trim().toLowerCase()] = rest.join(":").trim();
  }

  const response = await fetch(url.toString(), { headers, redirect: "follow" });
  if (!response.ok) throw new Error(`Kaynak yanıtı ${response.status}`);
  const body = await response.text();
  if (!body.trim()) throw new Error("Kaynak boş yanıt döndü");
  return body;
}

/** Bir tedarikçi beslemesini çalıştırır: indir → çözümle → eşleştir → fiyat/stok uygula. */
export async function runSupplierFeed(
  supabase: Client,
  feed: FeedRow,
  trigger: "manual" | "scheduled" = "manual",
): Promise<{ runId: string; totals: FeedTotals }> {
  const { data: run, error: runError } = await supabase
    .from("supplier_feed_runs")
    .insert({ store_id: feed.store_id, feed_id: feed.id, status: "running", trigger })
    .select("id")
    .single();
  if (runError) throw new Error(runError.message);
  const runId = (run as { id: string }).id;
  const totals = emptyTotals();

  const finish = async (status: "success" | "failed", error?: string) => {
    await supabase
      .from("supplier_feed_runs")
      .update({ status, totals, error: error ?? null, finished_at: new Date().toISOString() })
      .eq("id", runId);
    await supabase
      .from("supplier_feeds")
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: nextRunAt(feed.schedule),
        last_status: status,
        last_error: error ?? null,
        stats: totals,
      })
      .eq("id", feed.id);
  };

  try {
    const body = await fetchFeedBody(feed);
    const records = parseFeedPayload(feed.kind, body, feed.item_path);
    totals.fetched = records.length;
    if (!records.length) throw new Error("Kaynakta ürün bulunamadı (ürün düğümü/alan eşleşmesi kontrol edin)");

    const items: SupplierFeedItem[] = [];
    for (const record of records.slice(0, 5000)) {
      const item = normalizeFeedItem(record, feed.field_map ?? {});
      if (!item) {
        totals.skipped += 1;
        continue;
      }
      item.category = applyMapping(item.category, feed.category_map ?? {});
      item.brand = applyMapping(item.brand, feed.brand_map ?? {});
      if (!passesFilters(item, feed.filter_rules ?? {})) {
        totals.skipped += 1;
        continue;
      }
      items.push(item);
    }

    const now = new Date().toISOString();
    for (const item of items) {
      const salePrice = computeSalePrice(item.supplier_price, feed.price_rules ?? {});
      const stock = computeStock(item.stock, feed.stock_rules ?? {});
      const matchValue = matchValueOf(item, feed.match_key);

      let variant: { id: string; product_id: string; price: number; stock: number } | null = null;
      if (matchValue) {
        const column = feed.match_key === "barcode" ? "barcode" : "sku";
        const { data: found } = await supabase
          .from("product_variants")
          .select("id, product_id, price, stock")
          .eq("store_id", feed.store_id)
          .eq(column, matchValue)
          .limit(1)
          .maybeSingle();
        if (found) variant = found;
      }

      if (!variant && feed.create_missing) {
        const { data: product } = await supabase
          .from("products")
          .insert({
            store_id: feed.store_id,
            title: item.title,
            slug: `${slugify(item.title)}-${Math.random().toString(36).slice(2, 6)}`,
            description: item.description,
            vendor: item.brand,
            product_type: item.category,
            base_price: salePrice,
            status: "draft",
            sku: item.sku,
            barcode: item.barcode,
            cost_price: item.supplier_price,
          })
          .select("id")
          .maybeSingle();
        if (product) {
          const { data: created } = await supabase
            .from("product_variants")
            .insert({
              store_id: feed.store_id,
              product_id: (product as { id: string }).id,
              title: "Standart",
              sku: item.sku,
              barcode: item.barcode,
              price: salePrice,
              stock,
              position: 1,
            })
            .select("id, product_id, price, stock")
            .maybeSingle();
          if (created) {
            variant = created;
            totals.created += 1;
            if (feed.import_images && item.images.length) {
              await supabase.from("product_images").insert(
                item.images.slice(0, 6).map((url, index) => ({
                  store_id: feed.store_id,
                  product_id: (product as { id: string }).id,
                  url,
                  position: index + 1,
                })),
              );
            }
          }
        }
      }

      if (variant) {
        totals.matched += 1;
        const patch: Record<string, unknown> = {};
        if (Number(variant.price) !== salePrice && salePrice > 0) {
          patch["price"] = salePrice;
          totals.priceUpdated += 1;
        }
        if (Number(variant.stock ?? 0) !== stock) {
          patch["stock"] = stock;
          totals.stockUpdated += 1;
        }
        if (Object.keys(patch).length) {
          await supabase.from("product_variants").update(patch).eq("id", variant.id);
        }
      }

      const payload = {
        store_id: feed.store_id,
        feed_id: feed.id,
        supplier_id: feed.supplier_id,
        external_id: item.external_id,
        sku: item.sku,
        barcode: item.barcode,
        title: item.title,
        brand: item.brand,
        category: item.category,
        supplier_price: item.supplier_price,
        computed_price: salePrice,
        stock,
        images: feed.import_images ? item.images : [],
        raw: item.raw,
        product_id: variant?.product_id ?? null,
        variant_id: variant?.id ?? null,
        matched_at: variant ? now : null,
        last_seen_at: now,
      };

      const identityColumn =
        item.external_id ? "external_id" : item.sku ? "sku" : item.barcode ? "barcode" : "title";
      const identityValue =
        item.external_id ?? item.sku ?? item.barcode ?? item.title;

      const { data: existing } = await supabase
        .from("supplier_products")
        .select("id")
        .eq("feed_id", feed.id)
        .eq(identityColumn, identityValue)
        .limit(1)
        .maybeSingle();

      const { error: writeError } = existing
        ? await supabase
            .from("supplier_products")
            .update(payload)
            .eq("id", (existing as { id: string }).id)
        : await supabase.from("supplier_products").insert(payload);
      if (writeError) totals.skipped += 1;
      else totals.imported += 1;
    }

    await finish("success");
    return { runId, totals };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Senkronizasyon başarısız";
    await finish("failed", message);
    throw new Error(message);
  }
}

/**
 * Siparişi tedarikçiye iletir. Tedarikçi uç noktası tanımlıysa imzasız JSON
 * POST yapılır; tanımlı değilse kayıt "beklemede" olarak kuyruğa alınır.
 */
export async function sendDropshipOrder(
  supabase: Client,
  storeId: string,
  orderId: string,
  supplierId: string | null,
): Promise<{ id: string; status: string; error?: string }> {
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, order_number, currency, grand_total, customer_name, customer_email, customer_phone, shipping_address, order_items(id, title, sku, quantity, unit_price, variant_id)",
    )
    .eq("id", orderId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (orderError) throw new Error(orderError.message);
  if (!order) throw new Error("Sipariş bulunamadı");

  let supplier: { id: string; name: string; order_endpoint: string | null } | null = null;
  if (supplierId) {
    const { data } = await supabase
      .from("suppliers")
      .select("id, name, order_endpoint")
      .eq("id", supplierId)
      .eq("store_id", storeId)
      .maybeSingle();
    supplier = data ?? null;
  }

  const payload = {
    reference: order.order_number,
    currency: order.currency,
    customer: {
      name: order.customer_name,
      email: order.customer_email,
      phone: order.customer_phone,
    },
    shipping_address: order.shipping_address,
    items: (order.order_items ?? []).map((item: any) => ({
      sku: item.sku,
      title: item.title,
      quantity: item.quantity,
      unit_price: Number(item.unit_price ?? 0),
    })),
  };

  const { data: record, error: insertError } = await supabase
    .from("dropship_orders")
    .insert({
      store_id: storeId,
      supplier_id: supplierId,
      order_id: orderId,
      status: "pending",
      payload: payload as never,
    })
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);
  const id = (record as { id: string }).id;

  if (!supplier?.order_endpoint) {
    return { id, status: "pending" };
  }

  try {
    const response = await fetch(supplier.order_endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* düz metin yanıt */
    }
    if (!response.ok) throw new Error(`Tedarikçi yanıtı ${response.status}`);

    const external =
      parsed && typeof parsed === "object"
        ? ((parsed as Record<string, unknown>)["id"] ??
            (parsed as Record<string, unknown>)["reference"] ??
            null)
        : null;

    await supabase
      .from("dropship_orders")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        response: (typeof parsed === "object" ? parsed : { body: text }) as never,
        external_ref: external ? String(external) : null,
      })
      .eq("id", id);
    return { id, status: "sent" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gönderim başarısız";
    await supabase.from("dropship_orders").update({ status: "failed", error: message }).eq("id", id);
    return { id, status: "failed", error: message };
  }
}
