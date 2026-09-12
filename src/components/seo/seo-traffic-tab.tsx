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
