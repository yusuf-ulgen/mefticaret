import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Award, ChefHat, Copy, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BigButton, Field, Sheet, SoftCard, inputClass } from "@/components/homemaker/kolay-parts";
import {
  chooseMentor,
  getKitchenSettings,
  getMentorship,
  saveKitchenSettings,
} from "@/lib/kolay-v9.functions";

/** Üst çubuktaki "Üretimdeyim" düğmesi ve ayar paneli. */
export function KitchenModeButton({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const load = useServerFn(getKitchenSettings);
  const save = useServerFn(saveKitchenSettings);
  const { data } = useQuery({
    queryKey: ["kolay-kitchen", storeId],
    queryFn: () => load({ data: { storeId } }),
  });
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [gift, setGift] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) {
      setMessage(data.productionMessage);
      setGift(data.giftWrapEnabled);
    }
  }, [data]);

  const on = data?.productionMode ?? false;

  async function apply(productionMode: boolean) {
    setBusy(true);
    try {
      await save({ data: { storeId, productionMode, productionMessage: message, giftWrapEnabled: gift } });
      await qc.invalidateQueries({ queryKey: ["kolay-kitchen", storeId] });
      toast.success(productionMode ? "Üretimdeyim modu açık. Müşterileriniz notunuzu görecek." : "Ayarlar kaydedildi");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Mutfak modu"
        className={`grid min-h-12 w-12 place-items-center rounded-2xl ${on ? "bg-hm-amber text-white" : "bg-hm-amber-soft text-hm-amber"}`}
      >
        <ChefHat className="size-5" />
      </button>
      <Sheet open={open} title="Mutfak modu" onClose={() => setOpen(false)}>
        <div className="grid gap-4">
          <p className="text-sm text-hm-ink-soft">
            Açıkken mağazanızda “Üretimdeyim” yazısı ve notunuz görünür. Sipariş almaya devam edersiniz.
          </p>
          <Field label="Müşterilere notunuz" hint="Örn: Bugünkü siparişler yarın kargoda">
            <input className={inputClass} maxLength={200} value={message} onChange={(e) => setMessage(e.target.value)} />
          </Field>
          <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-hm-sand px-4 text-sm font-semibold text-hm-ink">
            <input type="checkbox" className="size-5" checked={gift} onChange={(e) => setGift(e.target.checked)} />
            Müşteriler hediye paketi ve not isteyebilsin
          </label>
          <BigButton tone="teal" disabled={busy} onClick={() => apply(!on)}>
            {busy ? <Loader2 className="size-5 animate-spin" /> : null}
            {on ? "Üretimi bitirdim (kapat)" : "Üretimdeyim (aç)"}
          </BigButton>
          <BigButton tone="ghost" disabled={busy} onClick={() => apply(on)}>
            Sadece kaydet
          </BigButton>
        </div>
      </Sheet>
    </>
  );
}

/** Mentorluk rozeti, puanlar ve mentor seçimi. */
export function MentorCard({ storeId, storeSlug }: { storeId: string; storeSlug: string }) {
  const qc = useQueryClient();
  const load = useServerFn(getMentorship);
  const choose = useServerFn(chooseMentor);
  const { data } = useQuery({
    queryKey: ["kolay-mentor", storeId],
    queryFn: () => load({ data: { storeId } }),
  });
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await choose({ data: { storeId, mentorSlug: slug } });
      await qc.invalidateQueries({ queryKey: ["kolay-mentor", storeId] });
      toast.success("Mentorunuz kaydedildi. İlk satışınızda o da puan kazanacak!");
      setSlug("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SoftCard className="grid gap-3">
      <div className="flex items-center gap-3">
        <div className="grid size-12 place-items-center rounded-2xl bg-hm-amber-soft text-hm-amber">
          <Award className="size-6" />
        </div>
        <div>
          <p className="font-semibold text-hm-ink">{data?.badge ?? "Mentorluk"}</p>
          <p className="text-sm text-hm-ink-soft">
            {data ? `${data.balance} puan · ${data.helped} kişiye yardım ettiniz` : "Yükleniyor…"}
          </p>
        </div>
      </div>
      <p className="text-sm text-hm-ink-soft">
        Yeni başlayan birine yardım edin. Mağaza adresinizi paylaşın; ilk satışını yaptığında 100 puan kazanırsınız.
        Puanlar ambalaj alışverişinde indirim olur.
      </p>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(storeSlug);
          toast.success("Mentor kodunuz kopyalandı");
        }}
        className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-hm-sand text-sm font-semibold text-hm-ink"
      >
        <Copy className="size-4" /> Mentor kodum: {storeSlug}
      </button>
      {data && !data.mentorName ? (
        <div className="grid gap-2">
          <Field label="Size yardım eden biri var mı?" hint="Onun mentor kodunu yazın">
            <input className={inputClass} value={slug} onChange={(e) => setSlug(e.target.value)} />
          </Field>
          <BigButton tone="ghost" disabled={busy || slug.trim().length < 2} onClick={submit}>
            Mentorumu kaydet
          </BigButton>
        </div>
      ) : data?.mentorName ? (
        <p className="text-sm text-hm-ink">Mentorunuz: <strong>{data.mentorName}</strong></p>
      ) : null}
    </SoftCard>
  );
}
