/**
 * Vitrin bloklarının mağazanın gerçek kargo ve ödeme verisini kullanabilmesi için
 * paylaşılan tipler. Veri kaynağı: shipping_zones / shipping_rates / store_payment_methods.
 */

export type StorefrontShippingOption = {
  title: string;
  price: number;
  freeOver: number | null;
  etaDays: number | null;
  zoneName: string | null;
};

export type StorefrontPaymentOption = {
  displayName: string;
  installments: boolean;
};

export type StorefrontCommerce = {
  shipping: StorefrontShippingOption[];
  payments: StorefrontPaymentOption[];
  /** Aktif tarifeler içindeki en düşük ücretsiz kargo eşiği. */
  freeShippingThreshold: number | null;
  /** En hızlı teslim süresi (gün). */
  fastestEtaDays: number | null;
  currency: string;
};

export const EMPTY_COMMERCE: StorefrontCommerce = {
  shipping: [],
  payments: [],
  freeShippingThreshold: null,
  fastestEtaDays: null,
  currency: "TRY",
};

/** Ham satırlardan vitrin için güvenli commerce özeti üretir. */
export function buildStorefrontCommerce(input: {
  currency: string;
  rates: {
    title: string;
    price: number | string;
    free_over: number | string | null;
    eta_days: number | null;
    zone_id?: string | null;
    zoneName?: string | null;
  }[];
  payments: { display_name: string; installments_enabled?: boolean | null }[];
}): StorefrontCommerce {
  const shipping: StorefrontShippingOption[] = input.rates.map((rate) => ({
    title: rate.title,
    price: Number(rate.price) || 0,
    freeOver: rate.free_over === null || rate.free_over === undefined ? null : Number(rate.free_over) || 0,
    etaDays: rate.eta_days ?? null,
    zoneName: rate.zoneName ?? null,
  }));
  const thresholds = shipping
    .map((option) => option.freeOver)
    .filter((value): value is number => typeof value === "number" && value > 0);
  const etas = shipping
    .map((option) => option.etaDays)
    .filter((value): value is number => typeof value === "number" && value > 0);

  return {
    shipping,
    payments: input.payments.map((payment) => ({
      displayName: payment.display_name,
      installments: Boolean(payment.installments_enabled),
    })),
    freeShippingThreshold: thresholds.length ? Math.min(...thresholds) : null,
    fastestEtaDays: etas.length ? Math.min(...etas) : null,
    currency: input.currency,
  };
}
