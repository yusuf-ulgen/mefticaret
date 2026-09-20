import { useMutation, useQuery } from "@tanstack/react-query";
import { Gift, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchStorefrontGame, playStorefrontGame } from "@/lib/gamification.functions";

type PlayResult = {
  repeat: boolean;
  prizeLabel: string;
  prizeValue: number;
  discountCode: string;
};

/**
 * Vitrin oyunlaştırma penceresi: aktif çark veya kazı kazan kampanyasını gösterir.
 * Ödül çekilişi ve indirim kodu üretimi sunucuda yapılır; istemci sadece sonucu gösterir.
 */
export function GamificationPopup({ storeSlug }: { storeSlug: string }) {
  const { data: campaign } = useQuery({
    queryKey: ["storefront-game", storeSlug],
    queryFn: () => fetchStorefrontGame({ data: { storeSlug } }),
    staleTime: 5 * 60 * 1000,
  });

  const storageKey = campaign ? `mefti-game-${campaign.id}` : null;
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [email, setEmail] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<PlayResult | null>(null);

  useEffect(() => {
    if (!storageKey) return;
    setDismissed(window.localStorage.getItem(storageKey) === "done");
  }, [storageKey]);

  useEffect(() => {
    if (!campaign || dismissed) return;
    const timer = setTimeout(
      () => setOpen(true),
      Math.max(0, campaign.showDelaySeconds) * 1000,
    );
    return () => clearTimeout(timer);
  }, [campaign, dismissed]);

  const playMutation = useMutation({
    mutationFn: () =>
      playStorefrontGame({ data: { storeSlug, campaignId: campaign!.id, email } }),
    onMutate: () => setSpinning(true),
    onSuccess: (data) => {
      setTimeout(() => {
        setSpinning(false);
        setResult(data as PlayResult);
        if (storageKey) window.localStorage.setItem(storageKey, "done");
      }, 1800);
    },
    onError: () => setSpinning(false),
  });

  console.log("[game]", { campaign, dismissed, open, storageKey });

  const segments = useMemo(() => campaign?.prizeLabels ?? [], [campaign]);

  if (!campaign || dismissed || !open) return null;

  const close = () => {
    setOpen(false);
    if (storageKey) window.localStorage.setItem(storageKey, "done");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 p-3 sm:items-center">
      <div className="relative w-full max-w-md border border-border bg-card p-5 shadow-lg">
        <button
          type="button"
          onClick={close}
          aria-label="Kapat"
          className="absolute right-3 top-3 text-muted-foreground transition hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-center gap-2">
          <Gift className="size-5 text-brand" />
          <h2 className="text-lg font-semibold">{campaign.headline}</h2>
        </div>

        {campaign.kind === "spin_wheel" ? (
          <div className="mt-4 flex justify-center">
            <div
              className={`relative flex size-40 items-center justify-center rounded-full border-4 border-brand/30 ${
                spinning ? "animate-spin" : ""
              }`}
              style={{
                background:
                  "conic-gradient(var(--color-brand) 0deg 60deg, var(--color-muted) 60deg 120deg, var(--color-brand) 120deg 180deg, var(--color-muted) 180deg 240deg, var(--color-brand) 240deg 300deg, var(--color-muted) 300deg 360deg)",
              }}
            >
              <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold">
                {segments.length} ödül
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex h-28 items-center justify-center border border-dashed border-border bg-muted/40">
            <span className={`text-sm font-semibold ${spinning ? "animate-pulse" : ""}`}>
              {spinning ? "Kazınıyor…" : "Kazı ve ödülünü gör"}
            </span>
          </div>
        )}

        {result ? (
          <div className="mt-4 space-y-2 border border-border bg-muted/30 p-3 text-center">
            <p className="font-semibold">{result.prizeLabel}</p>
            {result.discountCode ? (
              <p className="font-mono text-lg tracking-widest">{result.discountCode}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Bu sefer olmadı, yine bekleriz.</p>
            )}
            {result.repeat ? (
              <p className="text-xs text-muted-foreground">
                Daha önce kazandığınız kod yeniden gösterildi.
              </p>
            ) : null}
            <Button className="w-full" onClick={close}>
              Alışverişe devam et
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <ul className="flex flex-wrap gap-1 text-xs text-muted-foreground">
              {segments.map((label, index) => (
                <li key={index} className="border border-border px-2 py-0.5">
                  {label}
                </li>
              ))}
            </ul>
            <div className="space-y-2">
              <Label htmlFor="game-email">E-posta adresiniz</Label>
              <Input
                id="game-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ornek@eposta.com"
              />
            </div>
            {playMutation.isError ? (
              <p className="text-sm text-destructive">
                {(playMutation.error as Error).message}
              </p>
            ) : null}
            <Button
              className="w-full"
              disabled={!email.includes("@") || spinning || playMutation.isPending}
              onClick={() => playMutation.mutate()}
            >
              {spinning ? "Çekiliyor…" : campaign.ctaLabel}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Katılarak kampanya e-postalarımıza abone olursunuz. Dilediğinizde çıkabilirsiniz.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
