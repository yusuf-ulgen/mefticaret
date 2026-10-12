/**
 * Platform (süper admin) SEO merkezi: tüm mağazaların son denetim sonuçlarını
 * toplar ve istenen mağazalarda denetim çalıştırır. Yalnızca platform_admin
 * doğrulaması yapılmış server fonksiyonlarından çağrılır.
 */

type Db = { from: (table: string) => any };

async function admin(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}

export type PlatformSeoStore = {
  storeId: string;
  name: string;
  slug: string;
  status: string;
  score: number;
  technical: number;
  content: number;
  schema: number;
  performance: number;
  critical: number;
  warning: number;
  notFound: number;
  lastAudit: string | null;
  health: "critical" | "warning" | "healthy" | "none";
};

/** Süper admin SEO panosu: platform geneli özet + mağaza tablosu. */
export async function platformSeoOverview() {
  const db = await admin();

  const [storesRes, auditsRes, issuesRes, notFoundRes] = await Promise.all([
    db.from("stores").select("id, name, slug, status").order("created_at", { ascending: false }).limit(500),
    db
      .from("seo_audits")
      .select("id, store_id, score, technical_score, content_score, schema_score, performance_score, critical_count, warning_count, created_at, summary")
      .order("created_at", { ascending: false })
      .limit(2000),
    db.from("seo_issues").select("store_id, severity, status, code, category").eq("status", "open").limit(20000),
    db.from("store_seo_404s").select("store_id, hit_count").limit(20000),
  ]);

  const latest = new Map<string, any>();
  for (const audit of (auditsRes.data ?? []) as any[]) {
    if (!latest.has(audit.store_id)) latest.set(audit.store_id, audit);
  }
  const issues = (issuesRes.data ?? []) as { store_id: string; severity: string; code: string; category: string }[];
  const notFoundCounts = new Map<string, number>();
  for (const row of (notFoundRes.data ?? []) as { store_id: string }[]) {
    notFoundCounts.set(row.store_id, (notFoundCounts.get(row.store_id) ?? 0) + 1);
  }

  const stores: PlatformSeoStore[] = ((storesRes.data ?? []) as any[]).map((store) => {
    const audit = latest.get(store.id);
    const own = issues.filter((issue) => issue.store_id === store.id);
    const critical = own.filter((issue) => issue.severity === "critical").length;
    const warning = own.filter((issue) => issue.severity === "warning").length;
    const health: PlatformSeoStore["health"] = !audit
      ? "none"
      : critical > 0
        ? "critical"
        : warning > 0 || Number(audit.score) < 80
          ? "warning"
          : "healthy";
    return {
      storeId: String(store.id),
      name: String(store.name),
      slug: String(store.slug),
      status: String(store.status),
      score: Number(audit?.score ?? 0),
      technical: Number(audit?.technical_score ?? 0),
      content: Number(audit?.content_score ?? 0),
      schema: Number(audit?.schema_score ?? 0),
      performance: Number(audit?.performance_score ?? 0),
      critical,
      warning,
      notFound: notFoundCounts.get(String(store.id)) ?? 0,
      lastAudit: audit?.created_at ? String(audit.created_at) : null,
      health,
    };
  });

  const audited = stores.filter((store) => store.lastAudit);
  const countCode = (prefix: string) => issues.filter((issue) => issue.code.startsWith(prefix)).length;

  return {
    stores,
    totals: {
      stores: stores.length,
      audited: audited.length,
      withIssues: stores.filter((store) => store.critical + store.warning > 0).length,
      criticalStores: stores.filter((store) => store.health === "critical").length,
      warningStores: stores.filter((store) => store.health === "warning").length,
      healthyStores: stores.filter((store) => store.health === "healthy").length,
      noAudit: stores.filter((store) => store.health === "none").length,
      averageScore: audited.length
        ? Math.round(audited.reduce((sum, store) => sum + store.score, 0) / audited.length)
        : 0,
      criticalIssues: issues.filter((issue) => issue.severity === "critical").length,
      notFound: [...notFoundCounts.values()].reduce((sum, value) => sum + value, 0),
      brokenUrls: countCode("broken_urls"),
      missingMeta: countCode("missing_meta"),
      duplicates: countCode("duplicate_"),
      schemaErrors: issues.filter((issue) => issue.category === "schema").length,
      robotsErrors: countCode("robots_"),
      indexErrors: issues.filter((issue) => issue.code === "page_noindex" || issue.code === "store_noindex").length,
    },
    leaderboard: [...audited].sort((a, b) => b.score - a.score).slice(0, 10),
  };
}

/** Bir mağazada veya tüm platformda denetim çalıştırır. */
export async function auditStoresAsAdmin(input: { storeId: string | null; all: boolean; userId: string }) {
  const db = await admin();
  const { runStoreSeoAudit } = await import("@/lib/seo-audit.server");

  let ids: string[] = [];
  if (input.storeId) {
    ids = [input.storeId];
  } else if (input.all) {
    const { data } = await db.from("stores").select("id").eq("status", "active").limit(100);
    ids = ((data ?? []) as { id: string }[]).map((row) => String(row.id));
  }

  const results: { storeId: string; score: number; issues: number; error?: string }[] = [];
  for (const id of ids) {
    try {
      const result = await runStoreSeoAudit(db, id, { source: "platform_admin", userId: input.userId });
      results.push({ storeId: id, score: result.score, issues: result.issues });
    } catch (error) {
      results.push({ storeId: id, score: 0, issues: 0, error: error instanceof Error ? error.message : "hata" });
    }
  }
  return { audited: results.length, results };
}
