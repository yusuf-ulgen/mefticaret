/**
 * XML/CSV/API entegratörü yayınlama motoru: tedarikçi ürünlerini tek tıkla
 * mağazaya (site) ve seçilen pazaryeri kanallarına aktarır, kategori
 * eşleştirmesini otomatik yapar. Tenant izolasyonu çağıranın RLS bağlamıyla
 * sağlanır; bu katman yalnızca iş kurallarını uygular.
 */

type Client = { from: (table: string) => any };

const trNormalize = (value: string): string =>
  value
    .toLocaleLowerCase("tr")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/i̇/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const slugify = (value: string): string =>
  trNormalize(value).replace(/\s+/g, "-").slice(0, 60) || "kategori";

/** Son segmenti alır: "Giyim > Kadın > Elbise" → "Elbise". */
const leafOf = (value: string): string => {
  const parts = value.split(/[>|/»]/).map((part) => part.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1]! : value.trim();
};

const similarity = (a: string, b: string): number => {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aTokens = new Set(a.split(" "));
  const bTokens = new Set(b.split(" "));
  let shared = 0;
  for (const token of aTokens) if (bTokens.has(token)) shared += 1;
  const union = new Set([...aTokens, ...bTokens]).size;
  const jaccard = union ? shared / union : 0;
  const contains = a.includes(b) || b.includes(a) ? 0.65 : 0;
  return Math.max(jaccard, contains);
};

export type CategorySuggestion = {
  source: string;
  target: string;
  categoryId: string | null;
  score: number;
  action: "matched" | "create";
};

/** Besleme kategorilerini mağaza kategorileriyle otomatik eşleştirir. */
export async function autoMapFeedCategories(
  supabase: Client,
  storeId: string,
  feedId: string,
): Promise<{ suggestions: CategorySuggestion[]; map: Record<string, string> }> {
  const { data: rows, error } = await supabase
    .from("supplier_products")
    .select("category")
    .eq("store_id", storeId)
    .eq("feed_id", feedId)
    .not("category", "is", null)
    .limit(5000);
  if (error) throw new Error(error.message);

  const sources = Array.from(
    new Set(
      ((rows ?? []) as { category: string | null }[])
        .map((row) => (row.category ?? "").trim())
        .filter(Boolean),
    ),
  ).slice(0, 300);

  const { data: categories, error: categoryError } = await supabase
    .from("categories")
    .select("id, name")
    .eq("store_id", storeId)
    .limit(2000);
  if (categoryError) throw new Error(categoryError.message);

  const targets = ((categories ?? []) as { id: string; name: string }[]).map((row) => ({
    ...row,
    normalized: trNormalize(row.name),
  }));

  const suggestions: CategorySuggestion[] = [];
  const map: Record<string, string> = {};

  for (const source of sources) {
    const leaf = leafOf(source);
    const normalized = trNormalize(leaf);
    let best: { id: string; name: string; score: number } | null = null;
    for (const target of targets) {
      const score = similarity(normalized, target.normalized);
      if (!best || score > best.score) best = { id: target.id, name: target.name, score };
    }
    if (best && best.score >= 0.55) {
      suggestions.push({
        source,
        target: best.name,
        categoryId: best.id,
        score: Number(best.score.toFixed(2)),
        action: "matched",
      });
      map[source] = best.name;
    } else {
      suggestions.push({ source, target: leaf, categoryId: null, score: 0, action: "create" });
      map[source] = leaf;
    }
  }

  const { error: saveError } = await supabase
    .from("supplier_feeds")
    .update({ category_map: map as never })
    .eq("id", feedId)
    .eq("store_id", storeId);
  if (saveError) throw new Error(saveError.message);

  return { suggestions, map };
}

async function ensureCategory(
  supabase: Client,
  storeId: string,
  name: string,
  cache: Map<string, string>,
): Promise<string | null> {
  const leaf = leafOf(name);
  if (!leaf) return null;
  const key = trNormalize(leaf);
  const cached = cache.get(key);
  if (cached) return cached;

  const { data: existing } = await supabase
    .from("categories")
    .select("id, name")
    .eq("store_id", storeId)
    .ilike("name", leaf)
    .limit(1)
    .maybeSingle();
  if (existing) {
    cache.set(key, (existing as { id: string }).id);
    return (existing as { id: string }).id;
  }

  const { data: created, error } = await supabase
    .from("categories")
    .insert({
      store_id: storeId,
      name: leaf,
      slug: `${slugify(leaf)}-${Math.random().toString(36).slice(2, 5)}`,
      is_active: true,
    })
    .select("id")
    .maybeSingle();
  if (error || !created) return null;
  cache.set(key, (created as { id: string }).id);
  return (created as { id: string }).id;
}

export type PublishTotals = {
  processed: number;
  productsCreated: number;
  productsActivated: number;
  categoriesAssigned: number;
  listingsQueued: number;
  skipped: number;
};

/**
 * Tek tıkla yayınlama: tedarikçi ürünlerini mağazada aktif ürüne dönüştürür,
 * kategori eşleştirmesini uygular ve seçilen pazaryeri kanallarına kuyruğa alır.
 */
export async function publishSupplierProducts(
  supabase: Client,
  input: {
    storeId: string;
    feedId: string;
    supplierProductIds?: string[];
    channelIds: string[];
    activate: boolean;
    onlyInStock: boolean;
  },
): Promise<PublishTotals> {
  const totals: PublishTotals = {
    processed: 0,
    productsCreated: 0,
    productsActivated: 0,
    categoriesAssigned: 0,
    listingsQueued: 0,
    skipped: 0,
  };

  let query = supabase
    .from("supplier_products")
    .select(
      "id, title, sku, barcode, brand, category, supplier_price, computed_price, stock, images, product_id, variant_id, raw",
    )
    .eq("store_id", input.storeId)
    .eq("feed_id", input.feedId)
    .limit(1000);
  if (input.supplierProductIds?.length) query = query.in("id", input.supplierProductIds);
  if (input.onlyInStock) query = query.gt("stock", 0);

  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);

  const items = (rows ?? []) as {
    id: string;
    title: string;
    sku: string | null;
    barcode: string | null;
    brand: string | null;
    category: string | null;
    supplier_price: number;
    computed_price: number | null;
    stock: number;
    images: string[] | null;
    product_id: string | null;
    variant_id: string | null;
    raw: Record<string, unknown> | null;
  }[];

  if (!items.length) return totals;

  const { data: channels } = input.channelIds.length
    ? await supabase
        .from("marketplace_channels")
        .select("id")
        .eq("store_id", input.storeId)
        .in("id", input.channelIds)
    : { data: [] as { id: string }[] };
  const channelIds = ((channels ?? []) as { id: string }[]).map((row) => row.id);

  const categoryCache = new Map<string, string>();

  for (const item of items) {
    totals.processed += 1;
    const price = Number(item.computed_price ?? item.supplier_price ?? 0);
    let productId = item.product_id;

    const categoryId = item.category
      ? await ensureCategory(supabase, input.storeId, item.category, categoryCache)
      : null;

    const raw = (item.raw ?? {}) as Record<string, unknown>;
    const feedVariants = Array.isArray(raw["variants"])
      ? (raw["variants"] as Array<Record<string, unknown>>).filter((entry) => entry && String(entry["value"] ?? "").trim())
      : [];
    const feedVideos = Array.isArray(raw["videos"])
      ? (raw["videos"] as Array<Record<string, unknown>>).filter((entry) => entry && String(entry["embedUrl"] ?? "").trim())
      : [];
    const taxRate = typeof raw["tax_rate"] === "number" ? (raw["tax_rate"] as number) : null;

    if (!productId) {
      const { data: created, error: productError } = await supabase
        .from("products")
        .insert({
          store_id: input.storeId,
          title: item.title,
          slug: `${slugify(item.title)}-${Math.random().toString(36).slice(2, 6)}`,
          description: typeof raw["description"] === "string" ? raw["description"] : null,
          vendor: item.brand,
          product_type: item.category ? leafOf(item.category) : null,
          category_id: categoryId,
          base_price: price,
          cost_price: item.supplier_price,
          sku: item.sku,
          barcode: item.barcode,
          ...(taxRate !== null ? { tax_rate: taxRate } : {}),
          ...(feedVideos.length ? { video_url: String(feedVideos[0]!["embedUrl"]) } : {}),
          ...(feedVariants.length
            ? { variant_options: [{ name: String(feedVariants[0]!["name"] ?? "Beden"), values: Array.from(new Set(feedVariants.map((entry) => String(entry["value"])))) }] }
            : {}),
          status: input.activate ? "active" : "draft",
        })
        .select("id")
        .maybeSingle();
      if (productError || !created) {
        totals.skipped += 1;
        continue;
      }
      productId = (created as { id: string }).id;
      totals.productsCreated += 1;
      if (categoryId) totals.categoriesAssigned += 1;

      // İç içe varyant düğümü varsa her beden/renk ayrı varyant olur.
      const variantRows = feedVariants.length
        ? feedVariants.slice(0, 60).map((entry, index) => ({
            store_id: input.storeId,
            product_id: productId,
            title: String(entry["value"]),
            options: { [String(entry["name"] ?? "Beden")]: String(entry["value"]) },
            sku: item.sku ? `${item.sku}-${String(entry["value"]).toUpperCase().replace(/\s+/g, "")}` : null,
            barcode: entry["barcode"] ? String(entry["barcode"]) : null,
            price: typeof entry["price"] === "number" && entry["price"] ? (entry["price"] as number) : price,
            cost_price: item.supplier_price,
            stock: typeof entry["stock"] === "number" ? (entry["stock"] as number) : 0,
            position: index + 1,
          }))
        : [
            {
              store_id: input.storeId,
              product_id: productId,
              title: "Standart",
              sku: item.sku,
              barcode: item.barcode,
              price,
              cost_price: item.supplier_price,
              stock: item.stock,
              position: 1,
            },
          ];

      const { data: variant } = await supabase.from("product_variants").insert(variantRows).select("id");

      if ((item.images ?? []).length) {
        await supabase.from("product_images").insert(
          (item.images ?? []).slice(0, 8).map((url, index) => ({
            store_id: input.storeId,
            product_id: productId,
            url,
            position: index + 1,
          })),
        );
      }

      // Videolar mağazanın "Ürün Videosu / Shoppable Reels" galerisine düşer.
      if (feedVideos.length) {
        await supabase.from("shoppable_videos").insert(
          feedVideos.slice(0, 4).map((entry, index) => ({
            store_id: input.storeId,
            product_id: productId,
            title: item.title.slice(0, 160),
            video_url: String(entry["embedUrl"]),
            thumbnail_url: entry["thumbnailUrl"] ? String(entry["thumbnailUrl"]) : null,
            source: String(entry["source"] ?? "file"),
            placement: "product",
            sort_order: index + 1,
            is_active: true,
          })),
        );
      }

      const firstVariantId = Array.isArray(variant) && variant.length ? (variant[0] as { id: string }).id : null;
      await supabase
        .from("supplier_products")
        .update({
          product_id: productId,
          variant_id: firstVariantId,
          matched_at: new Date().toISOString(),
        })
        .eq("id", item.id);
    } else {
      const patch: Record<string, unknown> = {};
      if (input.activate) patch["status"] = "active";
      if (categoryId) {
        patch["category_id"] = categoryId;
        totals.categoriesAssigned += 1;
      }
      if (Object.keys(patch).length) {
        const { error: updateError } = await supabase
          .from("products")
          .update(patch)
          .eq("id", productId)
          .eq("store_id", input.storeId);
        if (updateError) {
          totals.skipped += 1;
          continue;
        }
        if (input.activate) totals.productsActivated += 1;
      }
    }

    for (const channelId of channelIds) {
      const { data: existing } = await supabase
        .from("channel_listings")
        .select("id")
        .eq("channel_id", channelId)
        .eq("product_id", productId)
        .limit(1)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("channel_listings")
          .update({ status: "queued", last_error: null })
          .eq("id", (existing as { id: string }).id);
      } else {
        const { error: listingError } = await supabase.from("channel_listings").insert({
          store_id: input.storeId,
          channel_id: channelId,
          product_id: productId,
          status: "queued",
        });
        if (listingError) continue;
      }
      totals.listingsQueued += 1;
    }
  }

  return totals;
}
