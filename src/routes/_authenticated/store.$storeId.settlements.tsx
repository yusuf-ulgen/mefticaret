import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Download, Plus, Wallet } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CardSkeleton, TableSkeleton } from "@/components/ui/data-skeleton";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatDate, formatMoney } from "@/lib/mefti";
import {
  SETTLEMENT_STATUSES,
  SETTLEMENT_STATUS_LABELS,
  type SettlementStatus,
} from "@/lib/marketplace-ops";
import { marketplaceSettlementsQuery, settlementSummaryQuery } from "@/lib/marketplace-ops-queries";
import { deleteSettlement, upsertSettlement } from "@/lib/marketplace-ops.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/settlements")({
  head: () => {
    const title = "Mutabakat & Hakediş — Mefticaret";
    const description =
      "Pazaryeri başına brüt satış, komisyon, kargo ve kesinti tutarlarını dönem bazında karşılaştır, mutabakat kayıtlarını takip et.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: () => (
    <AppShell title="Mutabakat & Hakediş" description="Bu sayfa şu anda yüklenemedi.">
      <div className="surface-card p-10 text-center text-sm text-muted-foreground">
        Bir sorun oluştu. Sayfayı yenilemeyi deneyin.
      </div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell title="Mutabakat & Hakediş" description="Kayıt bulunamadı.">
      <div className="surface-card p-10 text-center text-sm text-muted-foreground">
        Aradığınız mutabakat kaydı bulunamadı.
      </div>
    </AppShell>
  ),
  component: SettlementsPage,
});

const STATUS_TONE: Record<SettlementStatus, string> = {
  pending: "bg-amber-500/15 text-amber-600",
  processing: "bg-sky-500/15 text-sky-600",
  paid: "bg-emerald-500/15 text-emerald-600",
  disputed: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function ManualSettlementDialog({ storeId, onDone }: { storeId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [marketplace, setMarketplace] = useState("");
  const [periodStart, setPeriodStart] = useState(firstOfMonthIso());
  const [periodEnd, setPeriodEnd] = useState(todayIso());
  const [gross, setGross] = useState("0");
  const [commission, setCommission] = useState("0");
  const [shipping, setShipping] = useState("0");
  const [otherDeductions, setOtherDeductions] = useState("0");

  const upsert = useServerFn(upsertSettlement);
  const mutation = useMutation({
    mutationFn: () => {
      const grossAmount = Number(gross) || 0;
      const commissionAmount = Number(commission) || 0;
      const shippingAmount = Number(shipping) || 0;
      const otherAmount = Number(otherDeductions) || 0;
      const netAmount = grossAmount - commissionAmount - shippingAmount - otherAmount;
      return upsert({
        data: {
          storeId,
          marketplace,
          periodStart,
          periodEnd,
          grossAmount,
          commissionAmount,
          shippingAmount,
          otherDeductions: otherAmount,
          netAmount,
          status: "pending",
        },
      });
    },
    onSuccess: () => {
      toast.success("Mutabakat kaydı oluşturuldu");
      setOpen(false);
      setMarketplace("");
      setGross("0");
      setCommission("0");
      setShipping("0");
      setOtherDeductions("0");
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" /> Manuel kayıt
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manuel mutabakat kaydı</DialogTitle>
          <DialogDescription>
            Pazaryeri hakediş raporunuzdan gelen dönem tutarlarını girin.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="s-mp">Pazaryeri</Label>
            <Input id="s-mp" value={marketplace} onChange={(e) => setMarketplace(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="s-start">Dönem başlangıcı</Label>
              <Input id="s-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-end">Dönem bitişi</Label>
              <Input id="s-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="s-gross">Brüt</Label>
              <Input id="s-gross" type="number" value={gross} onChange={(e) => setGross(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-comm">Komisyon</Label>
              <Input id="s-comm" type="number" value={commission} onChange={(e) => setCommission(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-ship">Kargo</Label>
              <Input id="s-ship" type="number" value={shipping} onChange={(e) => setShipping(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-other">Diğer kesinti</Label>
              <Input
                id="s-other"
                type="number"
                value={otherDeductions}
                onChange={(e) => setOtherDeductions(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!marketplace || mutation.isPending} onClick={() => mutation.mutate()}>
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettlementsPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(firstOfMonthIso());
  const [to, setTo] = useState(todayIso());
  const [status, setStatus] = useState<SettlementStatus | "all">("all");

  const summaryQuery = useQuery(settlementSummaryQuery(storeId, from, to));
  const listQuery = useQuery(marketplaceSettlementsQuery(storeId, { status, from, to }));

  const update = useServerFn(upsertSettlement);
  const remove = useServerFn(deleteSettlement);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["marketplace-settlements", storeId] });
    void queryClient.invalidateQueries({ queryKey: ["marketplace-ops-settlement-summary", storeId] });
  };

  const statusMutation = useMutation({
    mutationFn: (input: { settlementId: string; row: any; status: SettlementStatus }) =>
      update({
        data: {
          storeId,
          settlementId: input.settlementId,
          marketplace: input.row.marketplace,
          periodStart: input.row.period_start,
          periodEnd: input.row.period_end,
          grossAmount: Number(input.row.gross_amount ?? 0),
          commissionAmount: Number(input.row.commission_amount ?? 0),
          shippingAmount: Number(input.row.shipping_amount ?? 0),
          serviceFee: Number(input.row.service_fee ?? 0),
          otherDeductions: Number(input.row.other_deductions ?? 0),
          netAmount: Number(input.row.net_amount ?? 0),
          currency: input.row.currency ?? "TRY",
          status: input.status,
        },
      }),
    onSuccess: () => {
      toast.success("Durum güncellendi");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (settlementId: string) => remove({ data: { storeId, settlementId } }),
    onSuccess: () => {
      toast.success("Kayıt silindi");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const summary = summaryQuery.data ?? [];
  const rows = listQuery.data ?? [];

  const exportCsv = () => {
    downloadCsv(
      `mutabakat-${storeId}.csv`,
      toCsv(
        ["Pazaryeri", "Dönem başı", "Dönem sonu", "Brüt", "Komisyon", "Kargo", "Kesinti", "Net", "Durum"],
        rows.map((row) => [
          row.marketplace,
          row.period_start,
          row.period_end,
          Number(row.gross_amount ?? 0).toFixed(2),
          Number(row.commission_amount ?? 0).toFixed(2),
          Number(row.shipping_amount ?? 0).toFixed(2),
          (Number(row.service_fee ?? 0) + Number(row.other_deductions ?? 0)).toFixed(2),
          Number(row.net_amount ?? 0).toFixed(2),
          SETTLEMENT_STATUS_LABELS[row.status as SettlementStatus] ?? row.status,
        ]),
      ),
    );
  };

  return (
    <AppShell
      storeId={storeId}
      title="Mutabakat & Hakediş"
      description="Pazaryeri hakediş dönemlerini karşılaştır, mutabakat kayıtlarını yönet."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="mr-2 size-4" /> CSV
          </Button>
          <ManualSettlementDialog storeId={storeId} onDone={invalidate} />
        </div>
      }
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="f-from">Başlangıç</Label>
          <Input id="f-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-to">Bitiş</Label>
          <Input id="f-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Durum</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as SettlementStatus | "all")}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {SETTLEMENT_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {SETTLEMENT_STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {summaryQuery.isLoading ? (
        <CardSkeleton count={4} className="mt-6" />
      ) : summary.length === 0 ? (
        <div className="mt-6 surface-card p-10 text-center text-sm text-muted-foreground">
          <Wallet className="mx-auto mb-2 size-6" />
          Bu dönemde mutabakat verisi yok.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summary.map((row) => (
            <div key={row.marketplace} className="surface-card space-y-2 p-5">
              <p className="text-sm font-semibold">{row.marketplace}</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Brüt: {formatMoney(row.gross)}</p>
                <p>Komisyon: {formatMoney(row.commission)}</p>
                <p>Kargo: {formatMoney(row.shipping)}</p>
                <p>Kesinti: {formatMoney(row.fees)}</p>
              </div>
              <p className="text-lg font-semibold">{formatMoney(row.net)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        {listQuery.isLoading ? (
          <TableSkeleton rows={6} columns={7} />
        ) : rows.length === 0 ? (
          <div className="surface-card p-10 text-center text-sm text-muted-foreground">
            Bu filtrede mutabakat kaydı yok.
          </div>
        ) : (
          <div className="surface-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pazaryeri</TableHead>
                  <TableHead>Dönem</TableHead>
                  <TableHead>Brüt</TableHead>
                  <TableHead>Komisyon</TableHead>
                  <TableHead>Kargo</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const rowStatus = row.status as SettlementStatus;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.marketplace}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDate(row.period_start)} – {formatDate(row.period_end)}
                      </TableCell>
                      <TableCell>{formatMoney(Number(row.gross_amount ?? 0), row.currency ?? "TRY")}</TableCell>
                      <TableCell>{formatMoney(Number(row.commission_amount ?? 0), row.currency ?? "TRY")}</TableCell>
                      <TableCell>{formatMoney(Number(row.shipping_amount ?? 0), row.currency ?? "TRY")}</TableCell>
                      <TableCell className="font-semibold">
                        {formatMoney(Number(row.net_amount ?? 0), row.currency ?? "TRY")}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={rowStatus}
                          onValueChange={(value) =>
                            statusMutation.mutate({
                              settlementId: row.id,
                              row,
                              status: value as SettlementStatus,
                            })
                          }
                        >
                          <SelectTrigger className="h-8 w-36">
                            <Badge className={STATUS_TONE[rowStatus]} variant="secondary">
                              {SETTLEMENT_STATUS_LABELS[rowStatus]}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {SETTLEMENT_STATUSES.map((value) => (
                              <SelectItem key={value} value={value}>
                                {SETTLEMENT_STATUS_LABELS[value]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => deleteMutation.mutate(row.id)}
                        >
                          Sil
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
