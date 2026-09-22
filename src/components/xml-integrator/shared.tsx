/**
 * XmlIntegrator ekranlarının paylaşılan parçaları: sekme çubuğu, besleme
 * satırı, durum etiketi ve besleme formu tipleri.
 */

import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, Pencil, Play, SlidersHorizontal as Sliders, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatDate } from "@/lib/mefti";
import { deleteXmlFeed, runXmlFeedNow, toggleXmlFeed } from "@/lib/xml-integrator.functions";
import {
  XML_PLATFORM_LABELS,
  XML_RUN_STATUS_LABELS,
  XML_SCHEDULE_LABELS,
  type XmlPlatform,
  type XmlRunStatus,
  type XmlSchedule,
} from "@/lib/xml-integrator";
import type { getXmlIntegratorOverview } from "@/lib/xml-integrator.functions";

export type XmlOverview = Awaited<ReturnType<typeof getXmlIntegratorOverview>>;
export type XmlFeedRow = XmlOverview["feeds"][number];

/** Modül içi gezinme sekmeleri. */
export function XmlIntegratorTabs({ storeId }: { storeId: string }) {
  const linkClass = "rounded-full border px-3 py-1.5 text-sm whitespace-nowrap";
  const active = { className: `${linkClass} bg-foreground text-background` };
  const inactive = { className: `${linkClass} bg-card text-muted-foreground hover:text-foreground` };
  return (
    <nav className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
      <Link to="/store/$storeId/xml-integrator" params={{ storeId }} activeOptions={{ exact: true }} activeProps={active} inactiveProps={inactive}>
        Pano
      </Link>
      <Link to="/store/$storeId/xml-integrator/feeds" params={{ storeId }} activeOptions={{ exact: true }} activeProps={active} inactiveProps={inactive}>
        Beslemeler
      </Link>
      <Link to="/store/$storeId/xml-integrator/feeds/new" params={{ storeId }} activeProps={active} inactiveProps={inactive}>
        Yeni besleme
      </Link>
      <Link to="/store/$storeId/xml-integrator/logs" params={{ storeId }} activeProps={active} inactiveProps={inactive}>
        Kayıtlar
      </Link>
    </nav>
  );
}

export function RunStatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="outline">Çalışmadı</Badge>;
  return (
    <Badge variant={status === "failed" ? "destructive" : status === "partial" ? "outline" : "secondary"}>
      {XML_RUN_STATUS_LABELS[status as XmlRunStatus] ?? status}
    </Badge>
  );
}

/** Yön rozeti: içe aktarım yeşil, dışa aktarım mavi. */
export function DirectionBadge({ direction }: { direction: string }) {
  const isImport = direction === "import";
  return (
    <span
      className={
        isImport
          ? "inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success"
          : "inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-xs font-medium text-info"
      }
    >
      {isImport ? <Upload className="size-3" /> : <Download className="size-3" />}
      {isImport ? "İçe aktarım" : "Dışa aktarım"}
    </span>
  );
}

const PLATFORM_MARKS: Record<string, { short: string; className: string }> = {
  trendyol: { short: "ty", className: "bg-platform-trendyol/12 text-platform-trendyol" },
  hepsiburada: { short: "hb", className: "bg-platform-hepsiburada/12 text-platform-hepsiburada" },
  n11: { short: "n11", className: "bg-platform-n11/12 text-platform-n11" },
  amazon: { short: "az", className: "bg-platform-amazon/12 text-platform-amazon" },
  ciceksepeti: { short: "çs", className: "bg-platform-n11/12 text-platform-n11" },
  pttavm: { short: "ptt", className: "bg-platform-amazon/12 text-platform-amazon" },
  google_shopping: { short: "g", className: "bg-info/12 text-info" },
  generic: { short: "xml", className: "bg-platform-generic/12 text-platform-generic" },
};

/** Platform işareti: kısa kod + platform adı. */
export function PlatformMark({ platform }: { platform: string }) {
  const mark = PLATFORM_MARKS[platform] ?? PLATFORM_MARKS["generic"]!;
  const label = XML_PLATFORM_LABELS[platform as XmlPlatform] ?? platform;
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className={`grid size-7 shrink-0 place-items-center rounded-md text-[10px] font-bold uppercase ${mark.className}`}
      >
        {mark.short}
      </span>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </span>
  );
}

/** Liste satırı: yön rozeti, platform işareti, aç/kapat, çalıştır, eşleştirme, silme. */
export function FeedCard({
  storeId,
  feed,
  onEdit,
}: {
  storeId: string;
  feed: XmlFeedRow;
  onEdit?: () => void;
}) {
  const client = useQueryClient();
  const remove = useServerFn(deleteXmlFeed);
  const toggle = useServerFn(toggleXmlFeed);
  const refresh = () => client.invalidateQueries({ queryKey: ["xml-integrator", storeId] });

  const removeMutation = useMutation({
    mutationFn: () => remove({ data: { storeId, feedId: feed.id } }),
    onSuccess: () => {
      toast.success("Besleme silindi");
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleMutation = useMutation({
    mutationFn: (isActive: boolean) => toggle({ data: { storeId, feedId: feed.id, isActive } }),
    onSuccess: () => void refresh(),
    onError: (error: Error) => toast.error(error.message),
  });

  const run = useServerFn(runXmlFeedNow);
  const runMutation = useMutation({
    mutationFn: () => run({ data: { storeId, feedId: feed.id } }),
    onSuccess: (result) => {
      toast.success(`Besleme çalıştı — ${result.totalRows} satır okundu`);
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <article className="rounded-xl border bg-card p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <DirectionBadge direction={feed.direction} />
            <h3 className="truncate font-medium">{feed.name}</h3>
            <RunStatusBadge status={feed.lastStatus} />
          </div>
          <div className="mt-2">
            <PlatformMark platform={feed.platform} />
          </div>
          <p className="mt-2 truncate text-xs text-muted-foreground">
            {feed.sourceUrl ?? feed.outputFilename ?? "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {XML_SCHEDULE_LABELS[feed.schedule as XmlSchedule] ?? feed.schedule} ·{" "}
            {feed.lastRunAt ? `Son çalışma: ${formatDate(feed.lastRunAt)}` : "Henüz çalışmadı"} · {feed.totalRuns} çalışma
          </p>
          {feed.lastError ? <p className="mt-1 text-xs text-destructive">{feed.lastError}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <span className={`text-xs ${feed.isActive ? "text-success" : "text-muted-foreground"}`}>
              {feed.isActive ? "Aktif" : "Pasif"}
            </span>
            <Switch
              aria-label={`${feed.name} aktif`}
              checked={feed.isActive}
              disabled={toggleMutation.isPending}
              onCheckedChange={(checked) => toggleMutation.mutate(checked)}
            />
          </div>
          {feed.direction === "import" ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={runMutation.isPending}
              onClick={() => runMutation.mutate()}
            >
              {runMutation.isPending ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <Play className="mr-1 size-4" />
              )}
              Şimdi çalıştır
            </Button>
          ) : null}
          <div className="flex gap-1">
            <Button asChild size="icon" variant="outline" aria-label="Alan eşleştirme">
              <Link to="/store/$storeId/xml-integrator/feeds/$feedId/mapper" params={{ storeId, feedId: feed.id }}>
                <Sliders className="size-4" />
              </Link>
            </Button>
            {onEdit ? (
              <Button size="icon" variant="outline" aria-label="Ayarları düzenle" onClick={onEdit}>
                <Pencil className="size-4" />
              </Button>
            ) : null}
            <Button
              size="icon"
              variant="outline"
              aria-label="Sil"
              disabled={removeMutation.isPending}
              onClick={() => removeMutation.mutate()}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
