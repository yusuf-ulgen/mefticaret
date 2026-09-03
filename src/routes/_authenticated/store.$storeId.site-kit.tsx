import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  BadgeCheck,
  Code2,
  Loader2,
  Radio,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/ui/data-skeleton";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  SITE_KIT_ADVANTAGES,
  SITE_KIT_EVENTS,
  SITE_KIT_PROVIDERS,
  SITE_KIT_STATUS_LABELS,
  siteKitProvider,
  validateSiteKitValues,
  type SiteKitConfigRow,
  type SiteKitProvider,
  type SiteKitStatus,
} from "@/lib/site-kit";
import { storeSiteKitQuery } from "@/lib/site-kit-queries";
import {
  removeStoreSiteKit,
  saveStoreSiteKit,
  testStoreSiteKit,
  toggleStoreSiteKit,
} from "@/lib/site-kit.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/site-kit")({
  head: () => {
    const title = "Site Kit — Kod Yazmadan Entegrasyon | Mefticaret";
    const description =
      "Google Analytics 4, Tag Manager, Google Ads, Meta Pixel, Facebook CAPI, TikTok ve Pinterest etiketlerini tek tıkla bağlayın; olaylar otomatik gönderilsin.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: () => (
    <AppShell title="Site Kit" description="Bu sayfa şu anda yüklenemedi.">
      <div className="surface-card p-10 text-center text-sm text-muted-foreground">
        Bir sorun oluştu. Sayfayı yenilemeyi deneyin.
      </div>
    </AppShell>
  ),
  component: SiteKitPage,
});

const STATUS_TONE: Record<SiteKitStatus, string> = {
  connected: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  paused: "border-border bg-muted text-muted-foreground",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
  unconfigured: "border-dashed border-border bg-transparent text-muted-foreground",
};

const SETUP_STEPS = [
  {
    title: "Servisi açın",
    body: 'Aşağıdaki kartlarda entegre etmek istediğiniz servisi bulun ve "Yapılandır" butonuna tıklayın.',
  },
  {
    title: "Kimliğinizi girin",
    body: "Açılan panelde ilgili servisin ID'sini veya API anahtarını yapıştırın. Her alanın altında nereden bulacağınız yazılı.",
  },
  {
    title: "Test edin ve aktifleştirin",
    body: '"Test et" ile doğrulayın, ardından anahtarı açıp kaydedin. Kartta "Bağlı" rozetini gördüğünüzde entegrasyon tamamdır.',
  },
];

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
      {description ? <p className="max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

function ProviderCard({
  provider,
  row,
  onConfigure,
  onToggle,
  toggling,
}: {
  provider: SiteKitProvider;
  row: SiteKitConfigRow | undefined;
  onConfigure: () => void;
  onToggle: (next: boolean) => void;
  toggling: boolean;
}) {
  const status: SiteKitStatus = row ? row.status : "unconfigured";
  const soon = provider.availability === "soon";
  return (
    <div className="surface-card flex h-full flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{provider.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{provider.summary}</p>
        </div>
        <Badge variant="outline" className={STATUS_TONE[status]}>
          {soon ? "Yakında" : SITE_KIT_STATUS_LABELS[status]}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span className="rounded-full border px-2 py-0.5">{provider.category}</span>
        <span className="rounded-full border px-2 py-0.5">{provider.requirement}</span>
        <span className="rounded-full border px-2 py-0.5">
          {provider.side === "server" ? "Sunucu taraflı" : "Tarayıcı taraflı"}
        </span>
      </div>

      {row?.lastTestResult ? (
        <p className="line-clamp-2 text-[11px] text-muted-foreground">Son test: {row.lastTestResult}</p>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Switch
            checked={Boolean(row?.isEnabled)}
            disabled={soon || !row || toggling}
            onCheckedChange={onToggle}
            aria-label={`${provider.name} etkin`}
          />
          <span className="text-xs text-muted-foreground">{row?.isEnabled ? "Aktif" : "Kapalı"}</span>
        </div>
        <Button size="sm" variant={row ? "outline" : "default"} disabled={soon} onClick={onConfigure}>
          {row ? "Düzenle" : "Yapılandır"}
        </Button>
      </div>
    </div>
  );
}

function SiteKitPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: rows, isLoading } = useQuery(storeSiteKitQuery(storeId));

  const save = useServerFn(saveStoreSiteKit);
  const toggle = useServerFn(toggleStoreSiteKit);
  const test = useServerFn(testStoreSiteKit);
  const remove = useServerFn(removeStoreSiteKit);

  const [openProvider, setOpenProvider] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState(true);

  const byProvider = useMemo(() => {
    const map = new Map<string, SiteKitConfigRow>();
    for (const row of rows ?? []) map.set(row.provider, row);
    return map;
  }, [rows]);

  const connectedCount = (rows ?? []).filter((row) => row.isEnabled).length;
  const readyCount = SITE_KIT_PROVIDERS.filter((p) => p.availability === "ready").length;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["site-kit", storeId] });

  const saveMutation = useMutation({
    mutationFn: (input: { provider: string; isEnabled: boolean; values: Record<string, string> }) =>
      save({ data: { storeId, ...input } }),
    onSuccess: () => {
      toast.success("Entegrasyon kaydedildi, etiketler vitrine yerleştirildi");
      setOpenProvider(null);
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleMutation = useMutation({
    mutationFn: (input: { provider: string; isEnabled: boolean }) => toggle({ data: { storeId, ...input } }),
    onSuccess: () => void invalidate(),
    onError: (error: Error) => toast.error(error.message),
  });

  const testMutation = useMutation({
    mutationFn: (provider: string) => test({ data: { storeId, provider } }),
    onSuccess: (result) => {
      if (result.ok) toast.success(result.detail);
      else toast.error(result.detail);
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: (provider: string) => remove({ data: { storeId, provider, isEnabled: false } }),
    onSuccess: () => {
      toast.success("Entegrasyon kaldırıldı");
      setOpenProvider(null);
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function openDialog(providerId: string) {
    const provider = siteKitProvider(providerId);
    const row = byProvider.get(providerId);
    const values: Record<string, string> = {};
    for (const field of provider?.fields ?? []) {
      values[field.key] = field.secret ? "" : (row?.publicConfig[field.key] ?? "");
    }
    setForm(values);
    setEnabled(row?.isEnabled ?? true);
    setOpenProvider(providerId);
  }

  const activeProvider = openProvider ? siteKitProvider(openProvider) : null;
  const activeRow = openProvider ? byProvider.get(openProvider) : undefined;
  const formError = activeProvider
    ? validateSiteKitValues(activeProvider.id, form, { secretsAlreadyFilled: activeRow?.secretsFilled ?? {} })
    : null;

  return (
    <AppShell
      title="Site Kit"
      description="Analitik ve reklam servislerini kod yazmadan bağlayın; olaylar otomatik gönderilsin."
    >
      <div className="space-y-10">
        {/* Kurulum kılavuzu */}
        <section className="surface-card p-6">
          <SectionHeading
            eyebrow="Kurulum"
            title="Entegrasyonu birkaç adımda kurun"
            description="Head mi body mi diye düşünmeyin; kimliği girin, Mefticaret etiketi doğru yere kendisi yerleştirir."
          />
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {SETUP_STEPS.map((step, index) => (
              <div key={step.title} className="rounded-2xl border bg-muted/30 p-5">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                <p className="mt-3 text-sm font-semibold">{step.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-xs text-muted-foreground">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>
              İpucu: Çerez izni bileşeni açıkken etiketler yalnızca ziyaretçi onay verdikten sonra çalışır; KVKK/GDPR
              uyumu otomatik korunur.
            </p>
          </div>
        </section>

        {/* Servis kartları */}
        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading eyebrow="Servisler" title="Bağlantılarınız" />
            <div className="flex gap-3 text-center">
              <div className="rounded-xl border px-4 py-2">
                <p className="text-lg font-semibold">{readyCount}</p>
                <p className="text-[11px] text-muted-foreground">Desteklenen servis</p>
              </div>
              <div className="rounded-xl border px-4 py-2">
                <p className="text-lg font-semibold text-emerald-600">{connectedCount}</p>
                <p className="text-[11px] text-muted-foreground">Aktif bağlantı</p>
              </div>
              <div className="rounded-xl border px-4 py-2">
                <p className="text-lg font-semibold">0</p>
                <p className="text-[11px] text-muted-foreground">Satır kod</p>
              </div>
            </div>
          </div>

          {isLoading ? (
            <CardSkeleton />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {SITE_KIT_PROVIDERS.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  row={byProvider.get(provider.id)}
                  onConfigure={() => openDialog(provider.id)}
                  toggling={toggleMutation.isPending}
                  onToggle={(next) => toggleMutation.mutate({ provider: provider.id, isEnabled: next })}
                />
              ))}
            </div>
          )}
        </section>

        {/* Geleneksel yöntem vs Site Kit */}
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="surface-card p-6">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Code2 className="size-4 text-muted-foreground" />
              Geleneksel yöntem
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Her servis için farklı bir kod parçasını sitenizin doğru yerine elle eklemeniz gerekir.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-muted/50 p-4 text-[11px] leading-relaxed text-muted-foreground">
              {`<head>
  gtag('config', 'G-XXXX')
  fbq('init', '...')
</head>
<body>
  ttq.load('...')
</body>`}
            </pre>
            <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
              <li>• Head mi body mi belirsiz</li>
              <li>• Hangi sayfaya hangi kod karmaşık</li>
              <li>• Yanlış yerleştirme veri kaybına yol açar</li>
            </ul>
          </div>
          <div className="surface-card border-primary/30 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Wand2 className="size-4 text-primary" />
              Mefticaret Site Kit
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Sadece kimliğinizi girin, gerisini Mefticaret halletsin. Kod yazmanıza gerek yok.
            </p>
            <div className="mt-4 space-y-3 rounded-xl border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <Input readOnly value="G-9F3K2LQ8XR" className="h-9 max-w-[200px] font-mono text-xs" />
                <Button size="sm" disabled>
                  Bağla
                </Button>
              </div>
              <p className="flex items-center gap-2 text-xs text-emerald-600">
                <BadgeCheck className="size-4" /> Kodlar otomatik yerleştirildi
              </p>
              <p className="text-xs text-muted-foreground">E-ticaret olayları aktif · dataLayer hazır</p>
            </div>
            <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
              <li>• Tek alan, sıfır kod</li>
              <li>• Etiket doğru konuma otomatik yerleşir</li>
              <li>• Tüm vitrin sayfalarında geçerli</li>
            </ul>
          </div>
        </section>

        {/* Otomatik olay takibi */}
        <section className="surface-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionHeading
              eyebrow="Olay takibi"
              title="Her adımı izleyin, hiçbir dönüşümü kaçırmayın"
              description="Vitrindeki tek bir olay standart isimlerle bağlı tüm servislere aynı anda gönderilir."
            />
            <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600">
              <Radio className="mr-1 size-3" /> Canlı
            </Badge>
          </div>

          <div className="mt-6 divide-y rounded-2xl border">
            {SITE_KIT_EVENTS.map((event) => (
              <div key={event.name} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-[190px]">
                  <p className="font-mono text-xs font-semibold">{event.name}</p>
                  <p className="text-xs text-muted-foreground">{event.label}</p>
                </div>
                <p className="min-w-[160px] flex-1 text-xs text-muted-foreground">{event.sample}</p>
                <div className="flex flex-wrap gap-1.5">
                  {event.targets.map((target) => {
                    const provider = siteKitProvider(target);
                    const active = byProvider.get(target)?.isEnabled;
                    return (
                      <span
                        key={target}
                        className={`rounded-full border px-2 py-0.5 text-[11px] ${
                          active
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        {provider?.name ?? target}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {SITE_KIT_ADVANTAGES.map((item) => (
              <div key={item.title} className="rounded-2xl border bg-muted/30 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Activity className="size-4 text-primary" />
                  {item.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Client-side vs server-side */}
        <section className="surface-card p-6">
          <SectionHeading
            eyebrow="Dayanıklılık"
            title="Reklam engelleyiciler sizi durduramaz"
            description="Tarayıcıda çalışan etiketler engellenebilir; sunucu taraflı gönderim engellenemez."
          />
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {SITE_KIT_PROVIDERS.filter((provider) =>
              ["meta_pixel", "tiktok_pixel", "facebook_capi"].includes(provider.id),
            ).map((provider) => (
              <div key={provider.id} className="rounded-2xl border p-5">
                <p className="text-sm font-semibold">{provider.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {provider.side === "server" ? "Sunucudan gönderilir" : "Tarayıcıda çalışır"}
                </p>
                <Badge
                  variant="outline"
                  className={`mt-3 ${
                    provider.blockable
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-600"
                      : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                  }`}
                >
                  {provider.blockable ? "Engellenebilir" : "Engellenemez"}
                </Badge>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { icon: ShieldCheck, text: "iOS 14.5+ kısıtlamalarıyla uyumlu" },
              { icon: ServerCog, text: "Enhanced matching ile doğruluk artışı" },
              { icon: BadgeCheck, text: "KVKK/GDPR uyumlu, çerez izni destekli" },
            ].map((item) => (
              <p key={item.text} className="flex items-center gap-2 rounded-xl border bg-muted/30 p-3 text-xs">
                <item.icon className="size-4 text-primary" />
                {item.text}
              </p>
            ))}
          </div>
        </section>

        {/* Servis listesi tablosu */}
        <section className="surface-card overflow-hidden">
          <div className="p-6 pb-4">
            <SectionHeading eyebrow="Kapsam" title="Desteklenen servisler" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">Servis</th>
                  <th className="px-6 py-3 text-left font-medium">Kategori</th>
                  <th className="px-6 py-3 text-left font-medium">Gerekli alan</th>
                  <th className="px-6 py-3 text-left font-medium">Durum</th>
                </tr>
              </thead>
              <tbody>
                {SITE_KIT_PROVIDERS.map((provider) => {
                  const row = byProvider.get(provider.id);
                  return (
                    <tr key={provider.id} className="border-t">
                      <td className="px-6 py-3 font-medium">{provider.name}</td>
                      <td className="px-6 py-3 text-muted-foreground">{provider.category}</td>
                      <td className="px-6 py-3 text-muted-foreground">{provider.requirement}</td>
                      <td className="px-6 py-3">
                        <Badge
                          variant="outline"
                          className={
                            provider.availability === "soon"
                              ? "text-muted-foreground"
                              : STATUS_TONE[row?.status ?? "unconfigured"]
                          }
                        >
                          {provider.availability === "soon"
                            ? "Yakında"
                            : row
                              ? SITE_KIT_STATUS_LABELS[row.status]
                              : "Hazır"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Dialog open={Boolean(openProvider)} onOpenChange={(open) => !open && setOpenProvider(null)}>
        <DialogContent className="max-w-lg">
          {activeProvider ? (
            <>
              <DialogHeader>
                <DialogTitle>{activeProvider.name}</DialogTitle>
                <DialogDescription>{activeProvider.summary}</DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <div className="flex items-center justify-between rounded-xl border p-3">
                  <div>
                    <p className="text-sm font-medium">Servisi etkinleştir</p>
                    <p className="text-xs text-muted-foreground">Kapalıyken etiket vitrine eklenmez.</p>
                  </div>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>

                {activeProvider.fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={`sk-${field.key}`}>{field.label}</Label>
                    {field.type === "textarea" ? (
                      <Textarea
                        id={`sk-${field.key}`}
                        rows={3}
                        placeholder={
                          field.secret && activeRow?.secretsFilled[field.key] ? "•••••• (kayıtlı)" : field.placeholder
                        }
                        value={form[field.key] ?? ""}
                        onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                      />
                    ) : (
                      <Input
                        id={`sk-${field.key}`}
                        placeholder={
                          field.secret && activeRow?.secretsFilled[field.key] ? "•••••• (kayıtlı)" : field.placeholder
                        }
                        value={form[field.key] ?? ""}
                        onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                      />
                    )}
                    <p className="text-xs text-muted-foreground">{field.hint}</p>
                  </div>
                ))}

                <a
                  href={activeProvider.docsUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-block text-xs underline text-muted-foreground"
                >
                  {activeProvider.name} dokümantasyonu
                </a>

                {activeRow?.lastTestResult ? (
                  <p className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                    Son test: {activeRow.lastTestResult}
                  </p>
                ) : null}
                {formError ? <p className="text-xs text-destructive">{formError}</p> : null}
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!activeRow || testMutation.isPending}
                    onClick={() => testMutation.mutate(activeProvider.id)}
                  >
                    {testMutation.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                    Test et
                  </Button>
                  {activeRow ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={removeMutation.isPending}
                      onClick={() => removeMutation.mutate(activeProvider.id)}
                    >
                      <Trash2 className="mr-1 size-4" />
                      Kaldır
                    </Button>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  disabled={Boolean(formError) || saveMutation.isPending}
                  onClick={() =>
                    saveMutation.mutate({ provider: activeProvider.id, isEnabled: enabled, values: form })
                  }
                >
                  {saveMutation.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                  Kaydet
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
