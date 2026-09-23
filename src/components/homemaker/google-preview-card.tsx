import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Globe, Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BigButton, Field, SoftCard, inputClass } from "@/components/homemaker/kolay-parts";
import { getKolayStoreSeo, saveKolayStoreSeo } from "@/lib/kolay-seo.functions";

/** Mağazanın Google'daki başlık/açıklamasını düzenleme + arama sonucu önizlemesi. */
export function GooglePreviewCard({
  storeId,
  storeName,
  storeSlug,
  city,
}: {
  storeId: string;
  storeName: string;
  storeSlug: string;
  city?: string | null;
}) {
  const queryClient = useQueryClient();
  const load = useServerFn(getKolayStoreSeo);
  const save = useServerFn(saveKolayStoreSeo);
  const { data } = useQuery({
    queryKey: ["kolay-seo", storeId],
    queryFn: () => load({ data: { storeId } }),
  });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setTitle(data.title);
    setDescription(data.description);
  }, [data]);

  const fallbackTitle = `El Yapımı Ürünler${city ? ` | ${city}` : ""}`;
  const fallbackDescription = `${city ? `${city}'dan ` : ""}${storeName} vitrini: el yapımı ve ev üretimi ürünler, güncel fiyat ve stok bilgisiyle. WhatsApp veya kartla güvenli sipariş verin.`;
  const shownTitle = `${title.trim() || fallbackTitle} | ${storeName}`;
  const shownDescription = description.trim() || fallbackDescription;

  const submit = async () => {
    setBusy(true);
    try {
      await save({ data: { storeId, title, description } });
      await queryClient.invalidateQueries({ queryKey: ["kolay-seo", storeId] });
      toast.success("Google görünümü kaydedildi. Google yeni bilgileri birkaç gün içinde gösterir.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SoftCard className="grid gap-4">
      <div className="flex items-center gap-2">
        <Search className="size-5 text-hm-teal" />
        <p className="text-sm font-bold text-hm-ink">Google'da nasıl görünüyorum?</p>
      </div>

      <div className="grid gap-1 rounded-2xl border border-hm-line bg-white p-4" aria-label="Google arama önizlemesi">
        <p className="flex items-center gap-1 truncate text-xs text-hm-ink-soft">
          <Globe className="size-3.5" /> mefticaret.com › s › {storeSlug}
        </p>
        <p className="line-clamp-1 text-base font-medium text-hm-teal">{shownTitle}</p>
        <p className="line-clamp-2 text-sm text-hm-ink-soft">{shownDescription}</p>
      </div>
      {data?.hidden ? (
        <p className="rounded-2xl bg-hm-amber-soft p-3 text-xs text-hm-ink">
          Mağazanız şu an Google'a kapalı. Kaydettiğinizde açılır.
        </p>
      ) : (
        <p className="text-xs text-hm-ink-soft">Mağazanız Google'a açık ve site haritasında yer alıyor.</p>
      )}

      <Field label={`Google başlığı (${title.length}/60)`} hint="Boş bırakırsanız otomatik başlık kullanılır">
        <input
          className={inputClass}
          value={title}
          maxLength={70}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={fallbackTitle}
        />
      </Field>
      <Field label={`Google açıklaması (${description.length}/160)`} hint="Ne sattığınızı ve şehrinizi yazın">
        <textarea
          className={`${inputClass} min-h-20`}
          value={description}
          maxLength={170}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={fallbackDescription}
        />
      </Field>
      <BigButton onClick={() => void submit()} disabled={busy} className="w-full">
        {busy ? <Loader2 className="size-5 animate-spin" /> : <Search className="size-5" />}
        Google görünümünü kaydet
      </BigButton>
    </SoftCard>
  );
}
