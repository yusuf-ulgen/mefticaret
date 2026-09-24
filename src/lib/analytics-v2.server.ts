import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { resolvePeriod, type Bucket, type PeriodInput, type ReportKey, REPORTS, type Section } from "@/lib/analytics-v2";

type Db = SupabaseClient<Database>;

/** 5 dakikalık süreç içi önbellek (API v2 ve rapor üretimi için). */
const cache = new Map<string, { at: number; value: unknown }>();
const TTL = 5 * 60_000;

export async function runSection(
  db: Db,
  storeId: string,
  section: Section,
  range: { from: string; to: string },
  bucket: Bucket = "day",
  opts: { cache?: boolean } = {},
) {
  const key = `${storeId}|${section}|${range.from}|${range.to}|${bucket}`;
  if (opts.cache && section !== "live") {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) return hit.value;
  }
  const { data, error } = await db.rpc("analytics_v2", {
    _store_id: storeId,
    _section: section,
    _from: range.from,
    _to: range.to,
    _bucket: bucket,
  });
  if (error) throw new Error("Analitik verisi alınamadı");
  if (opts.cache) {
    if (cache.size > 500) cache.clear();
    cache.set(key, { at: Date.now(), value: data });
  }
  return data;
}

/** Rapor şablonu için gereken bölümleri toplar. */
export async function buildReport(db: Db, storeId: string, reportKey: ReportKey, period?: PeriodInput) {
  const def = REPORTS[reportKey];
  const r = resolvePeriod(period ?? { period: def.period });
  const sections: Section[] =
    reportKey === "daily_sales" ? ["overview", "sales", "products"]
    : reportKey === "weekly_performance" ? ["overview", "series", "traffic", "funnel"]
    : reportKey === "monthly_growth" ? ["overview", "series", "sales", "customers"]
    : reportKey === "product_performance" ? ["products"]
    : ["customers"];
  const out: Record<string, unknown> = {};
  for (const s of sections) out[s] = await runSection(db, storeId, s, r, r.bucket, { cache: true });
  return { report: reportKey, label: def.label, range: r, data: out };
}
