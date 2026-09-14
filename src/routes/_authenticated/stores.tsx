import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Plus, Store } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { INDUSTRIES, STORE_ROLE_LABELS, STORE_STATUS_LABELS, SUBDOMAIN_SUFFIX } from "@/lib/mefti";
import { myStoresQuery } from "@/lib/store-queries";

export const Route = createFileRoute("/_authenticated/stores")({
  head: () => ({
    meta: [
      { title: "Mağazalarım — Mefticaret" },
      { name: "description", content: "Tüm mağazalarını görüntüle, aralarında geçiş yap ve yeni mağaza oluştur." },
      { property: "og:title", content: "Mağazalarım — Mefticaret" },
      { property: "og:description", content: "Çoklu mağaza yönetimi tek panelde." },
    ],
  }),
  component: StoresPage,
});

function StoresPage() {
  const { user } = useAuth();
  const { data: stores, isLoading } = useQuery(myStoresQuery(user?.id));

  return (
    <AppShell
      title="Mağazalarım"
      description="Tek hesap ile birden fazla mağaza yönet. Her mağazanın verisi tamamen izoledir."
      actions={
        <>
          <Button asChild>
            <Link to="/onboarding">
              <Plus className="mr-2 size-4" /> Yeni mağaza
            </Link>
          </Button>
        </>
      }
    >
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : (stores ?? []).length === 0 ? (
        <div className="surface-card flex flex-col items-center gap-4 px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand-foreground">
            <Store className="size-6" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold">Henüz mağazan yok</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              10 adımlık kurulum sihirbazı ile ilk mağazanı dakikalar içinde aç.
            </p>
          </div>
          <Button asChild size="lg">
            <Link to="/onboarding">
              Mağaza oluştur <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(stores ?? []).map((store) => (
            <article key={store.id} className="surface-card flex flex-col p-5">
              <div className="flex flex-wrap items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl brand-gradient font-bold text-brand-foreground">
                  {store.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-display text-lg font-semibold">{store.name}</h2>
                  <p className="truncate text-xs text-muted-foreground">
                    {store.slug}.{SUBDOMAIN_SUFFIX}
                  </p>
                </div>
                <Badge
                  className="shrink-0 whitespace-nowrap"
                  variant={store.status === "active" ? "default" : "secondary"}
                >
                  {STORE_STATUS_LABELS[store.status]}
                </Badge>
              </div>


              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Sektör</dt>
                  <dd>{INDUSTRIES.find((item) => item.value === store.industry)?.label ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Rolüm</dt>
                  <dd>{STORE_ROLE_LABELS[store.myRole] ?? store.myRole}</dd>
                </div>
              </dl>

              {!store.onboarding_completed ? (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Kurulum</span>
                    <span>%{Math.round((store.onboarding_step / 10) * 100)}</span>
                  </div>
                  <Progress value={(store.onboarding_step / 10) * 100} className="mt-1.5" />
                </div>
              ) : null}

              <Button asChild className="mt-5 w-full">
                <Link to="/store/$storeId/dashboard" params={{ storeId: store.id }}>
                  Panele git <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </article>
          ))}
        </div>
      )}

    </AppShell>
  );
}
