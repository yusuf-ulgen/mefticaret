import { QueryStatus } from "@/components/query-status";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Banknote, Landmark, Receipt, Wallet } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createPayout, updatePayoutStatus } from "@/lib/finance.functions";
import {
  LEDGER_KIND_LABELS,
  PAYOUT_STATUS_LABELS,
  ledgerQuery,
  payoutsQuery,
  summarizeLedger,
} from "@/lib/finance-queries";
import { formatDate, formatDateTime, formatMoney } from "@/lib/mefti";
import { storeQuery } from "@/lib/store-queries";

const RANGES = [30, 90, 180] as const;

function isoDate(offsetDays: number) {
  return new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export const Route = createFileRoute("/_authenticated/store/$storeId/finance")({
  head: () => ({
    meta: [
      { title: "Finans & Hakediş — Mefticaret" },
      {
        name: "description",
        content:
          "Satış, kargo, indirim, komisyon ve iade kayıtlarını içeren finans defteri ile hakediş dönemleri.",
      },
      { property: "og:title", content: "Finans & Hakediş — Mefticaret" },
      {
        property: "og:description",
        content: "Mağazanın net hakedişini ve finans hareketlerini takip et.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FinancePage,
});

function FinancePage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const [days, setDays] = useState<number>(30);
  const [periodStart, setPeriodStart] = useState(isoDate(15));
  const [periodEnd, setPeriodEnd] = useState(isoDate(1));
  const [reference, setReference] = useState("");
  const [open, setOpen] = useState(false);

  const { data: store } = useQuery(storeQuery(storeId));
  const {
    data: ledger,
    isLoading,
    error: ledgerError,
    refetch: retryLedger,
  } = useQuery(ledgerQuery(storeId, days));
  const {
    data: payouts,
    isPending: payoutsPending,
    error: payoutsError,
    refetch: retryPayouts,
  } = useQuery(payoutsQuery(storeId));

  const createFn = useServerFn(createPayout);
  const statusFn = useServerFn(updatePayoutStatus);
  const currency = store?.currency ?? "TRY";
  const rows = ledger ?? [];
  const summary = useMemo(() => summarizeLedger(rows as never[]), [rows]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["ledger", storeId] });
    void queryClient.invalidateQueries({ queryKey: ["payouts", storeId] });
  };

  const close = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          storeId,
          periodStart,
          periodEnd,
          reference: reference.trim() || undefined,
        },
      }),
    onSuccess: (result) => {
      toast.success(`Dönem kapatıldı — net ${formatMoney(result.net, currency)}`);
      setOpen(false);
      setReference("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setStatus = useMutation({
    mutationFn: (input: {
      payoutId: string;
      status: "pending" | "processing" | "paid" | "failed";
    }) => statusFn({ data: { storeId, ...input } }),
    onSuccess: () => {
      toast.success("Hakediş durumu güncellendi");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cards = [
    {
      label: `Brüt gelir (${days} gün)`,
      value: formatMoney(summary.credit, currency),
      icon: ArrowUpRight,
    },
    {
      label: "Kesinti & indirim",
      value: formatMoney(summary.debit, currency),
      icon: ArrowDownRight,
    },
    { label: "Net hakediş", value: formatMoney(summary.net, currency), icon: Wallet },
    { label: "Platform komisyonu", value: formatMoney(summary.fees, currency), icon: Receipt },
  ];

  return (
    <AppShell
      storeId={storeId}
      title="Finans & Hakediş"
      description="Değiştirilemez finans defteri, komisyon kesintileri ve dönemsel hakediş yönetimi."
      actions={
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-border/60 p-1">
            {RANGES.map((range) => (
              <Button
                key={range}
                size="sm"
                variant={days === range ? "default" : "ghost"}
                onClick={() => setDays(range)}
              >
                {range}g
              </Button>
            ))}
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button>
                <Landmark className="mr-2 size-4" />
                Dönem kapat
              </Button>
            </SheetTrigger>
            <SheetContent className="h-[100dvh] w-full overflow-y-auto sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Hakediş dönemi kapat</SheetTitle>
                <SheetDescription>
                  Seçilen tarih aralığındaki finans kayıtları toplanır ve yeni bir hakediş kaydı
                  oluşturulur.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="period-start">Dönem başlangıcı</Label>
                  <Input
                    id="period-start"
                    type="date"
                    value={periodStart}
                    onChange={(event) => setPeriodStart(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="period-end">Dönem bitişi</Label>
                  <Input
                    id="period-end"
                    type="date"
                    value={periodEnd}
                    onChange={(event) => setPeriodEnd(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payout-ref">Banka referansı (opsiyonel)</Label>
                  <Input
                    id="payout-ref"
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    placeholder="PAYOUT-2026-08"
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={close.isPending}
                  onClick={() => close.mutate()}
                >
                  {close.isPending ? "Hesaplanıyor…" : "Dönemi kapat"}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      }
    >
      <QueryStatus
        label="Finans defteri"
        error={ledgerError}
        loading={isLoading}
        hasData={ledger !== undefined}
        onRetry={() => void retryLedger()}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="surface-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{card.label}</span>
              <card.icon className="size-4 text-brand-foreground" />
            </div>
            <div className="mt-2 font-display text-2xl font-semibold">
              {isLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : ledger === undefined ? (
                "—"
              ) : (
                card.value
              )}
            </div>
          </div>
        ))}
      </div>

      <section className="surface-card p-6">
        <h2 className="font-display text-lg font-semibold">Kalem kırılımı</h2>
        {ledger === undefined ? null : summary.byKind.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Bu dönemde finans hareketi yok.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {summary.byKind.map(([kind, amount]) => (
              <li
                key={kind}
                className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
              >
                <span>{LEDGER_KIND_LABELS[kind] ?? kind}</span>
                <span className="text-muted-foreground">{formatMoney(amount, currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="surface-card p-6">
        <div className="flex items-center gap-2">
          <Banknote className="size-4 text-brand-foreground" />
          <h2 className="font-display text-lg font-semibold">Hakediş dönemleri</h2>
        </div>
        <QueryStatus
          label="Hakediş dönemleri"
          error={payoutsError}
          loading={payoutsPending}
          hasData={payouts !== undefined}
          onRetry={() => void retryPayouts()}
        />
        {payouts === undefined ? null : payouts.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Henüz hakediş kaydı yok.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Dönem</TableHead>
                  <TableHead>Brüt</TableHead>
                  <TableHead>Kesinti</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Referans</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(payouts ?? []).map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(payout.period_start)} – {formatDate(payout.period_end)}
                    </TableCell>
                    <TableCell>
                      {formatMoney(Number(payout.gross_amount ?? 0), payout.currency ?? currency)}
                    </TableCell>
                    <TableCell>
                      {formatMoney(Number(payout.fee_amount ?? 0), payout.currency ?? currency)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatMoney(Number(payout.net_amount ?? 0), payout.currency ?? currency)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {payout.reference ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={payout.status}
                        onValueChange={(value) =>
                          setStatus.mutate({
                            payoutId: payout.id,
                            status: value as "pending" | "processing" | "paid" | "failed",
                          })
                        }
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(PAYOUT_STATUS_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="surface-card p-6">
        <h2 className="font-display text-lg font-semibold">Finans defteri</h2>
        <p className="text-sm text-muted-foreground">
          Kayıtlar değiştirilemez; her sipariş otomatik olarak deftere işlenir.
        </p>
        {isLoading ? (
          <Skeleton className="mt-4 h-48 w-full" />
        ) : ledger === undefined ? null : rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Kayıt bulunamadı.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Kalem</TableHead>
                  <TableHead>Açıklama</TableHead>
                  <TableHead className="text-right">Tutar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 120).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(row.occurred_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.direction === "credit" ? "default" : "secondary"}>
                        {LEDGER_KIND_LABELS[row.kind] ?? row.kind}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.description ?? "—"}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${row.direction === "credit" ? "" : "text-destructive"}`}
                    >
                      {row.direction === "credit" ? "+" : "−"}
                      {formatMoney(Number(row.amount ?? 0), row.currency ?? currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
