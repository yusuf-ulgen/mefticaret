/**
 * Kayıt paneli: içe ve dışa aktarım çalışmalarının geçmişi.
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/ui/data-skeleton";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DeltaEfficiencyBadge,
  ErrorCategoryBadges,
  LiveRunProgress,
  RunStat,
} from "@/components/xml-integrator/live-run-progress";
import { RunStatusBadge } from "@/components/xml-integrator/shared";

import { formatDate } from "@/lib/mefti";
import { xmlIntegratorOverviewQuery } from "@/lib/xml-integrator-queries";

export function XmlLogsPanel({ storeId }: { storeId: string }) {
  const overview = useQuery(xmlIntegratorOverviewQuery(storeId));
  const [feedFilter, setFeedFilter] = useState("");

  const feeds = overview.data?.feeds ?? [];
  const feedName = useMemo(
    () => new Map(feeds.map((feed) => [feed.id, feed.name])),
    [feeds],
  );

  if (overview.isLoading) return <CardSkeleton />;
  if (overview.error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
        Kayıtlar yüklenemedi: {(overview.error as Error).message}
      </div>
    );
  }

  const match = (log: Record<string, unknown>) => !feedFilter || String(log["feed_id"]) === feedFilter;
  const importLogs = (overview.data?.importLogs ?? []).filter(match);
  const exportLogs = (overview.data?.exportLogs ?? []).filter(match);

  return (
    <div className="space-y-4">
      <LiveRunProgress storeId={storeId} feedNames={feedName} />

      <div className="space-y-1">

        <Label htmlFor="log-feed">Besleme</Label>
        <select
          id="log-feed"
          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          value={feedFilter}
          onChange={(event) => setFeedFilter(event.target.value)}
        >
          <option value="">Tümü</option>
          {feeds.map((feed) => (
            <option key={feed.id} value={feed.id}>{feed.name}</option>
          ))}
        </select>
      </div>

      <Tabs defaultValue="import" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2">
          <TabsTrigger className="whitespace-normal py-2" value="import">
            İçe aktarım ({importLogs.length})
          </TabsTrigger>
          <TabsTrigger className="whitespace-normal py-2" value="export">
            Dışa aktarım ({exportLogs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="mt-0 space-y-2">
          {importLogs.length ? (
            importLogs.map((log) => (
              <article key={String(log["id"])} className="rounded-xl border bg-card p-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{feedName.get(String(log["feed_id"])) ?? "—"}</span>
                  <RunStatusBadge status={String(log["status"])} />
                  <Badge variant="outline">{formatDate(String(log["started_at"]))}</Badge>
                </div>
                <p className="mt-2 text-muted-foreground">
                  {Number(log["total_rows"] ?? 0)} satır okundu
                  {log["duration_seconds"] ? ` · ${Number(log["duration_seconds"])} sn` : ""}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <RunStat label="Yeni" value={Number(log["created_count"] ?? 0)} />
                  <RunStat label="Güncellendi" value={Number(log["updated_count"] ?? 0)} />
                  <RunStat label="Değişmeyen (atlandı)" value={Number(log["unchanged_count"] ?? 0)} />
                  <RunStat
                    label="Hatalı"
                    value={Number(log["error_count"] ?? 0)}
                    tone={Number(log["error_count"] ?? 0) > 0 ? "error" : "default"}
                  />
                </div>
                <DeltaEfficiencyBadge
                  totalRows={Number(log["total_rows"] ?? 0)}
                  unchanged={Number(log["unchanged_count"] ?? 0)}
                  active={log["delta_sync_enabled"] === null ? null : Boolean(log["delta_sync_enabled"])}
                />
                <ErrorCategoryBadges value={log["error_categories"]} />
                {log["error_message"] ? (
                  <p className="mt-1 text-destructive">{String(log["error_message"])}</p>
                ) : null}

              </article>
            ))
          ) : (
            <p className="rounded-xl border border-dashed bg-card p-8 text-center text-xs text-muted-foreground">
              Henüz içe aktarım çalışması yok.
            </p>
          )}
        </TabsContent>

        <TabsContent value="export" className="mt-0 space-y-2">
          {exportLogs.length ? (
            exportLogs.map((log) => (
              <article key={String(log["id"])} className="rounded-xl border bg-card p-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{feedName.get(String(log["feed_id"])) ?? "—"}</span>
                  <RunStatusBadge status={String(log["status"])} />
                  <Badge variant="outline">{formatDate(String(log["started_at"]))}</Badge>
                </div>
                <p className="mt-2 text-muted-foreground">
                  {Number(log["exported_count"] ?? 0)} ürün · {Number(log["failed_count"] ?? 0)} hatalı
                  {log["file_size_bytes"] ? ` · ${Math.round(Number(log["file_size_bytes"]) / 1024)} KB` : ""}
                </p>
                {log["error_message"] ? (
                  <p className="mt-1 text-destructive">{String(log["error_message"])}</p>
                ) : null}
              </article>
            ))
          ) : (
            <p className="rounded-xl border border-dashed bg-card p-8 text-center text-xs text-muted-foreground">
              Henüz dışa aktarım çalışması yok.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
