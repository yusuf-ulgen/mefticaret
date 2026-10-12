import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gift, Plus, RefreshCcw, Shuffle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { downloadCsv, toCsv } from "@/lib/csv";
import {
  GIFT_CARD_STATUS_LABELS,
  GIFT_CARD_TX_LABELS,
  generateGiftCardCode,
  summarizeGiftCards,
  type GiftCardStatus,
} from "@/lib/gift-cards";
import { giftCardTransactionsQuery, giftCardsQuery } from "@/lib/gift-cards-queries";
import { adjustGiftCardBalance, issueGiftCard, setGiftCardStatus } from "@/lib/gift-cards.functions";
import { formatDateTime, formatMoney } from "@/lib/mefti";
import { storeQuery } from "@/lib/store-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/gift-cards")({
  head: () => ({
    meta: [
      { title: "Hediye Kartları — Mefticaret" },
      {
        name: "description",
        content:
          "Hediye kartı ve mağaza kredisi tanımlayın, bakiyeleri izleyin, kullanım geçmişini inceleyin ve kartları pasife alın.",
      },
      { property: "og:title", content: "Hediye Kartları — Mefticaret" },
      {
        property: "og:description",
        content: "Hediye kartı tanımlama, bakiye takibi ve kullanım geçmişi tek ekranda.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GiftCardsPage,
});

function GiftCardsPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: store } = useQuery(storeQuery(storeId));
  const { data: cards, isLoading } = useQuery(giftCardsQuery(storeId));

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState(generateGiftCardCode());
  const [amount, setAmount] = useState("500");
  const [email, setEmail] = useState("");
  const [expires, setExpires] = useState("");
  const [note, setNote] = useState("");
  const [delta, setDelta] = useState("");

  const currency = store?.currency ?? "TRY";
  const issue = useServerFn(issueGiftCard);
  const adjust = useServerFn(adjustGiftCardBalance);
  const setStatus = useServerFn(setGiftCardStatus);

  const { data: transactions } = useQuery(giftCardTransactionsQuery(selectedId));

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return cards ?? [];
    return (cards ?? []).filter(
      (card) =>
        card.code.toLowerCase().includes(term) ||
        (card.customer_email ?? "").toLowerCase().includes(term),
    );
  }, [cards, search]);

  const totals = useMemo(() => summarizeGiftCards(rows as never), [rows]);
  const selected = (cards ?? []).find((card) => card.id === selectedId) ?? null;

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["gift-cards", storeId] });
    if (selectedId) {
      await queryClient.invalidateQueries({ queryKey: ["gift-card-transactions", selectedId] });
    }
  };

  const createMutation = useMutation({
    mutationFn: () =>
      issue({
        data: {
          storeId,
          code,
          amount: Number(amount),
          currency,
          customerEmail: email.trim() ? email.trim() : undefined,
          note: note.trim() ? note.trim() : undefined,
          expiresAt: expires ? expires : undefined,
        },
      }),
    onSuccess: async (result) => {
      toast.success(`Hediye kartı oluşturuldu: ${result.code}`);
      setCreateOpen(false);
      setCode(generateGiftCardCode());
      setEmail("");
      setNote("");
      setExpires("");
      await invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Kart oluşturulamadı"),
  });

  const adjustMutation = useMutation({
    mutationFn: (input: { giftCardId: string; delta: number }) => adjust({ data: input }),
    onSuccess: async (result) => {
      toast.success(`Yeni bakiye: ${formatMoney(result.balance, currency)}`);
      setDelta("");
      await invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Bakiye güncellenemedi"),
  });

  const statusMutation = useMutation({
    mutationFn: (input: { giftCardId: string; status: "active" | "disabled" }) =>
      setStatus({ data: input }),
    onSuccess: async () => {
      toast.success("Kart durumu güncellendi");
      await invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Durum güncellenemedi"),
  });

  function exportCsv() {
    const content = toCsv(
      ["Kod", "Durum", "Başlangıç", "Bakiye", "Para birimi", "E-posta", "Son kullanma", "Oluşturma"],
      rows.map((card) => [
        card.code,
        GIFT_CARD_STATUS_LABELS[card.status as GiftCardStatus] ?? card.status,
        Number(card.initial_amount).toFixed(2),
        Number(card.balance).toFixed(2),
        card.currency,
        card.customer_email ?? "",
        card.expires_at ?? "",
        card.created_at,
      ]),
    );
    downloadCsv(`hediye-kartlari-${new Date().toISOString().slice(0, 10)}.csv`, content);
  }

  return (
    <AppShell storeId={storeId} title="Hediye Kartları">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Hediye kartları</h1>
            <p className="text-sm text-muted-foreground">
              Mağaza kredisi tanımlayın; kasada girilen kod bakiyeden düşülerek sipariş toplamına uygulanır.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
              CSV indir
            </Button>
            <Sheet open={createOpen} onOpenChange={setCreateOpen}>
              <SheetTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 size-4" />
                  Yeni kart
                </Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Hediye kartı tanımla</SheetTitle>
                  <SheetDescription>
                    Kod benzersiz olmalıdır. Bakiye kullanıldıkça otomatik güncellenir.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label>Kart kodu</Label>
                    <div className="flex gap-2">
                      <Input
                        value={code}
                        onChange={(event) => setCode(event.target.value.toUpperCase())}
                        className="font-mono"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCode(generateGiftCardCode())}
                      >
                        <Shuffle className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Tutar ({currency})</Label>
                    <Input
                      type="number"
                      min="1"
                      step="0.01"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Müşteri e-postası (opsiyonel)</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="musteri@ornek.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Son kullanma (opsiyonel)</Label>
                    <Input type="date" value={expires} onChange={(event) => setExpires(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Not</Label>
                    <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => createMutation.mutate()}
                    disabled={createMutation.isPending || Number(amount) <= 0 || code.trim().length < 4}
                  >
                    {createMutation.isPending ? "Oluşturuluyor…" : "Kartı oluştur"}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Kart sayısı" value={String(totals.count)} />
          <StatCard label="Tanımlanan toplam" value={formatMoney(totals.issued, currency)} />
          <StatCard label="Açık bakiye (yükümlülük)" value={formatMoney(totals.outstanding, currency)} />
          <StatCard label="Kullanılan" value={formatMoney(totals.redeemed, currency)} />
        </div>

        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Kod veya e-posta ara…"
          className="max-w-sm"
        />

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <Gift className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Henüz hediye kartı yok. İlk kartı oluşturarak mağaza kredisi vermeye başlayın.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Kod</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3 text-right">Başlangıç</th>
                  <th className="px-4 py-3 text-right">Bakiye</th>
                  <th className="px-4 py-3">Müşteri</th>
                  <th className="px-4 py-3">Son kullanma</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((card) => (
                  <tr key={card.id} className="border-t border-border">
                    <td className="px-4 py-3 font-mono">{card.code}</td>
                    <td className="px-4 py-3">
                      <Badge variant={card.status === "active" ? "default" : "secondary"}>
                        {GIFT_CARD_STATUS_LABELS[card.status as GiftCardStatus] ?? card.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatMoney(Number(card.initial_amount), card.currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatMoney(Number(card.balance), card.currency)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{card.customer_email ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {card.expires_at ? formatDateTime(card.expires_at) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setSelectedId(card.id)}>
                          Detay
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            statusMutation.mutate({
                              giftCardId: card.id,
                              status: card.status === "active" ? "disabled" : "active",
                            })
                          }
                        >
                          {card.status === "active" ? "Pasife al" : "Aktifleştir"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Sheet open={Boolean(selectedId)} onOpenChange={(open) => !open && setSelectedId(null)}>
          <SheetContent className="overflow-y-auto sm:max-w-lg">
            <SheetHeader>
              <SheetTitle className="font-mono">{selected?.code ?? "Kart"}</SheetTitle>
              <SheetDescription>
                {selected
                  ? `Bakiye ${formatMoney(Number(selected.balance), selected.currency)} · ${
                      GIFT_CARD_STATUS_LABELS[selected.status as GiftCardStatus] ?? selected.status
                    }`
                  : ""}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-5">
              <div className="space-y-2">
                <Label>Bakiye düzeltmesi ({currency})</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={delta}
                    onChange={(event) => setDelta(event.target.value)}
                    placeholder="Örn. 100 veya -50"
                  />
                  <Button
                    variant="outline"
                    disabled={!selectedId || !delta || Number(delta) === 0 || adjustMutation.isPending}
                    onClick={() =>
                      adjustMutation.mutate({ giftCardId: selectedId!, delta: Number(delta) })
                    }
                  >
                    <RefreshCcw className="mr-2 size-4" />
                    Uygula
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Pozitif değer yükleme, negatif değer düşüş olarak işlem geçmişine yazılır.
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">İşlem geçmişi</p>
                <div className="mt-3 space-y-2">
                  {(transactions ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Kayıt yok.</p>
                  ) : (
                    (transactions ?? []).map((tx) => (
                      <div
                        key={tx.id}
                        className="rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">
                            {GIFT_CARD_TX_LABELS[tx.kind] ?? tx.kind}
                          </span>
                          <span className={Number(tx.amount) < 0 ? "text-destructive" : ""}>
                            {Number(tx.amount) > 0 ? "+" : ""}
                            {formatMoney(Number(tx.amount), currency)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(tx.created_at)} · Kalan{" "}
                          {formatMoney(Number(tx.balance_after), currency)}
                          {tx.note ? ` · ${tx.note}` : ""}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
