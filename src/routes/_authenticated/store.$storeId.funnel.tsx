import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Filter } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { funnelQuery } from "@/lib/logistics-queries";
import { formatMoney, formatNumber } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/funnel")({
  head: () => ({
    meta: [
      { title: "Dönüşüm Hunisi — Mefticaret" },
      {
        name: "description",
        content: "Sepet oluşturma, terk edilen sepetler, kurtarılan sepetler ve sipariş dönüşüm oranları.",
      },
      { property: "og:title", content: "Dönüşüm Hunisi — Mefticaret" },
      {
        property: "og:description",
        content: "Sepetten siparişe dönüşüm oranı, kaybedilen sepet değeri ve kurtarma performansı.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FunnelPage,
});

function FunnelPage() {
  const { storeId } = Route.useParams();
  const [windowDays, setWindowDays] = useState(30);
  const { data, isLoading } = useQuery(funnelQuery(storeId, windowDays));
  const funnel = data ?? { carts: 0, recoveredCarts: 0, cartValue: 0, orders: 0, revenue: 0 };

  const totalSessions = funnel.carts + funnel.orders;
  const conversion = totalSessions > 0 ? funnel.orders / totalSessions : 0;
  const recoveryRate = funnel.carts > 0 ? funnel.recoveredCarts / funnel.carts : 0;
  const lostValue = funnel.cartValue;

  const steps = [
    { label: "Sepet oluşturuldu", value: totalSessions },
    { label: "Sipariş verildi", value: funnel.orders },
    { label: "Kurtarılan sepet", value: funnel.recoveredCarts },
  ];
  const maxStep = Math.max(1, ...steps.map((step) => step.value));

  return (
    <AppShell
      storeId={storeId}
      title="Dönüşüm Hunisi"
      description="Sepetten siparişe dönüşüm, kaybedilen sepet değeri ve kurtarma performansı."
    >
      <div className="space-y-6">
        <div className="space-y-1">
          <Label htmlFor="window">Pencere (gün)</Label>
          <Input
            id="window"
            type="number"
            min={7}
            max={365}
            className="w-32"
            value={windowDays}
            onChange={(event) =>
              setWindowDays(Math.min(365, Math.max(7, Number(event.target.value) || 30)))
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Dönüşüm oranı"
            value={`${(conversion * 100).toFixed(1)}%`}
            hint={`${formatNumber(funnel.orders)} sipariş / ${formatNumber(totalSessions)} sepet`}
          />
          <Kpi label="Ciro" value={formatMoney(funnel.revenue)} hint="Dönem toplamı" />
          <Kpi label="Kayıp sepet değeri" value={formatMoney(lostValue)} hint={`${formatNumber(funnel.carts)} terk edilmiş sepet`} />
          <Kpi
            label="Kurtarma oranı"
            value={`${(recoveryRate * 100).toFixed(1)}%`}
            hint={`${formatNumber(funnel.recoveredCarts)} sepet siparişe döndü`}
          />
        </div>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Filter className="size-4 text-primary" /> Huni adımları
          </h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Yükleniyor…</p>
          ) : (
            <ul className="space-y-4">
              {steps.map((step) => (
                <li key={step.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{step.label}</span>
                    <span className="text-muted-foreground">{formatNumber(step.value)}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.round((step.value / maxStep) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
