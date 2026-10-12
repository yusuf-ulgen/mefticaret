import { z } from "zod";

import { BUCKETS, periodInputSchema, resolvePeriod, type Section } from "@/lib/analytics-v2";

/** /api/v2/analytics/<uç> — yalnız API anahtarının mağazası; sonuçlar 5 dk önbellekte. */
const PATHS: Record<string, Section> = {
  overview: "overview",
  sales: "series",
  "products/top": "products",
  customers: "customers",
  traffic: "traffic",
  "conversion-funnel": "funnel",
  live: "live",
};

const GROUP: Record<string, (typeof BUCKETS)[number]> = { hour: "hour", day: "day", week: "week", month: "month" };

export async function handleAnalyticsApi(storeId: string, path: string, params: URLSearchParams): Promise<{ status: number; body: unknown }> {
  const section = PATHS[path];
  if (!section) return { status: 404, body: { error: "unknown_endpoint", endpoints: Object.keys(PATHS).map((p) => `/api/v2/analytics/${p}`) } };

  const parsed = periodInputSchema
    .extend({ group_by: z.enum(BUCKETS).optional() })
    .safeParse({
      period: params.get("period") ?? "30d",
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      group_by: params.get("group_by") ?? undefined,
    });
  if (!parsed.success) return { status: 400, body: { error: "invalid_params", details: parsed.error.issues.map((i) => i.message) } };

  const range = resolvePeriod(parsed.data);
  const bucket = parsed.data.group_by ? GROUP[parsed.data.group_by]! : range.bucket;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { runSection } = await import("@/lib/analytics-v2.server");
  try {
    const data = (await runSection(supabaseAdmin, storeId, section, range, bucket, { cache: true })) as Record<string, any>;
    let body: unknown = data;
    if (path === "overview") body = { ...data["current"], previous: data["previous"] };
    if (path === "products/top") body = { top: data["top"], most_viewed: data["viewed"] };
    if (path === "live") body = { active_visitors: data["active_visitors"], pages: data["pages"], carts: data["carts"], checkouts: data["checkouts"], recent_orders: data["recent_orders"] };
    return { status: 200, body: { period: { from: range.from, to: range.to, group_by: bucket }, data: body } };
  } catch {
    return { status: 500, body: { error: "analytics_failed" } };
  }
}
