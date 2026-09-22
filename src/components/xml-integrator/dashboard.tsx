/**
 * XmlIntegrator panosu: özet sayılar, son çalışma durumları ve hızlı geçişler.
 */

import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Download, ListChecks, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/ui/data-skeleton";
import { RunStatusBadge } from "@/components/xml-integrator/shared";
import { formatDate } from "@/lib/mefti";
import { xmlIntegratorOverviewQuery } from "@/lib/xml-integrator-queries";

export function XmlIntegratorDashboard({ storeId }: { storeId: string }) {
  const overview = useQuery(xmlIntegratorOverviewQuery(storeId));

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
  const importLogs = overview.data?.importLogs ?? [];
  const exportLogs = overview.data?.exportLogs ?? [];
  const failing = feeds.filter((feed) => feed.lastStatus === "failed");

  const metrics = [
    { label: "Tedarikçi beslemesi", value: importFeeds.length, icon: Upload },
    { label: "Pazaryeri çıktısı", value: exportFeeds.length, icon: Download },
    { label: "Aktif besleme", value: feeds.filter((feed) => feed.isActive).length, icon: ListChecks },
    { label: "Hatalı son çalışma", value: failing.length, icon: ListChecks },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border bg-card p-4">
            <metric.icon className="size-4 text-muted-foreground" />
            <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
            <p className="text-xs text-muted-foreground">{metric.label}</p>
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
        <h2 className="text-sm font-medium">Son çalışmalar</h2>
        {feeds.length ? (
          <ul className="mt-3 space-y-2 text-xs">
            {feeds.slice(0, 6).map((feed) => (
              <li key={feed.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t pt-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">{feed.name}</span>
                  <span className="text-muted-foreground">
                    {feed.lastRunAt ? formatDate(feed.lastRunAt) : "Henüz çalışmadı"}
                  </span>
                </span>
                <RunStatusBadge status={feed.lastStatus} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Henüz besleme yok. "Yeni besleme oluştur" ile başlayın.
          </p>
        )}
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-medium">Kayıt özeti</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          {importLogs.length} içe aktarım, {exportLogs.length} dışa aktarım kaydı tutuluyor.
        </p>
        <Button asChild className="mt-3" size="sm" variant="outline">
          <Link to="/store/$storeId/xml-integrator/logs" params={{ storeId }}>
            Kayıt paneline git
          </Link>
        </Button>
      </section>
    </div>
  );
}
