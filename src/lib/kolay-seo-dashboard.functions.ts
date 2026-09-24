import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Kolay Panel SEO paneli: ürün başına meta tamlığı, Open Graph ve sayfa hızı
 * puanı; düşük puanlılara yapay zekâ ile meta önerisi; Google arama verisi.
 */

const SITE = "https://mefticaret.com";
const GSC = "https://connector-gateway.lovable.dev/google_search_console";

type Seo = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const plain = (v: string) => v.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export type ProductSeoRow = {
  id: string;
  title: string;
  slug: string;
  url: string;
  published: boolean;
  metaTitle: string;
  metaDescription: string;
  metaScore: number;
  ogScore: number;
  speed: { score: number; lcp: number; cls: number; tbt: number; at: string } | null;
  issues: string[];
};

function scoreProduct(p: { title: string; description: string | null; seo: Seo }, imageCount: number) {
  const issues: string[] = [];
  const title = str(p.seo["title"]) || p.title;
  const desc = str(p.seo["description"]) || plain(p.description ?? "");
  let meta = 0;
  if (str(p.seo["title"])) meta += 20;
  else issues.push("Özel meta başlık yok");
  if (title.length >= 20 && title.length <= 60) meta += 30;
  else issues.push(title.length < 20 ? "Başlık çok kısa" : "Başlık 60 karakterden uzun");
  if (str(p.seo["description"])) meta += 20;
  else issues.push("Özel meta açıklama yok");
  if (desc.length >= 70 && desc.length <= 160) meta += 30;
  else issues.push(desc.length < 70 ? "Açıklama çok kısa" : "Açıklama 160 karakterden uzun");

  let og = 0;
  if (title) og += 25;
  if (desc.length >= 50) og += 25;
  if (imageCount > 0 || str(p.seo["ogImage"])) og += 35;
  else issues.push("Paylaşım görseli yok (ürün fotoğrafı ekleyin)");
  if (imageCount > 1) og += 15;
  return { meta, og, issues, title: str(p.seo["title"]), desc: str(p.seo["description"]) };
}

async function storeSlug(supabase: { from: (t: "stores") => any }, storeId: string) {
  const { data, error } = await supabase.from("stores").select("id, slug").eq("id", storeId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Mağaza bulunamadı veya yetkiniz yok");
  return String(data.slug);
}

export const listProductSeoScores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const slug = await storeSlug(supabase, data.storeId);
    const [{ data: products, error }, { data: images }] = await Promise.all([
      supabase
        .from("products")
        .select("id, title, slug, description, seo, status")
        .eq("store_id", data.storeId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("product_images").select("product_id").eq("store_id", data.storeId),
    ]);
    if (error) throw new Error(error.message);
    const counts = new Map<string, number>();
    for (const img of images ?? []) counts.set(img.product_id, (counts.get(img.product_id) ?? 0) + 1);

    const rows: ProductSeoRow[] = (products ?? []).map((p) => {
      const seo = (p.seo ?? {}) as Seo;
      const s = scoreProduct({ title: p.title, description: p.description, seo }, counts.get(p.id) ?? 0);
      const ps = seo["pagespeed"] as ProductSeoRow["speed"] | undefined;
      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        url: `${SITE}/s/${slug}/p/${p.slug}`,
        published: p.status === "active",
        metaTitle: s.title,
        metaDescription: s.desc,
        metaScore: s.meta,
        ogScore: s.og,
        speed: ps && typeof ps.score === "number" ? ps : null,
        issues: s.issues,
      };
    });
    return { slug, rows, pagespeedReady: Boolean(process.env["PAGESPEED_API_KEY"]) };
  });

async function patchSeo(supabase: any, storeId: string, productId: string, patch: Seo) {
  const { data: row, error } = await supabase
    .from("products")
    .select("seo")
    .eq("id", productId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Ürün bulunamadı");
  const seo = { ...((row.seo ?? {}) as Seo), ...patch };
  const { error: saveError } = await supabase
    .from("products")
    .update({ seo })
    .eq("id", productId)
    .eq("store_id", storeId);
  if (saveError) throw new Error(saveError.message);
}

/** Ürün sayfasını Google PageSpeed (mobil) ile ölçer ve sonucu saklar. */
export const runProductPageSpeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: z.guid(), productId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env["PAGESPEED_API_KEY"];
    if (!key) throw new Error("Hız ölçümü için Google PageSpeed anahtarı henüz eklenmedi.");
    const { supabase } = context;
    const slug = await storeSlug(supabase, data.storeId);
    const { data: product } = await supabase
      .from("products")
      .select("slug")
      .eq("id", data.productId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (!product) throw new Error("Ürün bulunamadı");
    const url = `${SITE}/s/${slug}/p/${product.slug}`;
    const api = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
    api.searchParams.set("url", url);
    api.searchParams.set("strategy", "mobile");
    api.searchParams.set("category", "performance");
    api.searchParams.set("key", key);
    const res = await fetch(api);
    const body = (await res.json()) as any;
    if (!res.ok) throw new Error(`Hız ölçümü yapılamadı: ${body?.error?.message ?? res.status}`);
    const audits = body.lighthouseResult?.audits ?? {};
    const speed = {
      score: Math.round((body.lighthouseResult?.categories?.performance?.score ?? 0) * 100),
      lcp: Math.round(audits["largest-contentful-paint"]?.numericValue ?? 0),
      cls: Number((audits["cumulative-layout-shift"]?.numericValue ?? 0).toFixed(3)),
      tbt: Math.round(audits["total-blocking-time"]?.numericValue ?? 0),
      at: new Date().toISOString(),
    };
    await patchSeo(supabase, data.storeId, data.productId, { pagespeed: speed });
    return speed;
  });

/** Yapay zekâ ile tek meta başlık + açıklama önerir (kaydetmez). */
export const suggestProductMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: z.guid(), productId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: product } = await supabase
      .from("products")
      .select("title, description, product_type")
      .eq("id", data.productId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (!product) throw new Error("Ürün bulunamadı");
    const { runAiTask } = await import("@/lib/ai.server");
    const result = await runAiTask({
      client: supabase,
      storeId: data.storeId,
      userId,
      taskKey: "product_meta",
      values: {
        subject: product.title,
        details: [product.product_type, plain(product.description ?? "")].filter(Boolean).join(" — ").slice(0, 800),
      },
    });
    const title = /BAŞLIK:\s*(.+)/i.exec(result.text)?.[1]?.trim() ?? "";
    const description = /AÇIKLAMA:\s*(.+)/i.exec(result.text)?.[1]?.trim() ?? "";
    if (!title && !description) throw new Error("Yapay zekâ öneri üretemedi, tekrar deneyin.");
    return { title: title.slice(0, 70), description: description.slice(0, 170) };
  });

export const saveProductMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        storeId: z.guid(),
        productId: z.guid(),
        title: z.string().trim().max(70),
        description: z.string().trim().max(170),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await patchSeo(context.supabase, data.storeId, data.productId, {
      title: data.title,
      description: data.description,
    });
    return { ok: true };
  });

/** Google Search Console: mağaza sayfalarının son 28 gün arama performansı. */
export const getStoreSearchPerformance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    const slug = await storeSlug(context.supabase, data.storeId);
    const lovable = process.env["LOVABLE_API_KEY"];
    const conn = process.env["GOOGLE_SEARCH_CONSOLE_API_KEY"];
    if (!lovable || !conn) return { status: "unavailable" as const, rows: [], totals: null };
    const headers = { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": conn };

    const sitesRes = await fetch(`${GSC}/webmasters/v3/sites`, { headers });
    if (!sitesRes.ok) return { status: "unavailable" as const, rows: [], totals: null };
    const { siteEntry = [] } = (await sitesRes.json()) as { siteEntry?: { siteUrl: string; permissionLevel?: string }[] };
    const site = siteEntry.find((e) => e.siteUrl === `${SITE}/` && e.permissionLevel !== "siteUnverifiedUser");
    if (!site) return { status: "unavailable" as const, rows: [], totals: null };

    const end = new Date();
    const start = new Date(end.getTime() - 28 * 86400000);
    const day = (d: Date) => d.toISOString().slice(0, 10);
    const res = await fetch(`${GSC}/webmasters/v3/sites/${encodeURIComponent(site.siteUrl)}/searchAnalytics/query`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: day(start),
        endDate: day(end),
        dimensions: ["page"],
        dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "contains", expression: `/s/${slug}` }] }],
        rowLimit: 50,
      }),
    });
    if (!res.ok) return { status: "unavailable" as const, rows: [], totals: null };
    const body = (await res.json()) as { rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[] };
    const rows = (body.rows ?? []).map((r) => ({
      page: r.keys[0] ?? "",
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    }));
    const totals = rows.reduce(
      (acc, r) => ({ clicks: acc.clicks + r.clicks, impressions: acc.impressions + r.impressions }),
      { clicks: 0, impressions: 0 },
    );
    return { status: "ok" as const, rows, totals };
  });
