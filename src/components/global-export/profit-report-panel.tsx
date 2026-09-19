import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Megaphone, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCampaignStorefrontReport } from "@/lib/email-marketing.functions";
import { getGlobalProfitReport } from "@/lib/global-suite.functions";
import { formatMoney } from "@/lib/mefti";


/** Döviz bazlı gelir ve net kârlılık raporu — gerçek ödenmiş siparişlerden hesaplanır. */
export function ProfitReportPanel({ storeId, baseCurrency }: { storeId: string; baseCurrency: string }) {
  const [days, setDays] = useState(90);
  const [feePercent, setFeePercent] = useState("3");

  const { data, isPending, refetch } = useQuery({
    queryKey: ["global-profit-report", storeId, days, feePercent],
    queryFn: () =>
      getGlobalProfitReport({
        data: { storeId, days, paymentFeePercent: Number(feePercent) || 0 },
      } as never),
  });

  const campaigns = useQuery({
    queryKey: ["campaign-storefront-report", storeId, days],
    queryFn: () => getCampaignStorefrontReport({ data: { storeId, days } } as never),
  });



  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <TrendingUp className="size-4" /> Net kârlılık
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ciro, ürün maliyeti, uluslararası kargo gideri ve ödeme komisyonu düşülerek hesaplanır.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="profit-days">Gün</Label>
            <Input
              id="profit-days"
              className="mt-1"
              inputMode="numeric"
              value={String(days)}
              onChange={(event) => setDays(Number(event.target.value) || 30)}
            />
          </div>
          <div>
            <Label htmlFor="profit-fee">Ödeme komisyonu (%)</Label>
            <Input
              id="profit-fee"
              className="mt-1"
              inputMode="decimal"
              value={feePercent}
              onChange={(event) => setFeePercent(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => void refetch()}>
              Yenile
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        {isPending ? (
          <p className="text-sm text-muted-foreground">Rapor hesaplanıyor…</p>
        ) : !data || data.countries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Seçili dönemde ödemesi tamamlanmış sipariş bulunamadı.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Sipariş</p>
                <p className="text-lg font-semibold">{data.totalOrders}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Ciro</p>
                <p className="text-lg font-semibold">{formatMoney(data.totals.revenue, baseCurrency)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Net kâr (TL)</p>
                <p className="text-lg font-semibold">{formatMoney(data.totals.netProfitTry, "TRY")}</p>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2">Ülke</th>
                    <th className="py-2">Sipariş</th>
                    <th className="py-2">Ciro</th>
                    <th className="py-2">Maliyet</th>
                    <th className="py-2">Kargo</th>
                    <th className="py-2">Net kâr</th>
                    <th className="py-2">Marj</th>
                  </tr>
                </thead>
                <tbody>
                  {data.countries.map((row) => (
                    <tr key={row.country} className="border-b last:border-0">
                      <td className="py-2 font-medium">{row.country}</td>
                      <td className="py-2">{row.orders}</td>
                      <td className="py-2">{formatMoney(row.revenue, baseCurrency)}</td>
                      <td className="py-2">{formatMoney(row.cogs, baseCurrency)}</td>
                      <td className="py-2">{formatMoney(row.shipping, baseCurrency)}</td>
                      <td className="py-2">{formatMoney(row.netProfit, baseCurrency)}</td>
                      <td className="py-2">{row.marginPercent.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Megaphone className="size-4" /> Kampanya tıklama cirosu
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Vitrinde yayınlanan kampanya bantlarının görüntülenme ve tıklamaları; ciro, kampanya
          indirim kodu ile ödemesi tamamlanan gerçek siparişlerden hesaplanır.
        </p>
        {campaigns.isPending ? (
          <p className="mt-4 text-sm text-muted-foreground">Kampanya verisi hesaplanıyor…</p>
        ) : !campaigns.data || campaigns.data.campaigns.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Vitrinde yayınlanmış kampanya yok. E-posta Pazarlama ekranından bir kampanyayı vitrine açın.
          </p>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Görüntülenme</p>
                <p className="text-lg font-semibold">{campaigns.data.totals.views}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Tıklama</p>
                <p className="text-lg font-semibold">{campaigns.data.totals.clicks}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Sipariş</p>
                <p className="text-lg font-semibold">{campaigns.data.totals.orders}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Kampanya cirosu</p>
                <p className="text-lg font-semibold">
                  {formatMoney(campaigns.data.totals.revenue, baseCurrency)}
                </p>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2">Kampanya</th>
                    <th className="py-2">Kod</th>
                    <th className="py-2">Görüntülenme</th>
                    <th className="py-2">Tıklama</th>
                    <th className="py-2">TO</th>
                    <th className="py-2">Sipariş</th>
                    <th className="py-2">Ciro</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.data.campaigns.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{row.name}</td>
                      <td className="py-2 font-mono text-xs uppercase">{row.discountCode || "—"}</td>
                      <td className="py-2">{row.views}</td>
                      <td className="py-2">{row.clicks}</td>
                      <td className="py-2">{row.ctr.toFixed(1)}%</td>
                      <td className="py-2">{row.orders}</td>
                      <td className="py-2">{formatMoney(row.revenue, baseCurrency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
