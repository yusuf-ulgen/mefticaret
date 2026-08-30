/**
 * Ciro tahmini (forecast) yardımcıları.
 * Saf fonksiyonlardır; veri erişimi yapmaz, RLS ile çekilmiş serileri işler.
 */

export type DailyPoint = { date: string; revenue: number; orders: number };

export type ForecastPoint = DailyPoint & { forecast: number | null; actual: number | null };

const DAY = 86_400_000;

function isoDay(value: Date) {
  return value.toISOString().slice(0, 10);
}

/** Son n günün ortalamasını verir (gün sayısı yetersizse mevcut günlere göre). */
export function movingAverage(series: DailyPoint[], window: number, key: "revenue" | "orders" = "revenue") {
  const slice = series.slice(-window);
  if (slice.length === 0) return 0;
  const total = slice.reduce((sum, point) => sum + point[key], 0);
  return total / slice.length;
}

/** Haftanın günlerine göre mevsimsellik katsayıları (ortalama = 1). */
export function weekdayFactors(series: DailyPoint[]) {
  const sums = new Array(7).fill(0) as number[];
  const counts = new Array(7).fill(0) as number[];
  for (const point of series) {
    const day = new Date(`${point.date}T00:00:00Z`).getUTCDay();
    sums[day] += point.revenue;
    counts[day] += 1;
  }
  const averages = sums.map((sum, index) => (counts[index] ? sum / counts[index] : 0));
  const overall = averages.reduce((sum, value) => sum + value, 0) / 7;
  if (overall <= 0) return new Array(7).fill(1) as number[];
  return averages.map((value) => {
    const factor = value / overall;
    // Aşırı sapmaları yumuşat: tek bir uç gün tahmini bozmasın.
    return Math.min(2, Math.max(0.35, factor));
  });
}

/** Mevcut ayın sonuna kadar günlük tahmin üretir. */
export function forecastMonth(series: DailyPoint[], now = new Date()) {
  const baseline = movingAverage(series, 28) || movingAverage(series, 7);
  const recent = movingAverage(series, 7);
  const level = baseline === 0 ? recent : baseline * 0.6 + recent * 0.4;
  const factors = weekdayFactors(series.slice(-56));

  const monthStart = isoDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const today = isoDay(now);

  const actualMonth = series.filter((point) => point.date >= monthStart && point.date <= today);
  const monthToDate = actualMonth.reduce((sum, point) => sum + point.revenue, 0);
  const ordersToDate = actualMonth.reduce((sum, point) => sum + point.orders, 0);

  const points: ForecastPoint[] = actualMonth.map((point) => ({
    ...point,
    actual: point.revenue,
    forecast: null,
  }));

  let projectedRemaining = 0;
  const startDay = now.getUTCDate() + 1;
  for (let day = startDay; day <= daysInMonth; day += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day));
    const value = level * (factors[date.getUTCDay()] ?? 1);
    projectedRemaining += value;
    points.push({ date: isoDay(date), revenue: 0, orders: 0, actual: null, forecast: value });
  }

  const previousMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const previousMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const previousMonth = series
    .filter((point) => point.date >= isoDay(previousMonthStart) && point.date <= isoDay(previousMonthEnd))
    .reduce((sum, point) => sum + point.revenue, 0);

  const projectedTotal = monthToDate + projectedRemaining;

  return {
    points,
    level,
    monthToDate,
    ordersToDate,
    projectedRemaining,
    projectedTotal,
    previousMonth,
    daysInMonth,
    daysLeft: Math.max(0, daysInMonth - now.getUTCDate()),
    growth: previousMonth > 0 ? (projectedTotal - previousMonth) / previousMonth : null,
    averageBasket: ordersToDate > 0 ? monthToDate / ordersToDate : 0,
  };
}

/** Hedefe ulaşmak için gereken günlük ciro. */
export function dailyNeeded(target: number, monthToDate: number, daysLeft: number) {
  if (daysLeft <= 0) return 0;
  return Math.max(0, (target - monthToDate) / daysLeft);
}

/** Tahmine göre hedefin tutulacağı gün (yoksa null). */
export function targetHitDate(points: ForecastPoint[], target: number, monthToDate: number) {
  let cumulative = monthToDate;
  for (const point of points) {
    if (point.forecast === null) continue;
    cumulative += point.forecast;
    if (cumulative >= target) return point.date;
  }
  return null;
}
