import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, Loader2, Rocket, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SoftCard } from "@/components/homemaker/kolay-parts";
import { Button } from "@/components/ui/button";
import { homeMakerProfileQuery } from "@/lib/home-maker-queries";
import { upgradeHomeMakerToCorporate } from "@/lib/home-maker.functions";

/**
 * "Mağazam" sekmesindeki yükseltme kartı. Yükseltme yalnızca panel türünü ve
 * rolü değiştirir; mağaza/ürün/sipariş kayıtları aynı kimliklerle korunur.
 */
export function UpgradeCard({ storeId }: { storeId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const profileQuery = useQuery(homeMakerProfileQuery());
  const upgradeFn = useServerFn(upgradeHomeMakerToCorporate);

  const upgrade = useMutation({
    mutationFn: () => upgradeFn(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["home-maker-profile"] });
      setConfirmOpen(false);
      toast.success("Kurumsal panel açıldı. Tüm ürün ve siparişleriniz aktarıldı.");
      await navigate({ to: "/store/$storeId/dashboard", params: { storeId } });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Yükseltme yapılamadı, tekrar deneyin."),
  });

  const profile = profileQuery.data;
  if (!profile) return null;

  const isCorporate = profile.panel_mode === "corporate";

  return (
    <SoftCard className="grid gap-3 border-hm-teal/40 bg-hm-teal/5">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-hm-teal/15 text-hm-teal">
          <Rocket className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-hm-ink-soft">
            Mevcut paketiniz
          </p>
          <p className="text-base font-semibold text-hm-ink">
            {isCorporate ? "Kurumsal Mefticaret Paneli" : "Ev Hanımı Mikro Paket (Sade Panel)"}
          </p>
          <p className="mt-1 text-sm text-hm-ink-soft">
            {isCorporate
              ? "Tüm kurumsal özellikler açık. Sade panele buradan devam edebilirsiniz."
              : "Kurumsal panelde kargo entegrasyonu, faturalar, kampanyalar ve raporlar açılır."}
          </p>
        </div>
      </div>

      {isCorporate ? (
        <Button
          onClick={() => void navigate({ to: "/store/$storeId/dashboard", params: { storeId } })}
          className="h-14 rounded-2xl bg-hm-teal text-base font-semibold text-white hover:bg-hm-teal/90"
        >
          Kurumsal panele git <ArrowUpRight className="ml-1 size-4" />
        </Button>
      ) : confirmOpen ? (
        <div className="grid gap-3 rounded-2xl border border-hm-line bg-white p-4">
          <p className="text-sm font-medium text-hm-ink">Kurumsal panele geçmek istediğinize emin misiniz?</p>
          <ul className="grid gap-1.5 text-sm text-hm-ink-soft">
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-hm-emerald" /> Mağazanız, ürünleriniz ve
              siparişleriniz aynen kalır.
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-hm-emerald" /> Sade panele dilediğiniz zaman
              geri dönebilirsiniz.
            </li>
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              className="h-14 rounded-2xl border-hm-line text-base"
              disabled={upgrade.isPending}
            >
              Vazgeç
            </Button>
            <Button
              onClick={() => upgrade.mutate()}
              disabled={upgrade.isPending}
              className="h-14 rounded-2xl bg-hm-teal text-base font-semibold text-white hover:bg-hm-teal/90"
            >
              {upgrade.isPending ? <Loader2 className="size-5 animate-spin" /> : "Evet, yükselt"}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          onClick={() => setConfirmOpen(true)}
          className="h-14 rounded-2xl bg-hm-teal text-base font-semibold text-white hover:bg-hm-teal/90"
        >
          Kurumsal Mefticaret Paneline Yükselt <ArrowUpRight className="ml-1 size-4" />
        </Button>
      )}
    </SoftCard>
  );
}
