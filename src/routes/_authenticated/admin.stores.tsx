import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
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
import { useAuth } from "@/lib/auth-context";
import { formatDateTime, formatNumber, slugify, STORE_STATUS_LABELS } from "@/lib/mefti";
import { adminStoresQuery, plansQuery } from "@/lib/store-queries";
import { setStoreStatus } from "@/lib/admin.functions";
import {
  createPlatformStore,
  deletePlatformStore,
  updatePlatformStore,
} from "@/lib/admin-stores.functions";
import { downloadCsv, toCsv } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/admin/stores")({
  head: () => ({
    meta: [
      { title: "Mağaza Yönetimi — Süper Admin" },
      {
        name: "description",
        content: "Platformdaki mağazaları oluştur, düzenle, sil ve durumlarını yönet.",
      },
      { property: "og:title", content: "Mağaza Yönetimi — Süper Admin" },
      { property: "og:description", content: "Kiracı mağazaların merkezi yönetimi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminStores,
});

const STATUS_OPTIONS = ["draft", "active", "suspended", "archived"] as const;
const CURRENCIES = ["TRY", "USD", "EUR", "GBP", "AED", "SAR"] as const;
const LOCALES = ["tr", "en", "de", "fr", "es", "ar"] as const;

type Status = (typeof STATUS_OPTIONS)[number];
type Currency = (typeof CURRENCIES)[number];
type Locale = (typeof LOCALES)[number];

type StoreForm = {
  storeId: string | null;
  name: string;
  slug: string;
  industry: string;
  currency: Currency;
  locale: Locale;
  status: Status;
  planId: string;
  ownerEmail: string;
};

const EMPTY_FORM: StoreForm = {
  storeId: null,
  name: "",
  slug: "",
  industry: "Genel",
  currency: "TRY",
  locale: "tr",
  status: "draft",
  planId: "none",
  ownerEmail: "",
};

function AdminStores() {
  const { isPlatformAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { data: stores } = useQuery(adminStoresQuery(isPlatformAdmin));
  const { data: plans } = useQuery(plansQuery());
  const updateStatus = useServerFn(setStoreStatus);
  const createStore = useServerFn(createPlatformStore);
  const updateStore = useServerFn(updatePlatformStore);
  const removeStore = useServerFn(deletePlatformStore);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [form, setForm] = useState<StoreForm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-stores"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-audit"] }),
      queryClient.invalidateQueries({ queryKey: ["my-stores"] }),
    ]);
  };

  const statusMutation = useMutation({
    mutationFn: (input: { storeId: string; status: Status }) => updateStatus({ data: input }),
    onSuccess: async () => {
      toast.success("Mağaza durumu güncellendi");
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveMutation = useMutation({
    mutationFn: async (values: StoreForm) => {
      const planId = values.planId === "none" ? null : values.planId;
      if (values.storeId) {
        return updateStore({
          data: {
            storeId: values.storeId,
            name: values.name,
            slug: slugify(values.slug || values.name),
            industry: values.industry || undefined,
            currency: values.currency,
            locale: values.locale,
            status: values.status,
            planId,
          },
        });
      }
      return createStore({
        data: {
          name: values.name,
          slug: values.slug ? slugify(values.slug) : undefined,
          industry: values.industry || "Genel",
          currency: values.currency,
          locale: values.locale,
          status: values.status,
          planId,
          ownerEmail: values.ownerEmail ? values.ownerEmail : undefined,
        },
      });
    },
    onSuccess: async (_result, values) => {
      toast.success(values.storeId ? "Mağaza güncellendi" : "Mağaza oluşturuldu");
      setForm(null);
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (input: { storeId: string; confirmSlug: string }) => removeStore({ data: input }),
    onSuccess: async () => {
      toast.success("Mağaza ve tüm verileri silindi");
      setDeleteTarget(null);
      setDeleteConfirm("");
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const term = search.trim().toLocaleLowerCase("tr-TR");
  const rows = (stores ?? []).filter((store) => {
    if (statusFilter !== "all" && store.status !== statusFilter) return false;
    if (!term) return true;
    return (
      store.name.toLocaleLowerCase("tr-TR").includes(term) ||
      store.slug.toLocaleLowerCase("tr-TR").includes(term)
    );
  });

  const exportStores = () => {
    downloadCsv(
      `mefticaret-magazalar-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        ["Mağaza", "Slug", "Paket", "Durum", "Oluşturma"],
        rows.map((store) => [
          store.name,
          store.slug,
          store.plans?.name ?? "",
          STORE_STATUS_LABELS[store.status] ?? store.status,
          formatDateTime(store.created_at),
        ]),
      ),
    );
  };

  return (
    <AdminShell
      title="Mağaza Yönetimi"
      description="Mağaza oluştur, bilgilerini düzenle, durum değiştir veya kalıcı olarak sil."
    >
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Mağaza adı veya slug ara"
          className="h-9 w-full sm:w-72"
          aria-label="Mağaza ara"
        />
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm durumlar</SelectItem>
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status} value={status}>
                {STORE_STATUS_LABELS[status] ?? status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{formatNumber(rows.length)} kayıt listeleniyor</span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={exportStores}>
            <Download className="size-4" /> CSV indir
          </Button>
          <Button size="sm" onClick={() => setForm({ ...EMPTY_FORM })}>
            <Plus className="size-4" /> Yeni mağaza
          </Button>
        </div>
      </div>

      <div className="surface-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Mağaza</th>
              <th className="px-5 py-3">Paket</th>
              <th className="px-5 py-3">Durum</th>
              <th className="px-5 py-3">Oluşturma</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((store) => (
              <tr key={store.id}>
                <td className="px-5 py-3">
                  <p className="font-medium">{store.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {store.slug} · {store.currency} · {store.locale}
                  </p>
                </td>
                <td className="px-5 py-3">{store.plans?.name ?? "—"}</td>
                <td className="px-5 py-3">
                  <Select
                    value={store.status}
                    onValueChange={(value) =>
                      statusMutation.mutate({ storeId: store.id, status: value as Status })
                    }
                  >
                    <SelectTrigger className="h-9 w-[170px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {STORE_STATUS_LABELS[status] ?? status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-5 py-3 text-xs text-muted-foreground">{formatDateTime(store.created_at)}</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button asChild size="sm">
                      <Link to="/admin/store/$storeId" params={{ storeId: store.id }}>
                        Kontrol
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/store/$storeId/dashboard" params={{ storeId: store.id }}>
                        Panel
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`${store.name} mağazasını düzenle`}
                      onClick={() =>
                        setForm({
                          storeId: store.id,
                          name: store.name,
                          slug: store.slug,
                          industry: store.industry ?? "Genel",
                          currency: (store.currency as Currency) ?? "TRY",
                          locale: (store.locale as Locale) ?? "tr",
                          status: store.status as Status,
                          planId: store.plan_id ?? "none",
                          ownerEmail: "",
                        })
                      }
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      aria-label={`${store.name} mağazasını sil`}
                      onClick={() => {
                        setDeleteTarget({ id: store.id, name: store.name, slug: store.slug });
                        setDeleteConfirm("");
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  Kayıt bulunamadı. Yeni mağaza oluşturarak başlayın.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Dialog open={form !== null} onOpenChange={(open) => (open ? null : setForm(null))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.storeId ? "Mağazayı düzenle" : "Yeni mağaza oluştur"}</DialogTitle>
            <DialogDescription>
              Mağaza verileri tenant kimliğine göre izole edilir; panel ve vitrin bu kayıt üzerinden çalışır.
            </DialogDescription>
          </DialogHeader>

          {form ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="store-name">Mağaza adı</Label>
                <Input
                  id="store-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            name: event.target.value,
                            slug: current.storeId ? current.slug : slugify(event.target.value),
                          }
                        : current,
                    )
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="store-slug">Slug (vitrin adresi)</Label>
                <Input
                  id="store-slug"
                  value={form.slug}
                  onChange={(event) =>
                    setForm((current) => (current ? { ...current, slug: event.target.value } : current))
                  }
                />
                <p className="text-xs text-muted-foreground">/s/{slugify(form.slug || form.name) || "magaza"}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="store-industry">Sektör</Label>
                  <Input
                    id="store-industry"
                    value={form.industry}
                    onChange={(event) =>
                      setForm((current) => (current ? { ...current, industry: event.target.value } : current))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Paket</Label>
                  <Select
                    value={form.planId}
                    onValueChange={(value) =>
                      setForm((current) => (current ? { ...current, planId: value } : current))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Paket yok</SelectItem>
                      {(plans ?? []).map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Para birimi</Label>
                  <Select
                    value={form.currency}
                    onValueChange={(value) =>
                      setForm((current) => (current ? { ...current, currency: value as Currency } : current))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((currency) => (
                        <SelectItem key={currency} value={currency}>
                          {currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Dil</Label>
                  <Select
                    value={form.locale}
                    onValueChange={(value) =>
                      setForm((current) => (current ? { ...current, locale: value as Locale } : current))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCALES.map((locale) => (
                        <SelectItem key={locale} value={locale}>
                          {locale}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Durum</Label>
                  <Select
                    value={form.status}
                    onValueChange={(value) =>
                      setForm((current) => (current ? { ...current, status: value as Status } : current))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {STORE_STATUS_LABELS[status] ?? status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.storeId ? null : (
                <div className="grid gap-2">
                  <Label htmlFor="store-owner">Mağaza sahibi e-postası (opsiyonel)</Label>
                  <Input
                    id="store-owner"
                    type="email"
                    placeholder="Boş bırakılırsa mağaza sizin adınıza açılır"
                    value={form.ownerEmail}
                    onChange={(event) =>
                      setForm((current) => (current ? { ...current, ownerEmail: event.target.value } : current))
                    }
                  />
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Vazgeç
            </Button>
            <Button
              disabled={!form || form.name.trim().length < 2 || saveMutation.isPending}
              onClick={() => form && saveMutation.mutate(form)}
            >
              {saveMutation.isPending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteConfirm("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mağazayı sil</DialogTitle>
            <DialogDescription>
              {deleteTarget?.name} mağazası ve tüm ürün, sipariş, tema verisi kalıcı olarak silinir. Onaylamak
              için slug'ı yazın: <strong>{deleteTarget?.slug}</strong>
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirm}
            onChange={(event) => setDeleteConfirm(event.target.value)}
            placeholder={deleteTarget?.slug ?? ""}
            aria-label="Silme onayı için slug"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Vazgeç
            </Button>
            <Button
              variant="destructive"
              disabled={!deleteTarget || deleteConfirm.trim() !== deleteTarget.slug || deleteMutation.isPending}
              onClick={() =>
                deleteTarget &&
                deleteMutation.mutate({ storeId: deleteTarget.id, confirmSlug: deleteConfirm.trim() })
              }
            >
              {deleteMutation.isPending ? "Siliniyor…" : "Kalıcı olarak sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
