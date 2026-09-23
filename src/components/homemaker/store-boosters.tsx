import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Truck } from "lucide-react";

import { getStoreBoosters } from "@/lib/kolay-v8.functions";
import { formatMoney } from "@/lib/mefti";

/**
 * Ödeme adımında gösterilen satış artırıcılar: kargo bedava çubuğu, paket
 * indirimi hatırlatması ve komşu mağaza önerisi.
 */
export function StoreBoosters({
  slug,
  cartTotal,
  currency,
}: {
  slug: string;
  cartTotal: number;
  currency: string;
}) {
  const load = useServerFn(getStoreBoosters);
  const { data } = useQuery({
    queryKey: ["store-boosters", slug],
    queryFn: () => load({ data: { slug } }),
    staleTime: 60_000,
  });

  if (!data) return null;
  const { bundle, freeShipping, crossSell } = data;
  if (!bundle && !freeShipping && crossSell.length === 0) return null;

  const remaining = freeShipping ? Math.max(0, freeShipping.threshold - cartTotal) : 0;
  const progress = freeShipping && freeShipping.threshold > 0
    ? Math.min(100, Math.round((cartTotal / freeShipping.threshold) * 100))
    : 0;

  return (
    <div className="grid gap-3">
      {freeShipping ? (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Truck className="size-4 text-primary" />
            {remaining > 0 ? (
              <span>
                {formatMoney(remaining, currency)} daha ekleyin, kargo bedava!
              </span>
            ) : (
              <span>Tebrikler, kargo bedava.</span>
            )}
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${remaining > 0 ? progress : 100}%` }}
            />
          </div>
        </div>
      ) : null}

      {bundle ? (
        <div className="flex items-start gap-2 rounded-2xl border border-border bg-card p-4 text-sm">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            {bundle.minQuantity} al %{bundle.percent} indirim kazan — sepette{" "}
            <strong>{bundle.code}</strong> kodunu kullanın.
          </p>
        </div>
      ) : null}

      {crossSell.map((partner) => (
        <a
          key={partner.id}
          href={
            partner.productSlug
              ? `/s/${partner.storeSlug}/p/${partner.productSlug}`
              : `/s/${partner.storeSlug}`
          }
          className="block rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Komşu mağaza önerisi
          </p>
          <p className="mt-1 text-sm font-semibold">{partner.headline}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {partner.storeName}
            {partner.productTitle ? ` · ${partner.productTitle}` : ""}
            {partner.productPrice !== null
              ? ` · ${formatMoney(partner.productPrice, partner.currency)}`
              : ""}
          </p>
        </a>
      ))}
    </div>
  );
}
