import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle2, ExternalLink, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { buildHealthChecks, healthScore, storeHealthQuery } from "@/lib/health-queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/store/$storeId/health")({
  head: () => ({
    meta: [
      { title: "Yayına Hazırlık Kontrolü — Mefticaret" },
      {
        name: "description",
        content:
          "Mağazanızın yayına hazırlık puanını görün: ödeme, kargo, tema, yasal sayfalar ve SEO kontrollerini tek ekranda tamamlayın.",
      },
      { property: "og:title", content: "Yayına Hazırlık Kontrolü — Mefticaret" },
      {
        property: "og:description",
        content: "Mağaza sağlık puanı, kritik eksikler ve hızlı düzeltme bağlantıları.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HealthPage,
});

function HealthPage() {
  const { storeId } = Route.useParams();
  const { data, isLoading } = useQuery(storeHealthQuery(storeId));

  const checks = useMemo(() => (data ? buildHealthChecks(data, storeId) : []), [data, storeId]);
  const score = useMemo(() => healthScore(checks), [checks]);
  const blockers = checks.filter((check) => !check.ok && check.severity === "critical");
  const warnings = checks.filter((check) => !check.ok && check.severity === "warning");

  return (
    <AppShell storeId={storeId} title="Yayına Hazırlık">
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <ShieldCheck className="size-5 text-primary" /> Yayına hazırlık kontrolü
            </h1>
            <p className="text-sm text-muted-foreground">
              Mağazanız satışa açılmadan önce tamamlanması gereken kritik ve önerilen adımlar.
            </p>
          </div>
          {data ? (
            <Button asChild variant="outline" size="sm">
              <a href={`/s/${data.storeSlug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 size-4" /> Vitrini gör
              </a>
            </Button>
          ) : null}
        </header>

        {isLoading || !data ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-card p-5 sm:col-span-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Hazırlık puanı</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">{score}%</p>
                <Progress value={score} className="mt-3" />
                <p className="mt-2 text-xs text-muted-foreground">
                  {score >= 90
                    ? "Mağaza yayına hazır."
                    : score >= 60
                      ? "Birkaç adım kaldı."
                      : "Kritik eksikler var."}
                </p>
              </div>
              <div className="rounded-xl border bg-card p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Kritik eksik</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-destructive">{blockers.length}</p>
                <p className="mt-2 text-xs text-muted-foreground">Satışı engelleyen adımlar</p>
              </div>
              <div className="rounded-xl border bg-card p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Öneri</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">{warnings.length}</p>
                <p className="mt-2 text-xs text-muted-foreground">Dönüşümü artıran iyileştirmeler</p>
              </div>
            </section>

            <section className="divide-y rounded-xl border bg-card">
              {checks.map((check) => (
                <div key={check.id} className="flex flex-wrap items-center gap-3 p-4">
                  {check.ok ? (
                    <CheckCircle2 className="size-5 shrink-0 text-primary" />
                  ) : (
                    <AlertTriangle
                      className={cn(
                        "size-5 shrink-0",
                        check.severity === "critical" ? "text-destructive" : "text-muted-foreground",
                      )}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {check.label}
                      {!check.ok ? (
                        <Badge variant={check.severity === "critical" ? "destructive" : "secondary"}>
                          {check.severity === "critical" ? "Kritik" : "Öneri"}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">{check.detail}</p>
                  </div>
                  {check.to ? (
                    <Button asChild variant={check.ok ? "ghost" : "outline"} size="sm">
                      <Link to={check.to}>
                        Düzenle <ArrowRight className="ml-2 size-4" />
                      </Link>
                    </Button>
                  ) : null}
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
