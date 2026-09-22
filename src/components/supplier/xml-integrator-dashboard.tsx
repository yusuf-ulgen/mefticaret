import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Clock,
  Copy,
  FileCode2,
  Loader2,
  Play,
  Plus,
  RefreshCcw,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FEED_SCHEDULE_LABEL, type SupplierFeedSchedule } from "@/lib/dropshipping";
import { EXPORT_PLATFORMS, type ExportPlatform } from "@/lib/xml-export";
import { xmlIntegratorOverviewQuery } from "@/lib/xml-integrator-queries";
import {
  getXmlExportUrl,
  previewXmlExport,
  runXmlExportNow,
  saveXmlExportFeed,
} from "@/lib/xml-integrator.functions";

/**
 * XML Entegratör v2 panosu: iki yönlü besleme özeti, grafikler, dışa aktarım
 * beslemesi oluşturma, hemen çalıştırma ve XML önizleme.
 */

const PLATFORM_LABEL: Record<string, string> = {
  ...Object.fromEntries(EXPORT_PLATFORMS.map((platform) => [platform.code, platform.label])),
  generic: "Genel",
};

const STATUS_LABEL: Record<string, string> = {
  success: "Başarılı",
  failed: "Hatalı",
  running: "Çalışıyor",
  partial: "Kısmi",
};

const PIE_COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)"];

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "—";

const formatBytes = (value: number | null) => {
  if (!value) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

type StatCardProps = { label: string; value: string; hint?: string | undefined; icon: React.ReactNode };

function StatCard({ label, value, hint, icon }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <span className="rounded-md bg-muted p-2 text-muted-foreground">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-semibold">{value}</p>
          {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function XmlIntegratorDashboard({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const overview = useQuery(xmlIntegratorOverviewQuery(storeId));

  const saveExport = useServerFn(saveXmlExportFeed);
  const runExport = useServerFn(runXmlExportNow);
  const preview = useServerFn(previewXmlExport);
  const exportUrl = useServerFn(getXmlExportUrl);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<ExportPlatform>("trendyol");
  const [schedule, setSchedule] = useState<SupplierFeedSchedule>("daily");
  const [filename, setFilename] = useState("{platform}-{date}.xml");
  const [onlyInStock, setOnlyInStock] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewIssues, setPreviewIssues] = useState<Array<{ sku: string | null; message: string }>>([]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["xml-integrator", "overview", storeId] });

  const saveMutation = useMutation({
    mutationFn: () =>
      saveExport({
        data: {
          storeId,
          name: name.trim(),
          platform,
          schedule,
          outputFilename: filename.trim() || null,
          outputTarget: "url" as const,
          isActive,
          filters: { only_in_stock: onlyInStock },
          timezone: "Europe/Istanbul",
          maxRuntimeSeconds: 600,
          categoryMap: {},
        },
      }),
    onSuccess: async () => {
      toast.success("Dışa aktarım beslemesi kaydedildi");
      setDialogOpen(false);
      setName("");
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const runMutation = useMutation({
    mutationFn: (feedId: string) => runExport({ data: { storeId, feedId } }),
    onSuccess: async (result) => {
      toast.success(`${result.exported} ürün aktarıldı`, {
        description: result.failed ? `${result.failed} ürün doğrulamadan geçemedi` : result.outputUrl ?? undefined,
      });
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const previewMutation = useMutation({
    mutationFn: (feedId: string) => preview({ data: { storeId, feedId, limit: 10 } }),
    onSuccess: (result) => {
      setPreviewText(result.xml);
      setPreviewIssues(result.issues.map((issue) => ({ sku: issue.sku, message: issue.message })));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const copyMutation = useMutation({
    mutationFn: (feedId: string) => exportUrl({ data: { storeId, feedId } }),
    onSuccess: async (result) => {
      await navigator.clipboard.writeText(result.url);
      toast.success("XML adresi kopyalandı");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const data = overview.data;
  const feeds = useMemo(() => data?.feeds ?? [], [data]);
  const importFeeds = feeds.filter((feed) => feed.direction !== "export");
  const exportFeeds = feeds.filter((feed) => feed.direction === "export");

  if (overview.isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Pano yükleniyor…
      </div>
    );
  }

  if (overview.error) {
    return <p className="text-sm text-destructive">{(overview.error as Error).message}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Aktif içe aktarım"
          value={String(data?.cards.activeImport ?? 0)}
          icon={<ArrowDownToLine className="size-4" />}
        />
        <StatCard
          label="Aktif dışa aktarım"
          value={String(data?.cards.activeExport ?? 0)}
          icon={<ArrowUpFromLine className="size-4" />}
        />
        <StatCard
          label="Bugünkü çalıştırma"
          value={String(data?.cards.todayRuns ?? 0)}
          icon={<RefreshCcw className="size-4" />}
        />
        <StatCard
          label="Güncellenen ürün (14 gün)"
          value={String(data?.cards.updatedProducts ?? 0)}
          icon={<FileCode2 className="size-4" />}
        />
        <StatCard
          label="Başarı oranı (24 saat)"
          value={data?.cards.successRate === null || data?.cards.successRate === undefined ? "—" : `${data.cards.successRate}%`}
          icon={<CheckCircle2 className="size-4" />}
        />
        <StatCard
          label="Sıradaki çalıştırma"
          value={data?.cards.nextRun ? formatDate(data.cards.nextRun.at) : "—"}
          hint={data?.cards.nextRun?.name}
          icon={<Clock className="size-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Son 14 gün çalıştırma</CardTitle>
            <CardDescription>İçe ve dışa aktarım çalıştırma sayısı</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.trend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="day" tickFormatter={(day: string) => day.slice(5)} fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="import" name="İçe" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="export" name="Dışa" stroke="var(--color-chart-2)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Besleme durumu</CardTitle>
            <CardDescription>Aktif, pasif ve hatalı beslemeler</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data?.status ?? []} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75}>
                  {(data?.status ?? []).map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Ürün hareketleri (7 gün)</CardTitle>
            <CardDescription>Eklenen, güncellenen ve hatalı kayıtlar</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.products ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="day" tickFormatter={(day: string) => day.slice(5)} fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Bar dataKey="created" name="Eklenen" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="updated" name="Güncellenen" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="failed" name="Hatalı" fill="var(--color-destructive)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Dışa aktarım beslemeleri</CardTitle>
            <CardDescription>Pazaryeri XML çıktıları — adresi pazaryerine verin, otomatik güncellenir.</CardDescription>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="w-full sm:w-auto">
            <Plus className="mr-2 size-4" /> Yeni dışa aktarım
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {exportFeeds.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz dışa aktarım beslemesi yok.</p>
          ) : (
            exportFeeds.map((feed) => (
              <div
                key={feed.id}
                className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{feed.name}</span>
                    <Badge variant="secondary">{PLATFORM_LABEL[feed.platform] ?? feed.platform}</Badge>
                    <Badge variant={feed.is_active ? "default" : "outline"}>{feed.is_active ? "Aktif" : "Pasif"}</Badge>
                    {feed.last_status ? (
                      <Badge variant={feed.last_status === "failed" ? "destructive" : "outline"}>
                        {STATUS_LABEL[feed.last_status] ?? feed.last_status}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {FEED_SCHEDULE_LABEL[feed.schedule as SupplierFeedSchedule] ?? feed.schedule} · Son:{" "}
                    {formatDate(feed.last_run_at)} · Sıradaki: {formatDate(feed.next_run_at)}
                  </p>
                  {feed.last_error ? <p className="text-xs text-destructive">{feed.last_error}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyMutation.mutate(feed.id)}
                    disabled={copyMutation.isPending}
                  >
                    <Copy className="mr-2 size-4" /> Adresi kopyala
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => previewMutation.mutate(feed.id)}
                    disabled={previewMutation.isPending}
                  >
                    <FileCode2 className="mr-2 size-4" /> Önizle
                  </Button>
                  <Button size="sm" onClick={() => runMutation.mutate(feed.id)} disabled={runMutation.isPending}>
                    {runMutation.isPending ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Play className="mr-2 size-4" />
                    )}
                    Çalıştır
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {previewText ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">XML önizleme (ilk 10 ürün)</CardTitle>
            <CardDescription>
              {previewIssues.length
                ? `${previewIssues.length} kayıt pazaryeri kurallarını karşılamıyor`
                : "Tüm kayıtlar pazaryeri kurallarını karşılıyor"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {previewIssues.length ? (
              <ul className="space-y-1 text-xs text-destructive">
                {previewIssues.slice(0, 10).map((issue, index) => (
                  <li key={`${issue.sku ?? "?"}-${index}`}>
                    {issue.sku ? `${issue.sku}: ` : ""}
                    {issue.message}
                  </li>
                ))}
              </ul>
            ) : null}
            <Textarea readOnly value={previewText} className="h-64 font-mono text-xs" />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">İçe aktarım beslemeleri</CardTitle>
          <CardDescription>Tedarikçi XML/CSV/API beslemeleri — ayrıntılı ayarlar XML Entegratör sekmelerinde.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {importFeeds.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz içe aktarım beslemesi yok.</p>
          ) : (
            importFeeds.map((feed) => (
              <div key={feed.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{feed.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {FEED_SCHEDULE_LABEL[feed.schedule as SupplierFeedSchedule] ?? feed.schedule} · Son:{" "}
                    {formatDate(feed.last_run_at)}
                  </p>
                </div>
                <Badge variant={feed.last_status === "failed" ? "destructive" : "outline"}>
                  {STATUS_LABEL[feed.last_status ?? ""] ?? "—"}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Son çalıştırmalar</CardTitle>
          <CardDescription>Son 14 günün kayıtları</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.runs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Kayıt yok.</p>
          ) : (
            (data?.runs ?? []).slice(0, 20).map((run) => (
              <div key={run.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate">
                    {run.direction === "export" ? "Dışa aktarım" : "İçe aktarım"} · {formatDate(run.started_at)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {run.duration_seconds ? `${run.duration_seconds} sn` : "—"} · {formatBytes(run.file_size_bytes)}
                  </p>
                </div>
                <Badge variant={run.status === "failed" ? "destructive" : run.status === "running" ? "secondary" : "outline"}>
                  {STATUS_LABEL[run.status] ?? run.status}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Yeni dışa aktarım beslemesi</DialogTitle>
            <DialogDescription>Pazaryerine vereceğiniz XML adresini oluşturur.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="export-name">Besleme adı</Label>
              <Input id="export-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Trendyol ana katalog" />
            </div>
            <div className="space-y-1.5">
              <Label>Pazaryeri</Label>
              <Select value={platform} onValueChange={(value) => setPlatform(value as ExportPlatform)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPORT_PLATFORMS.map((item) => (
                    <SelectItem key={item.code} value={item.code}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Yenileme sıklığı</Label>
              <Select value={schedule} onValueChange={(value) => setSchedule(value as SupplierFeedSchedule)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["manual", "hourly", "three_hourly", "six_hourly", "twelve_hourly", "daily"] as SupplierFeedSchedule[]).map(
                    (item) => (
                      <SelectItem key={item} value={item}>
                        {FEED_SCHEDULE_LABEL[item] ?? item}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="export-filename">Dosya adı şablonu</Label>
              <Input id="export-filename" value={filename} onChange={(event) => setFilename(event.target.value)} />
              <p className="text-xs text-muted-foreground">{"{platform}"}, {"{date}"} ve {"{time}"} kullanılabilir.</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="only-stock" className="text-sm font-normal">
                Yalnızca stokta olan ürünler
              </Label>
              <Switch id="only-stock" checked={onlyInStock} onCheckedChange={setOnlyInStock} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="export-active" className="text-sm font-normal">
                Besleme aktif
              </Label>
              <Switch id="export-active" checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Vazgeç
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || name.trim().length < 2}>
              {saveMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
