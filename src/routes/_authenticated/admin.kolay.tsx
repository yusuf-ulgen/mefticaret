import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, ExternalLink, Home, Package, ShoppingBag, Users } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime, formatMoney, formatNumber, STORE_STATUS_LABELS } from "@/lib/mefti";
import { listMicroStores, setMicroStoreStatus, type MicroStoreRow } from "@/lib/admin-kolay.functions";
import { downloadCsv, toCsv } from "@/lib/csv";

const DESCRIPTION =
  "Kolay Panel'e kayıt olan ev üreticisi satıcıları, vitrinlerini, ürün ve sipariş hareketlerini süper yönetici olarak izle ve durumlarını yönet.";

export const Route = createFileRoute("/_authenticated/admin/kolay")({
  head: () => ({
    meta: [
      { title: "Kolay Panel Satıcıları — Süper Admin" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Kolay Panel Satıcıları — Süper Admin" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminKolayPage,
});

const STATUSES = ["draft", "active", "suspended", "archived"] as const;
type Status = (typeof STATUSES)[number];

function AdminKolayPage() {
  const { isPlatformAdmin } = useAuth();
  const queryClient = useQueryClient();
  const fetchStores = useServerFn(listMicroStores);
  const updateStatus = useServerFn(setMicroStoreStatus);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");

  const stores = useQuery({
    queryKey: ["admin-micro-stores"],
    enabled: isPlatformAdmin,
    queryFn: async () => (await fetchStores()).stores,
  });

  const statusMutation = useMutation({
    mutationFn: (input: { storeId: string; status: Status }) => updateStatus({ data: input }),
    onSuccess: async () => {
      toast.success("Kolay Panel mağaza durumu güncellendi");
      await queryClient.invalidateQueries({ queryKey: ["admin-micro-stores"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = stores.data ?? [];

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("tr");
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!needle) return true;
      return `${row.name} ${row.slug} ${row.ownerName ?? ""} ${row.ownerEmail ?? ""} ${row.ownerPhone ?? ""} ${row.category ?? ""}`
        .toLocaleLowerCase("tr")
        .includes(needle);
    });
  }, [rows, search, statusFilter]);

  const totals = useMemo(
    () => ({
      sellers: rows.length,
      active: rows.filter((row) => row.status === "active").length,
      products: rows.reduce((sum, row) => sum + row.productCount, 0),
      orders: rows.reduce((sum, row) => sum + row.orderCount, 0),
      revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
    }),
    [rows],
  );

  const exportCsv = () => {
    const csv = toCsv(
      ["Mağaza", "Adres", "Kategori", "Satıcı", "E-posta", "Telefon", "Durum", "Ürün", "Sipariş", "Ciro", "Kayıt"],
      filtered.map((row) => [
        row.name,
        row.slug,
        row.category ?? "",
        row.ownerName ?? "",
        row.ownerEmail ?? "",
        row.ownerPhone ?? "",
        STORE_STATUS_LABELS[row.status as keyof typeof STORE_STATUS_LABELS] ?? row.status,
        row.productCount,
        row.orderCount,
        row.revenue,
        row.createdAt,
      ]),
    );
    downloadCsv("kolay-panel-saticilar.csv", csv);
  };

  return (
    <AdminShell
      title="Kolay Panel Satıcıları"
      description={DESCRIPTION}
      actions={
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="size-4" /> CSV indir
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Users className="size-4" />} label="Kayıtlı satıcı" value={formatNumber(totals.sellers)} hint={`${formatNumber(totals.active)} aktif vitrin`} />
        <StatCard icon={<Package className="size-4" />} label="Toplam ürün" value={formatNumber(totals.products)} />
        <StatCard icon={<ShoppingBag className="size-4" />} label="Toplam sipariş" value={formatNumber(totals.orders)} />
        <StatCard icon={<Home className="size-4" />} label="Toplam ciro" value={formatMoney(totals.revenue, "TRY")} />
      </div>

      <div className="surface-card mt-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Mağaza, satıcı, telefon veya kategori ara"
            className="sm:max-w-sm"
          />
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | Status)}>
            <SelectTrigger className="sm:w-44">
              <SelectValue placeholder="Durum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm durumlar</SelectItem>
              {STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {STORE_STATUS_LABELS[status] ?? status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground sm:ml-auto">
            {stores.isLoading ? "Yükleniyor…" : `${formatNumber(filtered.length)} satıcı`}
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Mağaza</th>
                <th className="px-3 py-2">Satıcı</th>
                <th className="px-3 py-2">Kategori</th>
                <th className="px-3 py-2 text-right">Ürün</th>
                <th className="px-3 py-2 text-right">Sipariş</th>
                <th className="px-3 py-2 text-right">Ciro</th>
                <th className="px-3 py-2">Son sipariş</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Vitrin</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-t border-border/60">
                  <td className="px-3 py-3">
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-muted-foreground">
                      /s/{row.slug} · {formatDateTime(row.createdAt)}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div>{row.ownerName ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{row.ownerPhone ?? row.ownerEmail ?? "—"}</div>
                  </td>
                  <td className="px-3 py-3">{row.category ?? "—"}</td>
                  <td className="px-3 py-3 text-right">{formatNumber(row.productCount)}</td>
                  <td className="px-3 py-3 text-right">{formatNumber(row.orderCount)}</td>
                  <td className="px-3 py-3 text-right">{formatMoney(row.revenue, "TRY")}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {row.lastOrderAt ? formatDateTime(row.lastOrderAt) : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <Select
                      value={row.status}
                      onValueChange={(value) =>
                        statusMutation.mutate({ storeId: row.id, status: value as Status })
                      }
                    >
                      <SelectTrigger className="h-9 w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {STORE_STATUS_LABELS[status] ?? status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-3">
                    <a
                      className="inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
                      href={`/s/${row.slug}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Vitrini aç <ExternalLink className="size-3.5" />
                    </a>
                  </td>
                </tr>
              ))}
              {!stores.isLoading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Kolay Panel mağazaları kurumsal paketlerden bağımsızdır: paket, abonelik ve faturalama bağlanmaz. Bu sayfa yalnızca
        izleme ve mağaza durumu yönetimi sağlar.
      </p>
    </AdminShell>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="surface-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export type { MicroStoreRow };
