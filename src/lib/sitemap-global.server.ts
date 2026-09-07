import { publicSupabase } from "@/lib/public-supabase.server";
import { readSeo } from "@/lib/seo";

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

  for (let offset = 0; ; offset += PAGE_SIZE) {
    if (kind === "products") {
      const { data, error } = await supabase
        .from("products")
        .select("slug, seo, updated_at, stores!inner(slug, status)")
        .eq("status", "active")
        .eq("stores.status", "active")
        .order("updated_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as { slug: string; seo: unknown; updated_at: string | null; stores: StoreJoin }[];
      for (const row of rows) {
        if (!row.stores || readSeo(row.seo).noindex) continue;
        entries.push({
          loc: `${BASE_URL}/s/${row.stores.slug}/p/${row.slug}`,
          lastmod: row.updated_at,
          changefreq: "weekly",
          priority: "0.8",
        });
      }
      if (rows.length < PAGE_SIZE) break;
    } else if (kind === "categories") {
      const { data, error } = await supabase
        .from("collections")
        .select("slug, seo, updated_at, stores!inner(slug, status)")
        .eq("stores.status", "active")
        .order("updated_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as { slug: string; seo: unknown; updated_at: string | null; stores: StoreJoin }[];
      for (const row of rows) {
        if (!row.stores || readSeo(row.seo).noindex) continue;
        entries.push({
          loc: `${BASE_URL}/s/${row.stores.slug}/c/${row.slug}`,
          lastmod: row.updated_at,
          changefreq: "weekly",
          priority: "0.7",
        });
      }
      if (rows.length < PAGE_SIZE) break;
    } else {
      const isBlog = kind === "blog";
      const { data, error } = await supabase
        .from("store_pages")
        .select("slug, seo, page_kind, updated_at, stores!inner(slug, status)")
        .eq("is_published", true)
        // pages: blog dışındaki tüm yayınlanmış sayfalar (page, custom vb.)
        [isBlog ? "eq" : "neq"]("page_kind", "blog")
        .eq("stores.status", "active")
        .order("updated_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as {
        slug: string;
        seo: unknown;
        updated_at: string | null;
        stores: StoreJoin;
      }[];
      for (const row of rows) {
        if (!row.stores || readSeo(row.seo).noindex) continue;
        entries.push({
          loc: `${BASE_URL}/s/${row.stores.slug}/page/${row.slug}`,
          lastmod: row.updated_at,
          changefreq: isBlog ? "weekly" : "monthly",
          priority: isBlog ? "0.6" : "0.5",
        });
      }
      if (rows.length < PAGE_SIZE) break;
    }
  }

  return render(entries);
}
