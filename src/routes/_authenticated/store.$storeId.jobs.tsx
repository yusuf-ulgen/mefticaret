import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Ban, Database, Gauge, RefreshCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/mefti";
import {
  JOB_KINDS,
  JOB_KIND_LABELS,
  JOB_STATUSES,
  JOB_STATUS_LABELS,
  type JobKind,
  type JobStatus,
} from "@/lib/queue";
import { cacheStatsQuery, jobsQuery, queueStatsQuery } from "@/lib/queue-queries";
import { cancelJob, clearStoreCache, queueJob, retryJob } from "@/lib/queue.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/jobs")({
  head: () => ({
    meta: [
      { title: "Kuyruk & Önbellek — Mefticaret" },
      {
        name: "description",
        content:
          "Arka plan işlerini izle, başarısız işleri yeniden dene ve mağaza önbelleğini yönet.",
      },
      { property: "og:title", content: "Kuyruk & Önbellek — Mefticaret" },
      {
        property: "og:description",
        content: "Arka plan iş kuyruğu ve önbellek durumunu tek ekrandan yönet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JobsPage,
});

const STATUS_VARIANT: Record<JobStatus, "default" | "secondary" | "destructive" | "outline"> = {
  queued: "secondary",
  running: "default",
  succeeded: "outline",
  failed: "destructive",
  cancelled: "outline",
};

function JobsPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<JobStatus | "all">("all");
  const [kind, setKind] = useState<JobKind | "all">("all");

  const filters = {
    ...(status === "all" ? {} : { status }),
    ...(kind === "all" ? {} : { kind }),
  };

  const { data: jobs, isLoading } = useQuery(jobsQuery(storeId, filters));
  const { data: stats } = useQuery(queueStatsQuery(storeId));
  const { data: cacheStats } = useQuery(cacheStatsQuery(storeId));

  const retryFn = useServerFn(retryJob);
  const cancelFn = useServerFn(cancelJob);
  const enqueueFn = useServerFn(queueJob);
  const clearCacheFn = useServerFn(clearStoreCache);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["store", storeId, "jobs"] });
    void queryClient.invalidateQueries({ queryKey: ["store", storeId, "queue-stats"] });
    void queryClient.invalidateQueries({ queryKey: ["store", storeId, "cache-stats"] });
  }

  const retry = useMutation({
    mutationFn: (id: string) => retryFn({ data: { storeId, id } }),
    onSuccess: () => {
      toast.success("İş yeniden kuyruğa alındı");
      refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "İşlem başarısız"),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { storeId, id } }),
    onSuccess: () => {
      toast.success("İş iptal edildi");
      refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "İşlem başarısız"),
  });

  const enqueue = useMutation({
    mutationFn: (jobKind: JobKind) => enqueueFn({ data: { storeId, kind: jobKind } }),
    onSuccess: () => {
      toast.success("İş kuyruğa alındı");
      refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "İşlem başarısız"),
  });

  const clearCache = useMutation({
    mutationFn: () => clearCacheFn({ data: { storeId } }),
    onSuccess: (result) => {
      toast.success(`${result.removed} önbellek kaydı temizlendi`);
      refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "İşlem başarısız"),
  });

  return (
    <AppShell
      storeId={storeId}
      title="Kuyruk & Önbellek"
      description="Ağır işler istek sırasında değil, arka plan worker'ında çalışır. Önbellek veri değiştiğinde otomatik geçersiz kılınır."
      actions={
        <>
          <Button variant="outline" onClick={refresh}>
            <RefreshCcw className="mr-2 size-4" /> Yenile
          </Button>
          <Button
            variant="outline"
            onClick={() => clearCache.mutate()}
            disabled={clearCache.isPending}
          >
            <Trash2 className="mr-2 size-4" /> Önbelleği temizle
          </Button>
        </>
      }
    >
      <div className="space-y-6">


        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Gauge className="size-4" /> Kuyruk durumu
              </CardTitle>
              <CardDescription>Toplam {stats?.total ?? 0} iş kaydı</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {JOB_STATUSES.map((jobStatus) => (
                <Badge key={jobStatus} variant={STATUS_VARIANT[jobStatus]}>
                  {JOB_STATUS_LABELS[jobStatus]}: {stats?.byStatus[jobStatus] ?? 0}
                </Badge>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="size-4" /> Önbellek
              </CardTitle>
              <CardDescription>{cacheStats?.total ?? 0} kayıt</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {Object.entries(cacheStats?.byNamespace ?? {}).length === 0 ? (
                <p className="text-muted-foreground">Henüz önbellek kaydı yok.</p>
              ) : (
                Object.entries(cacheStats?.byNamespace ?? {}).map(([namespace, value]) => (
                  <div key={namespace} className="flex justify-between">
                    <span className="text-muted-foreground">{namespace}</span>
                    <span>
                      {value.fresh} / {value.total} güncel
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Manuel iş başlat</CardTitle>
              <CardDescription>Seçilen işi hemen kuyruğa alır.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {(["analytics", "sitemap"] as JobKind[]).map((jobKind) => (
                <Button
                  key={jobKind}
                  size="sm"
                  variant="secondary"
                  onClick={() => enqueue.mutate(jobKind)}
                  disabled={enqueue.isPending}
                >
                  {JOB_KIND_LABELS[jobKind]}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-3">
          <Select value={status} onValueChange={(value) => setStatus(value as JobStatus | "all")}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Durum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm durumlar</SelectItem>
              {JOB_STATUSES.map((jobStatus) => (
                <SelectItem key={jobStatus} value={jobStatus}>
                  {JOB_STATUS_LABELS[jobStatus]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={kind} onValueChange={(value) => setKind(value as JobKind | "all")}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="İş tipi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm iş tipleri</SelectItem>
              {JOB_KINDS.map((jobKind) => (
                <SelectItem key={jobKind} value={jobKind}>
                  {JOB_KIND_LABELS[jobKind]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">İş kayıtları</CardTitle>
            <CardDescription>En yeni 200 kayıt gösterilir.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((row) => (
                  <Skeleton key={row} className="h-10 w-full" />
                ))}
              </div>
            ) : (jobs ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm">Bu filtreyle iş kaydı bulunmuyor.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tip</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Deneme</TableHead>
                    <TableHead>Çalışma zamanı</TableHead>
                    <TableHead>Hata</TableHead>
                    <TableHead className="text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(jobs ?? []).map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{JOB_KIND_LABELS[job.kind]}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[job.status]}>
                          {JOB_STATUS_LABELS[job.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {job.attempts} / {job.max_attempts}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDateTime(job.run_at)}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[280px] truncate text-sm">
                        {job.last_error ?? "—"}
                      </TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => retry.mutate(job.id)}
                          disabled={retry.isPending || job.status === "running"}
                        >
                          <RefreshCcw className="mr-1 size-3.5" /> Yeniden dene
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => cancel.mutate(job.id)}
                          disabled={
                            cancel.isPending ||
                            job.status === "succeeded" ||
                            job.status === "cancelled"
                          }
                        >
                          <Ban className="mr-1 size-3.5" /> İptal
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
