import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChefHat, Gift, Globe, Sparkles, Truck } from "lucide-react";
import { useState } from "react";

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
  gift,
  onGiftChange,
}: {
  slug: string;
  cartTotal: number;
  currency: string;
  gift?: { wrap: boolean; message: string };
  onGiftChange?: (next: { wrap: boolean; message: string }) => void;
}) {
  const [shown, setShown] = useState<"TRY" | "EUR" | "USD">("TRY");
  const load = useServerFn(getStoreBoosters);
  const { data } = useQuery({
    queryKey: ["store-boosters", slug],
    queryFn: () => load({ data: { slug } }),
    staleTime: 60_000,
  });

  if (!data) return null;
  const { bundle, freeShipping, crossSell, production, giftWrap, rates } = data;
  const canConvert = currency === "TRY" && (rates['EUR'] || rates['USD']);
  const converted = shown !== "TRY" && rates[shown] ? cartTotal / rates[shown] : null;

  const remaining = freeShipping ? Math.max(0, freeShipping.threshold - cartTotal) : 0;
  const progress = freeShipping && freeShipping.threshold > 0
    ? Math.min(100, Math.round((cartTotal / freeShipping.threshold) * 100))
    : 0;

  return (
    <div className="grid gap-3">
      {production ? (
        <div className="flex items-start gap-2 rounded-2xl border border-border bg-accent p-4 text-sm">
          <ChefHat className="mt-0.5 size-4 shrink-0 text-primary" />
          <p><strong>Üretimdeyim.</strong> {production.message}</p>
        </div>
      ) : null}

      {canConvert ? (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <Globe className="size-4 text-primary" /> Fiyatı hangi parayla görmek istersiniz?
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["TRY", "EUR", "USD"] as const).filter((c) => c === "TRY" || rates[c]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setShown(c)}
                className={`min-h-11 rounded-xl border text-sm font-semibold ${shown === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}
              >
                {c}
              </button>
            ))}
          </div>
          {converted !== null ? (
            <p className="mt-2">
              Yaklaşık <strong>{formatMoney(converted, shown)}</strong>
              <span className="ml-2 inline-block rounded-full bg-muted px-2 py-0.5 text-xs">Ödeme TL olarak alınır</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {giftWrap && gift && onGiftChange ? (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm">
          <label className="flex min-h-11 items-center gap-3 font-semibold">
            <input type="checkbox" className="size-5" checked={gift.wrap} onChange={(e) => onGiftChange({ ...gift, wrap: e.target.checked })} />
            <Gift className="size-4 text-primary" /> Hediye paketi olsun
          </label>
          {gift.wrap ? (
            <textarea
              className="mt-2 min-h-20 w-full rounded-xl border border-border bg-background p-3"
              maxLength={300}
              placeholder="Karta yazılacak mesajınız"
              value={gift.message}
              onChange={(e) => onGiftChange({ ...gift, message: e.target.value })}
            />
          ) : null}
        </div>
      ) : null}
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
