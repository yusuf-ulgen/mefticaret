import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { BookLock, Landmark, Plus, Undo2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  LEDGER_ACCOUNT_KIND_LABELS,
  LEDGER_MANUAL_TX,
  LEDGER_STATUS_LABELS,
  LEDGER_TX_LABELS,
  ledgerBalancesQuery,
  ledgerEntriesQuery,
  type LedgerManualTx,
} from "@/lib/ledger-queries";
import { postLedgerEntry, reverseLedgerEntry, settleLedgerEntry } from "@/lib/ledger.functions";
import { formatDateTime, formatMoney } from "@/lib/mefti";
import { sellersQuery } from "@/lib/marketplace-queries";
import { storeQuery } from "@/lib/store-queries";

const RANGES = [30, 90, 365] as const;

export const Route = createFileRoute("/_authenticated/store/$storeId/ledger")({
  head: () => ({
    meta: [
      { title: "Finansal Defter (Ledger) — Mefticaret" },
      {
        name: "description",
        content:
          "Değiştirilemez çift taraflı finansal defter: müşteri ödemesi, satıcı kazancı, marketplace komisyonu, iade, para çekme ve platform ücreti kayıtları.",
      },
      { property: "og:title", content: "Finansal Defter (Ledger) — Mefticaret" },
      {
        property: "og:description",
        content: "Bakiyeler yalnızca defter kayıtlarından hesaplanır; kayıtlar silinemez, yalnızca ters kayıtla düzeltilir.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LedgerPage,
});

function LedgerPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const [days, setDays] = useState<number>(90);
  const [accountId, setAccountId] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState<{
    kind: LedgerManualTx;
    amount: string;
    reference: string;
    description: string;
    status: "pending" | "posted";
    sellerId: string;
  }>({ kind: "customer_payment", amount: "", reference: "", description: "", status: "posted", sellerId: "" });

  const { data: store } = useQuery(storeQuery(storeId));
  const { data: balances, isLoading: balancesLoading } = useQuery(ledgerBalancesQuery(storeId));
  const { data: sellers } = useQuery(sellersQuery(storeId));
  const { data: entries, isLoading } = useQuery(
    ledgerEntriesQuery(storeId, {
      days,
      ...(accountId === "all" ? {} : { accountId }),
      ...(kindFilter === "all" ? {} : { kind: kindFilter }),
      ...(statusFilter === "all" ? {} : { status: statusFilter }),
    }),
  );

  const currency = store?.currency ?? "TRY";
  const postFn = useServerFn(postLedgerEntry);
  const reverseFn = useServerFn(reverseLedgerEntry);
  const settleFn = useServerFn(settleLedgerEntry);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["ledger-entries", storeId] });
    void queryClient.invalidateQueries({ queryKey: ["ledger-balances", storeId] });
    void queryClient.invalidateQueries({ queryKey: ["ledger-accounts", storeId] });
  };

  const totals = useMemo(() => {
    const rows = balances ?? [];
    return {
      balance: rows.reduce((sum, row) => sum + row.balance, 0),
      pending: rows.reduce((sum, row) => sum + row.pending, 0),
      credit: rows.reduce((sum, row) => sum + row.credit, 0),
      debit: rows.reduce((sum, row) => sum + row.debit, 0),
    };
  }, [balances]);

  const post = useMutation({
    mutationFn: () =>
      postFn({
        data: {
          storeId,
          kind: form.kind,
          amount: Number(form.amount.replace(",", ".")),
          status: form.status,
          ...(form.reference.trim() ? { reference: form.reference.trim() } : {}),
          ...(form.description.trim() ? { description: form.description.trim() } : {}),
          ...(form.sellerId ? { sellerId: form.sellerId } : {}),
        },
      }),
    onSuccess: () => {
      toast.success("Defter kaydı oluşturuldu");
      setOpen(false);
      setForm((prev) => ({ ...prev, amount: "", reference: "", description: "" }));
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reverse = useMutation({
    mutationFn: (entryId: string) => reverseFn({ data: { storeId, entryId } }),
    onSuccess: () => {
      toast.success("Ters kayıt oluşturuldu");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const settle = useMutation({
    mutationFn: (input: { entryId: string; status: "posted" | "cancelled" | "failed" }) =>
      settleFn({ data: { storeId, ...input } }),
    onSuccess: () => {
      toast.success("Kayıt durumu güncellendi");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cards = [
    { label: "Defter bakiyesi", value: formatMoney(totals.balance, currency), icon: Wallet },
    { label: "Bekleyen tutar", value: formatMoney(totals.pending, currency), icon: BookLock },
    { label: "Toplam alacak", value: formatMoney(totals.credit, currency), icon: Landmark },
    { label: "Toplam borç", value: formatMoney(totals.debit, currency), icon: Landmark },
  ];

  return (
    <AppShell
      storeId={storeId}
      title="Finansal Defter"
      description="Bakiye yalnızca defter kayıtlarından hesaplanır. Kayıtlar değiştirilemez ve silinemez; düzeltmeler ters kayıtla yapılır."
      actions={
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-border/60 p-1">
            {RANGES.map((range) => (
              <Button key={range} size="sm" variant={days === range ? "default" : "ghost"} onClick={() => setDays(range)}>
                {range}g
              </Button>
            ))}
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button>
                <Plus className="mr-2 size-4" />
                Defter kaydı
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Yeni defter kaydı</SheetTitle>
                <SheetDescription>
                  Kayıt oluşturulduktan sonra tutar, tip ve tarih değiştirilemez. Yanlış kayıt ters kayıtla düzeltilir.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label>İşlem tipi</Label>
                  <Select value={form.kind} onValueChange={(value) => setForm((prev) => ({ ...prev, kind: value as LedgerManualTx }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEDGER_MANUAL_TX.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {LEDGER_TX_LABELS[kind] ?? kind}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {form.kind === "seller_earning" ? (
                  <div className="space-y-2">
                    <Label>Satıcı</Label>
                    <Select value={form.sellerId} onValueChange={(value) => setForm((prev) => ({ ...prev, sellerId: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Satıcı seç" />
                      </SelectTrigger>
                      <SelectContent>
                        {(sellers ?? []).map((seller) => (
                          <SelectItem key={seller.id} value={seller.id}>
                            {seller.display_name ?? seller.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="ledger-amount">Tutar ({currency})</Label>
                  <Input
                    id="ledger-amount"
                    inputMode="decimal"
                    value={form.amount}
                    onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                    placeholder="1500.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ledger-ref">Referans</Label>
                  <Input
                    id="ledger-ref"
                    value={form.reference}
                    onChange={(event) => setForm((prev) => ({ ...prev, reference: event.target.value }))}
                    placeholder="TX-2026-0001"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Durum</Label>
                  <Select
                    value={form.status}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as "pending" | "posted" }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="posted">Kesinleşti</SelectItem>
                      <SelectItem value="pending">Bekliyor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ledger-desc">Açıklama</Label>
                  <Textarea
                    id="ledger-desc"
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                    rows={3}
                  />
                </div>

                <Button
                  className="w-full"
                  disabled={post.isPending || !Number(form.amount.replace(",", "."))}
                  onClick={() => post.mutate()}
                >
                  {post.isPending ? "Kaydediliyor…" : "Deftere işle"}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="surface-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{card.label}</span>
              <card.icon className="size-4 text-brand-foreground" />
            </div>
            <div className="mt-2 font-display text-2xl font-semibold">
              {balancesLoading ? <Skeleton className="h-7 w-24" /> : card.value}
            </div>
          </div>
        ))}
      </div>

      <section className="surface-card p-6">
        <h2 className="font-display text-lg font-semibold">Hesaplar ve bakiyeler</h2>
        {(balances ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Henüz defter hesabı hareketi yok.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hesap</TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead>Para birimi</TableHead>
                  <TableHead className="text-right">Alacak</TableHead>
                  <TableHead className="text-right">Borç</TableHead>
                  <TableHead className="text-right">Bakiye</TableHead>
                  <TableHead className="text-right">Bekleyen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(balances ?? []).map((row) => (
                  <TableRow key={row.account_id}>
                    <TableCell className="font-medium">{row.account_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{LEDGER_ACCOUNT_KIND_LABELS[row.account_kind] ?? row.account_kind}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.currency}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.credit, row.currency)}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.debit, row.currency)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatMoney(row.balance, row.currency)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatMoney(row.pending, row.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="surface-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Defter kayıtları</h2>
            <p className="text-sm text-muted-foreground">Kayıtlar değiştirilemez; düzeltme ters kayıtla yapılır.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Hesap" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm hesaplar</SelectItem>
                {(balances ?? []).map((row) => (
                  <SelectItem key={row.account_id} value={row.account_id}>
                    {row.account_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="İşlem tipi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm tipler</SelectItem>
                {Object.entries(LEDGER_TX_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm durumlar</SelectItem>
                {Object.entries(LEDGER_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="mt-4 h-64 w-full" />
        ) : (entries ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Kayıt bulunamadı.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>İşlem tipi</TableHead>
                  <TableHead>Referans</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">Tutar</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(entries ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(row.occurred_at)}</TableCell>
                    <TableCell>
                      <Badge variant={row.direction === "credit" ? "default" : "secondary"}>
                        {LEDGER_TX_LABELS[row.kind] ?? row.kind}
                      </Badge>
                      {row.reverses_entry_id ? <span className="ml-2 text-xs text-muted-foreground">ters kayıt</span> : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.reference ?? row.description ?? "—"}</TableCell>
                    <TableCell>
                      {row.status === "pending" ? (
                        <Select
                          value="pending"
                          onValueChange={(value) =>
                            settle.mutate({ entryId: row.id, status: value as "posted" | "cancelled" | "failed" })
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Bekliyor</SelectItem>
                            <SelectItem value="posted">Kesinleştir</SelectItem>
                            <SelectItem value="cancelled">İptal</SelectItem>
                            <SelectItem value="failed">Başarısız</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline">{LEDGER_STATUS_LABELS[row.status] ?? row.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${row.direction === "credit" ? "" : "text-destructive"}`}>
                      {row.direction === "credit" ? "+" : "−"}
                      {formatMoney(Number(row.amount ?? 0), row.currency ?? currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.reverses_entry_id ? null : (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={reverse.isPending}
                          onClick={() => reverse.mutate(row.id)}
                        >
                          <Undo2 className="mr-1 size-3.5" />
                          Ters kayıt
                        </Button>
                      )}
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
