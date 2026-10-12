/**
 * XmlIntegrator panosu: istatistik kartları, 14 günlük trend grafikleri,
 * son 7 günün ürün sonuçları ve gerçek zamanlı besleme durum tablosu.
 */

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowRight, CalendarClock, Download, ListChecks, Radio, Upload } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { CardSkeleton } from "@/components/ui/data-skeleton";
import { LiveRunProgress } from "@/components/xml-integrator/live-run-progress";
import { RunStatusBadge } from "@/components/xml-integrator/shared";

import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/mefti";
import { XML_SCHEDULE_LABELS } from "@/lib/xml-integrator";
import { xmlIntegratorOverviewQuery, xmlIntegratorStatsQuery } from "@/lib/xml-integrator-queries";

const trendConfig = {
  importRuns: { label: "İçe aktarım", color: "var(--chart-1)" },
  exportRuns: { label: "Dışa aktarım", color: "var(--chart-2)" },
} satisfies ChartConfig;

const itemsConfig = {
  successItems: { label: "Başarılı ürün", color: "var(--chart-2)" },
  failedItems: { label: "Hatalı ürün", color: "var(--destructive)" },
} satisfies ChartConfig;

const shortDay = (iso: string) => {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
};

export function XmlIntegratorDashboard({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const overview = useQuery(xmlIntegratorOverviewQuery(storeId));
  const stats = useQuery(xmlIntegratorStatsQuery(storeId));
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Gerçek zamanlı: besleme durumu ve çalışma kayıtları değiştikçe tabloyu yenile.
  useEffect(() => {
    if (!storeId) return;
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["xml-integrator", storeId] });
      setLastUpdated(new Date());
    };
    const channel = supabase
      .channel(`xml-integrator-${storeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "xml_feeds", filter: `store_id=eq.${storeId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "xml_import_logs", filter: `store_id=eq.${storeId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "xml_export_logs", filter: `store_id=eq.${storeId}` }, refresh)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [storeId, queryClient]);

  if (overview.isLoading) return <CardSkeleton />;
  if (overview.error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
        Pano yüklenemedi: {(overview.error as Error).message}
      </div>
    );
  }

  const feeds = overview.data?.feeds ?? [];
  const importFeeds = feeds.filter((feed) => feed.direction === "import");
  const exportFeeds = feeds.filter((feed) => feed.direction === "export");
  const activeFeeds = feeds.filter((feed) => feed.isActive);
  const totals = stats.data?.totals;
  const series = stats.data?.series ?? [];
  const last7 = series.slice(-7);

  const metrics = [
    { label: "Aktif besleme", value: String(activeFeeds.length), hint: `${feeds.length} besleme tanımlı`, icon: ListChecks },
    { label: "Bugünkü çalışma", value: String(totals?.todayRuns ?? 0), hint: "İçe + dışa aktarım", icon: CalendarClock },
    {
      label: "Başarı oranı (14 gün)",
      value: totals?.successRate === null || totals?.successRate === undefined ? "—" : `%${totals.successRate}`,
      hint: `${totals?.successRuns ?? 0}/${totals?.totalRuns ?? 0} çalışma`,
      icon: Activity,
    },
    {
      label: "Besleme dağılımı",
      value: `${importFeeds.length} / ${exportFeeds.length}`,
      hint: "İçe / dışa aktarım",
      icon: Upload,
    },
  ];

  return (
    <div className="space-y-4">
      <LiveRunProgress storeId={storeId} feedNames={new Map(feeds.map((feed) => [feed.id, feed.name]))} />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">

        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border bg-card p-4">
            <metric.icon className="size-4 text-muted-foreground" />
            <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
            <p className="text-xs font-medium text-foreground">{metric.label}</p>
            <p className="text-xs text-muted-foreground">{metric.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button asChild>
          <Link to="/store/$storeId/xml-integrator/feeds/new" params={{ storeId }}>
            Yeni besleme oluştur <ArrowRight className="ml-1 size-4" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/store/$storeId/xml-integrator/feeds" params={{ storeId }}>
            Besleme listesi
          </Link>
        </Button>
      </div>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-medium">14 günlük çalışma trendi</h2>
        <p className="text-xs text-muted-foreground">Günlük içe ve dışa aktarım çalışma sayısı.</p>
        {stats.isLoading ? (
          <div className="mt-3 h-52 animate-pulse rounded-lg bg-muted" />
        ) : (
          <ChartContainer config={trendConfig} className="mt-3 h-52 w-full">
            <ResponsiveContainer>
              <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDay} tickLine={false} axisLine={false} fontSize={11} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={32} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => shortDay(String(value))} />} />
                <Line dataKey="importRuns" type="monotone" stroke="var(--color-importRuns)" strokeWidth={2} dot={false} />
                <Line dataKey="exportRuns" type="monotone" stroke="var(--color-exportRuns)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-medium">Son 7 gün — ürün sonuçları</h2>
        <p className="text-xs text-muted-foreground">Başarıyla işlenen ve hata alan ürün satırları.</p>
        {stats.isLoading ? (
          <div className="mt-3 h-52 animate-pulse rounded-lg bg-muted" />
        ) : (
          <ChartContainer config={itemsConfig} className="mt-3 h-52 w-full">
            <ResponsiveContainer>
              <BarChart data={last7} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDay} tickLine={false} axisLine={false} fontSize={11} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={32} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => shortDay(String(value))} />} />
                <Bar dataKey="successItems" fill="var(--color-successItems)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="failedItems" fill="var(--color-failedItems)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </section>

      <section className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Besleme durumu</h2>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Radio className="size-3 text-primary" />
            {lastUpdated ? `Canlı • ${formatDate(lastUpdated.toISOString())}` : "Canlı takip açık"}
          </span>
        </div>
        {feeds.length ? (
          <div className="mt-3 -mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[520px] text-xs">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Besleme</th>
                  <th className="pb-2 font-medium">Yön</th>
                  <th className="pb-2 font-medium">Sıklık</th>
                  <th className="pb-2 font-medium">Son çalışma</th>
                  <th className="pb-2 font-medium">Durum</th>
                </tr>
              </thead>
              <tbody>
                {feeds.map((feed) => (
                  <tr key={feed.id} className="border-t">
                    <td className="max-w-[180px] truncate py-2 font-medium text-foreground">{feed.name}</td>
                    <td className="py-2 text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        {feed.direction === "import" ? <Upload className="size-3" /> : <Download className="size-3" />}
                        {feed.direction === "import" ? "İçe" : "Dışa"}
                      </span>
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {XML_SCHEDULE_LABELS[feed.schedule as keyof typeof XML_SCHEDULE_LABELS] ?? feed.schedule}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {feed.lastRunAt ? formatDate(feed.lastRunAt) : "Henüz çalışmadı"}
                    </td>
                    <td className="py-2">
                      <RunStatusBadge status={feed.lastStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Henüz besleme yok. "Yeni besleme oluştur" ile başlayın.
          </p>
        )}
        <Button asChild className="mt-3" size="sm" variant="outline">
          <Link to="/store/$storeId/xml-integrator/logs" params={{ storeId }}>
            Kayıt paneline git
          </Link>
        </Button>
      </section>
    </div>
  );
}
