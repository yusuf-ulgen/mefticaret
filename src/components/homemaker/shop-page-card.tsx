import { Copy, ExternalLink, Share2 } from "lucide-react";
import { toast } from "sonner";

import { SoftCard } from "@/components/homemaker/kolay-parts";
import type { SimpleProduct } from "@/lib/homemaker-queries";
import { formatMoney } from "@/lib/mefti";

/**
 * "Mağaza sayfam": ev üreticisinin gerçek web sayfası ve ürün sayfalarının bağlantıları.
 * Bağlantılar mağaza vitrini rotalarına (/s/{slug}) gider.
 */
export function ShopPageCard({
  storeUrl,
  storeName,
  products,
  currency,
  live,
}: {
  storeUrl: string;
  storeName: string;
  products: SimpleProduct[];
  currency: string;
  live: boolean;
}) {
  const share = async (url: string, title: string) => {
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Bağlantı kopyalandı");
      }
    } catch {
      /* kullanıcı paylaşmayı iptal etti */
    }
  };

  const published = products.filter((product) => product.status === "active");

  return (
    <SoftCard id="hm-website" className="grid gap-3">
      <div>
        <p className="font-semibold text-hm-ink">Mağaza sayfam</p>
        <p className="mt-0.5 text-sm text-hm-ink-soft">
          {live
            ? "Sayfanız internette açık. Bağlantıyı müşterilerinize gönderin."
            : "Mağazanız bakımda. Üstteki düğmeden canlıya alınca sayfanız açılır."}
        </p>
      </div>
      <p className="break-all rounded-2xl bg-hm-sand px-4 py-3 text-sm text-hm-ink-soft">
        {storeUrl}
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-hm-rose px-4 text-sm font-semibold text-white"
        >
          <ExternalLink className="size-4" /> Sayfamı gör
        </a>
        <a
          href={`${storeUrl}/products`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-hm-line bg-white px-4 text-sm font-semibold text-hm-ink"
        >
          <ExternalLink className="size-4" /> Ürünler sayfam
        </a>
        <button
          type="button"
          onClick={() => void share(storeUrl, storeName)}
          className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-hm-line bg-white px-4 text-sm font-semibold text-hm-ink"
        >
          <Share2 className="size-4" /> Paylaş
        </button>
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-semibold text-hm-ink">Ürün sayfalarım ({published.length})</p>
        {published.length === 0 ? (
          <p className="rounded-2xl bg-hm-sand p-3 text-sm text-hm-ink-soft">
            Yayında ürün yok. Ürünlerim sekmesinden ürün ekleyip yayına alın.
          </p>
        ) : (
          published.slice(0, 20).map((product) => {
            const url = product.slug ? `${storeUrl}/p/${product.slug}` : storeUrl;
            return (
              <div
                key={product.id}
                className="flex items-center gap-3 rounded-2xl border border-hm-line p-2"
              >
                <div className="size-12 shrink-0 overflow-hidden rounded-xl bg-hm-sand">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt="" className="size-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-hm-ink">{product.title}</p>
                  <p className="text-xs text-hm-ink-soft">
                    {formatMoney(product.base_price, currency)}
                  </p>
                </div>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${product.title} sayfasını aç`}
                  className="grid size-10 place-items-center rounded-xl bg-hm-sand text-hm-ink"
                >
                  <ExternalLink className="size-4" />
                </a>
                <button
                  type="button"
                  aria-label={`${product.title} bağlantısını kopyala`}
                  onClick={() => {
                    void navigator.clipboard.writeText(url);
                    toast.success("Ürün bağlantısı kopyalandı");
                  }}
                  className="grid size-10 place-items-center rounded-xl bg-hm-rose-soft text-hm-rose"
                >
                  <Copy className="size-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </SoftCard>
  );
}
