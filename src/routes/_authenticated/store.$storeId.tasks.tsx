import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, ListChecks, RefreshCcw } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { operationTasksQuery } from "@/lib/tasks-queries";
import { formatNumber } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/tasks")({
  head: () => ({
    meta: [
      { title: "Günlük Operasyon Merkezi — Mefticaret" },
      {
        name: "description",
        content: "Bekleyen sipariş, iade, kritik stok ve moderasyon işlerini tek ekranda takip et.",
      },
      { property: "og:title", content: "Günlük Operasyon Merkezi — Mefticaret" },
      {
        property: "og:description",
        content: "Mağazanın günlük yapılacaklar listesi: sipariş, kargo, stok ve müşteri işleri.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TasksPage,
});

const toneClass: Record<string, string> = {
  danger: "border-destructive/40 bg-destructive/5",
  warn: "border-amber-500/40 bg-amber-500/5",
  info: "border-border bg-card",
};

function TasksPage() {
  const { storeId } = Route.useParams();
  const { data, isLoading, isFetching, refetch } = useQuery(operationTasksQuery(storeId));
  const tasks = data ?? [];
  const open = tasks.filter((task) => task.count > 0);
  const clear = tasks.filter((task) => task.count === 0);
  const totalOpen = open.reduce((sum, task) => sum + task.count, 0);

  return (
    <AppShell
      storeId={storeId}
      title="Günlük Operasyon Merkezi"
      description="Bekleyen tüm operasyon işleri tek listede, öncelik sırasıyla."
    >
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <ListChecks className="size-5 text-primary" /> Günlük Operasyon Merkezi
            </h1>
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? "İş kalemleri hesaplanıyor…"
                : `${open.length} başlıkta toplam ${formatNumber(totalOpen)} bekleyen iş var.`}
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCcw className="mr-2 size-4" /> Yenile
          </Button>
        </header>

        {!isLoading && open.length === 0 && (
          <div className="flex items-center gap-3 rounded-xl border bg-card p-6 shadow-sm">
            <CheckCircle2 className="size-6 text-primary" />
            <div>
              <p className="font-medium">Bekleyen iş yok</p>
              <p className="text-sm text-muted-foreground">Tüm operasyon başlıkları temiz görünüyor.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {open.map((task) => (
            <div key={task.key} className={`rounded-xl border p-4 shadow-sm ${toneClass[task.tone]}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{task.label}</p>
                <Badge variant={task.tone === "danger" ? "destructive" : "secondary"}>
                  {formatNumber(task.count)}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{task.description}</p>
              <Button asChild size="sm" variant="ghost" className="mt-3 px-0">
                <Link to={task.to}>
                  Aç <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            </div>
          ))}
        </div>

        {clear.length > 0 && (
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-sm font-medium">Temiz başlıklar</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {clear.map((task) => (
                <li key={task.key}>
                  <Badge variant="outline" className="text-muted-foreground">
                    {task.label}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AppShell>
  );
}
