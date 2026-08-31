/**
 * Nakit akışı — saf hesaplama katmanı.
 *
 * Finans defteri (ledger_entries) kayıtlarından haftalık/aylık net akış,
 * gider kırılımı ve önümüzdeki dönem için basit projeksiyon üretir.
 * Ayrıca ödenmemiş hakediş (payout) tutarları bekleyen nakit olarak raporlanır.
 */

export type CashLedgerInput = {
  id: string;
  kind: string;
  direction: "credit" | "debit";
  amount: number;
  occurredAt: string;
  description: string | null;
};

export type CashPayoutInput = {
  id: string;
  status: string;
  netAmount: number;
  periodStart: string;
  periodEnd: string;
  paidAt: string | null;
};

export type CashPeriod = {
  key: string;
  label: string;
  inflow: number;
  outflow: number;
  net: number;
  cumulative: number;
};

export type CashKindRow = {
  kind: string;
  direction: "credit" | "debit";
  total: number;
  count: number;
  share: number;
};

export type CashflowAnalysis = {
  summary: {
    inflow: number;
    outflow: number;
    net: number;
    margin: number;
    avgDailyNet: number;
    pendingPayouts: number;
    paidPayouts: number;
  };
  months: CashPeriod[];
  weeks: CashPeriod[];
  kinds: CashKindRow[];
  projection: { label: string; net: number }[];
};

export const CASH_KIND_LABELS: Record<string, string> = {
  sale: "Satış",
  shipping: "Kargo geliri",
  discount: "İndirim",
  platform_fee: "Platform komisyonu",
  payment_fee: "Ödeme komisyonu",
  refund: "Geri ödeme",
  payout: "Hakediş ödemesi",
  adjustment: "Düzeltme",
};

const DAY = 24 * 60 * 60 * 1000;

const monthKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const weekKey = (date: Date) => {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() - day + 1);
  return copy.toISOString().slice(0, 10);
};

function buildPeriods(
  entries: CashLedgerInput[],
  keyOf: (date: Date) => string,
  labelOf: (key: string) => string,
): CashPeriod[] {
  const map = new Map<string, { inflow: number; outflow: number }>();
  for (const entry of entries) {
    const key = keyOf(new Date(entry.occurredAt));
    const bucket = map.get(key) ?? { inflow: 0, outflow: 0 };
    if (entry.direction === "credit") bucket.inflow += entry.amount;
    else bucket.outflow += entry.amount;
    map.set(key, bucket);
  }

  let cumulative = 0;
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, bucket]) => {
      const net = bucket.inflow - bucket.outflow;
      cumulative += net;
      return {
        key,
        label: labelOf(key),
        inflow: bucket.inflow,
        outflow: bucket.outflow,
        net,
        cumulative,
      };
    });
}

const MONTH_NAMES = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

export function analyzeCashflow(
  entries: CashLedgerInput[],
  payouts: CashPayoutInput[],
  now: Date = new Date(),
): CashflowAnalysis {
  let inflow = 0;
  let outflow = 0;
  const kindMap = new Map<string, { direction: "credit" | "debit"; total: number; count: number }>();

  for (const entry of entries) {
    if (entry.direction === "credit") inflow += entry.amount;
    else outflow += entry.amount;

    const bucket = kindMap.get(entry.kind) ?? { direction: entry.direction, total: 0, count: 0 };
    bucket.total += entry.amount;
    bucket.count += 1;
    bucket.direction = entry.direction;
    kindMap.set(entry.kind, bucket);
  }

  const net = inflow - outflow;
  const volume = inflow + outflow;

  const months = buildPeriods(entries, monthKey, (key) => {
    const [year, month] = key.split("-");
    return `${MONTH_NAMES[Number(month) - 1] ?? month} ${year}`;
  });
  const weeks = buildPeriods(entries, weekKey, (key) => key.slice(5)).slice(-12);

  const oldest = entries.reduce<number | null>((acc, entry) => {
    const time = new Date(entry.occurredAt).getTime();
    return acc === null || time < acc ? time : acc;
  }, null);
  const spanDays = oldest ? Math.max(1, Math.round((now.getTime() - oldest) / DAY)) : 1;

  // Projeksiyon: son 3 ayın ağırlıklı ortalaması (son ay daha ağır).
  const tail = months.slice(-3).map((month) => month.net);
  const weights = [1, 1.5, 2].slice(-tail.length);
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const baseline = tail.reduce((sum, value, index) => sum + value * (weights[index] ?? 1), 0) / weightSum;

  const projection = [1, 2, 3].map((offset) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    return {
      label: `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`,
      net: baseline,
    };
  });

  return {
    summary: {
      inflow,
      outflow,
      net,
      margin: inflow > 0 ? net / inflow : 0,
      avgDailyNet: net / spanDays,
      pendingPayouts: payouts
        .filter((payout) => payout.status !== "paid")
        .reduce((sum, payout) => sum + payout.netAmount, 0),
      paidPayouts: payouts
        .filter((payout) => payout.status === "paid")
        .reduce((sum, payout) => sum + payout.netAmount, 0),
    },
    months,
    weeks,
    kinds: [...kindMap.entries()]
      .map(([kind, bucket]) => ({
        kind,
        direction: bucket.direction,
        total: bucket.total,
        count: bucket.count,
        share: volume > 0 ? bucket.total / volume : 0,
      }))
      .sort((a, b) => b.total - a.total),
    projection,
  };
}
