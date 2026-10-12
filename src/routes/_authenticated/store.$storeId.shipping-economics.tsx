import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PackageCheck, Truck } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney, formatNumber } from "@/lib/mefti";
import { basketBands, shippingSummary, thresholdScenarios } from "@/lib/shipping-economics";
import { shippingEconomicsQuery } from "@/lib/shipping-economics-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/shipping-economics")({
  head: () => ({
    meta: [
      { title: "Kargo Ekonomisi — Mefticaret" },
      {
        name: "description",
        content:
          "Ücretsiz kargo eşiği optimizasyonu, kargo gideri karşılama oranı ve sepet dağılımına göre senaryo analizi.",
      },
      { property: "og:title", content: "Kargo Ekonomisi — Mefticaret" },
      {
        property: "og:description",
        content: "Hangi ücretsiz kargo eşiği en yüksek net katkıyı üretir? Sepet bandı analizi ile hesapla.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShippingEconomicsPage,
});

function ShippingEconomicsPage() {
  const { storeId } = Route.useParams();
  const [days, setDays] = useState(90);
  const [unitCost, setUnitCost] = useState(60);
  const [shippingPrice, setShippingPrice] = useState(50);
  const [nudgeRate, setNudgeRate] = useState(35);

  const { data, isLoading } = useQuery(shippingEconomicsQuery(storeId, days));
  const orders = data ?? [];

  const summary = useMemo(() => shippingSummary(orders, unitCost), [orders, unitCost]);
  const scenarios = useMemo(
    () => thresholdScenarios(orders, unitCost, shippingPrice, nudgeRate / 100),
    [orders, unitCost, shippingPrice, nudgeRate],
  );
  const bands = useMemo(() => basketBands(orders), [orders]);
  const best = useMemo(
    () => [...scenarios].sort((a, b) => b.netImpact - a.netImpact)[0] ?? null,
    [scenarios],
  );
  const maxBand = Math.max(1, ...bands.map((band) => band.orders));

  return (
    <AppShell
      storeId={storeId}
      title="Kargo Ekonomisi"
      description="Kargo giderinin karşılanma oranını ölç, en kârlı ücretsiz kargo eşiğini belirle."
    >
      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Dönem (gün)" value={days} onChange={setDays} min={7} max={365} />
          <Field label="Kargo birim gideri" value={unitCost} onChange={setUnitCost} min={0} max={2000} />
          <Field
            label="Müşteriden alınan kargo"
            value={shippingPrice}
            onChange={setShippingPrice}
            min={0}
            max={2000}
          />
          <Field label="Yukarı çekme oranı (%)" value={nudgeRate} onChange={setNudgeRate} min={0} max={100} />
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Kargo verisi hesaplanıyor…</p>
        ) : orders.length === 0 ? (
          <p className="text-muted-foreground text-sm">Bu dönemde sipariş bulunamadı.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Sipariş" value={formatNumber(summary.orders)} hint={`Ort. sepet ${formatMoney(summary.averageOrderValue)}`} />
              <Kpi label="Kargo geliri" value={formatMoney(summary.shippingRevenue)} hint={`Gider ${formatMoney(summary.shippingCost)}`} />
              <Kpi
                label="Kargo net katkı"
                value={formatMoney(summary.shippingMargin)}
                hint={summary.shippingMargin < 0 ? "Kargo zarar yazıyor" : "Kargo kendini karşılıyor"}
              />
              <Kpi
                label="Ücretsiz kargo payı"
                value={`%${summary.freeShareRate.toFixed(1)}`}
                hint={`Gider/ciro %${summary.shippingCostRate.toFixed(1)}`}
              />
            </div>

            {best ? (
              <section className="rounded-xl border p-5">
                <h3 className="font-display flex items-center gap-2 text-lg">
                  <PackageCheck className="size-4 text-primary" /> Önerilen eşik
                </h3>
                <p className="mt-2 text-sm">
                  <strong>{formatMoney(best.threshold)}</strong> eşiği ile net katkı{" "}
                  <strong>{formatMoney(best.netImpact)}</strong>. Siparişlerin %
                  {best.qualifyingRate.toFixed(1)}'i eşiği zaten geçiyor, {formatNumber(Math.round(best.nudgeable))}{" "}
                  sipariş yukarı çekilebilir ve {formatMoney(best.upliftRevenue)} ek ciro üretir.
                </p>
              </section>
            ) : null}

            <section className="space-y-3">
              <h3 className="font-display flex items-center gap-2 text-lg">
                <Truck className="size-4 text-primary" /> Eşik senaryoları
              </h3>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-3">Eşik</th>
                      <th className="p-3 text-right">Eşiği geçen</th>
                      <th className="p-3 text-right">Çekilebilir</th>
                      <th className="p-3 text-right">Ek ciro</th>
                      <th className="p-3 text-right">Kargo gideri</th>
                      <th className="p-3 text-right">Tahsil edilen</th>
                      <th className="p-3 text-right">Net etki</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarios.map((scenario) => (
                      <tr key={scenario.threshold} className="border-t">
                        <td className="p-3 font-medium">
                          {formatMoney(scenario.threshold)}
                          {best && scenario.threshold === best.threshold ? (
                            <Badge className="ml-2">önerilen</Badge>
                          ) : null}
                        </td>
                        <td className="p-3 text-right">
                          {formatNumber(scenario.qualifying)} (%{scenario.qualifyingRate.toFixed(0)})
                        </td>
                        <td className="p-3 text-right">{formatNumber(Math.round(scenario.nudgeable))}</td>
                        <td className="p-3 text-right">{formatMoney(scenario.upliftRevenue)}</td>
                        <td className="p-3 text-right">{formatMoney(scenario.freeShippingCost)}</td>
                        <td className="p-3 text-right">{formatMoney(scenario.collectedShipping)}</td>
                        <td className="p-3 text-right">
                          <span className={scenario.netImpact < 0 ? "text-destructive" : undefined}>
                            {formatMoney(scenario.netImpact)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg">Sepet dağılımı</h3>
              <div className="space-y-3 rounded-xl border p-5">
                {bands.map((band) => (
                  <div key={band.label} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{band.label}</span>
                      <span className="text-muted-foreground">
                        {formatNumber(band.orders)} sipariş · %{band.share.toFixed(1)} ·{" "}
                        {formatMoney(band.revenue)}
                      </span>
                    </div>
                    <div className="bg-muted h-3 overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${Math.round((band.orders / maxBand) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}) {
  const id = label.replace(/\s+/g, "-").toLowerCase();
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value) || 0)))}
      />
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p>
      <p className="font-display mt-2 text-2xl">{value}</p>
      {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}
