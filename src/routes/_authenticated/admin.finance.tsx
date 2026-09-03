import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/mefti";
import { platformFinanceQuery } from "@/lib/platform-finance-queries";
import type { PlatformRow } from "@/lib/platform-admin.server";

export const Route = createFileRoute("/_authenticated/admin/finance")({
  head: () => ({
    meta: [
      { title: "Finans Merkezi — Süper Admin" },
      {
        name: "description",
        content: "Gelirler, komisyonlar, iadeler, ödemeler, faturalar ve banka transferleri tek ekranda.",
      },
      { property: "og:title", content: "Finans Merkezi — Süper Admin" },
      { property: "og:description", content: "Mefticaret platformunun finansal komuta merkezi." },
    ],
  }),
  component: AdminFinancePage,
});

const RANGES = [7, 30, 90, 180, 365] as const;
const PAGE_SIZE = 20;

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="surface-card p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

type ColumnDef = {
  key: string;
  label: string;
  render?: (row: PlatformRow, storeNames: Record<string, string>) => string;
};

function PaginatedTable({
  title,
  rows,
  columns,
  storeNames,
  filename,
}: {
  title: string;
  rows: PlatformRow[];
  columns: ColumnDef[];
  storeNames: Record<string, string>;
  filename: string;
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const exportCsv = () => {
    downloadCsv(
      `${filename}-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        ["Mağaza", ...columns.map((c) => c.label)],
        rows.map((row) => [
          storeNames[String(row["store_id"] ?? "")] ?? "",
          ...columns.map((c) => c.render?.(row, storeNames) ?? String(row[c.key] ?? "—")),
        ]),
      ),
    );
  };

  return (
    <section className="surface-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{formatNumber(rows.length)} kayıt</Badge>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="size-4" /> CSV
          </Button>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Mağaza</th>
              {columns.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-3 py-2">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pageRows.map((row, index) => (
              <tr key={String(row["id"] ?? index)}>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {storeNames[String(row["store_id"] ?? "")] ?? "—"}
                </td>
                {columns.map((c) => (
                  <td key={c.key} className="px-3 py-2">
                    {c.render?.(row, storeNames) ?? String(row[c.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Bu aralıkta kayıt yok.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {totalPages > 1 ? (
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Önceki
          </Button>
          <span className="text-xs text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Sonraki
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function AdminFinancePage() {
  const { isPlatformAdmin } = useAuth();
  const [days, setDays] = useState<number>(30);
  const { data, isLoading, error } = useQuery(platformFinanceQuery(days, isPlatformAdmin));

  const kpis = data?.kpis;
  const storeNames = data?.storeNames ?? {};

  const cards = useMemo(
    () => [
      { label: "MRR", value: formatMoney(kpis?.mrr ?? 0), hint: "Aktif + deneme abonelikleri" },
      { label: "ARR", value: formatMoney(kpis?.arr ?? 0) },
      { label: "GMV", value: formatMoney(kpis?.gmv ?? 0), hint: `${days} günlük sipariş hacmi` },
      { label: "Tahsil edilen", value: formatMoney(kpis?.collected ?? 0), hint: "Başarılı ödemeler" },
      { label: "Bekleyen ödeme", value: formatMoney(kpis?.pendingPayments ?? 0) },
      { label: "Bekleyen fatura", value: formatMoney(kpis?.pendingInvoices ?? 0) },
      { label: "İade tutarı", value: formatMoney(kpis?.refundTotal ?? 0) },
      { label: "Komisyon geliri", value: formatMoney(kpis?.commissionTotal ?? 0) },
      { label: "Ödenen transfer (payout)", value: formatMoney(kpis?.payoutTotal ?? 0) },
      { label: "Vergi toplamı", value: formatMoney(kpis?.taxTotal ?? 0) },
    ],
    [kpis, days],
  );

  return (
    <AdminShell
      title="Finans Merkezi"
      description="Platform geneli gelir, komisyon, iade, ödeme ve tahsilat görünümü."
      actions={
        <div className="flex flex-wrap gap-1">
          {RANGES.map((range) => (
            <Button
              key={range}
              size="sm"
              variant={days === range ? "default" : "outline"}
              onClick={() => setDays(range)}
            >
              {range}g
            </Button>
          ))}
        </div>
      }
    >
      {error ? (
        <div className="surface-card p-6 text-sm text-destructive">{(error as Error).message}</div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <Kpi key={card.label} label={card.label} value={card.value} hint={card.hint} />
        ))}
      </div>

      <PaginatedTable
        title="Faturalar"
        rows={data?.invoices ?? []}
        storeNames={storeNames}
        filename="mefticaret-invoices"
        columns={[
          { key: "invoice_number", label: "Fatura No" },
          { key: "status", label: "Durum" },
          { key: "total", label: "Toplam", render: (row) => formatMoney(Number(row["total"] ?? 0)) },
          { key: "tax_total", label: "Vergi", render: (row) => formatMoney(Number(row["tax_total"] ?? 0)) },
          { key: "issued_at", label: "Kesim", render: (row) => formatDateTime(String(row["issued_at"] ?? "")) },
          {
            key: "due_at",
            label: "Vade",
            render: (row) => (row["due_at"] ? formatDateTime(String(row["due_at"])) : "—"),
          },
        ]}
      />

      <PaginatedTable
        title="Ödeme kayıtları"
        rows={data?.payments ?? []}
        storeNames={storeNames}
        filename="mefticaret-payments"
        columns={[
          { key: "provider", label: "Sağlayıcı" },
          { key: "method", label: "Yöntem", render: (row) => String(row["method"] ?? "—") },
          { key: "status", label: "Durum" },
          { key: "amount", label: "Tutar", render: (row) => formatMoney(Number(row["amount"] ?? 0)) },
          {
            key: "captured_at",
            label: "Tahsilat",
            render: (row) => (row["captured_at"] ? formatDateTime(String(row["captured_at"])) : "—"),
          },
          { key: "created_at", label: "Oluşturma", render: (row) => formatDateTime(String(row["created_at"] ?? "")) },
        ]}
      />

      <PaginatedTable
        title="İadeler (refunds)"
        rows={data?.refunds ?? []}
        storeNames={storeNames}
        filename="mefticaret-refunds"
        columns={[
          { key: "status", label: "Durum" },
          { key: "amount", label: "Tutar", render: (row) => formatMoney(Number(row["amount"] ?? 0)) },
          { key: "reason", label: "Sebep", render: (row) => String(row["reason"] ?? "—") },
          {
            key: "processed_at",
            label: "İşlenme",
            render: (row) => (row["processed_at"] ? formatDateTime(String(row["processed_at"])) : "—"),
          },
        ]}
      />

      <PaginatedTable
        title="Komisyonlar"
        rows={data?.commissions ?? []}
        storeNames={storeNames}
        filename="mefticaret-commissions"
        columns={[
          { key: "status", label: "Durum" },
          { key: "rate", label: "Oran", render: (row) => `${(Number(row["rate"] ?? 0) * 100).toFixed(2)}%` },
          { key: "base_amount", label: "Baz Tutar", render: (row) => formatMoney(Number(row["base_amount"] ?? 0)) },
          {
            key: "commission_amount",
            label: "Komisyon",
            render: (row) => formatMoney(Number(row["commission_amount"] ?? 0)),
          },
          { key: "created_at", label: "Tarih", render: (row) => formatDateTime(String(row["created_at"] ?? "")) },
        ]}
      />

      <PaginatedTable
        title="Banka transferleri (payouts)"
        rows={data?.payouts ?? []}
        storeNames={storeNames}
        filename="mefticaret-payouts"
        columns={[
          { key: "status", label: "Durum" },
          { key: "gross_amount", label: "Brüt", render: (row) => formatMoney(Number(row["gross_amount"] ?? 0)) },
          { key: "fee_amount", label: "Kesinti", render: (row) => formatMoney(Number(row["fee_amount"] ?? 0)) },
          { key: "net_amount", label: "Net", render: (row) => formatMoney(Number(row["net_amount"] ?? 0)) },
          {
            key: "period_start",
            label: "Dönem",
            render: (row) =>
              `${formatDateTime(String(row["period_start"] ?? ""))} → ${formatDateTime(String(row["period_end"] ?? ""))}`,
          },
          {
            key: "paid_at",
            label: "Ödeme",
            render: (row) => (row["paid_at"] ? formatDateTime(String(row["paid_at"])) : "—"),
          },
        ]}
      />

      {isLoading ? <p className="text-sm text-muted-foreground">Yükleniyor…</p> : null}
    </AdminShell>
  );
}
