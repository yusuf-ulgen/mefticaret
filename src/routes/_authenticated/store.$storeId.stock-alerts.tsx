import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BellRing, CheckCheck, Mail, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/mefti";
import { stockAlertsQuery } from "@/lib/stock-alerts-queries";
import { storeQuery } from "@/lib/store-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/stock-alerts")({
  head: () => ({
    meta: [
      { title: "Stok Bildirimleri — Mefticaret" },
      {
        name: "description",
        content: "Tükenen ürünler için stoğa gelince haber verilmesini isteyen müşterileri yönet.",
      },
      { property: "og:title", content: "Stok Bildirimleri — Mefticaret" },
      { property: "og:description", content: "Stok bekleyen müşteri taleplerini takip et ve bilgilendir." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StockAlertsPage,
});

function StockAlertsPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: store } = useQuery(storeQuery(storeId));
  const { data: alerts, isLoading } = useQuery(stockAlertsQuery(storeId));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["store", storeId, "stock-alerts"] });

  const markNotified = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("stock_alerts")
        .update({ notified_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bildirildi olarak işaretlendi");
      void invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "İşlem başarısız"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stock_alerts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kayıt silindi");
      void invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Silinemedi"),
  });

  const rows = alerts ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr");
    if (!q) return rows;
    return rows.filter((row) =>
      [row.email, row.products?.title ?? "", row.product_variants?.title ?? ""]
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(q),
    );
  }, [rows, search]);

  const pending = rows.filter((row) => !row.notified_at);
  const ready = pending.filter((row) => (row.product_variants?.stock ?? 0) > 0);

  return (
    <AppShell storeId={storeId} storeName={store?.name} title="Stok Bildirimleri">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Bekleyen talep" value={String(pending.length)} icon={<BellRing className="size-4" />} />
          <StatCard label="Stoğu gelenler" value={String(ready.length)} icon={<CheckCheck className="size-4" />} />
          <StatCard label="Toplam kayıt" value={String(rows.length)} icon={<Mail className="size-4" />} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="E-posta veya ürün ara"
            className="max-w-xs"
          />
          {ready.length > 0 ? (
            <Button
              size="sm"
              disabled={markNotified.isPending}
              onClick={() => markNotified.mutate(ready.map((row) => row.id))}
            >
              Stoğu gelenleri bildirildi işaretle ({ready.length})
            </Button>
          ) : null}
        </div>

        <div className="rounded-xl border bg-card">
          {isLoading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-2/3" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Henüz stok bildirimi talebi yok. Tükenen ürün sayfalarında müşteriler e-posta bırakabilir.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ürün</TableHead>
                  <TableHead>Varyant</TableHead>
                  <TableHead>E-posta</TableHead>
                  <TableHead>Stok</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const stock = row.product_variants?.stock ?? null;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.products?.title ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{row.product_variants?.title ?? "—"}</TableCell>
                      <TableCell>{row.email}</TableCell>
                      <TableCell>{stock === null ? "—" : stock}</TableCell>
                      <TableCell>
                        {row.notified_at ? (
                          <Badge variant="secondary">Bildirildi</Badge>
                        ) : stock && stock > 0 ? (
                          <Badge>Stok geldi</Badge>
                        ) : (
                          <Badge variant="outline">Bekliyor</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(row.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {row.notified_at ? null : (
                            <Button size="sm" variant="outline" onClick={() => markNotified.mutate([row.id])}>
                              Bildirildi
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Kaydı sil"
                            onClick={() => remove.mutate(row.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
