import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Map as MapIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GLOBAL_COUNTRIES } from "@/lib/global-commerce";
import { getGlobalProfitReport } from "@/lib/global-suite.functions";
import { formatMoney } from "@/lib/mefti";

/**
 * Küresel satış ısı haritası ve döviz bazlı gelir raporu.
 * Tüm veriler gerçek ödenmiş siparişlerden gelir; kayıt yoksa boş durum gösterilir.
 */
export function SalesHeatmapPanel({ storeId, baseCurrency }: { storeId: string; baseCurrency: string }) {
  const [days, setDays] = useState(90);

  const { data, isPending, refetch, isFetching } = useQuery({
    queryKey: ["global-sales-heatmap", storeId, days],
    queryFn: () =>
      getGlobalProfitReport({ data: { storeId, days, paymentFeePercent: 3 } } as never),
  });

  const countries = data?.countries ?? [];
  const currencies = data?.currencies ?? [];
  const maxRevenue = countries.reduce((max, row) => Math.max(max, row.revenueTry), 0);

  const countryName = (code: string) =>
    GLOBAL_COUNTRIES.find((entry) => entry.code === code)?.name ?? code;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <MapIcon className="size-4" /> Küresel satış ısı haritası
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ülke bazlı sipariş, ciro ve dönüşüm yoğunluğu. Yeni sipariş ödendiğinde rapor güncellenir.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="heatmap-days">Gün</Label>
            <Input
              id="heatmap-days"
              className="mt-1 w-28"
              inputMode="numeric"
              value={String(days)}
              onChange={(event) => setDays(Math.min(365, Math.max(1, Number(event.target.value) || 30)))}
            />
          </div>
          <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? "Yenileniyor…" : "Yenile"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold">Ülke yoğunluğu</h3>
        {isPending ? (
          <p className="mt-3 text-sm text-muted-foreground">Yükleniyor…</p>
        ) : countries.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Seçilen dönemde ödemesi tamamlanmış sipariş bulunmuyor.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {countries.map((row) => {
              const intensity = maxRevenue > 0 ? row.revenueTry / maxRevenue : 0;
              return (
                <li key={row.country} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">
                      {countryName(row.country)} <span className="text-muted-foreground">({row.country})</span>
                    </span>
                    <span className="text-muted-foreground">
                      {row.orders} sipariş · {formatMoney(row.revenueTry, "TRY")}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(4, Math.round(intensity * 100))}%`, opacity: 0.35 + intensity * 0.65 }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold">En çok ihracat yapılan ülkeler</h3>
          {countries.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Henüz veri yok.</p>
          ) : (
            <ol className="mt-3 space-y-2 text-sm">
              {countries.slice(0, 5).map((row, index) => (
                <li key={row.country} className="flex items-center justify-between gap-3">
                  <span>
                    {index + 1}. {countryName(row.country)}
                  </span>
                  <span className="text-muted-foreground">
                    {formatMoney(row.revenue, baseCurrency)} · net {formatMoney(row.netProfitTry, "TRY")}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold">Döviz bazlı gelir</h3>
          {currencies.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Henüz veri yok.</p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Para birimi</th>
                  <th className="pb-2 font-medium">Sipariş</th>
                  <th className="pb-2 font-medium">Gelir</th>
                  <th className="pb-2 font-medium">TL karşılığı</th>
                </tr>
              </thead>
              <tbody>
                {currencies.map((row) => (
                  <tr key={row.currency} className="border-t">
                    <td className="py-2 font-medium">{row.currency}</td>
                    <td className="py-2 text-muted-foreground">{row.orders}</td>
                    <td className="py-2">{formatMoney(row.revenue, row.currency)}</td>
                    <td className="py-2">{formatMoney(row.revenueTry, "TRY")}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-medium">
                  <td className="py-2">Toplam</td>
                  <td className="py-2" />
                  <td className="py-2" />
                  <td className="py-2">{formatMoney(data?.totals.revenueTry ?? 0, "TRY")}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
