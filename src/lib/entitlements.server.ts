import { MODULE_BY_KEY, isModuleKey, limitExceeded } from "@/lib/plan-features";

/**
 * Paket haklarının sunucu tarafında zorlanması.
 * Limit ve modül bilgisi her zaman veritabanından (plans + plan_features) okunur.
 */

type Client = {
  from: (table: string) => any;
};

export type PlanEntitlements = {
  planId: string | null;
  planCode: string | null;
  planName: string | null;
  modules: Record<string, boolean>;
  limits: Record<string, number | null>;
};

export class PlanLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}

export async function loadEntitlements(
  supabase: Client,
  storeId: string,
): Promise<PlanEntitlements> {
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("store_kind, plan_id, plans(id, code, name)")
    .eq("id", storeId)
    .maybeSingle();
  if (storeError) throw new Error(storeError.message);

  if (store?.store_kind === "micro") {
    return { planId: null, planCode: null, planName: null, modules: {}, limits: {} };
  }
  const plan = store?.plans as { id: string; code: string; name: string } | null | undefined;
  if (!plan) {
    return { planId: null, planCode: null, planName: null, modules: {}, limits: {} };
  }

  const { data: rows, error } = await supabase
    .from("plan_features")
    .select("metric_key, limit_value, is_enabled")
    .eq("plan_id", plan.id);
  if (error) throw new Error(error.message);

  const modules: Record<string, boolean> = {};
  const limits: Record<string, number | null> = {};
  for (const row of (rows ?? []) as {
    metric_key: string;
    limit_value: number | null;
    is_enabled: boolean;
  }[]) {
    if (isModuleKey(row.metric_key)) modules[row.metric_key] = Boolean(row.is_enabled);
    else if (row.is_enabled)
      limits[row.metric_key] = row.limit_value === null ? null : Number(row.limit_value);
    else limits[row.metric_key] = 0;
  }

  return { planId: plan.id, planCode: plan.code, planName: plan.name, modules, limits };
}

/** Modül paketinde kapalıysa hata fırlatır. */
export async function requirePlanModule(
  supabase: Client,
  storeId: string,
  moduleKey: string,
): Promise<void> {
  const entitlements = await loadEntitlements(supabase, storeId);
  if (entitlements.modules[moduleKey] === true) return;
  const label = MODULE_BY_KEY[moduleKey]?.label ?? moduleKey;
  throw new PlanLimitError(
    `${label} özelliği ${entitlements.planName ?? "mevcut"} paketinde kapalı. Paketinizi yükseltin.`,
  );
}

/**
 * Sayısal kotayı zorlar: mevcut kullanım limite eşit/üstündeyse hata verir.
 * `countFn` yalnızca limit tanımlıysa çalıştırılır.
 */
export async function requirePlanQuota(
  supabase: Client,
  storeId: string,
  metricKey: string,
  countFn: () => Promise<number>,
  label: string,
): Promise<void> {
  const entitlements = await loadEntitlements(supabase, storeId);
  const limit = entitlements.limits[metricKey];
  if (limit === null || limit === undefined || limit < 0) return;
  const used = limit === 0 ? 0 : await countFn();
  if (limitExceeded(limit, used)) {
    throw new PlanLimitError(
      `${label} limitine ulaştınız (${limit}). ${entitlements.planName ?? "Paketinizi"} yükselterek devam edebilirsiniz.`,
    );
  }
}
