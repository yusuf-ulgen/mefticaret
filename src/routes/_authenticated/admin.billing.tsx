import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchPlatformInvoices,
  markInvoicePaidManually,
} from "@/lib/admin-billing.functions";

/** Süper admin: ödeme sağlayıcısı ayarları ve tüm mağazaların fatura tahsilat takibi. */

export const Route = createFileRoute("/_authenticated/admin/billing")({
  head: () => ({
    meta: [
      { title: "Ödeme & Tahsilat — Süper Admin" },
      {
        name: "description",
        content: "Tüm mağazaların faturalarını ve tahsilat durumunu takip et.",
      },
      { property: "og:title", content: "Ödeme & Tahsilat — Süper Admin" },
      { property: "og:description", content: "Ödeme sağlayıcısı ayarları ve platform genelinde fatura tahsilatı." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminBillingPage,
});

const STATUS_LABELS: Record<string, string> = {
  draft: "Taslak",
  open: "Ödeme bekliyor",
  paid: "Ödendi",
  uncollectible: "Tahsil edilemedi",
  void: "İptal",
};

const STATUS_FILTERS = ["all", "open", "paid", "uncollectible", "void"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("tr-TR") : "—";
}

function InvoicesPanel() {
  const list = useServerFn(fetchPlatformInvoices);
  const markPaid = useServerFn(markInvoicePaidManually);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const invoicesQuery = useQuery({
    queryKey: ["admin", "platform-invoices", status, search],
    queryFn: () => list({ data: { status, ...(search ? { search } : {}) } }),
  });

  const payMutation = useMutation({
    mutationFn: (invoiceId: string) => markPaid({ data: { invoiceId } }),
    onSuccess: () => {
      toast.success("Fatura ödendi olarak işaretlendi.");
      void queryClient.invalidateQueries({ queryKey: ["admin", "platform-invoices"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = invoicesQuery.data ?? [];
  const openTotal = rows.filter((row) => row.status === "open").reduce((sum, row) => sum + row.total, 0);
  const paidTotal = rows.filter((row) => row.status === "paid").reduce((sum, row) => sum + row.total, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Bekleyen tahsilat</p>
            <p className="mt-1 font-display text-xl font-semibold">{formatMoney(openTotal, "TRY")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tahsil edilen</p>
            <p className="mt-1 font-display text-xl font-semibold">{formatMoney(paidTotal, "TRY")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Fatura sayısı</p>
            <p className="mt-1 font-display text-xl font-semibold">{rows.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={status === value ? "default" : "outline"}
            onClick={() => setStatus(value)}
          >
            {value === "all" ? "Tümü" : (STATUS_LABELS[value] ?? value)}
          </Button>
        ))}
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Fatura no veya mağaza ara"
          className="w-full max-w-xs"
          aria-label="Fatura ara"
        />
      </div>

      {invoicesQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Faturalar yükleniyor…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Bu filtreye uyan fatura yok.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2">Fatura</th>
                <th scope="col" className="px-3 py-2">Mağaza</th>
                <th scope="col" className="px-3 py-2">Durum</th>
                <th scope="col" className="px-3 py-2">Tutar</th>
                <th scope="col" className="px-3 py-2">Vade</th>
                <th scope="col" className="px-3 py-2">Ödeme</th>
                <th scope="col" className="px-3 py-2 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{row.invoiceNumber}</td>
                  <td className="px-3 py-2">{row.storeName}</td>
                  <td className="px-3 py-2">
                    <Badge variant={row.status === "paid" ? "default" : row.status === "open" ? "secondary" : "outline"}>
                      {STATUS_LABELS[row.status] ?? row.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">{formatMoney(row.total, row.currency)}</td>
                  <td className="px-3 py-2">{formatDate(row.dueAt)}</td>
                  <td className="px-3 py-2">{formatDate(row.paidAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1.5">
                      {row.payUrl ? (
                        <Button asChild size="sm" variant="outline">
                          <a href={row.payUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="size-3.5" /> Ödeme linki
                          </a>
                        </Button>
                      ) : null}
                      {row.status !== "paid" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={payMutation.isPending}
                          onClick={() => payMutation.mutate(row.id)}
                        >
                          Ödendi işaretle
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AdminBillingPage() {
  return (
    <AdminShell
      title="Ödeme & Tahsilat"
      description="Tüm mağazaların fatura tahsilat takibi."
    >
      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Faturalar & tahsilat</TabsTrigger>
        </TabsList>
        <TabsContent value="invoices" className="mt-4">
          <InvoicesPanel />
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
