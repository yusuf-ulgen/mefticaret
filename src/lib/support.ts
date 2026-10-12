/** Müşteri iletişimi yanıt performansı: ürün soruları ve yorum yanıtları için SLA analizi. */

export type SupportThreadInput = {
  id: string;
  kind: "question" | "review";
  productId: string | null;
  createdAt: string;
  respondedAt: string | null;
  rating?: number | null;
};

export type SupportSummary = {
  total: number;
  answered: number;
  pending: number;
  /** Yanıtlama oranı (%) */
  answerRate: number;
  /** Ortalama yanıt süresi (saat) */
  avgResponseHours: number;
  /** Medyan yanıt süresi (saat) */
  medianResponseHours: number;
  /** 24 saat içinde yanıtlananların oranı (%) */
  within24hRate: number;
  /** Yanıt bekleyen en eski kaydın bekleme süresi (saat) */
  oldestPendingHours: number;
};

const HOUR = 1000 * 60 * 60;

function hoursBetween(from: string, to: string | number) {
  const start = new Date(from).getTime();
  const end = typeof to === "number" ? to : new Date(to).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, (end - start) / HOUR);
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export function supportSummary(threads: SupportThreadInput[], now = Date.now()): SupportSummary {
  const answered = threads.filter((thread) => thread.respondedAt);
  const pending = threads.filter((thread) => !thread.respondedAt);
  const durations = answered.map((thread) => hoursBetween(thread.createdAt, thread.respondedAt!));
  const within24h = durations.filter((hours) => hours <= 24).length;
  const oldestPending = pending.reduce(
    (max, thread) => Math.max(max, hoursBetween(thread.createdAt, now)),
    0,
  );

  return {
    total: threads.length,
    answered: answered.length,
    pending: pending.length,
    answerRate: threads.length ? (answered.length / threads.length) * 100 : 0,
    avgResponseHours: durations.length
      ? durations.reduce((sum, hours) => sum + hours, 0) / durations.length
      : 0,
    medianResponseHours: median(durations),
    within24hRate: answered.length ? (within24h / answered.length) * 100 : 0,
    oldestPendingHours: oldestPending,
  };
}

export type SupportBand = {
  label: string;
  count: number;
  share: number;
};

const BANDS: Array<{ label: string; max: number }> = [
  { label: "0-4 saat", max: 4 },
  { label: "4-12 saat", max: 12 },
  { label: "12-24 saat", max: 24 },
  { label: "1-3 gün", max: 72 },
  { label: "3 gün+", max: Number.POSITIVE_INFINITY },
];

export function responseBands(threads: SupportThreadInput[]): SupportBand[] {
  const answered = threads.filter((thread) => thread.respondedAt);
  const counts = BANDS.map(() => 0);

  for (const thread of answered) {
    const hours = hoursBetween(thread.createdAt, thread.respondedAt!);
    const index = BANDS.findIndex((band) => hours <= band.max);
    counts[index === -1 ? BANDS.length - 1 : index]! += 1;
  }

  return BANDS.map((band, index) => ({
    label: band.label,
    count: counts[index]!,
    share: answered.length ? (counts[index]! / answered.length) * 100 : 0,
  }));
}

export type SupportChannelStat = {
  kind: "question" | "review";
  label: string;
  total: number;
  answered: number;
  pending: number;
  answerRate: number;
  avgResponseHours: number;
};

export function channelStats(threads: SupportThreadInput[]): SupportChannelStat[] {
  const kinds: Array<{ kind: "question" | "review"; label: string }> = [
    { kind: "question", label: "Ürün soruları" },
    { kind: "review", label: "Değerlendirmeler" },
  ];

  return kinds.map(({ kind, label }) => {
    const subset = threads.filter((thread) => thread.kind === kind);
    const summary = supportSummary(subset);
    return {
      kind,
      label,
      total: summary.total,
      answered: summary.answered,
      pending: summary.pending,
      answerRate: summary.answerRate,
      avgResponseHours: summary.avgResponseHours,
    };
  });
}

export type SupportDailyPoint = {
  date: string;
  incoming: number;
  answered: number;
  avgResponseHours: number;
};

export function dailyTrend(threads: SupportThreadInput[]): SupportDailyPoint[] {
  const map = new Map<string, { incoming: number; answered: number; durations: number[] }>();

  for (const thread of threads) {
    const date = thread.createdAt.slice(0, 10);
    const entry = map.get(date) ?? { incoming: 0, answered: 0, durations: [] };
    entry.incoming += 1;
    if (thread.respondedAt) {
      entry.answered += 1;
      entry.durations.push(hoursBetween(thread.createdAt, thread.respondedAt));
    }
    map.set(date, entry);
  }

  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, entry]) => ({
      date,
      incoming: entry.incoming,
      answered: entry.answered,
      avgResponseHours: entry.durations.length
        ? entry.durations.reduce((sum, hours) => sum + hours, 0) / entry.durations.length
        : 0,
    }));
}

export type PendingItem = SupportThreadInput & {
  waitingHours: number;
  productTitle: string;
};

export function pendingQueue(
  threads: SupportThreadInput[],
  titleByProduct: Map<string, string>,
  now = Date.now(),
): PendingItem[] {
  return threads
    .filter((thread) => !thread.respondedAt)
    .map((thread) => ({
      ...thread,
      waitingHours: hoursBetween(thread.createdAt, now),
      productTitle: (thread.productId ? titleByProduct.get(thread.productId) : null) ?? "Ürün",
    }))
    .sort((a, b) => b.waitingHours - a.waitingHours);
}
