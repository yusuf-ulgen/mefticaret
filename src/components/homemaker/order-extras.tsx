import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gift, Loader2, StickyNote, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BigButton, Field, Sheet, SoftCard, inputClass } from "@/components/homemaker/kolay-parts";
import type { SimpleOrder } from "@/lib/homemaker-queries";
import {
  createOrderSplit,
  listOrderNotes,
  listOrderSplits,
  respondOrderSplit,
  saveOrderNote,
  searchSplitPartners,
} from "@/lib/kolay-v9.functions";
import { formatMoney } from "@/lib/mefti";

const PRESET_TAGS = ["VIP Müşteri", "Aramadan Teslim Et", "Tatlı Sever", "Alerjisi Var", "Düzenli Müşteri"];

function useNotes(storeId: string) {
  const load = useServerFn(listOrderNotes);
  return useQuery({
    queryKey: ["kolay-order-notes", storeId],
    queryFn: () => load({ data: { storeId } }),
    staleTime: 30_000,
  });
}

/** Sipariş kartında: hediye bilgisi, özel notlar ve siparişi bölüşme. */
export function OrderExtras({ storeId, order }: { storeId: string; order: SimpleOrder }) {
  const qc = useQueryClient();
  const { data: notes } = useNotes(storeId);
  const current = notes?.find((n) => n.orderId === order.id);
  const [noteOpen, setNoteOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const save = useServerFn(saveOrderNote);

  const totalQty = order.items.reduce((a, i) => a + i.quantity, 0);
  const isLarge = totalQty >= 5 || order.grand_total >= 1000;

  function openNotes() {
    setTags(current?.tags ?? []);
    setText(current?.note ?? "");
    setNoteOpen(true);
  }

  async function submitNote() {
    setBusy(true);
    try {
      await save({ data: { storeId, orderId: order.id, tags, note: text } });
      await qc.invalidateQueries({ queryKey: ["kolay-order-notes", storeId] });
      toast.success("Not kaydedildi. Sadece siz görürsünüz.");
      setNoteOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Not kaydedilemedi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {order.gift_wrap ? (
        <div className="flex items-start gap-2 rounded-2xl bg-hm-amber-soft p-3 text-sm text-hm-ink">
          <Gift className="mt-0.5 size-5 shrink-0 text-hm-amber" />
          <div>
            <p className="font-semibold">Hediye paketi istendi</p>
            {order.gift_message ? <p className="mt-1 italic">“{order.gift_message}”</p> : null}
          </div>
        </div>
      ) : null}

      {current && (current.tags.length > 0 || current.note) ? (
        <div className="rounded-2xl bg-hm-teal-soft p-3 text-sm text-hm-ink">
          <div className="flex flex-wrap gap-1.5">
            {current.tags.map((t) => (
              <span key={t} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-hm-teal">
                {t}
              </span>
            ))}
          </div>
          {current.note ? <p className="mt-2">{current.note}</p> : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={openNotes}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-hm-line bg-white text-sm font-semibold text-hm-ink"
        >
          <StickyNote className="size-4" /> Özel not
        </button>
        {isLarge ? (
          <button
            type="button"
            onClick={() => setSplitOpen(true)}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-hm-line bg-white text-sm font-semibold text-hm-ink"
          >
            <Users className="size-4" /> Siparişi Bölüş
          </button>
        ) : null}
      </div>

      <Sheet open={noteOpen} title="Müşteri notu (yalnız siz görürsünüz)" onClose={() => setNoteOpen(false)}>
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            {PRESET_TAGS.map((t) => {
              const on = tags.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTags(on ? tags.filter((x) => x !== t) : [...tags, t])}
                  className={`min-h-11 rounded-full px-4 text-sm font-semibold ${on ? "bg-hm-teal text-white" : "border border-hm-line bg-white text-hm-ink"}`}
                >
                  {t}
                </button>
              );
            })}
          </div>
          <Field label="Not">
            <textarea className={`${inputClass} min-h-24`} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <BigButton tone="teal" disabled={busy} onClick={submitNote}>
            {busy ? <Loader2 className="size-5 animate-spin" /> : null} Kaydet
          </BigButton>
        </div>
      </Sheet>

      {splitOpen ? <SplitSheet storeId={storeId} order={order} onClose={() => setSplitOpen(false)} /> : null}
    </>
  );
}

function SplitSheet({ storeId, order, onClose }: { storeId: string; order: SimpleOrder; onClose: () => void }) {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const search = useServerFn(searchSplitPartners);
  const create = useServerFn(createOrderSplit);
  const { data: partners, isFetching } = useQuery({
    queryKey: ["kolay-split-partners", storeId, query],
    queryFn: () => search({ data: { storeId, query } }),
    staleTime: 30_000,
  });

  async function submit() {
    if (!picked) {
      toast.error("Birlikte çalışacağınız ev hanımını seçin");
      return;
    }
    setBusy(true);
    try {
      await create({
        data: { storeId, orderId: order.id, toStoreId: picked, shareNote: note, shareAmount: Number(amount) || 0 },
      });
      await qc.invalidateQueries({ queryKey: ["kolay-splits", storeId] });
      toast.success("Davet gönderildi. Kabul edince size haber vereceğiz.");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Davet gönderilemedi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open title="Siparişi bölüş" onClose={onClose}>
      <div className="grid gap-4">
        <Field label="Ev hanımı ara">
          <input className={inputClass} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Mağaza adı" />
        </Field>
        <div className="grid max-h-56 gap-2 overflow-y-auto">
          {isFetching && !partners ? <Loader2 className="mx-auto size-5 animate-spin" /> : null}
          {(partners ?? []).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPicked(p.id)}
              className={`min-h-12 rounded-2xl border px-4 text-left text-sm ${picked === p.id ? "border-hm-rose bg-hm-rose-soft" : "border-hm-line bg-white"}`}
            >
              <span className="font-semibold text-hm-ink">{p.name}</span>
              {p.city ? <span className="ml-2 text-hm-ink-soft">{p.city}</span> : null}
            </button>
          ))}
          {partners && partners.length === 0 ? <p className="text-sm text-hm-ink-soft">Kayıtlı ev hanımı bulunamadı.</p> : null}
        </div>
        <Field label="Ne yapmasını istiyorsunuz?" hint="Örn: 3 tepsi baklavayı o hazırlasın">
          <textarea className={`${inputClass} min-h-20`} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Field label="Ona düşen kazanç (TL)" hint={`Sipariş tutarı: ${formatMoney(order.grand_total, order.currency)}`}>
          <input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, "").replace(",", "."))} />
        </Field>
        <BigButton disabled={busy || note.trim().length < 3} onClick={submit}>
          {busy ? <Loader2 className="size-5 animate-spin" /> : null} Davet gönder
        </BigButton>
      </div>
    </Sheet>
  );
}

const STATUS: Record<string, string> = {
  pending: "Yanıt bekliyor",
  accepted: "Kabul edildi",
  declined: "Reddedildi",
  cancelled: "İptal edildi",
};

/** Gelen/giden bölüşme davetleri. */
export function SplitInvitesCard({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const load = useServerFn(listOrderSplits);
  const respond = useServerFn(respondOrderSplit);
  const { data } = useQuery({
    queryKey: ["kolay-splits", storeId],
    queryFn: () => load({ data: { storeId } }),
    staleTime: 30_000,
  });
  if (!data || data.length === 0) return null;

  async function act(splitId: string, status: "accepted" | "declined" | "cancelled") {
    try {
      await respond({ data: { storeId, splitId, status } });
      await qc.invalidateQueries({ queryKey: ["kolay-splits", storeId] });
      toast.success(status === "accepted" ? "Harika, işi kabul ettiniz!" : "Tamam, kaydedildi.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İşlem yapılamadı");
    }
  }

  return (
    <SoftCard className="grid gap-3">
      <p className="flex items-center gap-2 font-semibold text-hm-ink">
        <Users className="size-5 text-hm-teal" /> Birlikte üretim
      </p>
      {data.slice(0, 5).map((s) => (
        <div key={s.id} className="grid gap-2 rounded-2xl bg-hm-sand p-3 text-sm">
          <p className="text-hm-ink">
            <strong>{s.partnerName}</strong> {s.incoming ? "sizinle bölüşmek istiyor" : "ile bölüştünüz"}
          </p>
          <p className="text-hm-ink-soft">{s.shareNote}</p>
          <p className="text-hm-ink-soft">
            Kazanç: {formatMoney(s.shareAmount, "TRY")} · {STATUS[s.status] ?? s.status}
          </p>
          {s.status === "pending" ? (
            <div className="grid grid-cols-2 gap-2">
              {s.incoming ? (
                <>
                  <BigButton tone="teal" onClick={() => act(s.id, "accepted")}>Kabul et</BigButton>
                  <BigButton tone="ghost" onClick={() => act(s.id, "declined")}>Reddet</BigButton>
                </>
              ) : (
                <BigButton tone="ghost" onClick={() => act(s.id, "cancelled")}>Daveti geri al</BigButton>
              )}
            </div>
          ) : null}
        </div>
      ))}
    </SoftCard>
  );
}
