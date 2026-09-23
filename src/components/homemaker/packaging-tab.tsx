import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, PackageOpen, ShoppingBasket } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BigButton, Field, Sheet, SoftCard, inputClass } from "@/components/homemaker/kolay-parts";
import {
  listPackagingItems,
  listPackagingOrders,
  orderPackagingItem,
} from "@/lib/kolay-v8.functions";
import { formatMoney } from "@/lib/mefti";

const CATEGORY_LABELS: Record<string, string> = {
  kutu: "Kutu",
  kavanoz: "Kavanoz",
  kargo: "Kargo",
  etiket: "Etiket",
  susleme: "Süsleme",
};

/** İndirimli ambalaj pazarı: kutu, kavanoz, kargo poşeti ve etiketler. */
export function PackagingTab({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const loadItems = useServerFn(listPackagingItems);
  const loadOrders = useServerFn(listPackagingOrders);
  const placeOrder = useServerFn(orderPackagingItem);

  const itemsQuery = useQuery({ queryKey: ["kolay-packaging-items"], queryFn: () => loadItems({}) });
  const ordersQuery = useQuery({
    queryKey: ["kolay-packaging-orders", storeId],
    queryFn: () => loadOrders({ data: { storeId } }),
  });

  const [selected, setSelected] = useState<{ id: string; title: string; price: number; currency: string } | null>(
    null,
  );
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [usePoints, setUsePoints] = useState(false);

  const submit = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await placeOrder({
        data: { storeId, itemId: selected.id, quantity, deliveryNote: note.trim() || null, usePoints },
      });
      if (result.pointsUsed > 0) {
        toast.success(`${result.pointsUsed} mentor puanınızla ${result.pointsUsed} TL indirim kazandınız`);
        await queryClient.invalidateQueries({ queryKey: ["kolay-mentor", storeId] });
      }
      await queryClient.invalidateQueries({ queryKey: ["kolay-packaging-orders", storeId] });
      setSelected(null);
      setQuantity(1);
      setNote("");
      toast.success("Ambalaj talebiniz alındı, hazırlanınca haber verilecek");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Talep oluşturulamadı");
    } finally {
      setBusy(false);
    }
  };

  const items = itemsQuery.data ?? [];
  const orders = ordersQuery.data ?? [];

  return (
    <div className="grid gap-4">
      <SoftCard className="grid gap-1">
        <div className="flex items-center gap-2">
          <ShoppingBasket className="size-5 text-hm-teal" />
          <h2 className="text-base font-bold">Ambalaj pazarı</h2>
        </div>
        <p className="text-xs text-hm-ink-soft">
          Kutu, kavanoz, kargo poşeti ve etiketleri toptan fiyatına sipariş edin. Talebiniz
          hazırlanıp adresinize gönderilir.
        </p>
      </SoftCard>

      {itemsQuery.isPending ? (
        <p className="py-8 text-center text-sm text-hm-ink-soft">Ürünler yükleniyor…</p>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => {
            const sale = Number(item.sale_price);
            const list = Number(item.list_price);
            const off = list > sale ? Math.round(((list - sale) / list) * 100) : 0;
            return (
              <SoftCard key={item.id} className="grid gap-2">
                <div className="flex items-start gap-3">
                  <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-hm-sand text-hm-teal">
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="size-full rounded-2xl object-cover" />
                    ) : (
                      <PackageOpen className="size-6" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-0.5 text-xs text-hm-ink-soft">{item.description}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-hm-teal">
                      {CATEGORY_LABELS[item.category] ?? item.category}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-base font-bold">{formatMoney(sale, item.currency)}</p>
                    {off > 0 ? (
                      <p className="text-xs text-hm-ink-soft">
                        <span className="line-through">{formatMoney(list, item.currency)}</span> · %
                        {off} indirim
                      </p>
                    ) : null}
                  </div>
                  <BigButton
                    tone="teal"
                    onClick={() =>
                      setSelected({
                        id: item.id,
                        title: item.title,
                        price: sale,
                        currency: item.currency,
                      })
                    }
                  >
                    Sipariş et
                  </BigButton>
                </div>
              </SoftCard>
            );
          })}
        </div>
      )}

      {orders.length > 0 ? (
        <SoftCard className="grid gap-2">
          <h3 className="text-sm font-bold">Ambalaj taleplerim</h3>
          <ul className="grid gap-2">
            {orders.map((order) => (
              <li key={order.id} className="flex items-center gap-3 rounded-2xl bg-hm-sand p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{order.title}</p>
                  <p className="text-xs text-hm-ink-soft">
                    {order.quantity} adet · {formatMoney(order.total, order.currency)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-hm-ink-soft">
                  {order.status === "pending" ? "Hazırlanıyor" : order.status}
                </span>
              </li>
            ))}
          </ul>
        </SoftCard>
      ) : null}

      <Sheet open={Boolean(selected)} title="Ambalaj siparişi" onClose={() => setSelected(null)}>
        {selected ? (
          <div className="grid gap-3">
            <p className="text-sm font-semibold">{selected.title}</p>
            <Field label="Kaç paket?">
              <input
                type="number"
                min={1}
                max={50}
                value={quantity}
                onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                className={inputClass}
              />
            </Field>
            <Field label="Teslim notu (isteğe bağlı)">
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                className={inputClass}
                placeholder="Apartman girişine bırakılabilir."
              />
            </Field>
            <p className="rounded-2xl bg-hm-sand p-3 text-sm">
              Toplam:{" "}
              <strong>{formatMoney(selected.price * quantity, selected.currency)}</strong>
            </p>
            <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-hm-amber-soft px-4 text-sm font-semibold text-hm-ink">
              <input type="checkbox" className="size-5" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} />
              Mentor puanlarımı kullan (1 puan = 1 TL, en fazla yarısı)
            </label>
            <BigButton tone="teal" onClick={() => void submit()} disabled={busy}>
              {busy ? <Loader2 className="size-5 animate-spin" /> : null}
              Talebi gönder
            </BigButton>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
