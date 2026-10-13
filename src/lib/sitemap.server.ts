import { readAllPages } from "@/lib/read-all-pages";
import { policySlug } from "@/lib/policy-content";
import { publicSupabase } from "@/lib/public-supabase.server";
import { readSeo, readStoreSeo } from "@/lib/seo";

/**
 * Mağaza vitrinleri için otomatik sitemap ve robots.txt üretimi.
 * Yalnızca yayınlanmış/aktif ve arama motorlarına açık içerikler listelenir.
 */

const STATIC_PATHS = [
  { path: "", priority: "1.0", changefreq: "daily" },
  { path: "/products", priority: "0.9", changefreq: "daily" },
  { path: "/collections", priority: "0.7", changefreq: "weekly" },
  { path: "/categories", priority: "0.7", changefreq: "weekly" },
  { path: "/blog", priority: "0.6", changefreq: "weekly" },
  { path: "/about", priority: "0.4", changefreq: "monthly" },
  { path: "/contact", priority: "0.4", changefreq: "monthly" },
  { path: "/faq", priority: "0.4", changefreq: "monthly" },
];

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type SitemapEntry = {
  loc: string;
  lastmod?: string | null;
  changefreq?: string;
  priority?: string;
};

function renderSitemap(entries: SitemapEntry[]) {
  const body = entries
    .map((entry) => {
      const parts = [`    <loc>${escapeXml(entry.loc)}</loc>`];
      if (entry.lastmod) parts.push(`    <lastmod>${entry.lastmod.slice(0, 10)}</lastmod>`);
      if (entry.changefreq) parts.push(`    <changefreq>${entry.changefreq}</changefreq>`);
      if (entry.priority) parts.push(`    <priority>${entry.priority}</priority>`);
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

/** Mağazanın vitrin sitemap.xml içeriğini üretir. */
export async function buildStoreSitemap(slug: string, origin: string) {
  const supabase = publicSupabase();

  const { data: store, error } = await supabase
    .from("stores")
    .select("id, slug, status, store_kind")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!store || store.status !== "active") return null;

  const base = `${origin.replace(/\/$/, "")}/s/${store.slug}`;

  const [settingsRes, productsRes, collectionsRes, pagesRes] = await Promise.all([
    supabase.from("store_settings").select("seo").eq("store_id", store.id).maybeSingle(),
    readAllPages((from, to) =>
      supabase
        .from("products")
        .select("slug, seo, updated_at")
        .eq("store_id", store.id)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    readAllPages((from, to) =>
      supabase
        .from("collections")
        .select("slug, seo, updated_at")
        .eq("store_id", store.id)
        .order("sort_order")
        .order("id")
        .range(from, to),
    ),
    readAllPages((from, to) =>
      supabase
        .from("store_pages")
        .select("slug, seo, page_kind, updated_at")
        .eq("store_id", store.id)
        .eq("is_published", true)
        .order("id")
        .range(from, to),
    ),
  ]);

  if (settingsRes.error) throw new Error(settingsRes.error.message);
  const storeSeo = readStoreSeo(settingsRes.data?.seo);
  if (storeSeo.noindexStore) return null;

  const entries: SitemapEntry[] = (
    store.store_kind === "micro"
      ? STATIC_PATHS.filter((item) => ["", "/products"].includes(item.path))
      : STATIC_PATHS
  ).map((item) => ({
    loc: `${base}${item.path}`,
    changefreq: item.changefreq,
    priority: item.priority,
  }));

  for (const product of productsRes.data ?? []) {
    if (readSeo(product.seo).noindex) continue;
    entries.push({
      loc: `${base}/p/${product.slug}`,
      lastmod: product.updated_at,
      changefreq: "weekly",
      priority: "0.8",
    });
  }

  for (const collection of collectionsRes.data ?? []) {
    if (readSeo(collection.seo).noindex) continue;
    entries.push({
      loc: `${base}/c/${collection.slug}`,
      lastmod: collection.updated_at,
      changefreq: "weekly",
      priority: "0.7",
    });
  }

  for (const page of pagesRes.data ?? []) {
    if (readSeo(page.seo).noindex) continue;
    entries.push({
      loc: `${base}/page/${page.slug}`,
      lastmod: page.updated_at,
      changefreq: page.page_kind === "blog" ? "weekly" : "monthly",
      priority: page.page_kind === "blog" ? "0.6" : "0.5",
    });
  }

  const { data: policies, error: policyError } = await supabase
    .from("policies")
    .select("policy_key, current_version_id")
    .eq("store_id", store.id)
    .eq("is_visible", true)
    .not("current_version_id", "is", null);
  if (policyError) throw new Error(policyError.message);
  const ids = (policies ?? []).map((policy) => policy.current_version_id!).filter(Boolean);
  const { data: versions, error: versionError } = ids.length
    ? await supabase
        .from("policy_versions")
        .select("id, published_at")
        .eq("store_id", store.id)
        .in("id", ids)
        .eq("is_active", true)
    : { data: [], error: null };
  if (versionError) throw new Error(versionError.message);
  for (const policy of policies ?? []) {
    const version = versions?.find((v) => v.id === policy.current_version_id);
    if (version)
      entries.push({
        loc: `${base}/politika/${policySlug("store", policy.policy_key)}`,
        lastmod: version.published_at,
        changefreq: "yearly",
        priority: "0.3",
      });
  }
  return renderSitemap([...new Map(entries.map((entry) => [entry.loc, entry])).values()]);
}

/** Mağazanın vitrin robots.txt içeriğini üretir. */
export async function buildStoreRobots(slug: string, origin: string) {
  const supabase = publicSupabase();

  const { data: store, error } = await supabase
    .from("stores")
    .select("id, slug, status")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!store) return null;

  const { data: settings } = await supabase
    .from("store_settings")
    .select("seo")
    .eq("store_id", store.id)
    .maybeSingle();
  const storeSeo = readStoreSeo(settings?.seo);

  const blocked = store.status !== "active" || storeSeo.noindexStore === true;

  const lines = ["User-agent: *"];
  if (blocked) {
    lines.push("Disallow: /");
    return `${lines.join("\n")}\n`;
  }

  lines.push("Allow: /");
  for (const path of [
    "/cart",
    "/checkout",
    "/account",
    "/orders",
    "/login",
    "/register",
    "/favorites",
    "/compare",
  ]) {
    lines.push(`Disallow: /s/${store.slug}${path}`);
  }
  if (storeSeo.robotsExtra?.trim()) lines.push(storeSeo.robotsExtra.trim());
  lines.push("", `Sitemap: ${origin.replace(/\/$/, "")}/api/public/sitemap/${store.slug}`);
  return `${lines.join("\n")}\n`;
}
