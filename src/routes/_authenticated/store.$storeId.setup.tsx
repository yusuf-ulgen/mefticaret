import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, ExternalLink, Rocket } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { storeHealthQuery } from "@/lib/health-queries";
import { storeQuery } from "@/lib/store-queries";
import { updateStore } from "@/lib/stores.functions";
import { cn } from "@/lib/utils";

/**
 * Kurulum sihirbazı: 10 adımın tamamı gerçek mağaza verisinden hesaplanır.
 * Adım durumları istemciden değil veritabanı sayımlarından gelir; yayına alma
 * işlemi sunucu tarafındaki updateStore ile RLS altında yapılır.
 */
export const Route = createFileRoute("/_authenticated/store/$storeId/setup")({
  head: () => ({
    meta: [
      { title: "Kurulum Sihirbazı — Mefticaret" },
      {
        name: "description",
        content:
          "Mağaza kurulumunun 10 adımını tek ekrandan tamamla: tema, ürün, ödeme, kargo, alan adı, ayarlar ve yayına alma.",
      },
      { property: "og:title", content: "Kurulum Sihirbazı — Mefticaret" },
      {
        property: "og:description",
        content: "Mağazanın kurulum ilerlemesini gör, eksik adımları tamamla ve yayına al.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SetupPage,
});

type SetupStep = {
  step: number;
  title: string;
  description: string;
  done: boolean;
  to?: string;
};

function SetupPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: store, isLoading: storeLoading } = useQuery(storeQuery(storeId));
  const { data: health, isLoading: healthLoading } = useQuery(storeHealthQuery(storeId));
  const publish = useServerFn(updateStore);

  const isLoading = storeLoading || healthLoading;
  const base = `/store/${storeId}`;

  const steps = useMemo<SetupStep[]>(() => {
    if (!store || !health) return [];
    return [
      { step: 1, title: "Hesap", description: "Hesabın hazır ve mağaza sahibi olarak yetkilendirildin", done: true },
      {
        step: 2,
        title: "Mağaza adı",
        description: `Marka adı: ${health.storeName}`,
        done: Boolean(store.name),
        to: `${base}/settings`,
      },
      {
        step: 3,
        title: "Sektör",
        description: store.industry ? `Seçilen sektör: ${store.industry}` : "Sektör seçilmedi",
        done: Boolean(store.industry),
        to: `${base}/settings`,
      },
      {
        step: 4,
        title: "Tema",
        description: health.themePublished ? "Vitrin teması yayında" : "Tema hâlâ taslak durumda",
        done: health.themePublished,
        to: `${base}/themes`,
      },
      {
        step: 5,
        title: "İlk ürün",
        description: `${health.activeProducts} aktif ürün (toplam ${health.totalProducts})`,
        done: health.activeProducts > 0,
        to: `${base}/products`,
      },
      {
        step: 6,
        title: "Ödeme",
        description: `${health.paymentMethods} aktif ödeme yöntemi`,
        done: health.paymentMethods > 0,
        to: `${base}/payments`,
      },
      {
        step: 7,
        title: "Kargo",
        description: `${health.shippingRates} aktif kargo tarifesi`,
        done: health.shippingRates > 0,
        to: `${base}/shipping`,
      },
      {
        step: 8,
        title: "Alan adı",
        description: `${health.verifiedDomains} doğrulanmış alan adı`,
        done: health.verifiedDomains > 0,
        to: `${base}/domains`,
      },
      {
        step: 9,
        title: "Ayarlar",
        description:
          health.contactFilled && health.legalFilled
            ? `İletişim ve kurumsal bilgiler tamam · ${store.currency} / ${store.locale}`
            : "İletişim veya kurumsal bilgiler eksik",
        done: health.contactFilled && health.legalFilled,
        to: `${base}/settings`,
      },
      {
        step: 10,
        title: "Yayınla",
        description:
          health.storeStatus === "active" ? "Mağaza yayında" : "Mağaza hâlâ taslak durumda",
        done: health.storeStatus === "active",
      },
    ];
  }, [base, health, store]);

  const completed = steps.filter((step) => step.done).length;
  const progress = steps.length ? Math.round((completed / steps.length) * 100) : 0;
  const blockers = steps.filter((step) => !step.done && step.step >= 4 && step.step <= 7);
  const canPublish = blockers.length === 0 && health?.storeStatus !== "active";

  const mutation = useMutation({
    mutationFn: () =>
      publish({
        data: {
          storeId,
          patch: { status: "active" as const, onboarding_completed: true, onboarding_step: 10 },
        },
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["store", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["store-health", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["my-stores"] }),
      ]);
      toast.success("Mağazan yayına alındı.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell storeId={storeId} title="Kurulum Sihirbazı">
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Rocket className="size-5 text-primary" /> Kurulum sihirbazı
            </h1>
            <p className="text-sm text-muted-foreground">
              10 adımın tamamı mağaza verinden okunur; eksik adımı tamamladığında burada otomatik
              işaretlenir.
            </p>
          </div>
          {health ? (
            <Button asChild variant="outline" size="sm">
              <a href={`/s/${health.storeSlug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 size-4" /> Vitrini gör
              </a>
            </Button>
          ) : null}
        </header>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">Mağaza bilgileri okunamadı.</p>
        ) : (
          <>
            <section className="surface-card space-y-3 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Kurulum ilerlemesi</p>
                  <p className="font-display text-3xl font-semibold">{progress}%</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={health?.storeStatus === "active" ? "default" : "secondary"}>
                    {health?.storeStatus === "active" ? "Yayında" : "Taslak"}
                  </Badge>
                  <Button
                    size="sm"
                    disabled={!canPublish || mutation.isPending}
                    onClick={() => mutation.mutate()}
                  >
                    {mutation.isPending ? "Yayına alınıyor…" : "Mağazayı yayına al"}
                  </Button>
                </div>
              </div>
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">
                {completed}/{steps.length} adım tamam.{" "}
                {blockers.length
                  ? `Yayına almak için eksik adımlar: ${blockers.map((item) => item.title).join(", ")}.`
                  : health?.storeStatus === "active"
                    ? "Tüm kritik adımlar tamam."
                    : "Kritik adımlar tamam, mağazayı yayına alabilirsin."}
              </p>
            </section>

            <ol className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {steps.map((step) => (
                <li
                  key={step.step}
                  className={cn(
                    "surface-card flex items-start gap-3 p-4",
                    step.done ? "border-success/40" : "",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                      step.done ? "border-success text-success" : "border-border",
                    )}
                  >
                    {step.done ? <Check className="size-3.5" /> : step.step}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </div>
                  {step.to ? (
                    <Button asChild variant="ghost" size="sm">
                      <Link to={step.to}>
                        Aç <ArrowRight className="ml-1 size-3.5" />
                      </Link>
                    </Button>
                  ) : null}
                </li>
              ))}
            </ol>

            <p className="text-xs text-muted-foreground">
              Daha ayrıntılı kontrol listesi için{" "}
              <Link className="underline" to={`${base}/health`}>
                Yayına Hazırlık
              </Link>{" "}
              sayfasına bakabilirsin.
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}
