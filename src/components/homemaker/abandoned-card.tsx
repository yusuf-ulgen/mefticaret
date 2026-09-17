import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, MessageCircle, ShoppingCart, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SoftCard } from "@/components/homemaker/kolay-parts";
import { deleteAbandonedCart } from "@/lib/abandoned.functions";
import { abandonedCartsQuery } from "@/lib/abandoned-queries";
import { formatMoney } from "@/lib/mefti";

/**
 * "Sepette kalanlar": ödemeye geçmeden ayrılan ziyaretçileri gösterir ve
 * sepeti dolu geri getiren hatırlatma linkini paylaşmayı kolaylaştırır.
 */
export function AbandonedCard({
  storeId,
  storeSlug,
  storeName,
}: {
  storeId: string;
  storeSlug?: string | undefined;
  storeName: string;
}) {
  const queryClient = useQueryClient();
  const { data: carts } = useQuery(abandonedCartsQuery(storeId));
  const removeCart = useServerFn(deleteAbandonedCart);
  const [origin, setOrigin] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const pending = (carts ?? []).filter(
    (cart) => !cart.recovered_order_id && (cart.item_count ?? 0) > 0,
  );
  if (pending.length === 0) return null;

  const linkFor = (token: string) =>
    `${origin}/s/${storeSlug ?? ""}/cart?recover=${encodeURIComponent(token)}`;

  const messageFor = (name: string | null, token: string) =>
    `Merhaba${name ? ` ${name}` : ""}, ${storeName} sepetinizde ürünler bekliyor. Şu bağlantıdan kaldığınız yerden devam edebilirsiniz: ${linkFor(token)}`;

  const copy = async (cart: { customer_name: string | null; cart_token: string }) => {
    try {
      await navigator.clipboard.writeText(messageFor(cart.customer_name, cart.cart_token));
      toast.success("Hatırlatma mesajı kopyalandı");
    } catch {
      toast.error("Kopyalanamadı, bağlantıyı elle seçebilirsiniz.");
    }
  };

  const share = async (cart: { customer_name: string | null; cart_token: string }) => {
    const text = messageFor(cart.customer_name, cart.cart_token);
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        /* kullanıcı vazgeçti */
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const drop = async (id: string) => {
    setBusy(id);
    try {
      await removeCart({ data: { id } });
      await queryClient.invalidateQueries({ queryKey: ["store", storeId, "abandoned-carts"] });
      toast.success("Kayıt silindi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Silinemedi");
    } finally {
      setBusy(null);
    }
  };

  const totalValue = pending.reduce((sum, cart) => sum + Number(cart.total ?? 0), 0);
  const currency = pending[0]?.currency ?? "TRY";

  return (
    <SoftCard>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 text-left"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-hm-amber-soft text-hm-amber">
          <ShoppingCart className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-hm-ink">Sepette kalanlar</span>
          <span className="block text-xs text-hm-ink-soft">
            {pending.length} kişi · {formatMoney(totalValue, currency)} tutarında ürün bekliyor
          </span>
        </span>
        <span className="text-sm font-semibold text-hm-rose">{open ? "Kapat" : "Gör"}</span>
      </button>

      {open ? (
        <div className="mt-3 grid gap-2">
          {pending.map((cart) => (
            <div key={cart.id} className="rounded-2xl border border-hm-line p-3">
              <p className="font-semibold text-hm-ink">
                {cart.customer_name || cart.customer_email || "İsimsiz ziyaretçi"}
              </p>
              <p className="text-xs text-hm-ink-soft">
                {cart.item_count} ürün · {formatMoney(Number(cart.total ?? 0), cart.currency)} ·{" "}
                {cart.last_seen_at ? new Date(cart.last_seen_at).toLocaleString("tr-TR") : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void share(cart)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl bg-hm-emerald px-4 text-sm font-semibold text-white"
                >
                  <MessageCircle className="size-4" /> Hatırlat
                </button>
                <button
                  type="button"
                  onClick={() => void copy(cart)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl border border-hm-line px-4 text-sm font-semibold text-hm-ink"
                >
                  <Copy className="size-4" /> Kopyala
                </button>
                <button
                  type="button"
                  disabled={busy === cart.id}
                  onClick={() => void drop(cart.id)}
                  aria-label="Kaydı sil"
                  className="inline-flex min-h-11 items-center rounded-2xl border border-hm-line px-4 text-hm-ink-soft disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </SoftCard>
  );
}
