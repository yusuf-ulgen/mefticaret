/**
 * Yeniden sipariş (reorder) planlama motoru — saf hesaplama.
 *
 * Günlük satış hızı (velocity) son dönem satış adetlerinden hesaplanır;
 * tedarik süresi (lead time) ve emniyet stoğu gün sayısı ile birlikte
 * yeniden sipariş noktası ve önerilen sipariş adedi bulunur.
 */

export type ReorderInput = {
  variantId: string;
  productId: string | null;
  title: string;
  sku: string | null;
  stock: number;
  costPrice: number | null;
  /** Dönem içinde satılan toplam adet */
  soldUnits: number;
};

export type ReorderSettings = {
  /** Satış hızının hesaplandığı gün sayısı */
  windowDays: number;
  /** Tedarikçi teslim süresi (gün) */
  leadTimeDays: number;
  /** Emniyet stoğu (gün) */
  safetyDays: number;
  /** Kapsanacak hedef gün sayısı (sipariş edilen miktarın ömrü) */
  coverDays: number;
};

export type ReorderLine = {
  variantId: string;
  productId: string | null;
  title: string;
  sku: string | null;
  stock: number;
  costPrice: number | null;
  velocity: number;
  daysOfCover: number | null;
  reorderPoint: number;
  suggestedQuantity: number;
  urgency: "critical" | "soon" | "ok";
};

export const DEFAULT_REORDER_SETTINGS: ReorderSettings = {
  windowDays: 30,
  leadTimeDays: 7,
  safetyDays: 5,
  coverDays: 30,
};

export function reorderLine(input: ReorderInput, settings: ReorderSettings): ReorderLine {
  const windowDays = Math.max(1, settings.windowDays);
  const velocity = Math.max(0, input.soldUnits) / windowDays;
  const daysOfCover = velocity > 0 ? input.stock / velocity : null;
  const reorderPoint = Math.ceil(velocity * (settings.leadTimeDays + settings.safetyDays));
  const target = Math.ceil(velocity * (settings.leadTimeDays + settings.safetyDays + settings.coverDays));
  const suggestedQuantity = Math.max(0, target - input.stock);

  let urgency: ReorderLine["urgency"] = "ok";
  if (velocity > 0) {
    if (input.stock <= reorderPoint) urgency = "critical";
    else if (daysOfCover !== null && daysOfCover <= settings.leadTimeDays + settings.coverDays)
      urgency = "soon";
  } else if (input.stock <= 0) {
    urgency = "soon";
  }

  return {
    variantId: input.variantId,
    productId: input.productId,
    title: input.title,
    sku: input.sku,
    stock: input.stock,
    costPrice: input.costPrice,
    velocity: Math.round(velocity * 100) / 100,
    daysOfCover: daysOfCover === null ? null : Math.round(daysOfCover * 10) / 10,
    reorderPoint,
    suggestedQuantity,
    urgency,
  };
}

export function buildReorderPlan(
  inputs: ReorderInput[],
  settings: ReorderSettings,
): ReorderLine[] {
  const rank = { critical: 0, soon: 1, ok: 2 } as const;
  return inputs
    .map((input) => reorderLine(input, settings))
    .sort((a, b) => rank[a.urgency] - rank[b.urgency] || b.velocity - a.velocity);
}

export function reorderPlanCost(lines: ReorderLine[]): number {
  return lines.reduce(
    (sum, line) => sum + line.suggestedQuantity * Number(line.costPrice ?? 0),
    0,
  );
}
