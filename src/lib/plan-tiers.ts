/** Paket slug + ödeme dönemi eşlemeleri ve paket sıralaması (istemci tarafı güvenli). */

export const PAID_PLAN_SLUGS = ["starter", "professional", "business"] as const;

export type PaidPlanSlug = (typeof PAID_PLAN_SLUGS)[number];
export type PlanInterval = "monthly" | "yearly";

/** Paket sıralaması: yükseltme/düşürme kararı için kullanılır. */
export const PLAN_RANK: Record<string, number> = {
  free: 0,
  starter: 1,
  professional: 2,
  business: 3,
  enterprise: 4,
};

export function isPaidPlanSlug(slug: string | null | undefined): slug is PaidPlanSlug {
  return Boolean(slug) && (PAID_PLAN_SLUGS as readonly string[]).includes(slug as string);
}

/** Ödeme sağlayıcısındaki fiyat kimliği (örn. "starter_monthly"). */
export function planPriceId(slug: string, interval: PlanInterval): string | null {
  if (!isPaidPlanSlug(slug)) return null;
  return `${slug}_${interval}`;
}

/** Fiyat kimliğinden paket slug'ı ve dönemi çözer. */
export function parsePlanPriceId(
  priceId: string | null | undefined,
): { slug: PaidPlanSlug; interval: PlanInterval } | null {
  if (!priceId) return null;
  const match = /^([a-z]+)_(monthly|yearly)$/.exec(priceId);
  if (!match) return null;
  const [, slug, interval] = match;
  if (!isPaidPlanSlug(slug)) return null;
  return { slug, interval: interval as PlanInterval };
}
