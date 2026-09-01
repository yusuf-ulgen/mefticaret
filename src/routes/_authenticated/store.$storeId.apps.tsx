import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Download, PauseCircle, PlayCircle, Settings2, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime, formatMoney } from "@/lib/mefti";
import {
  APP_CATEGORIES,
  APP_CATEGORY_LABELS,
  APP_INSTALL_STATUS_LABELS,
  APP_PERMISSION_LABELS,
  APP_PRICING_LABELS,
  appPriceLabel,
  readSettingsSchema,
  type AppCategory,
} from "@/lib/apps";
import { appCatalogQuery, storeAppInstallationsQuery } from "@/lib/apps-queries";
import {
  installStoreApp,
  saveStoreAppSettings,
  setStoreAppStatus,
} from "@/lib/apps.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/apps")({
  head: () => ({
    meta: [
      { title: "Uygulama Mağazası — Mefticaret" },
      {
        name: "description",
        content:
          "SEO, pazarlama, ödeme, kargo, muhasebe ve yapay zekâ uygulamalarını mağazana kur, izinlerini ve ayarlarını yönet.",
      },
      { property: "og:title", content: "Uygulama Mağazası — Mefticaret" },
      {
        property: "og:description",
        content: "15 kategoride mağaza uygulamaları: kurulum, izinler, sürüm ve ayar yönetimi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AppsPage,
});

type CatalogApp = {
  id: string;
  name: string;
  slug: string;
  category: string;
  tagline: string | null;
  description: string | null;
  developer: string | null;
  version: string | null;
  logo_url: string | null;
  permissions: string[] | null;
  pricing_model: string;
  price: number | null;
  currency: string | null;
  settings_schema: unknown;
};

function AppsPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: catalog, isLoading } = useQuery(appCatalogQuery());
  const { data: installs } = useQuery(storeAppInstallationsQuery(storeId));

  const [category, setCategory] = useState<AppCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [configuring, setConfiguring] = useState<CatalogApp | null>(null);
  const [draft, setDraft] = useState<Record<string, string | number | boolean | null>>({});

  const installFn = useServerFn(installStoreApp);
  const statusFn = useServerFn(setStoreAppStatus);
  const settingsFn = useServerFn(saveStoreAppSettings);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["store", storeId, "app-installations"] });
  }

  const install = useMutation({
    mutationFn: (appId: string) => installFn({ data: { storeId, appId } }),
    onSuccess: () => {
      toast.success("Uygulama kuruldu");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const changeStatus = useMutation({
    mutationFn: (input: { appId: string; status: "installed" | "paused" | "uninstalled" }) =>
      statusFn({ data: { storeId, ...input } }),
    onSuccess: () => {
      toast.success("Uygulama durumu güncellendi");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveSettings = useMutation({
    mutationFn: (appId: string) => settingsFn({ data: { storeId, appId, settings: draft } }),
    onSuccess: () => {
      toast.success("Ayarlar kaydedildi");
      setConfiguring(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const installMap = useMemo(() => {
    const map = new Map<string, { status: string; installed_at: string | null; settings: unknown }>();
    for (const row of (installs ?? []) as {
      app_id: string;
      status: string;
      installed_at: string | null;
      settings: unknown;
    }[]) {
      map.set(row.app_id, row);
    }
    return map;
  }, [installs]);

  const apps = useMemo(() => {
    const list = (catalog ?? []) as CatalogApp[];
    const needle = search.trim().toLowerCase();
    return list.filter((app) => {
      if (category !== "all" && app.category !== category) return false;
      if (!needle) return true;
      return (
        app.name.toLowerCase().includes(needle) ||
        (app.tagline ?? "").toLowerCase().includes(needle) ||
        (app.developer ?? "").toLowerCase().includes(needle)
      );
    });
  }, [catalog, category, search]);

  const installedCount = [...installMap.values()].filter((row) => row.status === "installed").length;

  function openSettings(app: CatalogApp) {
    const fields = readSettingsSchema(app.settings_schema);
    const current = (installMap.get(app.id)?.settings ?? {}) as Record<string, unknown>;
    const next: Record<string, string | number | boolean | null> = {};
    for (const field of fields) {
      const value = current[field.key] ?? field.default ?? (field.type === "boolean" ? false : "");
      next[field.key] =
        typeof value === "string" || typeof value === "number" || typeof value === "boolean"
          ? value
          : null;
    }
    setDraft(next);
    setConfiguring(app);
  }

  return (
    <AppShell storeId={storeId}>
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Uygulama Mağazası</h1>
          <p className="text-sm text-muted-foreground">
            {installedCount} kurulu uygulama · {(catalog ?? []).length} uygulama listede
          </p>
        </header>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Uygulama veya geliştirici ara"
            className="sm:max-w-xs"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={category === "all" ? "default" : "outline"}
              onClick={() => setCategory("all")}
            >
              Tümü
            </Button>
            {APP_CATEGORIES.map((item) => (
              <Button
                key={item}
                size="sm"
                variant={category === item ? "default" : "outline"}
                onClick={() => setCategory(item)}
              >
                {APP_CATEGORY_LABELS[item]}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <Skeleton key={index} className="h-52 w-full rounded-xl" />
            ))}
          </div>
        ) : apps.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Bu filtreyle eşleşen uygulama yok.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {apps.map((app) => {
              const installed = installMap.get(app.id);
              const active = installed?.status === "installed";
              const paused = installed?.status === "paused";
              const fields = readSettingsSchema(app.settings_schema);

              return (
                <article
                  key={app.id}
                  className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                      {app.logo_url ? (
                        <img
                          src={app.logo_url}
                          alt={`${app.name} logosu`}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      ) : (
                        <Store className="size-5 text-muted-foreground" aria-hidden />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate font-medium">{app.name}</h2>
                        {installed ? (
                          <Badge variant={active ? "default" : "secondary"}>
                            {APP_INSTALL_STATUS_LABELS[installed.status] ?? installed.status}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="line-clamp-2 text-sm text-muted-foreground">{app.tagline}</p>
                    </div>
                  </div>

                  <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <dt className="font-medium text-foreground">Kategori</dt>
                      <dd>{APP_CATEGORY_LABELS[app.category as AppCategory] ?? app.category}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">Geliştirici</dt>
                      <dd className="truncate">{app.developer ?? "Mefticaret"}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">Sürüm</dt>
                      <dd>v{app.version ?? "1.0.0"}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">Fiyat</dt>
                      <dd>
                        {appPriceLabel(
                          app.pricing_model,
                          app.price ?? 0,
                          app.currency ?? "TRY",
                          formatMoney,
                        )}
                        <span className="ml-1 opacity-70">
                          ({APP_PRICING_LABELS[app.pricing_model] ?? app.pricing_model})
                        </span>
                      </dd>
                    </div>
                  </dl>

                  {(app.permissions ?? []).length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-xs font-medium">İzinler</p>
                      <div className="flex flex-wrap gap-1">
                        {(app.permissions ?? []).map((permission) => (
                          <Badge key={permission} variant="outline" className="text-[11px]">
                            {APP_PERMISSION_LABELS[permission] ?? permission}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {installed?.installed_at ? (
                    <p className="text-xs text-muted-foreground">
                      Kurulum: {formatDateTime(installed.installed_at)}
                    </p>
                  ) : null}

                  <div className="mt-auto flex flex-wrap gap-2">
                    {!installed || installed.status === "uninstalled" ? (
                      <Button
                        size="sm"
                        onClick={() => install.mutate(app.id)}
                        disabled={install.isPending}
                      >
                        <Download className="mr-1 size-4" aria-hidden /> Kur
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            changeStatus.mutate({
                              appId: app.id,
                              status: active ? "paused" : "installed",
                            })
                          }
                          disabled={changeStatus.isPending}
                        >
                          {active ? (
                            <>
                              <PauseCircle className="mr-1 size-4" aria-hidden /> Duraklat
                            </>
                          ) : (
                            <>
                              <PlayCircle className="mr-1 size-4" aria-hidden /> Sürdür
                            </>
                          )}
                        </Button>
                        {fields.length > 0 ? (
                          <Button size="sm" variant="outline" onClick={() => openSettings(app)}>
                            <Settings2 className="mr-1 size-4" aria-hidden /> Ayarlar
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            changeStatus.mutate({ appId: app.id, status: "uninstalled" })
                          }
                          disabled={changeStatus.isPending}
                        >
                          <Trash2 className="mr-1 size-4" aria-hidden /> Kaldır
                        </Button>
                      </>
                    )}
                  </div>
                  {paused ? (
                    <p className="text-xs text-amber-600">
                      Uygulama duraklatıldı; ayarlar korunuyor.
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={Boolean(configuring)} onOpenChange={(open) => !open && setConfiguring(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{configuring?.name} ayarları</DialogTitle>
            <DialogDescription>
              Uygulamanın çalışması için gereken bilgileri gir. Değerler mağazana özel saklanır.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {readSettingsSchema(configuring?.settings_schema).map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={`app-field-${field.key}`}>{field.label}</Label>
                {field.type === "boolean" ? (
                  <Switch
                    id={`app-field-${field.key}`}
                    checked={Boolean(draft[field.key])}
                    onCheckedChange={(checked) =>
                      setDraft((prev) => ({ ...prev, [field.key]: checked }))
                    }
                  />
                ) : field.type === "select" ? (
                  <select
                    id={`app-field-${field.key}`}
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={String(draft[field.key] ?? "")}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))
                    }
                  >
                    <option value="">Seçin</option>
                    {(field.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id={`app-field-${field.key}`}
                    type={field.type === "password" ? "password" : field.type === "number" ? "number" : "text"}
                    value={String(draft[field.key] ?? "")}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        [field.key]:
                          field.type === "number"
                            ? Number(event.target.value || 0)
                            : event.target.value,
                      }))
                    }
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfiguring(null)}>
              Vazgeç
            </Button>
            <Button
              onClick={() => configuring && saveSettings.mutate(configuring.id)}
              disabled={saveSettings.isPending}
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
