import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  analyticsEventsQuery,
  analyticsRangeOrdersQuery,
  summarizeEvents,
} from "@/lib/analytics-events-queries";
import { buildRange, RANGE_PRESETS, type RangePreset } from "@/lib/analytics-range";
import { formatNumber, formatPercent } from "@/lib/mefti";
import { Metric } from "@/components/seo/seo-shared";
import { seoEntitiesQuery } from "@/lib/seo-entities-queries";

const SOURCE_LABELS: Record<string, string> = {
  organic: "Organik arama",
  direct: "Doğrudan",
  referral: "Yönlendirme",
  social: "Sosyal medya",
  paid: "Reklam",
  email: "E-posta",
  bilinmiyor: "Bilinmiyor",
};

/** SEO Merkezi trafik sekmesi: organik ziyaret, dönüşüm ve kanal kırılımı. */
export function SeoTrafficTab({ storeId }: { storeId: string }) {
  const [preset, setPreset] = useState<RangePreset>("30d");
  const range = useMemo(() => buildRange(preset, "", ""), [preset]);

  const { data: events, isLoading } = useQuery(analyticsEventsQuery(storeId, range));
  const { data: orders } = useQuery(analyticsRangeOrdersQuery(storeId, range));

  const revenue = (orders ?? []).reduce((total, row) => total + Number(row.grand_total ?? 0), 0);
  const traffic = useMemo(
    () => summarizeEvents(events ?? [], revenue, (orders ?? []).length),
    [events, revenue, orders],
  );

  const { data: entities } = useQuery(seoEntitiesQuery(storeId));
  const productTitles = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of entities ?? []) if (row.kind === "product") map.set(row.id, row.title);
    return map;
  }, [entities]);

  /** Ürün sayfası tıklamaları: gerçek product_view olayları, sepet ve satın alma dönüşümü. */
  const productClicks = useMemo(() => {
    const rows = new Map<
      string,
      { id: string; views: number; organic: number; carts: number; purchases: number }
    >();
    const pick = (id: string) => {
      const existing = rows.get(id);
      if (existing) return existing;
      const created = { id, views: 0, organic: 0, carts: 0, purchases: 0 };
      rows.set(id, created);
      return created;
    };
    for (const event of events ?? []) {
      if (!event.product_id) continue;
      const row = pick(event.product_id);
      if (event.kind === "product_view") {
        row.views += 1;
        if (event.source === "organic") row.organic += 1;
      }
      if (event.kind === "add_to_cart") row.carts += 1;
      if (event.kind === "purchase") row.purchases += 1;
    }
    return [...rows.values()]
      .map((row) => ({
        ...row,
        title: productTitles.get(row.id) ?? "Bilinmeyen ürün",
        conversion: row.views > 0 ? (row.purchases / row.views) * 100 : 0,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 15);
  }, [events, productTitles]);

  const organic = traffic.sources.find((row) => row.key === "organic")?.count ?? 0;
  const organicShare = traffic.sessions > 0 ? (organic / traffic.sessions) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {RANGE_PRESETS.filter((item) => item.id !== "custom").map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={preset === item.id ? "default" : "outline"}
            onClick={() => setPreset(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Trafik verisi yükleniyor…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Ziyaretçi" value={formatNumber(traffic.visitors)} hint={`${formatNumber(traffic.sessions)} oturum`} />
            <Metric
              label="Organik oturum"
              value={formatNumber(organic)}
              hint={`Tüm trafiğin %${organicShare.toFixed(1)}'i`}
            />
            <Metric
              label="Dönüşüm oranı"
              value={formatPercent(traffic.conversion)}
              hint={`${formatNumber(traffic.purchaseSessions)} satın alan oturum`}
            />
            <Metric
              label="Sayfa / oturum"
              value={traffic.pagesPerSession.toFixed(1)}
              hint={`Çıkış oranı ${formatPercent(traffic.bounceRate)}`}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Breakdown
              title="Trafik kaynakları"
              rows={traffic.sources.map((row) => [SOURCE_LABELS[row.key] ?? row.key, row.count] as [string, number])}
              total={traffic.sessions}
            />
            <Breakdown
              title="Yönlendiren siteler"
              rows={traffic.referrers.map((row) => [row.key, row.count] as [string, number])}
              total={traffic.sessions}
            />
            <Breakdown
              title="En çok görüntülenen sayfalar"
              rows={traffic.topPages.map((row) => [row.key, row.count] as [string, number])}
              total={traffic.pageViews}
            />
            <Breakdown
              title="Ülkeler"
              rows={traffic.countries.map((row) => [row.key, row.count] as [string, number])}
              total={traffic.sessions}
            />
          </div>

          <div className="surface-card space-y-3 p-5">
            <div>
              <h3 className="text-sm font-semibold">Ürün sayfası tıklamaları</h3>
              <p className="text-xs text-muted-foreground">
                Vitrinde kaydedilen gerçek ürün görüntüleme, sepete ekleme ve satın alma olayları.
              </p>
            </div>
            {productClicks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Bu dönemde ürün sayfası tıklaması kaydedilmedi.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px] text-sm">
                  <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-2 text-left font-medium">Ürün</th>
                      <th className="py-2 text-right font-medium">Tıklama</th>
                      <th className="py-2 text-right font-medium">Organik</th>
                      <th className="py-2 text-right font-medium">Sepet</th>
                      <th className="py-2 text-right font-medium">Satış</th>
                      <th className="py-2 text-right font-medium">Dönüşüm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productClicks.map((row) => (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="max-w-[240px] truncate py-2 pr-3">{row.title}</td>
                        <td className="py-2 text-right">{formatNumber(row.views)}</td>
                        <td className="py-2 text-right">{formatNumber(row.organic)}</td>
                        <td className="py-2 text-right">{formatNumber(row.carts)}</td>
                        <td className="py-2 text-right">{formatNumber(row.purchases)}</td>
                        <td className="py-2 text-right">{formatPercent(row.conversion)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </>
      )}
    </div>
  );
}

function Breakdown({
  title,
  rows,
  total,
}: {
  title: string;
  rows: [string, number][];
  total: number;
}) {
  return (
    <div className="surface-card space-y-3 p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Bu dönemde veri yok.</p>
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 8).map(([label, count]) => (
            <div key={label} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate">{label}</span>
              <Badge variant="outline">{formatNumber(count)}</Badge>
              <span className="w-14 text-right text-xs text-muted-foreground">
                {total > 0 ? `${((count / total) * 100).toFixed(1)}%` : "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
