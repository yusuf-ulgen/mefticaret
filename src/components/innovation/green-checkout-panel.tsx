import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Leaf, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { globalSettingsQuery } from "@/lib/global-export-queries";
import { estimateShippingCarbon, treesFromDonation } from "@/lib/innovation";
import { checkoutAddonsQuery } from "@/lib/innovation-queries";
import { deleteCheckoutAddon, saveCheckoutAddon, saveInnovationSettings } from "@/lib/innovation.functions";

const KIND_LABEL: Record<string, string> = {
  warranty: "Ek garanti",
  insurance: "Kargo sigortası",
  carbon: "Karbon dengeleme",
};

/** Yeşil kasa (karbon dengeleme) ve ek garanti/sigorta hizmetleri. */
export function GreenCheckoutPanel({ storeId, currency }: { storeId: string; currency: string }) {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery(globalSettingsQuery(storeId));
  const { data: addons } = useQuery(checkoutAddonsQuery(storeId));

  const saveSettings = useServerFn(saveInnovationSettings);
  const saveAddon = useServerFn(saveCheckoutAddon);
  const removeAddon = useServerFn(deleteCheckoutAddon);

  const [carbonEnabled, setCarbonEnabled] = useState(false);
  const [carbonAmount, setCarbonAmount] = useState("15");
  const [threshold, setThreshold] = useState("70");
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  useEffect(() => {
    if (!settings) return;
    const row = settings as unknown as Record<string, unknown>;
    setCarbonEnabled(Boolean(row["carbon_offset_enabled"]));
    setCarbonAmount(String(row["carbon_offset_amount"] ?? 15));
    setThreshold(String(row["fraud_block_threshold"] ?? 70));
    setLiveEnabled(Boolean(row["live_commerce_enabled"]));
    setVoiceEnabled(Boolean(row["voice_search_enabled"]));
  }, [settings]);

  const [kind, setKind] = useState("warranty");
  const [name, setName] = useState("");
  const [months, setMonths] = useState("24");
  const [priceType, setPriceType] = useState("percent");
  const [priceValue, setPriceValue] = useState("5");
  const [minTotal, setMinTotal] = useState("0");

  const settingsMutation = useMutation({
    mutationFn: async () =>
      saveSettings({
        data: {
          storeId,
          carbonOffsetEnabled: carbonEnabled,
          carbonOffsetAmount: Number(carbonAmount) || 0,
          fraudBlockThreshold: Number(threshold) || 70,
          liveCommerceEnabled: liveEnabled,
          voiceSearchEnabled: voiceEnabled,
        } as never,
      }),
    onSuccess: () => {
      toast.success("Ayarlar kaydedildi.");
      void queryClient.invalidateQueries({ queryKey: ["global-settings", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addonMutation = useMutation({
    mutationFn: async () =>
      saveAddon({
        data: {
          storeId,
          kind,
          name: name.trim() || KIND_LABEL[kind],
          months: kind === "warranty" ? Number(months) || 12 : null,
          priceType,
          priceValue: Number(priceValue) || 0,
          minOrderTotal: Number(minTotal) || 0,
          currency,
        } as never,
      }),
    onSuccess: () => {
      toast.success("Hizmet kaydedildi.");
      setName("");
      void queryClient.invalidateQueries({ queryKey: ["checkout-addons", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const donation = Number(carbonAmount) || 0;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <Leaf className="size-4" /> Yeşil kasa ve yenilik ayarları
        </h3>
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="carbon">Karbon dengeleme kutusu</Label>
              <p className="text-xs text-muted-foreground">
                Kasada müşteri, kargonun karbon salımını dengelemek için küçük bir katkı ekleyebilir.
              </p>
            </div>
            <Switch id="carbon" checked={carbonEnabled} onCheckedChange={setCarbonEnabled} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Katkı tutarı</Label>
              <Input value={carbonAmount} onChange={(event) => setCarbonAmount(event.target.value)} inputMode="decimal" />
              <p className="mt-1 text-xs text-muted-foreground">
                ≈ {treesFromDonation(donation)} fidan · 1 kg paket yurt içi ≈{" "}
                {estimateShippingCarbon(1000, true)} kg CO₂
              </p>
            </div>
            <div>
              <Label>Otomatik blok eşiği (risk)</Label>
              <Input value={threshold} onChange={(event) => setThreshold(event.target.value)} inputMode="numeric" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="live">Canlı satış</Label>
                <Switch id="live" checked={liveEnabled} onCheckedChange={setLiveEnabled} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="voice">Sesli arama</Label>
                <Switch id="voice" checked={voiceEnabled} onCheckedChange={setVoiceEnabled} />
              </div>
            </div>
          </div>
          <Button disabled={settingsMutation.isPending} onClick={() => settingsMutation.mutate()}>
            Ayarları kaydet
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="size-4" /> Ek garanti ve kargo sigortası
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Hizmet türü</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(KIND_LABEL).map(([value, text]) => (
                  <SelectItem key={value} value={value}>{text}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Adı</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="2 yıl ek garanti" />
          </div>
          {kind === "warranty" ? (
            <div>
              <Label>Süre (ay)</Label>
              <Input value={months} onChange={(event) => setMonths(event.target.value)} inputMode="numeric" />
            </div>
          ) : null}
          <div>
            <Label>Fiyat türü</Label>
            <Select value={priceType} onValueChange={setPriceType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Sepetin yüzdesi</SelectItem>
                <SelectItem value="fixed">Sabit tutar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Değer</Label>
            <Input value={priceValue} onChange={(event) => setPriceValue(event.target.value)} inputMode="decimal" />
          </div>
          <div>
            <Label>Alt sepet sınırı</Label>
            <Input value={minTotal} onChange={(event) => setMinTotal(event.target.value)} inputMode="decimal" />
          </div>
        </div>
        <Button className="mt-4" disabled={addonMutation.isPending} onClick={() => addonMutation.mutate()}>
          Hizmeti kaydet
        </Button>

        <div className="mt-5 space-y-2">
          {(addons ?? []).map((addon) => (
            <div key={addon.id} className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium">{addon.name}</p>
                <p className="text-xs text-muted-foreground">
                  {KIND_LABEL[addon.kind]} ·{" "}
                  {addon.price_type === "percent" ? `%${addon.price_value}` : `${addon.price_value} ${addon.currency}`}
                  {addon.months ? ` · ${addon.months} ay` : ""}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Hizmeti sil"
                onClick={() => {
                  void removeAddon({ data: { storeId, id: addon.id } as never }).then(() => {
                    toast.success("Silindi.");
                    void queryClient.invalidateQueries({ queryKey: ["checkout-addons", storeId] });
                  });
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {(addons ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz ek hizmet yok.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
