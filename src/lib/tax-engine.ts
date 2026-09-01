/**
 * Vergi motoru — saf, bağımsız servis katmanı (DB/UI bilmez).
 * KDV, ülke ve bölge vergisi, ürün vergi sınıfı, vergi dahil/hariç fiyat destekler.
 * Tüm hesaplamalar burada yapılır; checkout ve raporlama bu servisi kullanır.
 */

export type TaxClass = {
  id: string;
  name: string;
  code: string;
  is_default?: boolean;
};

export type TaxRule = {
  id: string;
  name: string;
  tax_class_id: string | null;
  country_code: string | null;
  region: string | null;
  rate: number | string;
  priority: number;
  is_active: boolean;
};

export type TaxContext = {
  /** Ürünün vergi sınıfı (yoksa sınıfsız kurallar/varsayılan oran uygulanır). */
  taxClassId?: string | null;
  /** ISO ülke kodu, örn. "TR". */
  country?: string | null;
  /** İl / eyalet / bölge adı. */
  region?: string | null;
  /** Mağaza ayarındaki varsayılan oran (yüzde). */
  defaultRate: number;
};

export type TaxResolution = {
  /** Ondalık oran, örn. 0.20 */
  rate: number;
  /** Yüzde değer, örn. 20 */
  percent: number;
  ruleId: string | null;
  ruleName: string | null;
  source: "rule" | "default";
};

export type TaxAmounts = {
  net: number;
  tax: number;
  gross: number;
  percent: number;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Yüzde (20) ya da ondalık (0.2) girdiyi ondalığa normalize eder. */
export function normalizeRate(value: number | string | null | undefined): number {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return numeric > 1 ? numeric / 100 : numeric;
}

function matchesScope(value: string | null, target: string | null | undefined): boolean {
  if (!value) return true; // kural tüm ülkeleri/bölgeleri kapsıyor
  if (!target) return false;
  return value.trim().toUpperCase() === target.trim().toUpperCase();
}

/** Kural özgüllük skoru: ülke + bölge + sınıf eşleşmesi arttıkça skor yükselir. */
function specificity(rule: TaxRule): number {
  return (
    (rule.country_code ? 4 : 0) + (rule.region ? 2 : 0) + (rule.tax_class_id ? 1 : 0)
  );
}

/**
 * Bağlama uyan en yüksek öncelikli / en özgül kuralı çözer.
 * Eşleşme yoksa mağazanın varsayılan oranı kullanılır.
 */
export function resolveTaxRate(rules: TaxRule[], context: TaxContext): TaxResolution {
  const candidates = (rules ?? [])
    .filter((rule) => rule.is_active)
    .filter((rule) =>
      rule.tax_class_id ? rule.tax_class_id === (context.taxClassId ?? null) : true,
    )
    .filter(
      (rule) =>
        matchesScope(rule.country_code, context.country) &&
        matchesScope(rule.region, context.region),
    )
    .sort((a, b) => b.priority - a.priority || specificity(b) - specificity(a));

  const winner = candidates[0];
  if (winner) {
    const rate = normalizeRate(winner.rate);
    return {
      rate,
      percent: round2(rate * 100),
      ruleId: winner.id,
      ruleName: winner.name,
      source: "rule",
    };
  }

  const fallback = normalizeRate(context.defaultRate);
  return {
    rate: fallback,
    percent: round2(fallback * 100),
    ruleId: null,
    ruleName: null,
    source: "default",
  };
}

/** Fiyat vergi dahilse brütten ayrıştırır, hariçse matrah üzerine ekler. */
export function computeTax(
  amount: number,
  rate: number,
  pricesIncludeTax: boolean,
): TaxAmounts {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const decimalRate = normalizeRate(rate);
  if (decimalRate === 0) {
    return { net: round2(safeAmount), tax: 0, gross: round2(safeAmount), percent: 0 };
  }
  if (pricesIncludeTax) {
    const net = safeAmount / (1 + decimalRate);
    return {
      net: round2(net),
      tax: round2(safeAmount - net),
      gross: round2(safeAmount),
      percent: round2(decimalRate * 100),
    };
  }
  const tax = safeAmount * decimalRate;
  return {
    net: round2(safeAmount),
    tax: round2(tax),
    gross: round2(safeAmount + tax),
    percent: round2(decimalRate * 100),
  };
}

export type TaxLineInput = {
  /** Satır tutarı (adet × fiyat), ana para biriminde. */
  amount: number;
  taxClassId?: string | null;
};

export type TaxLineResult = TaxAmounts & {
  taxClassId: string | null;
  ruleId: string | null;
  ruleName: string | null;
};

export type TaxBreakdown = {
  lines: TaxLineResult[];
  /** Orana göre gruplanmış vergi dökümü (fatura için). */
  groups: { percent: number; net: number; tax: number; gross: number }[];
  totals: TaxAmounts;
};

/** Sepet/sipariş satırlarını uçtan uca hesaplar. */
export function calculateTax(
  lines: TaxLineInput[],
  options: {
    rules: TaxRule[];
    defaultRate: number;
    pricesIncludeTax: boolean;
    country?: string | null;
    region?: string | null;
  },
): TaxBreakdown {
  const results: TaxLineResult[] = (lines ?? []).map((line) => {
    const resolution = resolveTaxRate(options.rules, {
      taxClassId: line.taxClassId ?? null,
      country: options.country ?? null,
      region: options.region ?? null,
      defaultRate: options.defaultRate,
    });
    const amounts = computeTax(line.amount, resolution.rate, options.pricesIncludeTax);
    return {
      ...amounts,
      taxClassId: line.taxClassId ?? null,
      ruleId: resolution.ruleId,
      ruleName: resolution.ruleName,
    };
  });

  const groupMap = new Map<number, { percent: number; net: number; tax: number; gross: number }>();
  for (const line of results) {
    const group = groupMap.get(line.percent) ?? {
      percent: line.percent,
      net: 0,
      tax: 0,
      gross: 0,
    };
    group.net += line.net;
    group.tax += line.tax;
    group.gross += line.gross;
    groupMap.set(line.percent, group);
  }

  const groups = [...groupMap.values()]
    .map((group) => ({
      percent: group.percent,
      net: round2(group.net),
      tax: round2(group.tax),
      gross: round2(group.gross),
    }))
    .sort((a, b) => b.percent - a.percent);

  const totals = groups.reduce<TaxAmounts>(
    (acc, group) => ({
      net: round2(acc.net + group.net),
      tax: round2(acc.tax + group.tax),
      gross: round2(acc.gross + group.gross),
      percent: groups.length === 1 ? group.percent : 0,
    }),
    { net: 0, tax: 0, gross: 0, percent: 0 },
  );

  return { lines: results, groups, totals };
}
