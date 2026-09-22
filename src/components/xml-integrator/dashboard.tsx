/**
 * XmlIntegrator panosu: besleme listesi, durum özetleri ve çalışma kayıtları.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { emptyFeed, FeedSheet, type FeedFormValue } from "@/components/xml-integrator/feed-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/ui/data-skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/mefti";
import { xmlIntegratorOverviewQuery } from "@/lib/xml-integrator-queries";
import { deleteXmlFeed, toggleXmlFeed } from "@/lib/xml-integrator.functions";
import {
  XML_DIRECTION_LABELS,
  XML_PLATFORM_LABELS,
  XML_RUN_STATUS_LABELS,
  XML_SCHEDULE_LABELS,
  type XmlDirection,
  type XmlPlatform,
  type XmlRunStatus,
  type XmlSchedule,
  type XmlSourceFormat,
} from "@/lib/xml-integrator";

export function XmlIntegratorDashboard({ storeId }: { storeId: string }) {
  const client = useQueryClient();
  const overview = useQuery(xmlIntegratorOverviewQuery(storeId));
  const remove = useServerFn(deleteXmlFeed);
  const toggle = useServerFn(toggleXmlFeed);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<FeedFormValue>(emptyFeed);

  const refresh = () => client.invalidateQueries({ queryKey: ["xml-integrator", storeId] });

  const removeMutation = useMutation({
    mutationFn: (feedId: string) => remove({ data: { storeId, feedId } }),
    onSuccess: () => {
      toast.success("Besleme silindi");
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleMutation = useMutation({
    mutationFn: (input: { feedId: string; isActive: boolean }) => toggle({ data: { storeId, ...input } }),
    onSuccess: () => void refresh(),
    onError: (error: Error) => toast.error(error.message),
  });

  if (overview.isLoading) return <CardSkeleton />;
  if (overview.error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
        Besleme listesi yüklenemedi: {(overview.error as Error).message}
      </div>
    );
  }

  const feeds = overview.data?.feeds ?? [];
  const importFeeds = feeds.filter((feed) => feed.direction === "import");
  const exportFeeds = feeds.filter((feed) => feed.direction === "export");
  const importLogs = overview.data?.importLogs ?? [];
  const exportLogs = overview.data?.exportLogs ?? [];

  const openNew = (direction: XmlDirection) => {
    setEditing({ ...emptyFeed, direction });
    setSheetOpen(true);
  };

  const openEdit = (feed: (typeof feeds)[number]) => {
    setEditing({
      id: feed.id,
      name: feed.name,
      direction: feed.direction,
      platform: feed.platform as XmlPlatform,
      sourceFormat: feed.sourceFormat as XmlSourceFormat,
      sourceUrl: feed.sourceUrl ?? "",
      itemPath: feed.itemPath ?? "",
      authType: feed.authType as FeedFormValue["authType"],
      hasCredentials: feed.hasCredentials,
      outputFilename: feed.outputFilename ?? "",
      schedule: feed.schedule as XmlSchedule,
      fieldMapping: feed.fieldMapping,
      currency: feed.currency,
      priceMarkup: feed.priceMarkup,
      isActive: feed.isActive,
    });
    setSheetOpen(true);
  };

  const FeedList = ({ rows, direction }: { rows: typeof feeds; direction: XmlDirection }) =>
    rows.length ? (
      <div className="space-y-2">
        {rows.map((feed) => (
          <article key={feed.id} className="rounded-xl border bg-card p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate font-medium">{feed.name}</h3>
                  <Badge variant="outline">{XML_PLATFORM_LABELS[feed.platform as XmlPlatform]}</Badge>
                  {feed.lastStatus ? (
                    <Badge variant={feed.lastStatus === "failed" ? "destructive" : "secondary"}>
                      {XML_RUN_STATUS_LABELS[feed.lastStatus as XmlRunStatus]}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {feed.sourceUrl ?? feed.outputFilename ?? "—"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {XML_SCHEDULE_LABELS[feed.schedule as XmlSchedule]} ·{" "}
                  {feed.lastRunAt ? `Son çalışma: ${formatDate(feed.lastRunAt)}` : "Henüz çalışmadı"} · {feed.totalRuns} çalışma
                </p>
                {feed.lastError ? <p className="mt-1 text-xs text-destructive">{feed.lastError}</p> : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Switch
                  aria-label={`${feed.name} aktif`}
                  checked={feed.isActive}
                  onCheckedChange={(checked) => toggleMutation.mutate({ feedId: feed.id, isActive: checked })}
                />
                <div className="flex gap-1">
                  <Button size="icon" variant="outline" aria-label="Düzenle" onClick={() => openEdit(feed)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label="Sil"
                    onClick={() => removeMutation.mutate(feed.id)}
                    disabled={removeMutation.isPending}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    ) : (
      <div className="rounded-xl border border-dashed bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">
          {direction === "import"
            ? "Henüz tedarikçi beslemesi eklemediniz."
            : "Henüz pazaryeri çıktısı tanımlamadınız."}
        </p>
        <Button className="mt-4" onClick={() => openNew(direction)}>
          <Plus className="mr-1 size-4" /> Besleme ekle
        </Button>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="outline" onClick={() => openNew("import")}>
          <Upload className="mr-1 size-4" /> Tedarikçi beslemesi ekle
        </Button>
        <Button variant="outline" onClick={() => openNew("export")}>
          <Download className="mr-1 size-4" /> Pazaryeri çıktısı ekle
        </Button>
      </div>

      <Tabs defaultValue="import" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-3">
          <TabsTrigger className="whitespace-normal py-2" value="import">
            İçe aktarım ({importFeeds.length})
          </TabsTrigger>
          <TabsTrigger className="whitespace-normal py-2" value="export">
            Dışa aktarım ({exportFeeds.length})
          </TabsTrigger>
          <TabsTrigger className="whitespace-normal py-2" value="logs">
            Kayıtlar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="mt-0">
          <FeedList rows={importFeeds} direction="import" />
        </TabsContent>
        <TabsContent value="export" className="mt-0">
          <FeedList rows={exportFeeds} direction="export" />
        </TabsContent>
        <TabsContent value="logs" className="mt-0 space-y-4">
          <section className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-medium">{XML_DIRECTION_LABELS.import}</h3>
            {importLogs.length ? (
              <ul className="mt-3 space-y-2 text-xs">
                {importLogs.map((log) => (
                  <li key={String(log["id"])} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t pt-2">
                    <span className="min-w-0 truncate">
                      {formatDate(String(log["started_at"]))} · {Number(log["total_rows"] ?? 0)} satır ·{" "}
                      {Number(log["created_count"] ?? 0)} yeni · {Number(log["updated_count"] ?? 0)} güncel
                    </span>
                    <Badge variant={String(log["status"]) === "failed" ? "destructive" : "secondary"}>
                      {XML_RUN_STATUS_LABELS[String(log["status"]) as XmlRunStatus]}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Henüz içe aktarım çalışması yok.</p>
            )}
          </section>

          <section className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-medium">{XML_DIRECTION_LABELS.export}</h3>
            {exportLogs.length ? (
              <ul className="mt-3 space-y-2 text-xs">
                {exportLogs.map((log) => (
                  <li key={String(log["id"])} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t pt-2">
                    <span className="min-w-0 truncate">
                      {formatDate(String(log["started_at"]))} · {Number(log["exported_count"] ?? 0)} ürün ·{" "}
                      {Number(log["failed_count"] ?? 0)} hatalı
                    </span>
                    <Badge variant={String(log["status"]) === "failed" ? "destructive" : "secondary"}>
                      {XML_RUN_STATUS_LABELS[String(log["status"]) as XmlRunStatus]}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Henüz dışa aktarım çalışması yok.</p>
            )}
          </section>
        </TabsContent>
      </Tabs>

      <FeedSheet
        storeId={storeId}
        open={sheetOpen}
        value={editing}
        onOpenChange={setSheetOpen}
        onSaved={refresh}
      />
    </div>
  );
}
