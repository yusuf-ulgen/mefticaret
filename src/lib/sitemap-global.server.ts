import { readAllPages } from "@/lib/read-all-pages";
import { publicSupabase } from "@/lib/public-supabase.server";
import { readSeo, readStoreSeo } from "@/lib/seo";

/**
 * Platform geneli, tür bazlı sitemap üretimi:
 * /sitemap-products.xml, /sitemap-categories.xml, /sitemap-pages.xml, /sitemap-blog.xml
 * Yalnızca aktif mağazaların yayınlanmış ve noindex olmayan içerikleri listelenir.
 */

const BASE_URL = "https://mefticaret.com";
const PAGE_SIZE = 1000;

export type GlobalSitemapKind = "products" | "categories" | "pages" | "blog";

type Entry = { loc: string; lastmod?: string | null; changefreq: string; priority: string };

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function render(entries: Entry[]) {
  const body = entries
    .map((e) => {
      const parts = [`    <loc>${escapeXml(e.loc)}</loc>`];
      if (e.lastmod) parts.push(`    <lastmod>${e.lastmod.slice(0, 10)}</lastmod>`);
      parts.push(`    <changefreq>${e.changefreq}</changefreq>`);
      parts.push(`    <priority>${e.priority}</priority>`);
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

type StoreJoin = { slug: string; status: string } | null;

/** Tür bazlı platform geneli sitemap XML'i üretir. */
export async function buildGlobalSitemap(kind: GlobalSitemapKind): Promise<string> {
  const supabase = publicSupabase();
  const entries: Entry[] = [];
  const settings = await readAllPages((from, to) =>
    supabase.from("store_settings").select("store_id,seo").order("store_id").range(from, to),
  );
  const hiddenStores = new Set(
    (settings.data ?? [])
      .filter((row) => readStoreSeo(row.seo).noindexStore)
      .map((row) => row.store_id),
  );

  for (let offset = 0; ;) {
    if (kind === "products") {
      const { data, error } = await supabase
        .from("products")
        .select("store_id, slug, seo, updated_at, stores!inner(slug, status)")
        .eq("status", "active")
        .eq("stores.status", "active")
        .order("updated_at", { ascending: false })
        .order("id")
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as {
        store_id: string;
        slug: string;
        seo: unknown;
        updated_at: string | null;
        stores: StoreJoin;
      }[];
      for (const row of rows) {
        if (!row.stores || hiddenStores.has(row.store_id) || readSeo(row.seo).noindex) continue;
        entries.push({
          loc: `${BASE_URL}/s/${row.stores.slug}/p/${row.slug}`,
          lastmod: row.updated_at,
          changefreq: "weekly",
          priority: "0.8",
        });
      }
      if (!rows.length) break;
      offset += rows.length;
    } else if (kind === "categories") {
      const { data, error } = await supabase
        .from("collections")
        .select("store_id, slug, seo, updated_at, stores!inner(slug, status)")
        .eq("stores.status", "active")
        .order("updated_at", { ascending: false })
        .order("id")
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as {
        store_id: string;
        slug: string;
        seo: unknown;
        updated_at: string | null;
        stores: StoreJoin;
      }[];
      for (const row of rows) {
        if (!row.stores || hiddenStores.has(row.store_id) || readSeo(row.seo).noindex) continue;
        entries.push({
          loc: `${BASE_URL}/s/${row.stores.slug}/c/${row.slug}`,
          lastmod: row.updated_at,
          changefreq: "weekly",
          priority: "0.7",
        });
      }
      if (!rows.length) break;
      offset += rows.length;
    } else {
      const isBlog = kind === "blog";
      const { data, error } = await supabase
        .from("store_pages")
        .select("store_id, slug, seo, page_kind, updated_at, stores!inner(slug, status)")
        .eq("is_published", true)
        [
          // pages: blog dışındaki tüm yayınlanmış sayfalar (page, custom vb.)
          isBlog ? "eq" : "neq"
        ]("page_kind", "blog")
        .eq("stores.status", "active")
        .order("updated_at", { ascending: false })
        .order("id")
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as {
        store_id: string;
        slug: string;
        seo: unknown;
        updated_at: string | null;
        stores: StoreJoin;
      }[];
      for (const row of rows) {
        if (!row.stores || hiddenStores.has(row.store_id) || readSeo(row.seo).noindex) continue;
        entries.push({
          loc: `${BASE_URL}/s/${row.stores.slug}/page/${row.slug}`,
          lastmod: row.updated_at,
          changefreq: isBlog ? "weekly" : "monthly",
          priority: isBlog ? "0.6" : "0.5",
        });
      }
      if (!rows.length) break;
      offset += rows.length;
    }
  }

  // Platform (mefticaret.com) kendi içeriği: kurumsal sayfalar ve platform blogu.
  if (kind === "pages") {
    const { data, error } = await readAllPages((from, to) =>
      supabase
        .from("platform_pages")
        .select("slug, updated_at, noindex")
        .eq("is_published", true)
        .order("sort_order")
        .order("id")
        .range(from, to),
    );
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as {
      slug: string;
      updated_at: string | null;
      noindex: boolean | null;
    }[]) {
      if (row.noindex) continue;
      entries.push({
        loc: `${BASE_URL}/sayfa/${row.slug}`,
        lastmod: row.updated_at,
        changefreq: "monthly",
        priority: "0.6",
      });
    }
  } else if (kind === "blog") {
    const { data, error } = await readAllPages((from, to) =>
      supabase
        .from("platform_posts")
        .select("slug, updated_at, published_at, noindex")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .order("id")
        .range(from, to),
    );
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as {
      slug: string;
      updated_at: string | null;
      published_at: string | null;
      noindex: boolean | null;
    }[]) {
      if (row.noindex) continue;
      entries.push({
        loc: `${BASE_URL}/blog/${row.slug}`,
        lastmod: row.updated_at ?? row.published_at,
        changefreq: "weekly",
        priority: "0.7",
      });
    }
  }

  return render([...new Map(entries.map((entry) => [entry.loc, entry])).values()]);
}
