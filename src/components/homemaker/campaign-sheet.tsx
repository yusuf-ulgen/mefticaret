import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Gift, Loader2, PartyPopper, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BigButton, Field, Sheet, SoftCard, inputClass } from "@/components/homemaker/kolay-parts";
import { startSeasonalCampaign, stopSeasonalCampaign } from "@/lib/kolay-v4.functions";

export type CampaignBanner = {
  occasion?: string;
  percent?: number;
  code?: string;
  ends_at?: string;
  preorder?: boolean;
  message?: string;
} | null;

const OCCASIONS = [
  "Ramazan Bayramı",
  "Kurban Bayramı",
  "Anneler Günü",
  "Sevgililer Günü",
  "Yılbaşı",
  "Kış lezzetleri",
];

/** Tek dokunuşla özel gün kampanyası: indirim kodu + vitrin duyurusu. */
export function CampaignSheet({
  open,
  onClose,
  storeId,
  banner,
}: {
  open: boolean;
  onClose: () => void;
  storeId: string;
  banner: CampaignBanner;
}) {
  const queryClient = useQueryClient();
  const start = useServerFn(startSeasonalCampaign);
  const stop = useServerFn(stopSeasonalCampaign);

  const [occasion, setOccasion] = useState(OCCASIONS[0] ?? "");
  const [percent, setPercent] = useState("15");
  const [endsAt, setEndsAt] = useState(() =>
    new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
  );
  const [preorder, setPreorder] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["store-settings", storeId] });
  };

  const submit = async () => {
    const value = Number(percent);
    if (!occasion.trim()) {
      toast.error("Kampanya adını yazın.");
      return;
    }
    if (!Number.isFinite(value) || value < 1 || value > 70) {
      toast.error("İndirim oranı 1 ile 70 arasında olmalı.");
      return;
    }
    setBusy(true);
    try {
      const result = await start({
        data: {
          storeId,
          occasion: occasion.trim(),
          percent: Math.round(value),
          endsAt,
          preorder,
        },
      });
      await refresh();
      toast.success(`Kampanya başladı. İndirim kodu: ${result.code}`);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kampanya başlatılamadı");
    } finally {
      setBusy(false);
    }
  };

  const end = async () => {
    setBusy(true);
    try {
      await stop({ data: { storeId, code: banner?.code ?? "" } });
      await refresh();
      toast.success("Kampanya kapatıldı");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kapatılamadı");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} title="Özel gün kampanyası" onClose={onClose}>
      <div className="grid gap-4">
        {banner?.code ? (
          <SoftCard className="grid gap-2 bg-hm-emerald-soft">
            <p className="text-sm font-semibold text-hm-emerald">Şu an açık kampanyanız var</p>
            <p className="text-sm text-hm-ink">{banner.message}</p>
            <div className="flex flex-wrap gap-2">
              <BigButton
                tone="ghost"
                onClick={() => {
                  void navigator.clipboard.writeText(banner.code ?? "");
                  toast.success("Kod kopyalandı");
                }}
              >
                <Copy className="size-4" /> {banner.code}
              </BigButton>
              <BigButton tone="ghost" disabled={busy} onClick={() => void end()}>
                <Trash2 className="size-4" /> Kampanyayı kapat
              </BigButton>
            </div>
          </SoftCard>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {OCCASIONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setOccasion(item)}
              className={`min-h-11 rounded-2xl px-3 text-sm font-semibold ${
                occasion === item ? "bg-hm-rose text-white" : "bg-hm-sand text-hm-ink-soft"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <Field label="Kampanya adı">
          <input
            className={inputClass}
            value={occasion}
            onChange={(event) => setOccasion(event.target.value)}
            placeholder="Örn. Anneler Günü"
          />
        </Field>
        <Field label="İndirim oranı (%)" hint="Müşteri kodu yazınca indirim uygulanır.">
          <input
            className={inputClass}
            value={percent}
            inputMode="numeric"
            onChange={(event) => setPercent(event.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <Field label="Son gün">
          <input
            type="date"
            className={inputClass}
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
          />
        </Field>
        <label className="flex min-h-14 items-center gap-3 rounded-2xl bg-hm-sand px-4">
          <input
            type="checkbox"
            checked={preorder}
            onChange={(event) => setPreorder(event.target.checked)}
            className="size-5 accent-hm-rose"
          />
          <span className="text-sm font-semibold text-hm-ink">
            Ön sipariş olarak duyur (özel gün öncesi hazırlanır)
          </span>
        </label>

        <BigButton onClick={() => void submit()} disabled={busy} className="w-full">
          {busy ? <Loader2 className="size-5 animate-spin" /> : <PartyPopper className="size-5" />}
          Kampanyayı başlat
        </BigButton>
        <p className="flex items-start gap-2 text-xs text-hm-ink-soft">
          <Gift className="mt-0.5 size-4 shrink-0" />
          Kampanya başladığında mağaza sayfanızda duyuru görünür ve indirim kodu müşterilerinizde
          çalışır.
        </p>
      </div>
    </Sheet>
  );
}
