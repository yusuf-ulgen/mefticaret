/**
 * Süper Analitik & İş Zekâsı motoru — saf fonksiyonlar.
 * Veri erişimi yapmaz; RLS ile çekilmiş satırları işler.
 */

export type MarketingChannel =
  | "direct"
  | "organic"
  | "meta_ads"
  | "google_ads"
  | "tiktok"
  | "instagram"
  | "whatsapp"
  | "email"
  | "referral"
  | "other";

export const CHANNEL_LABELS: Record<string, string> = {
  direct: "Doğrudan",
  organic: "Organik arama",
  meta_ads: "Meta Ads (CAPI)",
  google_ads: "Google Ads",
  tiktok: "TikTok Pixel",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  email: "E-posta",
  referral: "Yönlendirme",
  other: "Diğer",
};

export const SPEND_CHANNELS: MarketingChannel[] = [
  "meta_ads",
  "google_ads",
  "tiktok",
  "instagram",
  "whatsapp",
  "email",
  "other",
];

/** Ham source/medium/referrer değerlerini kanal etiketine indirger. */
export function classifyChannel(input: {
  source?: string | null;
  medium?: string | null;
  referrerHost?: string | null;
}): MarketingChannel {
  const source = (input.source ?? "").toLowerCase();
  const medium = (input.medium ?? "").toLowerCase();
  const host = (input.referrerHost ?? "").toLowerCase();
  const blob = `${source} ${medium} ${host}`;

  if (/facebook|meta|fb|fbclid/.test(blob)) return "meta_ads";
  if (/google.?ads|gclid|adwords/.test(blob)) return "google_ads";
  if (/tiktok|ttclid/.test(blob)) return "tiktok";
  if (/instagram|ig_/.test(blob)) return "instagram";
  if (/whatsapp|wa\.me/.test(blob)) return "whatsapp";
  if (/klaviyo|mail|newsletter|email/.test(blob)) return "email";
  if (/organic|google|bing|yandex|duckduck/.test(blob)) return "organic";
  if (!source && !medium && !host) return "direct";
  if (host) return "referral";
  return "other";
}

export type DeviceKey = "mobile" | "desktop" | "tablet" | "unknown";

export const DEVICE_LABELS: Record<DeviceKey, string> = {
  mobile: "Mobil",
  desktop: "Masaüstü",
  tablet: "Tablet",
  unknown: "Bilinmiyor",
};

export function normalizeDevice(value: string | null | undefined): DeviceKey {
  const raw = (value ?? "").toLowerCase();
  if (raw.includes("mobil") || raw.includes("phone")) return "mobile";
  if (raw.includes("tablet") || raw.includes("ipad")) return "tablet";
  if (raw.includes("desk") || raw.includes("pc") || raw.includes("mac")) return "desktop";
  return "unknown";
}

/* --------------------------- kârlılık hesabı ------------------------------ */

export type CostSettings = {
  paymentCommissionRate: number;
  shippingCostPerOrder: number;
  packagingCostPerOrder: number;
  overheadRate: number;
};

export type ProfitInput = {
  grossSales: number;
  discounts: number;
  refunds: number;
  shippingRevenue: number;
  taxTotal: number;
  cogs: number;
  adsSpend: number;
  orderCount: number;
  settings: CostSettings;
};

export type ProfitBreakdown = {
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  shippingRevenue: number;
  taxTotal: number;
  cogs: number;
  adsSpend: number;
  shippingCost: number;
  packagingCost: number;
  gatewayCommission: number;
  overhead: number;
  totalCost: number;
  netProfit: number;
  marginPercent: number;
  grossMarginPercent: number;
};

/** Brüt satıştan gerçekleşen net kâra kadar tüm kalemleri hesaplar. */
export function computeProfit(input: ProfitInput): ProfitBreakdown {
  const grossSales = round2(input.grossSales);
  const discounts = round2(input.discounts);
  const refunds = round2(input.refunds);
  const netSales = round2(grossSales - discounts - refunds);
  const shippingCost = round2(input.settings.shippingCostPerOrder * input.orderCount);
  const packagingCost = round2(input.settings.packagingCostPerOrder * input.orderCount);
  const gatewayCommission = round2((netSales * input.settings.paymentCommissionRate) / 100);
  const overhead = round2((netSales * input.settings.overheadRate) / 100);
  const cogs = round2(input.cogs);
  const adsSpend = round2(input.adsSpend);
  const totalCost = round2(cogs + adsSpend + shippingCost + packagingCost + gatewayCommission + overhead);
  const netProfit = round2(netSales - input.taxTotal - totalCost);

  return {
    grossSales,
    discounts,
    refunds,
    netSales,
    shippingRevenue: round2(input.shippingRevenue),
    taxTotal: round2(input.taxTotal),
    cogs,
    adsSpend,
    shippingCost,
    packagingCost,
    gatewayCommission,
    overhead,
    totalCost,
    netProfit,
    marginPercent: netSales > 0 ? round2((netProfit / netSales) * 100) : 0,
    grossMarginPercent: netSales > 0 ? round2(((netSales - cogs) / netSales) * 100) : 0,
  };
}

function round2(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

/* ------------------------------ huni & oran ------------------------------- */

export type FunnelCounts = {
  visits: number;
  productViews: number;
  cartAdds: number;
  checkouts: number;
  orders: number;
};

export type FunnelStage = {
  key: keyof FunnelCounts;
  label: string;
  value: number;
  /** İlk adıma göre oran (%) */
  share: number;
  /** Önceki adımdan geçiş oranı (%) */
  stepRate: number;
  dropOff: number;
};

const FUNNEL_LABELS: Record<keyof FunnelCounts, string> = {
  visits: "Toplam ziyaret",
  productViews: "Ürün görüntüleme",
  cartAdds: "Sepete ekleme",
  checkouts: "Ödeme adımı",
  orders: "Tamamlanan sipariş",
};

export function funnelStages(counts: FunnelCounts): FunnelStage[] {
  const order: Array<keyof FunnelCounts> = ["visits", "productViews", "cartAdds", "checkouts", "orders"];
  const first = counts.visits;
  return order.map((key, index) => {
    const value = counts[key];
    const previous = index === 0 ? value : counts[order[index - 1] as keyof FunnelCounts];
    return {
      key,
      label: FUNNEL_LABELS[key],
      value,
      share: first > 0 ? round2((value / first) * 100) : 0,
      stepRate: previous > 0 ? round2((value / previous) * 100) : 0,
      dropOff: Math.max(0, previous - value),
    };
  });
}

export function safeDivide(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

/** CAC = pazarlama harcaması / yeni müşteri, ROAS = ilişkili ciro / harcama. */
export function acquisitionMetrics(input: {
  adsSpend: number;
  newCustomers: number;
  attributedRevenue: number;
  netProfit: number;
}) {
  return {
    cac: round2(safeDivide(input.adsSpend, input.newCustomers)),
    roas: round2(safeDivide(input.attributedRevenue, input.adsSpend)),
    poas: round2(safeDivide(input.netProfit, input.adsSpend)),
  };
}

/* ----------------------------- kohort analizi ----------------------------- */

export type CohortOrder = { customerKey: string; date: string; revenue: number };

export type CohortRow = {
  cohort: string;
  size: number;
  /** 0..11 arası ay indeksleri için tekrar eden müşteri oranı (%) */
  retention: number[];
  revenue: number;
};

/** 12 aylık tekrar satın alma kohort matrisi üretir. */
export function cohortMatrix(orders: CohortOrder[], months = 12): CohortRow[] {
  const firstMonth = new Map<string, string>();
  for (const order of orders) {
    const month = order.date.slice(0, 7);
    const current = firstMonth.get(order.customerKey);
    if (!current || month < current) firstMonth.set(order.customerKey, month);
  }

  const cohorts = new Map<string, { customers: Set<string>; active: Map<number, Set<string>>; revenue: number }>();
  for (const order of orders) {
    const cohort = firstMonth.get(order.customerKey);
    if (!cohort) continue;
    const bucket =
      cohorts.get(cohort) ?? { customers: new Set<string>(), active: new Map<number, Set<string>>(), revenue: 0 };
    bucket.customers.add(order.customerKey);
    bucket.revenue += order.revenue;
    const offset = monthDiff(cohort, order.date.slice(0, 7));
    if (offset >= 0 && offset < months) {
      const set = bucket.active.get(offset) ?? new Set<string>();
      set.add(order.customerKey);
      bucket.active.set(offset, set);
    }
    cohorts.set(cohort, bucket);
  }

  return [...cohorts.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([cohort, bucket]) => ({
      cohort,
      size: bucket.customers.size,
      revenue: round2(bucket.revenue),
      retention: Array.from({ length: months }, (_, index) => {
        const active = bucket.active.get(index)?.size ?? 0;
        return bucket.customers.size > 0 ? round2((active / bucket.customers.size) * 100) : 0;
      }),
    }));
}

function monthDiff(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  if (!fy || !fm || !ty || !tm) return -1;
  return (ty - fy) * 12 + (tm - fm);
}

/* --------------------------- stok tükenme tahmini ------------------------- */

export type DepletionInput = {
  productId: string;
  title: string;
  stock: number;
  unitsSold: number;
  price: number;
  windowDays: number;
};

export type DepletionRow = {
  productId: string;
  title: string;
  stock: number;
  dailyVelocity: number;
  daysLeft: number | null;
  lostRevenue: number;
  status: "out" | "critical" | "warning" | "healthy" | "idle";
};

/** Satış hızından stok tükenme gününü ve olası ciro kaybını hesaplar. */
export function depletionForecast(rows: DepletionInput[], horizonDays = 30): DepletionRow[] {
  return rows
    .map((row) => {
      const velocity = row.windowDays > 0 ? row.unitsSold / row.windowDays : 0;
      const daysLeft = velocity > 0 ? Math.floor(row.stock / velocity) : null;
      const missingDays = daysLeft === null ? 0 : Math.max(0, horizonDays - daysLeft);
      const lostRevenue = round2(missingDays * velocity * row.price);
      let status: DepletionRow["status"] = "healthy";
      if (row.stock <= 0) status = "out";
      else if (velocity <= 0) status = "idle";
      else if (daysLeft !== null && daysLeft <= 7) status = "critical";
      else if (daysLeft !== null && daysLeft <= 21) status = "warning";
      return {
        productId: row.productId,
        title: row.title,
        stock: row.stock,
        dailyVelocity: Math.round(velocity * 100) / 100,
        daysLeft,
        lostRevenue,
        status,
      };
    })
    .sort((a, b) => {
      const rank = { out: 0, critical: 1, warning: 2, healthy: 3, idle: 4 } as const;
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      return b.lostRevenue - a.lostRevenue;
    });
}

/* ------------------------------- dışa aktarım ---------------------------- */

/** Excel'in açabildiği UTF-8 CSV üretir (noktalı virgül ayraçlı, TR uyumlu). */
export function toCsv(rows: Array<Record<string, string | number | null>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0] as Record<string, unknown>);
  const escape = (value: string | number | null) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [headers.join(";")];
  for (const row of rows) lines.push(headers.map((header) => escape(row[header] ?? "")).join(";"));
  return `\uFEFF${lines.join("\n")}`;
}
