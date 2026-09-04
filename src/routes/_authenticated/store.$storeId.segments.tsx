import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ClipboardCopy, Download, TicketPercent, UsersRound } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatMoney, formatNumber } from "@/lib/mefti";
import { upsertDiscount } from "@/lib/sales.functions";
import {
  SEGMENT_META,
  type SegmentKey,
  buildSegments,
  segmentOrdersQuery,
} from "@/lib/segments-queries";
import { storeQuery } from "@/lib/store-queries";
import { cn } from "@/lib/utils";

const SEGMENT_ORDER: SegmentKey[] = ["champion", "loyal", "new", "at_risk", "lost"];

const SEGMENT_CODE: Record<SegmentKey, string> = {
  champion: "VIP",
  loyal: "SADIK",
  new: "HOSGELDIN",
  at_risk: "GERIDON",
  lost: "OZLEDIK",
};

export const Route = createFileRoute("/_authenticated/store/$storeId/segments")({
  head: () => ({
    meta: [
      { title: "Müşteri Segmentleri — Mefticaret" },
      {
        name: "description",
        content:
          "RFM tabanlı müşteri segmentasyonu: şampiyonlar, sadık, yeni, riskli ve kayıp müşterileri tek ekranda yönetin.",
      },
      { property: "og:title", content: "Müşteri Segmentleri — Mefticaret" },
      {
        property: "og:description",
        content: "Sipariş sıklığı, güncelliği ve harcama tutarına göre otomatik müşteri segmentleri.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SegmentsPage,
});

function SegmentsPage() {
  const { storeId } = Route.useParams();
  const [active, setActive] = useState<SegmentKey | "all">("all");
  const [term, setTerm] = useState("");
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [percent, setPercent] = useState("10");
  const [validDays, setValidDays] = useState("14");

  const queryClient = useQueryClient();
  const saveDiscount = useServerFn(upsertDiscount);
  const { data: store } = useQuery(storeQuery(storeId));
  const { data: orders, isLoading } = useQuery(segmentOrdersQuery(storeId));
  const currency = store?.currency ?? "TRY";

  const rows = useMemo(() => buildSegments(orders ?? []), [orders]);

  const counts = useMemo(() => {
    const base = { champion: 0, loyal: 0, new: 0, at_risk: 0, lost: 0 } as Record<SegmentKey, number>;
    const revenue = { champion: 0, loyal: 0, new: 0, at_risk: 0, lost: 0 } as Record<SegmentKey, number>;
    for (const row of rows) {
      base[row.segment] += 1;
      revenue[row.segment] += row.revenue;
    }
    return { base, revenue };
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = term.trim().toLocaleLowerCase("tr");
    return rows.filter((row) => {
      if (active !== "all" && row.segment !== active) return false;
      if (!needle) return true;
      return (
        row.name.toLocaleLowerCase("tr").includes(needle) ||
        row.email.toLocaleLowerCase("tr").includes(needle)
      );
    });
  }, [rows, active, term]);

  function exportCsv() {
    const content = toCsv(
      ["Müşteri", "E-posta", "Segment", "Sipariş", "Ciro", "Ortalama Sepet", "Son Sipariş (gün)"],
      filtered.map((row) => [
        row.name,
        row.email,
        SEGMENT_META[row.segment].label,
        row.orders,
        row.revenue.toFixed(2),
        row.average.toFixed(2),
        row.recencyDays,
      ]),
    );
    downloadCsv(`segmentler-${new Date().toISOString().slice(0, 10)}.csv`, content);
  }

  const campaignCode = useMemo(() => {
    const base = active === "all" ? "SEGMENT" : SEGMENT_CODE[active];
    return `${base}${Math.round(Number(percent) || 0)}`;
  }, [active, percent]);

  const campaign = useMutation({
    mutationFn: async () => {
      const value = Number(percent);
      if (!Number.isFinite(value) || value <= 0 || value > 100) {
        throw new Error("Yüzde 1 ile 100 arasında olmalı");
      }
      const days = Math.max(1, Math.round(Number(validDays) || 14));
      const endsAt = new Date(Date.now() + days * 86_400_000).toISOString();
      await saveDiscount({
        data: {
          storeId,
          code: campaignCode,
          title: `${active === "all" ? "Tüm segmentler" : SEGMENT_META[active].label} geri kazanım kampanyası`,
          type: "percentage",
          value,
          minSubtotal: 0,
          usageLimit: null,
          endsAt,
          isActive: true,
        },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["discounts", storeId] });
      setCampaignOpen(false);
      toast.success(`${campaignCode} kuponu oluşturuldu`);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Kupon oluşturulamadı");
    },
  });

  async function copyEmails() {
    const emails = [...new Set(filtered.map((row) => row.email).filter(Boolean))];
    if (emails.length === 0) {
      toast.error("Kopyalanacak e-posta bulunamadı");
      return;
    }
    await navigator.clipboard.writeText(emails.join(", "));
    toast.success(`${emails.length} e-posta kopyalandı`);
  }

  return (
    <AppShell storeId={storeId} title="Müşteri Segmentleri">
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <UsersRound className="size-5 text-primary" /> Müşteri segmentleri
            </h1>
            <p className="text-sm text-muted-foreground">
              Sipariş güncelliği, sıklığı ve harcama tutarına göre otomatik RFM segmentasyonu.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={copyEmails} disabled={filtered.length === 0}>
              <ClipboardCopy className="mr-2 size-4" /> E-postaları kopyala
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="mr-2 size-4" /> CSV indir
            </Button>
            <Dialog open={campaignOpen} onOpenChange={setCampaignOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <TicketPercent className="mr-2 size-4" /> Geri kazanım kuponu
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Segment kuponu oluştur</DialogTitle>
                  <DialogDescription>
                    {active === "all"
                      ? "Tüm müşteriler için"
                      : `${SEGMENT_META[active].label} segmenti için`}{" "}
                    yüzde indirimli, süreli bir kupon üretilir.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="segment-percent">İndirim (%)</Label>
                    <Input
                      id="segment-percent"
                      value={percent}
                      inputMode="numeric"
                      onChange={(event) => setPercent(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="segment-days">Geçerlilik (gün)</Label>
                    <Input
                      id="segment-days"
                      value={validDays}
                      inputMode="numeric"
                      onChange={(event) => setValidDays(event.target.value)}
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Kupon kodu: <span className="font-mono font-medium text-foreground">{campaignCode}</span>
                </p>
                <DialogFooter>
                  <Button
                    onClick={() => campaign.mutate()}
                    disabled={campaign.isPending}
                  >
                    {campaign.isPending ? "Oluşturuluyor…" : "Kuponu oluştur"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {SEGMENT_ORDER.map((key) => {
            const meta = SEGMENT_META[key];
            const isActive = active === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActive(isActive ? "all" : key)}
                className={cn(
                  "rounded-xl border bg-card p-4 text-left transition hover:border-primary/50",
                  isActive && "border-primary ring-1 ring-primary/40",
                )}
              >
                <Badge className={cn("mb-2", meta.tone)} variant="secondary">
                  {meta.label}
                </Badge>
                <p className="text-2xl font-semibold">{formatNumber(counts.base[key])}</p>
                <p className="text-xs text-muted-foreground">
                  {formatMoney(counts.revenue[key], currency)} ciro
                </p>
                <p className="mt-2 text-xs leading-snug text-muted-foreground">{meta.description}</p>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Müşteri adı veya e-posta ara"
            className="max-w-xs"
          />
          {active !== "all" ? (
            <Button variant="ghost" size="sm" onClick={() => setActive("all")}>
              Filtreyi temizle
            </Button>
          ) : null}
          <span className="text-sm text-muted-foreground">{formatNumber(filtered.length)} müşteri</span>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="hidden grid-cols-12 gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
            <span className="col-span-4">Müşteri</span>
            <span className="col-span-2">Segment</span>
            <span className="col-span-1 text-right">Sipariş</span>
            <span className="col-span-2 text-right">Ciro</span>
            <span className="col-span-2 text-right">Ort. sepet</span>
            <span className="col-span-1 text-right">Son</span>
          </div>

          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Bu segmentte müşteri yok. Sipariş geldikçe segmentler otomatik güncellenir.
            </p>
          ) : (
            <ul className="divide-y">
              {filtered.slice(0, 300).map((row) => {
                const meta = SEGMENT_META[row.segment];
                return (
                  <li key={row.key} className="grid grid-cols-2 gap-2 px-4 py-3 text-sm md:grid-cols-12 md:items-center md:gap-3">
                    <div className="col-span-2 md:col-span-4">
                      {row.customerId ? (
                        <Link
                          to="/store/$storeId/customers/$customerId"
                          params={{ storeId, customerId: row.customerId }}
                          className="font-medium hover:underline"
                        >
                          {row.name}
                        </Link>
                      ) : (
                        <span className="font-medium">{row.name}</span>
                      )}
                      <p className="text-xs text-muted-foreground">{row.email || "—"}</p>
                    </div>
                    <div className="md:col-span-2">
                      <Badge variant="secondary" className={meta.tone}>
                        {meta.label}
                      </Badge>
                    </div>
                    <span className="md:col-span-1 md:text-right">{formatNumber(row.orders)}</span>
                    <span className="font-medium md:col-span-2 md:text-right">
                      {formatMoney(row.revenue, currency)}
                    </span>
                    <span className="text-muted-foreground md:col-span-2 md:text-right">
                      {formatMoney(row.average, currency)}
                    </span>
                    <span className="text-muted-foreground md:col-span-1 md:text-right">
                      {row.recencyDays >= 999 ? "—" : `${row.recencyDays} gün`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
