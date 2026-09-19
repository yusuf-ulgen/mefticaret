/**
 * Next-Gen Innovation & FinTech motoru — saf hesaplama katmanı (DB/UI bilmez).
 * Akıllı POS yönlendirme, sahtecilik risk skoru, ek hizmet fiyatlama, karbon bağışı.
 */

export type PaymentRouteInput = {
  id: string;
  provider: string;
  label: string;
  binPrefixes: string[];
  cardNetworks: string[];
  feePercent: number;
  feeFixed: number;
  approvalRate: number;
  priority: number;
  isActive: boolean;
};

export type RouteDecision = {
  route: PaymentRouteInput;
  fee: number;
  score: number;
  matchedBin: string | null;
};

/** Kart numarasının ilk 6-8 hanesi (BIN). Sadece rakam tutulur, kart numarası saklanmaz. */
export function normalizeBin(value: string): string {
  return value.replace(/\D/g, "").slice(0, 8);
}

export function cardNetworkFromBin(bin: string): string {
  const digits = normalizeBin(bin);
  if (!digits) return "unknown";
  if (digits.startsWith("4")) return "visa";
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return "mastercard";
  if (/^3[47]/.test(digits)) return "amex";
  if (digits.startsWith("9792") || digits.startsWith("6")) return "troy";
  return "unknown";
}

export function routeFee(route: PaymentRouteInput, amount: number): number {
  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
  return Number(((safeAmount * route.feePercent) / 100 + route.feeFixed).toFixed(2));
}

/**
 * En düşük maliyetli POS'u seçer; onay oranı düşük POS'lar cezalandırılır.
 * Skor = komisyon + (başarısızlık oranı × tutar × 0.5) — yani sürekli red alan
 * ucuz POS, pahalı ama güvenilir POS'un önüne geçmez.
 */
export function chooseRoute(
  routes: PaymentRouteInput[],
  options: { amount: number; bin?: string | null },
): { selected: RouteDecision | null; ranked: RouteDecision[]; baselineFee: number; savedAmount: number } {
  const bin = options.bin ? normalizeBin(options.bin) : "";
  const network = bin ? cardNetworkFromBin(bin) : "unknown";

  const eligible = routes.filter((route) => {
    if (!route.isActive) return false;
    if (route.binPrefixes.length > 0) {
      if (!bin) return false;
      if (!route.binPrefixes.some((prefix) => bin.startsWith(normalizeBin(prefix)))) return false;
    }
    if (route.cardNetworks.length > 0 && network !== "unknown") {
      if (!route.cardNetworks.map((item) => item.toLowerCase()).includes(network)) return false;
    }
    return true;
  });

  const ranked: RouteDecision[] = eligible
    .map((route) => {
      const fee = routeFee(route, options.amount);
      const failurePenalty = ((100 - route.approvalRate) / 100) * options.amount * 0.5;
      return {
        route,
        fee,
        score: Number((fee + failurePenalty - route.priority * 0.01).toFixed(4)),
        matchedBin:
          route.binPrefixes.find((prefix) => bin && bin.startsWith(normalizeBin(prefix))) ?? null,
      };
    })
    .sort((a, b) => a.score - b.score);

  const selected = ranked[0] ?? null;
  const baselineFee = ranked.length > 0 ? Math.max(...ranked.map((item) => item.fee)) : 0;
  const savedAmount = selected ? Number((baselineFee - selected.fee).toFixed(2)) : 0;
  return { selected, ranked, baselineFee, savedAmount };
}

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "tempmail.com",
  "temp-mail.org",
  "guerrillamail.com",
  "10minutemail.com",
  "yopmail.com",
  "trashmail.com",
  "sharklasers.com",
  "getnada.com",
  "dispostable.com",
  "throwawaymail.com",
  "fakeinbox.com",
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1];
  return Boolean(domain && DISPOSABLE_EMAIL_DOMAINS.has(domain));
}

export type FraudSignal = { code: string; label: string; weight: number };

export type FraudInput = {
  email: string;
  orderTotal: number;
  /** Ülke kodu — kargo adresi. */
  shippingCountry: string;
  /** IP'den algılanan ülke kodu (yoksa null). */
  ipCountry?: string | null;
  /** Aynı e-posta/IP ile son 24 saatteki sipariş sayısı. */
  ordersLast24h: number;
  /** Aynı müşterinin daha önce ödenmiş sipariş sayısı. */
  paidHistoryCount: number;
  /** Mağazanın ortalama sipariş tutarı. */
  averageOrderTotal: number;
  phone?: string | null;
};

/**
 * Risk skoru 0–100. Sahte veri üretmez: yalnız verilen sinyallerden hesaplar.
 */
export function scoreFraudRisk(input: FraudInput): {
  score: number;
  level: "low" | "medium" | "high";
  signals: FraudSignal[];
} {
  const signals: FraudSignal[] = [];

  if (isDisposableEmail(input.email)) {
    signals.push({ code: "disposable_email", label: "Tek kullanımlık e-posta adresi", weight: 30 });
  }
  const ipCountry = (input.ipCountry ?? "").toUpperCase();
  const shipCountry = (input.shippingCountry ?? "").toUpperCase();
  if (ipCountry && shipCountry && ipCountry !== shipCountry) {
    signals.push({
      code: "geo_mismatch",
      label: `IP ülkesi (${ipCountry}) teslimat ülkesinden (${shipCountry}) farklı`,
      weight: 20,
    });
  }
  if (input.ordersLast24h >= 5) {
    signals.push({ code: "velocity_high", label: `24 saatte ${input.ordersLast24h} sipariş denemesi`, weight: 25 });
  } else if (input.ordersLast24h >= 3) {
    signals.push({ code: "velocity_medium", label: `24 saatte ${input.ordersLast24h} sipariş denemesi`, weight: 12 });
  }
  if (input.averageOrderTotal > 0 && input.orderTotal > input.averageOrderTotal * 4) {
    signals.push({ code: "amount_outlier", label: "Sipariş tutarı ortalamanın 4 katından yüksek", weight: 18 });
  }
  if (input.paidHistoryCount === 0) {
    signals.push({ code: "first_order", label: "İlk siparişi (geçmiş ödeme yok)", weight: 6 });
  } else if (input.paidHistoryCount >= 3) {
    signals.push({ code: "trusted_customer", label: "Daha önce ödenmiş siparişleri var", weight: -12 });
  }
  const phone = (input.phone ?? "").replace(/\D/g, "");
  if (phone && /^(\d)\1+$/.test(phone)) {
    signals.push({ code: "phone_pattern", label: "Telefon numarası tek rakamdan oluşuyor", weight: 15 });
  }

  const raw = signals.reduce((total, signal) => total + signal.weight, 0);
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const level: "low" | "medium" | "high" = score >= 60 ? "high" : score >= 30 ? "medium" : "low";
  return { score, level, signals };
}

export type AddonInput = {
  id: string;
  kind: "warranty" | "insurance" | "carbon";
  name: string;
  months: number | null;
  priceType: "percent" | "fixed";
  priceValue: number;
  minOrderTotal: number;
  currency: string;
  isActive: boolean;
};

export function addonPrice(addon: AddonInput, orderTotal: number): number {
  if (addon.priceType === "fixed") return Number(addon.priceValue.toFixed(2));
  return Number(((orderTotal * addon.priceValue) / 100).toFixed(2));
}

/** Sipariş tutarına uygun, aktif ek hizmetler ve fiyatları. */
export function eligibleAddons(addons: AddonInput[], orderTotal: number) {
  return addons
    .filter((addon) => addon.isActive && orderTotal >= addon.minOrderTotal)
    .map((addon) => ({ ...addon, price: addonPrice(addon, orderTotal) }));
}

/** Kargo ağırlığına göre yaklaşık karbon salımı (kg CO2e) — sektör ortalaması 0.6 kg/kg-km yerine basit tahmin. */
export function estimateShippingCarbon(weightGrams: number, domestic: boolean): number {
  const kg = Math.max(0.1, weightGrams / 1000);
  const factor = domestic ? 0.35 : 1.6;
  return Number((kg * factor).toFixed(2));
}

/** Bağış tutarından ekilecek yaklaşık fidan sayısı (fidan başı maliyet). */
export function treesFromDonation(amount: number, costPerTree = 25): number {
  if (amount <= 0 || costPerTree <= 0) return 0;
  return Math.max(1, Math.floor(amount / costPerTree));
}

/** Canlı yayın performansı: dönüşüm ve izleyici başına ciro. */
export function streamPerformance(input: {
  totalViews: number;
  peakViewers: number;
  productClicks: number;
  orders: number;
  revenue: number;
}) {
  const ctr = input.totalViews > 0 ? (input.productClicks / input.totalViews) * 100 : 0;
  const conversion = input.productClicks > 0 ? (input.orders / input.productClicks) * 100 : 0;
  const revenuePerViewer = input.totalViews > 0 ? input.revenue / input.totalViews : 0;
  return {
    ctr: Number(ctr.toFixed(2)),
    conversion: Number(conversion.toFixed(2)),
    revenuePerViewer: Number(revenuePerViewer.toFixed(2)),
  };
}

/** Sesli aramadan gelen doğal cümleyi arama terimi + filtrelere ayırır. */
export function parseVoiceQuery(spoken: string): {
  term: string;
  maxPrice: number | null;
  minPrice: number | null;
  color: string | null;
} {
  const text = spoken.toLowerCase().trim();
  const colors = [
    "siyah",
    "beyaz",
    "kırmızı",
    "mavi",
    "yeşil",
    "sarı",
    "gri",
    "pembe",
    "mor",
    "kahverengi",
    "lacivert",
  ];
  const color = colors.find((item) => text.includes(item)) ?? null;

  const under = text.match(/(\d[\d.,]*)\s*(tl|lira|₺)?\s*(altında|altı|aşağı|az)/);
  const over = text.match(/(\d[\d.,]*)\s*(tl|lira|₺)?\s*(üzerinde|üstü|üzeri|fazla)/);
  const toNumber = (value: string | undefined) =>
    value ? Number(value.replace(/\./g, "").replace(",", ".")) : null;

  const stopWords = [
    "bana",
    "bul",
    "göster",
    "arıyorum",
    "istiyorum",
    "lütfen",
    "tl",
    "lira",
    "altında",
    "altı",
    "üzerinde",
    "üstü",
    "en",
    "ucuz",
    "pahalı",
    "bir",
    "tane",
  ];
  const term = text
    .replace(/[\d.,]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.includes(word))
    .join(" ")
    .trim();

  return {
    term: term || text,
    maxPrice: toNumber(under?.[1]),
    minPrice: toNumber(over?.[1]),
    color,
  };
}

/** Sanal POS kataloğu — gerçek tahsilat için mağazanın kendi hesap bilgileri gerekir. */
export const POS_CATALOG: { code: string; label: string; secretNames: string[] }[] = [
  { code: "qnbpay", label: "QNBpay", secretNames: ["QNBPAY_MERCHANT_ID", "QNBPAY_API_KEY"] },
  { code: "iyzico", label: "iyzico", secretNames: ["IYZICO_API_KEY", "IYZICO_SECRET"] },
  { code: "paytr", label: "PayTR", secretNames: ["PAYTR_MERCHANT_ID", "PAYTR_MERCHANT_KEY"] },
  { code: "param", label: "Param POS", secretNames: ["PARAM_CLIENT_CODE", "PARAM_GUID"] },
  { code: "stripe", label: "Stripe", secretNames: ["STRIPE_SECRET_KEY"] },
  { code: "adyen", label: "Adyen", secretNames: ["ADYEN_API_KEY", "ADYEN_MERCHANT_ACCOUNT"] },
];
