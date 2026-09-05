import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Search } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  APP_CATEGORIES,
  APP_CATEGORY_LABELS,
  APP_PRICING_LABELS,
  type AppCategory,
} from "@/lib/apps";
import { formatMoney } from "@/lib/mefti";
import {
  fetchAdminApps,
  saveAdminApp,
  saveAdminAppPrices,
  toggleAdminApp,
} from "@/lib/platform-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/apps")({
  head: () => ({
    meta: [
      { title: "Uygulamalar — Süper Admin" },
      {
        name: "description",
        content:
          "Uygulama mağazasındaki uygulamaların adı, açıklaması, fiyatlandırması ve yayın durumunu yönet.",
      },
      { property: "og:title", content: "Uygulamalar — Süper Admin" },
      {
        property: "og:description",
        content: "Uygulama adı, açıklama, fiyat ve yayın durumu düzenleme.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminAppsPage,
});

type PricingModel = "free" | "monthly" | "one_time" | "usage";

type AppRow = {
  id: string;
  code: string;
  name: string;
  tagline: string | null;
  description: string | null;
  category: AppCategory;
  developer: string;
  developer_url: string | null;
  version: string;
  logo_emoji: string | null;
  pricing_model: PricingModel;
  price: number;
  currency: string;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  install_count: number;
};

type AppForm = Omit<AppRow, "id" | "install_count"> & { id?: string };

const emptyForm: AppForm = {
  code: "",
  name: "",
  tagline: "",
  description: "",
  category: "marketing",
  developer: "Mefticaret",
  developer_url: "",
  version: "1.0.0",
  logo_emoji: "🧩",
  pricing_model: "monthly",
  price: 0,
  currency: "TRY",
  is_active: true,
  is_featured: false,
  sort_order: 100,
};

const PRICING_MODELS: PricingModel[] = ["free", "monthly", "one_time", "usage"];

function AdminAppsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<AppForm | null>(null);
  const [prices, setPrices] = useState<
    Record<string, { pricing_model: PricingModel; price: string; currency: string }>
  >({});

  const appsQuery = useQuery({
    queryKey: ["admin", "apps"],
    queryFn: () => fetchAdminApps(),
    staleTime: 30_000,
  });

  const rows = useMemo(() => {
    const list = (appsQuery.data ?? []) as unknown as AppRow[];
    const term = search.trim().toLocaleLowerCase("tr");
    if (!term) return list;
    return list.filter((row) =>
      [row.name, row.code, APP_CATEGORY_LABELS[row.category] ?? row.category]
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(term),
    );
  }, [appsQuery.data, search]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "apps"] });
    void queryClient.invalidateQueries({ queryKey: ["app-catalog"] });
  };

  const saveApp = useMutation({
    mutationFn: (input: AppForm) =>
      saveAdminApp({
        data: {
          ...(input.id ? { id: input.id } : {}),
          code: input.code.trim(),
          name: input.name.trim(),
          tagline: input.tagline?.trim() ? input.tagline.trim() : null,
          description: input.description?.trim() ? input.description.trim() : null,
          category: input.category,
          developer: input.developer.trim() || "Mefticaret",
          developer_url: input.developer_url?.trim() ? input.developer_url.trim() : null,
          version: input.version.trim() || "1.0.0",
          logo_emoji: input.logo_emoji?.trim() ? input.logo_emoji.trim() : null,
          pricing_model: input.pricing_model,
          price: Number(input.price) || 0,
          currency: input.currency.trim().toUpperCase() || "TRY",
          is_active: input.is_active,
          is_featured: input.is_featured,
          sort_order: Number(input.sort_order) || 100,
        },
      }),
    onSuccess: () => {
      toast.success("Uygulama kaydedildi");
      setForm(null);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const savePrices = useMutation({
    mutationFn: () =>
      saveAdminAppPrices({
        data: {
          items: Object.entries(prices).map(([id, value]) => ({
            id,
            pricing_model: value.pricing_model,
            price: Number(value.price) || 0,
            currency: value.currency.trim().toUpperCase() || "TRY",
          })),
        },
      }),
    onSuccess: (result) => {
      toast.success(`${result.count} uygulamanın fiyatı güncellendi`);
      setPrices({});
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: (input: { id: string; isActive?: boolean; isFeatured?: boolean }) =>
      toggleAdminApp({ data: input }),
    onSuccess: () => {
      toast.success("Uygulama güncellendi");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const priceDraft = (row: AppRow) =>
    prices[row.id] ?? {
      pricing_model: row.pricing_model,
      price: String(row.price ?? 0),
      currency: row.currency ?? "TRY",
    };

  const setPriceDraft = (
    row: AppRow,
    patch: Partial<{ pricing_model: PricingModel; price: string; currency: string }>,
  ) => setPrices((prev) => ({ ...prev, [row.id]: { ...priceDraft(row), ...patch } }));

  const dirtyCount = Object.keys(prices).length;

  return (
    <AdminShell
      title="Uygulamalar"
      description="Uygulama mağazasındaki uygulamaların adı, açıklaması, fiyatı ve yayın durumunu düzenle."
      actions={
        <Button onClick={() => setForm({ ...emptyForm })}>
          <Plus className="mr-1 size-4" aria-hidden /> Yeni uygulama
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Uygulama ara"
              aria-label="Uygulama ara"
              className="pl-9"
            />
          </div>
          <Button
            onClick={() => savePrices.mutate()}
            disabled={dirtyCount === 0 || savePrices.isPending}
          >
            <Save className="mr-1 size-4" aria-hidden />
            Fiyatları kaydet{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
          </Button>
        </div>

        {appsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Yükleniyor…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Kayıt bulunamadı.</p>
        ) : (
          <div className="grid gap-3">
            {rows.map((row) => {
              const draft = priceDraft(row);
              return (
                <div
                  key={row.id}
                  className="rounded-2xl border bg-card p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span aria-hidden className="text-lg">
                          {row.logo_emoji ?? "🧩"}
                        </span>
                        <span className="truncate font-medium">{row.name}</span>
                        <Badge variant="secondary">
                          {APP_CATEGORY_LABELS[row.category] ?? row.category}
                        </Badge>
                        {row.is_featured ? <Badge>Öne çıkan</Badge> : null}
                        {!row.is_active ? <Badge variant="outline">Yayında değil</Badge> : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {row.tagline ?? row.description ?? "Açıklama girilmemiş"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.code} · v{row.version} · {row.install_count} kurulum ·{" "}
                        {row.pricing_model === "free" || row.price <= 0
                          ? APP_PRICING_LABELS[row.pricing_model] ?? "Ücretsiz"
                          : `${formatMoney(Number(row.price), row.currency)} · ${APP_PRICING_LABELS[row.pricing_model]}`}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-end gap-3">
                      <div className="w-40">
                        <Label className="text-xs">Fiyat tipi</Label>
                        <Select
                          value={draft.pricing_model}
                          onValueChange={(value) =>
                            setPriceDraft(row, { pricing_model: value as PricingModel })
                          }
                        >
                          <SelectTrigger aria-label={`${row.name} fiyat tipi`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRICING_MODELS.map((model) => (
                              <SelectItem key={model} value={model}>
                                {APP_PRICING_LABELS[model]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-28">
                        <Label className="text-xs">Fiyat</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={draft.price}
                          disabled={draft.pricing_model === "free"}
                          aria-label={`${row.name} fiyatı`}
                          onChange={(event) => setPriceDraft(row, { price: event.target.value })}
                        />
                      </div>
                      <div className="w-24">
                        <Label className="text-xs">Para birimi</Label>
                        <Input
                          value={draft.currency}
                          maxLength={3}
                          aria-label={`${row.name} para birimi`}
                          onChange={(event) =>
                            setPriceDraft(row, { currency: event.target.value.toUpperCase() })
                          }
                        />
                      </div>
                      <div className="flex items-center gap-2 pb-2">
                        <Switch
                          checked={row.is_active}
                          aria-label={`${row.name} yayında`}
                          onCheckedChange={(checked) =>
                            toggle.mutate({ id: row.id, isActive: checked })
                          }
                        />
                        <span className="text-xs text-muted-foreground">Yayında</span>
                      </div>
                      <Button variant="outline" onClick={() => setForm({ ...row })}>
                        Düzenle
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={Boolean(form)} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Uygulamayı düzenle" : "Yeni uygulama"}</DialogTitle>
            <DialogDescription>
              Uygulama mağazasında görünecek ad, açıklama, fiyat ve yayın bilgileri.
            </DialogDescription>
          </DialogHeader>

          {form ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <Label htmlFor="app-name">Uygulama adı</Label>
                <Input
                  id="app-name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="app-code">Kod (benzersiz)</Label>
                <Input
                  id="app-code"
                  value={form.code}
                  disabled={Boolean(form.id)}
                  onChange={(event) =>
                    setForm({ ...form, code: event.target.value.toLowerCase() })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="app-tagline">Kısa tanıtım</Label>
                <Input
                  id="app-tagline"
                  value={form.tagline ?? ""}
                  onChange={(event) => setForm({ ...form, tagline: event.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="app-description">Açıklama</Label>
                <Textarea
                  id="app-description"
                  rows={4}
                  value={form.description ?? ""}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </div>
              <div>
                <Label>Kategori</Label>
                <Select
                  value={form.category}
                  onValueChange={(value) => setForm({ ...form, category: value as AppCategory })}
                >
                  <SelectTrigger aria-label="Kategori">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APP_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {APP_CATEGORY_LABELS[category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fiyat tipi</Label>
                <Select
                  value={form.pricing_model}
                  onValueChange={(value) =>
                    setForm({ ...form, pricing_model: value as PricingModel })
                  }
                >
                  <SelectTrigger aria-label="Fiyat tipi">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICING_MODELS.map((model) => (
                      <SelectItem key={model} value={model}>
                        {APP_PRICING_LABELS[model]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="app-price">Fiyat</Label>
                <Input
                  id="app-price"
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={form.pricing_model === "free"}
                  value={form.price}
                  onChange={(event) => setForm({ ...form, price: Number(event.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="app-currency">Para birimi</Label>
                <Input
                  id="app-currency"
                  maxLength={3}
                  value={form.currency}
                  onChange={(event) =>
                    setForm({ ...form, currency: event.target.value.toUpperCase() })
                  }
                />
              </div>
              <div>
                <Label htmlFor="app-developer">Geliştirici</Label>
                <Input
                  id="app-developer"
                  value={form.developer}
                  onChange={(event) => setForm({ ...form, developer: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="app-developer-url">Geliştirici bağlantısı</Label>
                <Input
                  id="app-developer-url"
                  value={form.developer_url ?? ""}
                  placeholder="https://"
                  onChange={(event) => setForm({ ...form, developer_url: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="app-version">Sürüm</Label>
                <Input
                  id="app-version"
                  value={form.version}
                  onChange={(event) => setForm({ ...form, version: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="app-emoji">Simge</Label>
                <Input
                  id="app-emoji"
                  value={form.logo_emoji ?? ""}
                  onChange={(event) => setForm({ ...form, logo_emoji: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="app-sort">Sıra</Label>
                <Input
                  id="app-sort"
                  type="number"
                  min={0}
                  value={form.sort_order}
                  onChange={(event) =>
                    setForm({ ...form, sort_order: Number(event.target.value) })
                  }
                />
              </div>
              <div className="flex items-center gap-6 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                  />
                  Yayında
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={form.is_featured}
                    onCheckedChange={(checked) => setForm({ ...form, is_featured: checked })}
                  />
                  Öne çıkan
                </label>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Vazgeç
            </Button>
            <Button
              onClick={() => form && saveApp.mutate(form)}
              disabled={saveApp.isPending || !form?.name.trim() || !form?.code.trim()}
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
