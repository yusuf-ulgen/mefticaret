import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MoreVertical, RotateCcw, Undo2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatMoney } from "@/lib/mefti";
import {
  REFUND_METHOD_LABELS,
  REFUND_REASONS,
  REFUND_STATUS_LABELS,
  createRefundSchema,
} from "@/lib/refund-schema";
import type { z } from "zod";
import {
  cancelOrderRefund,
  createOrderRefund,
  getOrderRefunds,
  retryOrderRefund,
} from "@/lib/refunds.functions";

type Method = keyof typeof REFUND_METHOD_LABELS;
type Reason = (typeof REFUND_REASONS)[number];
type Line = { selected: boolean; quantity: number; restock: boolean };

const QUEUE_KEY = "mefti-refund-queue";
type Queued = z.input<typeof createRefundSchema>;

function readQueue(): Queued[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as Queued[];
  } catch {
    return [];
  }
}
function writeQueue(items: Queued[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

function newKey() {
  return crypto.randomUUID();
}

export function refundsQueryKey(orderId: string) {
  return ["order-refunds", orderId] as const;
}

/** ⋮ menüsü: "İade Et" seçeneği ile iade penceresini açar. */
export function OrderActionsMenu({ onRefund, disabled }: { onRefund: () => void; disabled?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="size-11" aria-label="Diğer işlemler">
          <MoreVertical className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className="min-h-11" disabled={disabled ?? false} onSelect={onRefund}>
          <Undo2 className="mr-2 size-4" /> İade Et
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RefundDrawer({
  storeId,
  orderId,
  open,
  onOpenChange,
}: {
  storeId: string;
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const load = useServerFn(getOrderRefunds);
  const create = useServerFn(createOrderRefund);
  const { data, isLoading } = useQuery({
    queryKey: refundsQueryKey(orderId),
    queryFn: () => load({ data: { storeId, orderId } }),
    enabled: open,
  });

  const [lines, setLines] = useState<Record<string, Line>>({});
  const [method, setMethod] = useState<Method>("original_payment");
  const [reason, setReason] = useState<Reason>("Müşteri vazgeçti");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [edited, setEdited] = useState(false);
  const [step, setStep] = useState<"form" | "preview">("form");
  const [busy, setBusy] = useState(false);
  const [idemKey, setIdemKey] = useState(newKey);

  useEffect(() => {
    if (!open || !data) return;
    const next: Record<string, Line> = {};
    for (const item of data.items) next[item.id] = { selected: false, quantity: item.refundable, restock: true };
    setLines(next);
    setMethod(data.hasCard ? "original_payment" : "manual");
    setEdited(false);
    setStep("form");
    setNote("");
    setIdemKey(newKey());
  }, [open, data]);

  const computed = useMemo(() => {
    if (!data) return 0;
    let sum = 0;
    for (const item of data.items) {
      const line = lines[item.id];
      if (!line?.selected || line.quantity <= 0) continue;
      const perTax = item.quantity > 0 ? Number(item.tax_total) / item.quantity : 0;
      sum += (Number(item.unit_price) + perTax) * line.quantity;
    }
    return Math.min(Math.round(sum * 100) / 100, data.refundable);
  }, [data, lines]);

  useEffect(() => {
    if (!edited) setAmount(computed ? computed.toFixed(2) : "");
  }, [computed, edited]);

  const currency = data?.order.currency ?? "TRY";
  const value = Number(amount.replace(",", "."));
  const over = data ? value > data.refundable + 0.001 : false;
  const valid = value > 0 && !over;
  const selected = data?.items.filter((i) => lines[i.id]?.selected && lines[i.id]!.quantity > 0) ?? [];

  const payload: Queued = {
    storeId,
    orderId,
    lines: selected.map((i) => ({ orderItemId: i.id, quantity: lines[i.id]!.quantity, restock: lines[i.id]!.restock })),
    amount: value,
    method,
    reason,
    note,
    idempotencyKey: idemKey,
  };

  const submit = async () => {
    if (!navigator.onLine) {
      writeQueue([...readQueue().filter((q) => q.idempotencyKey !== idemKey), payload]);
      toast.info("Bağlantı yok. İade, bağlantı gelince otomatik gönderilecek.");
      onOpenChange(false);
      return;
    }
    setBusy(true);
    try {
      const res = await create({ data: payload });
      toast.success(`${res.number ?? "İade"} tamamlandı · ${formatMoney(value, currency)}`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İade yapılamadı");
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: refundsQueryKey(orderId) });
      qc.invalidateQueries();
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[92vh] w-full max-w-xl">
        <DrawerHeader className="text-left">
          <DrawerTitle>Sipariş #{data?.order.order_number ?? ""} — İade</DrawerTitle>
          <DrawerDescription>
            {data ? `İade edilebilir kalan tutar: ${formatMoney(data.refundable, currency)}` : "Yükleniyor…"}
          </DrawerDescription>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-2">
          {isLoading || !data ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : step === "form" ? (
            <div className="space-y-5">
              <section>
                <h3 className="mb-2 text-sm font-semibold">İade Edilecek Ürünler</h3>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {data.items.map((item) => {
                    const line = lines[item.id] ?? { selected: false, quantity: 0, restock: true };
                    const set = (patch: Partial<Line>) => setLines((l) => ({ ...l, [item.id]: { ...line, ...patch } }));
                    const disabled = item.refundable <= 0;
                    return (
                      <li key={item.id} className="flex flex-col gap-2 p-3">
                        <label className="flex min-h-11 items-center gap-3">
                          <Checkbox
                            className="size-5"
                            checked={line.selected}
                            disabled={disabled}
                            onCheckedChange={(v) => set({ selected: v === true })}
                          />
                          <span className="flex-1 text-sm">
                            {item.title}
                            {item.variant_title ? ` · ${item.variant_title}` : ""}
                            <span className="block text-xs text-muted-foreground">
                              {disabled ? "Tamamı iade edildi" : `${item.refundable} adet iade edilebilir`}
                            </span>
                          </span>
                          <span className="text-sm font-medium">{formatMoney(Number(item.unit_price) * line.quantity, currency)}</span>
                        </label>
                        {line.selected && (
                          <div className="flex flex-wrap items-center justify-between gap-3 pl-8">
                            <div className="flex items-center gap-2">
                              <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Azalt"
                                onClick={() => set({ quantity: Math.max(1, line.quantity - 1) })}>−</Button>
                              <span className="w-8 text-center text-sm">{line.quantity}</span>
                              <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Artır"
                                onClick={() => set({ quantity: Math.min(item.refundable, line.quantity + 1) })}>+</Button>
                            </div>
                            <label className="flex min-h-11 items-center gap-2 text-sm">
                              Stoka geri ekle
                              <Switch checked={line.restock} disabled={!item.variant_id} onCheckedChange={(v) => set({ restock: v })} />
                            </label>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold">İade Yöntemi</h3>
                <RadioGroup value={method} onValueChange={(v) => setMethod(v as Method)} className="gap-1">
                  {(Object.keys(REFUND_METHOD_LABELS) as Method[]).map((key) => {
                    const off = (key === "original_payment" && !data.hasCard) || (key === "store_credit" && !data.order.customer_id);
                    return (
                      <label key={key} className={`flex min-h-11 items-center gap-3 rounded-md px-2 ${off ? "opacity-50" : ""}`}>
                        <RadioGroupItem value={key} disabled={off} />
                        <span className="text-sm">
                          {REFUND_METHOD_LABELS[key]}
                          {off && (
                            <span className="block text-xs text-muted-foreground">
                              {key === "original_payment" ? "Sipariş kartla ödenmemiş" : "Kayıtlı müşteri yok"}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </RadioGroup>
              </section>

              <section className="space-y-2">
                <Label htmlFor="refund-amount">İade Tutarı</Label>
                <Input
                  id="refund-amount"
                  inputMode="decimal"
                  className="h-11"
                  value={amount}
                  onChange={(e) => { setEdited(true); setAmount(e.target.value); }}
                />
                {over && <p className="text-xs text-destructive">Tutar kalan iade edilebilir tutarı aşamaz.</p>}
                {edited && (
                  <button type="button" className="min-h-11 text-xs underline" onClick={() => setEdited(false)}>
                    Seçili ürünlere göre hesapla ({formatMoney(computed, currency)})
                  </button>
                )}
              </section>

              <section className="space-y-2">
                <Label>Neden?</Label>
                <Select value={reason} onValueChange={(v) => setReason(v as Reason)}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REFUND_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Label htmlFor="refund-note">Not</Label>
                <Textarea id="refund-note" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
              </section>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <h3 className="font-semibold">Özet</h3>
              <ul className="space-y-1">
                {selected.length === 0 && <li className="text-muted-foreground">Ürün seçilmedi (yalnız tutar iadesi)</li>}
                {selected.map((i) => (
                  <li key={i.id} className="flex justify-between">
                    <span>{i.title} × {lines[i.id]!.quantity}{lines[i.id]!.restock && i.variant_id ? " · stoka eklenecek" : ""}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between border-t border-border pt-2"><span>Yöntem</span><span>{REFUND_METHOD_LABELS[method]}</span></div>
              <div className="flex justify-between"><span>Neden</span><span>{reason}</span></div>
              {note && <p className="text-muted-foreground">{note}</p>}
              <div className="flex justify-between text-base font-semibold"><span>İade Tutarı</span><span>{formatMoney(value, currency)}</span></div>
            </div>
          )}
        </div>

        <DrawerFooter>
          {step === "form" ? (
            <Button className="h-12" disabled={!valid || !data} onClick={() => setStep("preview")}>
              Devam · {formatMoney(valid ? value : 0, currency)}
            </Button>
          ) : (
            <>
              <Button className="h-12" disabled={busy || !valid} onClick={submit}>
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />} İade Et {formatMoney(value, currency)}
              </Button>
              <Button variant="ghost" className="h-11" disabled={busy} onClick={() => setStep("form")}>Geri</Button>
            </>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

/** Siparişin iade geçmişi + çevrimdışı kuyruğun gönderimi. */
export function OrderRefundHistory({ storeId, orderId }: { storeId: string; orderId: string }) {
  const qc = useQueryClient();
  const load = useServerFn(getOrderRefunds);
  const create = useServerFn(createOrderRefund);
  const retry = useServerFn(retryOrderRefund);
  const cancel = useServerFn(cancelOrderRefund);
  const { data, isLoading } = useQuery({
    queryKey: refundsQueryKey(orderId),
    queryFn: () => load({ data: { storeId, orderId } }),
  });
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const flush = async () => {
      const queue = readQueue();
      if (!queue.length || !navigator.onLine) return;
      const left: Queued[] = [];
      for (const item of queue) {
        try {
          await create({ data: item });
          toast.success("Bekleyen iade gönderildi");
        } catch (e) {
          const msg = e instanceof Error ? e.message : "";
          if (/fetch|network/i.test(msg)) left.push(item);
          else toast.error(msg || "Bekleyen iade gönderilemedi");
        }
      }
      writeQueue(left);
      qc.invalidateQueries({ queryKey: refundsQueryKey(orderId) });
    };
    void flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [create, orderId, qc]);

  const act = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id);
    try { await fn(); toast.success(ok); } catch (e) { toast.error(e instanceof Error ? e.message : "İşlem başarısız"); }
    finally { setBusy(null); qc.invalidateQueries(); }
  };

  if (isLoading) return <Skeleton className="h-20 w-full" />;
  if (!data?.refunds.length) return null;

  return (
    <div className="surface-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><RotateCcw className="size-4" /> İadeler</h3>
      <ul className="space-y-3">
        {data.refunds.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div>
              <div className="font-medium">{r.refund_number ?? "İade"} · {formatMoney(Number(r.amount), r.currency)}</div>
              <div className="text-xs text-muted-foreground">
                {REFUND_METHOD_LABELS[r.refund_method as Method] ?? r.refund_method} · {r.reason ?? ""} · {formatDateTime(r.created_at)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={r.status === "processed" ? "secondary" : r.status === "failed" ? "destructive" : "outline"}>
                {REFUND_STATUS_LABELS[r.status] ?? r.status}
              </Badge>
              {(r.status === "failed" || r.status === "pending") && (
                <>
                  <Button size="sm" className="h-11" disabled={busy === r.id}
                    onClick={() => act(r.id, () => retry({ data: { storeId, refundId: r.id } }), "İade tamamlandı")}>Tekrar dene</Button>
                  <Button size="sm" variant="ghost" className="h-11" disabled={busy === r.id}
                    onClick={() => act(r.id, () => cancel({ data: { storeId, refundId: r.id } }), "İade iptal edildi")}>İptal</Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
