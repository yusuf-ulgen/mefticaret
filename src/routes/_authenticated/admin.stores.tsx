import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
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
import { formatDateTime, formatNumber, STORE_STATUS_LABELS } from "@/lib/mefti";
import { adminStoresQuery } from "@/lib/store-queries";
import { setStoreStatus } from "@/lib/admin.functions";
import { downloadCsv, toCsv } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/admin/stores")({
  head: () => ({
    meta: [
      { title: "Mağazalar — Süper Admin" },
      { name: "description", content: "Platformdaki tüm mağazaları filtrele, durumlarını yönet ve dışa aktar." },
      { property: "og:title", content: "Mağazalar — Süper Admin" },
      { property: "og:description", content: "Kiracı mağazaların merkezi yönetimi." },
    ],
  }),
  component: AdminStores,
});

const STATUS_OPTIONS = ["draft", "active", "suspended", "archived"] as const;

function AdminStores() {
  const { isPlatformAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { data: stores } = useQuery(adminStoresQuery(isPlatformAdmin));
  const updateStatus = useServerFn(setStoreStatus);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | (typeof STATUS_OPTIONS)[number]>("all");

  const statusMutation = useMutation({
    mutationFn: (input: { storeId: string; status: (typeof STATUS_OPTIONS)[number] }) =>
      updateStatus({ data: input }),
    onSuccess: () => {
      toast.success("Mağaza durumu güncellendi");
      queryClient.invalidateQueries({ queryKey: ["admin-stores"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit"] });
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
    <AdminShell title="Mağazalar" description="Kiracı mağazaları ara, durumlarını değiştir, dışa aktar.">
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
        <Button size="sm" variant="outline" className="ml-auto" onClick={exportStores}>
          <Download className="size-4" /> CSV indir
        </Button>
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
                  <p className="text-xs text-muted-foreground">{store.slug}</p>
                </td>
                <td className="px-5 py-3">{store.plans?.name ?? "—"}</td>
                <td className="px-5 py-3">
                  <Select
                    value={store.status}
                    onValueChange={(value) =>
                      statusMutation.mutate({
                        storeId: store.id,
                        status: value as (typeof STATUS_OPTIONS)[number],
                      })
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
                  <div className="flex justify-end gap-2">
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
                  </div>
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
