import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Handshake, Loader2, MapPin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BigButton, Field, Sheet, inputClass } from "@/components/homemaker/kolay-parts";
import type { SimpleOrder } from "@/lib/homemaker-queries";
import { nearbyStoresQuery } from "@/lib/kolay-v4-queries";
import { delegateOrder } from "@/lib/kolay-v4.functions";

/** Yoğun günlerde siparişi aynı şehirdeki komşu mağazaya devretme. */
export function DelegateSheet({
  order,
  onClose,
  storeId,
}: {
  order: SimpleOrder | null;
  onClose: () => void;
  storeId: string;
}) {
  const queryClient = useQueryClient();
  const {
    data: stores,
    isPending,
    isError,
  } = useQuery({
    ...nearbyStoresQuery(storeId),
    enabled: Boolean(order),
  });
  const send = useServerFn(delegateOrder);
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!order || !target) {
      toast.error("Devretmek istediğiniz mağazayı seçin.");
      return;
    }
    setBusy(true);
    try {
      await send({
        data: { orderId: order.id, toStoreId: target, note: note.trim() || undefined },
      });
      await queryClient.invalidateQueries({ queryKey: ["kolay-delegations", storeId] });
      await queryClient.invalidateQueries({ queryKey: ["kolay-orders", storeId] });
      toast.success("Devir talebiniz komşu mağazaya iletildi.");
      setTarget("");
      setNote("");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Devredilemedi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={Boolean(order)} title="Siparişi komşuya devret" onClose={onClose}>
      <div className="grid gap-4">
        <p className="text-sm text-hm-ink-soft">
          Yetişemediğiniz günlerde siparişi aynı şehirdeki bir mağazaya devredebilirsiniz. Karşı
          taraf onaylayana kadar sipariş sizde kalır.
        </p>

        {isPending ? (
          <p className="text-sm text-hm-ink-soft">Komşu mağazalar yükleniyor…</p>
        ) : isError ? (
          <p className="text-sm text-hm-rose">Komşu mağazalar getirilemedi.</p>
        ) : (stores ?? []).length === 0 ? (
          <p className="flex items-start gap-2 rounded-2xl bg-hm-sand p-3 text-sm text-hm-ink-soft">
            <MapPin className="mt-0.5 size-4 shrink-0" />
            Aynı şehirde başka mağaza görünmüyor. Mağaza adresinizde şehir bilgisi yazılıysa
            komşularınız burada listelenir.
          </p>
        ) : (
          <Field label="Hangi mağazaya devredelim?">
            <select
              className={inputClass}
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            >
              <option value="">Mağaza seçin</option>
              {(stores ?? []).map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                  {store.city ? ` · ${store.city}` : ""}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Not (isteğe bağlı)" hint="Örn. Müşteri cumartesi teslim istiyor.">
          <textarea
            className={`${inputClass} min-h-24 resize-y`}
            value={note}
            maxLength={300}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>

        <BigButton
          onClick={() => void submit()}
          disabled={busy || !target}
          className="w-full"
          tone="teal"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Handshake className="size-5" />}
          Devir talebi gönder
        </BigButton>
      </div>
    </Sheet>
  );
}
