import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { POS_CATALOG } from "@/lib/innovation";
import { paymentRoutesQuery, routeDecisionsQuery } from "@/lib/innovation-queries";
import { deletePaymentRoute, routePayment, savePaymentRoute } from "@/lib/innovation.functions";
import { formatMoney } from "@/lib/mefti";

type RouteResult = {
  selected: { label: string; provider: string; fee: number; matchedBin: string | null } | null;
  ranked: { label: string; provider: string; fee: number; approvalRate: number }[];
  baselineFee: number;
  savedAmount: number;
};

/** Akıllı sanal POS yönlendirme: BIN ve tutara göre en düşük maliyetli POS. */
export function SmartPaymentPanel({ storeId, currency }: { storeId: string; currency: string }) {
  const queryClient = useQueryClient();
  const { data: routes } = useQuery(paymentRoutesQuery(storeId));
  const { data: decisions } = useQuery(routeDecisionsQuery(storeId));

  const save = useServerFn(savePaymentRoute);
  const remove = useServerFn(deletePaymentRoute);
  const route = useServerFn(routePayment);

  const [provider, setProvider] = useState("qnbpay");
  const [label, setLabel] = useState("");
  const [bins, setBins] = useState("");
  const [networks, setNetworks] = useState("");
  const [feePercent, setFeePercent] = useState("2.5");
  const [feeFixed, setFeeFixed] = useState("0");
  const [approvalRate, setApprovalRate] = useState("96");

  const [testBin, setTestBin] = useState("");
  const [testAmount, setTestAmount] = useState("1000");
  const [result, setResult] = useState<RouteResult | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["payment-routes", storeId] });
    void queryClient.invalidateQueries({ queryKey: ["payment-route-decisions", storeId] });
  };

  const saveMutation = useMutation({
    mutationFn: async () =>
      save({
        data: {
          storeId,
          provider,
          label: label.trim() || (POS_CATALOG.find((item) => item.code === provider)?.label ?? provider),
          binPrefixes: bins.split(",").map((item) => item.trim()).filter(Boolean),
          cardNetworks: networks.split(",").map((item) => item.trim()).filter(Boolean),
          feePercent: Number(feePercent) || 0,
          feeFixed: Number(feeFixed) || 0,
          approvalRate: Number(approvalRate) || 95,
        } as never,
      }),
    onSuccess: () => {
      toast.success("POS kuralı kaydedildi.");
      setLabel("");
      setBins("");
      setNetworks("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const testMutation = useMutation({
    mutationFn: async () =>
      route({
        data: {
          storeId,
          bin: testBin.trim() || null,
          amount: Number(testAmount) || 0,
          currency,
        } as never,
      }),
    onSuccess: (data) => setResult(data as unknown as RouteResult),
    onError: (error: Error) => toast.error(error.message),
  });

  const totalSaved = (decisions ?? []).reduce((total, row) => total + Number(row.saved_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <CreditCard className="size-4" /> Akıllı POS yönlendirme
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Her POS için komisyon ve onay oranını girin. Kasada kart numarasının ilk hanelerine (BIN) göre en
          düşük maliyetli ve en yüksek onay oranlı POS seçilir. Kart numarası hiçbir yerde saklanmaz.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Sağlayıcı</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {POS_CATALOG.map((item) => (
                  <SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Görünen ad</Label>
            <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Banka POS 1" />
          </div>
          <div>
            <Label>Komisyon (%)</Label>
            <Input value={feePercent} onChange={(event) => setFeePercent(event.target.value)} inputMode="decimal" />
          </div>
          <div>
            <Label>Sabit ücret</Label>
            <Input value={feeFixed} onChange={(event) => setFeeFixed(event.target.value)} inputMode="decimal" />
          </div>
          <div>
            <Label>Onay oranı (%)</Label>
            <Input value={approvalRate} onChange={(event) => setApprovalRate(event.target.value)} inputMode="decimal" />
          </div>
          <div>
            <Label>Kart markaları</Label>
            <Input value={networks} onChange={(event) => setNetworks(event.target.value)} placeholder="visa, mastercard, troy" />
          </div>
          <div className="sm:col-span-3">
            <Label>BIN listesi (virgülle)</Label>
            <Input value={bins} onChange={(event) => setBins(event.target.value)} placeholder="454671, 552096" />
          </div>
        </div>
        <Button className="mt-4" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          POS kuralını kaydet
        </Button>

        <div className="mt-5 space-y-2">
          {(routes ?? []).map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium">{row.label}</p>
                <p className="text-xs text-muted-foreground">
                  {row.provider} · %{row.fee_percent} + {row.fee_fixed} · onay %{row.approval_rate}
                  {row.bin_prefixes.length > 0 ? ` · BIN: ${row.bin_prefixes.join(", ")}` : ""}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label="POS kuralını sil"
                onClick={() => {
                  void remove({ data: { storeId, id: row.id } as never }).then(() => {
                    toast.success("Silindi.");
                    invalidate();
                  });
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {(routes ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz POS kuralı yok.</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold">Yönlendirme denemesi</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Kartın ilk 6 hanesi</Label>
            <Input value={testBin} onChange={(event) => setTestBin(event.target.value)} inputMode="numeric" placeholder="454671" />
          </div>
          <div>
            <Label>Sepet tutarı</Label>
            <Input value={testAmount} onChange={(event) => setTestAmount(event.target.value)} inputMode="decimal" />
          </div>
          <div className="flex items-end">
            <Button variant="outline" disabled={testMutation.isPending} onClick={() => testMutation.mutate()}>
              Hesapla
            </Button>
          </div>
        </div>
        {result ? (
          <div className="mt-4 space-y-2 text-sm">
            {result.selected ? (
              <p>
                Seçilen POS: <strong>{result.selected.label}</strong> — komisyon{" "}
                {formatMoney(result.selected.fee, currency)}, tasarruf {formatMoney(result.savedAmount, currency)}
              </p>
            ) : (
              <p className="text-muted-foreground">Bu karta uygun aktif POS kuralı yok.</p>
            )}
            {result.ranked.map((item) => (
              <p key={`${item.provider}-${item.label}`} className="text-xs text-muted-foreground">
                {item.label}: {formatMoney(item.fee, currency)} · onay %{item.approvalRate}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold">Komisyon tasarrufu</h3>
        <p className="mt-1 text-2xl font-semibold">{formatMoney(totalSaved, currency)}</p>
        <p className="text-sm text-muted-foreground">
          {(decisions ?? []).length} yönlendirme kararında en pahalı POS'a kıyasla kazanılan tutar.
        </p>
      </div>
    </div>
  );
}
