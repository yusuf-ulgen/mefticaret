import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type FeedItem = {
  id: string;
  title: string;
  description: string;
  link: string;
  imageLink: string | null;
  price: string;
  availability: "in stock" | "out of stock";
  category: string;
  brand: string;
};

async function loadFeedItems(
  supabase: Client,
  storeId: string,
  origin: string,
  storeSlug: string,
  currency: string,
  includeOutOfStock: boolean,
  categoryMap: Record<string, string>,
): Promise<FeedItem[]> {
  const { data: products, error } = await supabase
    .from("products")
    .select(
      "id, title, slug, description, base_price, currency, vendor, category_id, categories(name), product_variants(stock)",
    )
    .eq("store_id", storeId)
    .eq("status", "active")
    .limit(5000);
  if (error) throw new Error(error.message);

  const ids = (products ?? []).map((p) => p.id);
  const covers: Record<string, string> = {};
  if (ids.length) {
    const { data: images } = await supabase
      .from("product_images")
      .select("product_id, url, position")
      .in("product_id", ids)
      .order("position");
    for (const row of images ?? []) {
      if (!covers[row.product_id] && row.url) covers[row.product_id] = row.url;
    }
  }

  return (products ?? [])
    .map((product) => {
      const variants = (product as { product_variants?: { stock: number | null }[] }).product_variants ?? [];
      const inStock = variants.length ? variants.some((v) => (v.stock ?? 0) > 0) : true;
      const categoryName = (product as { categories?: { name: string } | null }).categories?.name ?? "";
      const mappedCategory = categoryMap[product.category_id ?? ""] ?? categoryName;
      return {
        id: product.id,
        title: product.title,
        description: (product.description ?? "").slice(0, 5000) || product.title,
        link: `${origin}/s/${storeSlug}/p/${product.slug}`,
        imageLink: covers[product.id] ?? null,
        price: `${Number(product.base_price ?? 0).toFixed(2)} ${currency}`,
        availability: inStock ? ("in stock" as const) : ("out of stock" as const),
        category: mappedCategory,
        brand: product.vendor ?? "",
      };
    })
    .filter((item) => includeOutOfStock || item.availability === "in stock");
}

/** Google Shopping RSS 2.0 (g: namespace) XML üretir. */
export async function buildGoogleShoppingFeed(
  supabase: Client,
  storeId: string,
  storeName: string,
  storeSlug: string,
  origin: string,
  currency: string,
  includeOutOfStock: boolean,
  categoryMap: Record<string, string>,
) {
  const items = await loadFeedItems(supabase, storeId, origin, storeSlug, currency, includeOutOfStock, categoryMap);
  const entries = items
    .map(
      (item) => `  <item>
    <g:id>${escapeXml(item.id)}</g:id>
    <title>${escapeXml(item.title)}</title>
    <description>${escapeXml(item.description)}</description>
    <link>${escapeXml(item.link)}</link>
    ${item.imageLink ? `<g:image_link>${escapeXml(item.imageLink)}</g:image_link>` : ""}
    <g:condition>new</g:condition>
    <g:availability>${item.availability}</g:availability>
    <g:price>${item.price}</g:price>
    ${item.category ? `<g:product_type>${escapeXml(item.category)}</g:product_type>` : ""}
    ${item.brand ? `<g:brand>${escapeXml(item.brand)}</g:brand>` : ""}
  </item>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
<channel>
  <title>${escapeXml(storeName)} — Ürün Akışı</title>
  <link>${escapeXml(origin)}/s/${escapeXml(storeSlug)}</link>
  <description>${escapeXml(storeName)} Google Shopping ürün akışı</description>
${entries}
</channel>
</rss>`;
}

/** TikTok Shop / Instagram Shop / Facebook Catalog için JSON çıktısı. */
export async function buildCatalogFeedJson(
  supabase: Client,
  storeId: string,
  storeSlug: string,
  origin: string,
  currency: string,
  includeOutOfStock: boolean,
  categoryMap: Record<string, string>,
) {
  const items = await loadFeedItems(supabase, storeId, origin, storeSlug, currency, includeOutOfStock, categoryMap);
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    link: item.link,
    image_link: item.imageLink,
    price: item.price,
    availability: item.availability,
    category: item.category,
    brand: item.brand,
    condition: "new",
  }));
}

function csvEscape(raw: string) {
  /* Tablo programlarında formül olarak çalışmasın diye =,+,-,@ ile başlayan hücreler metne çevrilir. */
  const value = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** TikTok/Instagram/Facebook katalogları için CSV çıktısı üretir. */
export function catalogFeedToCsv(items: Awaited<ReturnType<typeof buildCatalogFeedJson>>) {
  const headers = ["id", "title", "description", "link", "image_link", "price", "availability", "category", "brand", "condition"];
  const rows = items.map((item) =>
    headers.map((header) => csvEscape(String((item as Record<string, unknown>)[header] ?? ""))).join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}
