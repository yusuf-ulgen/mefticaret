/**
 * Otomatik yeniden fiyatlama — sunucu katmanı.
 * Kurallar mağaza kapsamlıdır; fiyat güncellemesi yalnızca mağaza yöneticisi
 * tarafından ve kuralın sınırları içinde yapılır. Öneri/uygulama olayları
 * `repricing_events` günlüğüne yazılır.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { RoundingMode } from "@/lib/pricing-engine";
import { computeRepricing, type RepricingStrategy } from "@/lib/repricing";

type Client = SupabaseClient<Database>;
type Any = any;

export type RepricingRuleRow = {
  id: string;
  productId: string | null;
  name: string;
  isActive: boolean;
  strategy: RepricingStrategy;
  value: number;
  minMarginPct: number;
  floorPrice: number | null;
  ceilingPrice: number | null;
  maxChangePct: number;
  rounding: RoundingMode;
  autoApply: boolean;
  updatedAt: string;
};

export type RepricingEventRow = {
  id: string;
  productId: string;
  productTitle: string;
  oldPrice: number;
  suggestedPrice: number;
  competitorPrice: number | null;
  currency: string;
  reason: string;
  applied: boolean;
  createdAt: string;
};

function mapRule(row: Any): RepricingRuleRow {
  return {
    id: String(row.id),
    productId: row.product_id ? String(row.product_id) : null,
    name: String(row.name),
    isActive: Boolean(row.is_active),
    strategy: String(row.strategy) as RepricingStrategy,
    value: Number(row.value ?? 0),
    minMarginPct: Number(row.min_margin_pct ?? 0),
    floorPrice: row.floor_price == null ? null : Number(row.floor_price),
    ceilingPrice: row.ceiling_price == null ? null : Number(row.ceiling_price),
    maxChangePct: Number(row.max_change_pct ?? 0),
    rounding: String(row.rounding) as RoundingMode,
    autoApply: Boolean(row.auto_apply),
    updatedAt: String(row.updated_at ?? row.created_at),
  };
}

export async function listRepricingRules(client: Client, storeId: string): Promise<RepricingRuleRow[]> {
  const { data, error } = await (client as unknown as Any)
    .from("repricing_rules")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Any[]).map(mapRule);
}

export async function listRepricingEvents(client: Client, storeId: string): Promise<RepricingEventRow[]> {
  const { data, error } = await (client as unknown as Any)
    .from("repricing_events")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Any[];
  const ids = [...new Set(rows.map((row) => String(row.product_id)))];
  const titles = new Map<string, string>();
  if (ids.length > 0) {
    const { data: products } = await client
      .from("products")
      .select("id, title")
      .eq("store_id", storeId)
      .in("id", ids);
    for (const row of products ?? []) titles.set(String(row.id), String(row.title));
  }
  return rows.map((row) => ({
    id: String(row.id),
    productId: String(row.product_id),
    productTitle: titles.get(String(row.product_id)) ?? "Ürün",
    oldPrice: Number(row.old_price ?? 0),
    suggestedPrice: Number(row.suggested_price ?? 0),
    competitorPrice: row.competitor_price == null ? null : Number(row.competitor_price),
    currency: String(row.currency ?? "TRY"),
    reason: String(row.reason ?? ""),
    applied: Boolean(row.applied),
    createdAt: String(row.created_at),
  }));
}

export type SaveRepricingRuleInput = {
  id?: string | null | undefined;
  productId?: string | null | undefined;
  name: string;
  isActive: boolean;
  strategy: RepricingStrategy;
  value: number;
  minMarginPct: number;
  floorPrice?: number | null | undefined;
  ceilingPrice?: number | null | undefined;
  maxChangePct: number;
  rounding: RoundingMode;
  autoApply: boolean;
};

export async function saveRepricingRule(options: {
  client: Client;
  storeId: string;
  userId: string;
  input: SaveRepricingRuleInput;
}) {
  const { assertStoreManager } = await import("@/lib/store-access.server");
  await assertStoreManager(options.client, options.storeId, options.userId);

  const { input } = options;
  const row: Record<string, unknown> = {
    store_id: options.storeId,
    product_id: input.productId ?? null,
    name: input.name,
    is_active: input.isActive,
    strategy: input.strategy,
    value: input.value,
    min_margin_pct: input.minMarginPct,
    floor_price: input.floorPrice ?? null,
    ceiling_price: input.ceilingPrice ?? null,
    max_change_pct: input.maxChangePct,
    rounding: input.rounding,
    auto_apply: input.autoApply,
    updated_at: new Date().toISOString(),
  };
  if (input.id) row["id"] = input.id;

  const { data, error } = await (options.client as unknown as Any)
    .from("repricing_rules")
    .upsert(row, { onConflict: "id" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: String(data.id) };
}

export async function deleteRepricingRule(options: { client: Client; storeId: string; userId: string; id: string }) {
  const { assertStoreManager } = await import("@/lib/store-access.server");
  await assertStoreManager(options.client, options.storeId, options.userId);
  const { error } = await (options.client as unknown as Any)
    .from("repricing_rules")
    .delete()
    .eq("id", options.id)
    .eq("store_id", options.storeId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export type RepricingPreviewItem = {
  productId: string;
  productTitle: string;
  ruleId: string;
  ruleName: string;
  currency: string;
  currentPrice: number;
  competitorPrice: number | null;
  competitorName: string | null;
  competitorId: string | null;
  suggestedPrice: number;
  changePct: number;
  marginPct: number | null;
  reasons: string[];
  shouldChange: boolean;
  autoApply: boolean;
  applied: boolean;
};

/**
 * Aktif kuralları en güncel rakip fiyatlarıyla çalıştırır.
 * `apply` true ise (veya kuralda otomatik uygulama açıksa) ürün fiyatı güncellenir.
 */
export async function runRepricing(options: {
  client: Client;
  storeId: string;
  userId: string;
  apply: boolean;
  ruleId?: string | null | undefined;
}): Promise<{ items: RepricingPreviewItem[]; appliedCount: number }> {
  const { assertStoreManager } = await import("@/lib/store-access.server");
  await assertStoreManager(options.client, options.storeId, options.userId);

  const db = options.client as unknown as Any;

  let ruleQuery = db
    .from("repricing_rules")
    .select("*")
    .eq("store_id", options.storeId)
    .eq("is_active", true);
  if (options.ruleId) ruleQuery = ruleQuery.eq("id", options.ruleId);
  const { data: ruleRows, error: ruleError } = await ruleQuery;
  if (ruleError) throw new Error(ruleError.message);
  const rules = ((ruleRows ?? []) as Any[]).map(mapRule);
  if (rules.length === 0) return { items: [], appliedCount: 0 };

  const { data: competitorRows, error: competitorError } = await db
    .from("competitor_products")
    .select("id, name, product_id, competitor_price, currency, last_checked_at")
    .eq("store_id", options.storeId)
    .eq("is_active", true)
    .not("product_id", "is", null)
    .not("competitor_price", "is", null);
  if (competitorError) throw new Error(competitorError.message);

  // Ürün başına en düşük rakip fiyatı esas alınır.
  const bestByProduct = new Map<string, { id: string; name: string; price: number; currency: string }>();
  for (const row of (competitorRows ?? []) as Any[]) {
    const productId = String(row.product_id);
    const price = Number(row.competitor_price);
    if (!Number.isFinite(price) || price <= 0) continue;
    const current = bestByProduct.get(productId);
    if (!current || price < current.price) {
      bestByProduct.set(productId, {
        id: String(row.id),
        name: String(row.name),
        price,
        currency: String(row.currency ?? "TRY"),
      });
    }
  }

  const targetProductIds = new Set<string>();
  for (const rule of rules) {
    if (rule.productId) targetProductIds.add(rule.productId);
  }
  const hasGlobalRule = rules.some((rule) => !rule.productId);
  if (hasGlobalRule) for (const key of bestByProduct.keys()) targetProductIds.add(key);
  if (targetProductIds.size === 0) return { items: [], appliedCount: 0 };

  const { data: products, error: productError } = await db
    .from("products")
    .select("id, title, base_price, cost_price, currency")
    .eq("store_id", options.storeId)
    .in("id", [...targetProductIds]);
  if (productError) throw new Error(productError.message);

  const items: RepricingPreviewItem[] = [];
  let appliedCount = 0;

  for (const product of (products ?? []) as Any[]) {
    const productId = String(product.id);
    const rule = rules.find((row) => row.productId === productId) ?? rules.find((row) => !row.productId);
    if (!rule) continue;
    const competitor = bestByProduct.get(productId) ?? null;
    const currentPrice = Number(product.base_price ?? 0);

    const suggestion = computeRepricing({
      currentPrice,
      competitorPrice: competitor?.price ?? null,
      costPrice: product.cost_price == null ? null : Number(product.cost_price),
      rule: {
        strategy: rule.strategy,
        value: rule.value,
        minMarginPct: rule.minMarginPct,
        floorPrice: rule.floorPrice,
        ceilingPrice: rule.ceilingPrice,
        maxChangePct: rule.maxChangePct,
        rounding: rule.rounding,
      },
    });

    const shouldApply = suggestion.shouldChange && (options.apply || rule.autoApply);
    if (shouldApply) {
      const { error: updateError } = await db
        .from("products")
        .update({ base_price: suggestion.suggestedPrice })
        .eq("id", productId)
        .eq("store_id", options.storeId);
      if (updateError) throw new Error(updateError.message);
      appliedCount += 1;
    }

    if (suggestion.shouldChange) {
      await db.from("repricing_events").insert({
        store_id: options.storeId,
        rule_id: rule.id,
        product_id: productId,
        competitor_id: competitor?.id ?? null,
        old_price: currentPrice,
        suggested_price: suggestion.suggestedPrice,
        competitor_price: competitor?.price ?? null,
        currency: String(product.currency ?? "TRY"),
        reason: suggestion.reasons.join(" "),
        applied: shouldApply,
      });
    }

    items.push({
      productId,
      productTitle: String(product.title),
      ruleId: rule.id,
      ruleName: rule.name,
      currency: String(product.currency ?? "TRY"),
      currentPrice,
      competitorPrice: competitor?.price ?? null,
      competitorName: competitor?.name ?? null,
      competitorId: competitor?.id ?? null,
      suggestedPrice: suggestion.suggestedPrice,
      changePct: suggestion.changePct,
      marginPct: suggestion.marginPct,
      reasons: suggestion.reasons,
      shouldChange: suggestion.shouldChange,
      autoApply: rule.autoApply,
      applied: shouldApply,
    });
  }

  items.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  return { items, appliedCount };
}
