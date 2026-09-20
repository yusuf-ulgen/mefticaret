import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gamepad2, MapPin, Plus, RefreshCcw, Trash2, TrendingDown } from "lucide-react";
import { useMemo, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_PRIZES,
  GAMIFICATION_KINDS,
  GAMIFICATION_KIND_LABELS,
  prizeSummary,
  type GamificationKind,
  type GamificationPrize,
} from "@/lib/gamification";
import {
  deleteGamificationCampaignFn,
  saveGamificationCampaignFn,
} from "@/lib/gamification.functions";
import { formatDateTime, formatMoney } from "@/lib/mefti";
import {
  gamificationQuery,
  pickupLocationsQuery,
  rfqDeskQuery,
  stockForecastQuery,
} from "@/lib/nextgen-queries";
import {
  deletePickupLocationFn,
  replyToRfqFn,
  savePickupLocationFn,
} from "@/lib/retail-ops.functions";
import { storeQuery } from "@/lib/store-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/engagement")({
  head: () => ({
    meta: [
      { title: "Oyunlaştırma & Operasyon — Mefticaret" },
      {
        name: "description",
        content:
          "Şans çarkı ve kazı kazan kampanyaları kurun, stok tükenme tahminini izleyin, mağazadan teslim noktalarını yönetin ve toptan teklif taleplerini yanıtlayın.",
      },
      { property: "og:title", content: "Oyunlaştırma & Operasyon — Mefticaret" },
      {
        property: "og:description",
        content: "Çark, kazı kazan, stok tahmini, mağazadan teslim ve toptan teklif masası tek ekranda.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EngagementPage,
});

const STATUS_STYLE: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive",
  warning: "bg-warning/10 text-warning",
  healthy: "bg-success/10 text-success",
  idle: "bg-muted text-muted-foreground",
};

const STATUS_LABEL: Record<string, string> = {
  critical: "Kritik",
  warning: "Yakında biter",
  healthy: "Yeterli",
  idle: "Satış yok",
};

function EngagementPage() {
  const { storeId } = Route.useParams();
  const { data: store } = useQuery(storeQuery(storeId));

  return (
    <AppShell storeId={storeId} title="Oyunlaştırma & Operasyon">
      <div className="space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Etkileşim</p>
          <h1 className="mt-1 text-2xl font-semibold">Oyunlaştırma & Operasyon</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {store?.name ?? "Mağaza"} için çark ve kazı kazan kampanyaları, stok tükenme tahmini,
            mağazadan teslim noktaları ve toptan teklif masası.
          </p>
        </header>

        <Tabs defaultValue="gamification">
          <TabsList className="flex w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="gamification">Çark & Kazı Kazan</TabsTrigger>
            <TabsTrigger value="stock">Stok Tahmini</TabsTrigger>
            <TabsTrigger value="pickup">Mağazadan Teslim</TabsTrigger>
            <TabsTrigger value="rfq">Toptan Teklif Masası</TabsTrigger>
          </TabsList>

          <TabsContent value="gamification" className="mt-5">
            <GamificationTab storeId={storeId} />
          </TabsContent>
          <TabsContent value="stock" className="mt-5">
            <StockTab storeId={storeId} />
          </TabsContent>
          <TabsContent value="pickup" className="mt-5">
            <PickupTab storeId={storeId} />
          </TabsContent>
          <TabsContent value="rfq" className="mt-5">
            <RfqTab storeId={storeId} currency={store?.currency ?? "TRY"} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function GamificationTab({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(gamificationQuery(storeId));

  const [editingId, setEditingId] = useState<string | null>(null);
  const [kind, setKind] = useState<GamificationKind>("spin_wheel");
  const [name, setName] = useState("Şans çarkı");
  const [headline, setHeadline] = useState("Şansını dene!");
  const [ctaLabel, setCtaLabel] = useState("Çevir");
  const [isActive, setIsActive] = useState(true);
  const [codePrefix, setCodePrefix] = useState("SANS");
  const [codeValidDays, setCodeValidDays] = useState("7");
  const [maxPlays, setMaxPlays] = useState("1");
  const [showDelay, setShowDelay] = useState("6");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [prizes, setPrizes] = useState<GamificationPrize[]>(DEFAULT_PRIZES);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["gamification-campaigns", storeId] });

  const resetForm = () => {
    setEditingId(null);
    setKind("spin_wheel");
    setName("Şans çarkı");
    setHeadline("Şansını dene!");
    setCtaLabel("Çevir");
    setIsActive(true);
    setCodePrefix("SANS");
    setCodeValidDays("7");
    setMaxPlays("1");
    setShowDelay("6");
    setDiscountType("percent");
    setPrizes(DEFAULT_PRIZES);
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      saveGamificationCampaignFn({
        data: {
          storeId,
          id: editingId,
          kind,
          name,
          isActive,
          headline,
          ctaLabel,
          prizes,
          discountType,
          codePrefix,
          codeValidDays: Number(codeValidDays) || 7,
          maxPlaysPerEmail: Number(maxPlays) || 1,
          showDelaySeconds: Number(showDelay) || 0,
        },
      }),
    onSuccess: async () => {
      await invalidate();
      resetForm();
      toast.success("Kampanya kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGamificationCampaignFn({ data: { storeId, id } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Kampanya silindi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const chances = useMemo(() => prizeSummary(prizes), [prizes]);

  const updatePrize = (index: number, patch: Partial<GamificationPrize>) =>
    setPrizes((current) => current.map((prize, i) => (i === index ? { ...prize, ...patch } : prize)));

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Kampanyalar</h2>
          <Button variant="outline" size="sm" onClick={resetForm}>
            <Plus className="mr-2 size-4" /> Yeni
          </Button>
        </div>
        {isLoading ? (
          <div className="mt-4 space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (data?.campaigns.length ?? 0) === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Henüz kampanya yok. Sağdaki formdan çark veya kazı kazan kampanyası oluşturun.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {data?.campaigns.map((campaign) => (
              <li key={campaign.id} className="border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Gamepad2 className="size-4 text-brand" />
                      <span className="font-medium">{campaign.name}</span>
                      <Badge variant={campaign.isActive ? "default" : "outline"}>
                        {campaign.isActive ? "Aktif" : "Kapalı"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {GAMIFICATION_KIND_LABELS[campaign.kind]} • {campaign.prizes.length} ödül •{" "}
                      {campaign.playCount} oynama • kod {campaign.codePrefix}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingId(campaign.id);
                        setKind(campaign.kind);
                        setName(campaign.name);
                        setHeadline(campaign.headline);
                        setCtaLabel(campaign.ctaLabel);
                        setIsActive(campaign.isActive);
                        setCodePrefix(campaign.codePrefix);
                        setCodeValidDays(String(campaign.codeValidDays));
                        setMaxPlays(String(campaign.maxPlaysPerEmail));
                        setShowDelay(String(campaign.showDelaySeconds));
                        setDiscountType(campaign.discountType);
                        setPrizes(campaign.prizes);
                      }}
                    >
                      Düzenle
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Kampanyayı sil"
                      onClick={() => deleteMutation.mutate(campaign.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 border-t border-border pt-4">
          <h3 className="font-semibold">Son oynamalar</h3>
          {(data?.plays.length ?? 0) === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Henüz oynama kaydı yok.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border text-sm">
              {data?.plays.slice(0, 15).map((play) => (
                <li key={play.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="truncate">{play.email}</span>
                  <span className="text-muted-foreground">{play.prizeLabel}</span>
                  <span className="font-mono text-xs">{play.discountCode || "—"}</span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(play.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <aside className="border border-border bg-card p-4">
        <h2 className="font-semibold">{editingId ? "Kampanyayı düzenle" : "Yeni kampanya"}</h2>
        <div className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="game-kind">Oyun türü</Label>
            <Select value={kind} onValueChange={(value) => setKind(value as GamificationKind)}>
              <SelectTrigger id="game-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GAMIFICATION_KINDS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {GAMIFICATION_KIND_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="game-name">Kampanya adı</Label>
            <Input id="game-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="game-headline">Vitrin başlığı</Label>
            <Input id="game-headline" value={headline} onChange={(event) => setHeadline(event.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="game-cta">Buton yazısı</Label>
              <Input id="game-cta" value={ctaLabel} onChange={(event) => setCtaLabel(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="game-prefix">Kod öneki</Label>
              <Input id="game-prefix" value={codePrefix} onChange={(event) => setCodePrefix(event.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2">
              <Label htmlFor="game-days">Geçerlilik (gün)</Label>
              <Input id="game-days" type="number" min="1" value={codeValidDays} onChange={(event) => setCodeValidDays(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="game-plays">Kişi başı hak</Label>
              <Input id="game-plays" type="number" min="1" value={maxPlays} onChange={(event) => setMaxPlays(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="game-delay">Gecikme (sn)</Label>
              <Input id="game-delay" type="number" min="0" value={showDelay} onChange={(event) => setShowDelay(event.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="game-discount">İndirim türü</Label>
            <Select value={discountType} onValueChange={(value) => setDiscountType(value as "percent" | "amount")}>
              <SelectTrigger id="game-discount">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Yüzde indirim</SelectItem>
                <SelectItem value="amount">Tutar indirimi</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between border border-border px-3 py-2">
            <span className="text-sm">Vitrinde aktif</span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <Label>Ödüller ve kazanma şansı</Label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPrizes((current) => [...current, { label: "Yeni ödül", value: 0, weight: 10 }])}
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <div className="mt-2 space-y-2">
              {prizes.map((prize, index) => (
                <div key={index} className="grid grid-cols-[1fr_64px_64px_32px] items-center gap-1">
                  <Input
                    aria-label={`Ödül ${index + 1} adı`}
                    value={prize.label}
                    onChange={(event) => updatePrize(index, { label: event.target.value })}
                  />
                  <Input
                    aria-label={`Ödül ${index + 1} değeri`}
                    type="number"
                    min="0"
                    value={String(prize.value)}
                    onChange={(event) => updatePrize(index, { value: Number(event.target.value) })}
                  />
                  <Input
                    aria-label={`Ödül ${index + 1} ağırlığı`}
                    type="number"
                    min="1"
                    value={String(prize.weight)}
                    onChange={(event) => updatePrize(index, { weight: Number(event.target.value) })}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Ödül ${index + 1} sil`}
                    disabled={prizes.length <= 2}
                    onClick={() => setPrizes((current) => current.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {chances.map((prize, index) => (
                <li key={index}>
                  {prize.label}: %{prize.chance} şans
                </li>
              ))}
            </ul>
          </div>

          <Button className="w-full" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? "Kaydediliyor…" : "Kampanyayı kaydet"}
          </Button>
        </div>
      </aside>
    </div>
  );
}

function StockTab({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(stockForecastQuery(storeId));

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const rows = data?.rows ?? [];
  const critical = rows.filter((row) => row.status === "critical").length;

  return (
    <section className="border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Stok tükenme tahmini</h2>
          <p className="text-sm text-muted-foreground">
            Son {data?.windowDays ?? 30} günün gerçek satış hızına göre. {critical} ürün kritik seviyede.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["stock-forecast", storeId] })}
        >
          <RefreshCcw className="mr-2 size-4" /> Yenile
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Tahmin için yeterli ürün ya da satış verisi yok.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-2">Ürün</th>
                <th className="pb-2">Stok</th>
                <th className="pb-2">Günlük satış</th>
                <th className="pb-2">Tahmini tükenme</th>
                <th className="pb-2">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.slice(0, 60).map((row) => (
                <tr key={row.productId}>
                  <td className="py-2 pr-3">{row.name}</td>
                  <td className="py-2 pr-3">{row.available}</td>
                  <td className="py-2 pr-3">{row.dailyUsage}</td>
                  <td className="py-2 pr-3">
                    {row.daysLeft === null ? (
                      "—"
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <TrendingDown className="size-3.5 text-muted-foreground" /> {row.daysLeft} gün
                      </span>
                    )}
                  </td>
                  <td className="py-2">
                    <span className={`inline-flex px-2 py-0.5 text-xs ${STATUS_STYLE[row.status]}`}>
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PickupTab({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(pickupLocationsQuery(storeId));

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["pickup-locations", storeId] });

  const reset = () => {
    setEditingId(null);
    setName("");
    setAddressLine("");
    setCity("");
    setPhone("");
    setOpeningHours("");
    setNotes("");
    setIsActive(true);
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      savePickupLocationFn({
        data: {
          storeId,
          id: editingId,
          name,
          addressLine,
          city,
          phone,
          openingHours,
          notes,
          isActive,
        },
      }),
    onSuccess: async () => {
      await invalidate();
      reset();
      toast.success("Teslim noktası kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePickupLocationFn({ data: { storeId, id } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Teslim noktası silindi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="border border-border bg-card p-4">
        <h2 className="font-semibold">Mağazadan teslim noktaları</h2>
        <p className="text-sm text-muted-foreground">
          Aktif noktalar kasada “Mağazadan teslim al” seçeneği olarak görünür.
        </p>
        {isLoading ? (
          <Skeleton className="mt-4 h-32 w-full" />
        ) : (data?.length ?? 0) === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Henüz teslim noktası eklenmedi.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {data?.map((location) => (
              <li key={location.id} className="flex flex-wrap items-start justify-between gap-2 border border-border p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4 text-brand" />
                    <span className="font-medium">{location.name}</span>
                    <Badge variant={location.isActive ? "default" : "outline"}>
                      {location.isActive ? "Aktif" : "Kapalı"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {location.addressLine}, {location.city}
                    {location.openingHours ? ` • ${location.openingHours}` : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingId(location.id);
                      setName(location.name);
                      setAddressLine(location.addressLine);
                      setCity(location.city);
                      setPhone(location.phone);
                      setOpeningHours(location.openingHours);
                      setNotes(location.notes);
                      setIsActive(location.isActive);
                    }}
                  >
                    Düzenle
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Teslim noktasını sil"
                    onClick={() => deleteMutation.mutate(location.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="border border-border bg-card p-4">
        <h2 className="font-semibold">{editingId ? "Noktayı düzenle" : "Yeni teslim noktası"}</h2>
        <div className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="pickup-name">Nokta adı</Label>
            <Input id="pickup-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Merkez mağaza" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pickup-address">Adres</Label>
            <Input id="pickup-address" value={addressLine} onChange={(event) => setAddressLine(event.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="pickup-city">Şehir</Label>
              <Input id="pickup-city" value={city} onChange={(event) => setCity(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pickup-phone">Telefon</Label>
              <Input id="pickup-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pickup-hours">Çalışma saatleri</Label>
            <Input id="pickup-hours" value={openingHours} onChange={(event) => setOpeningHours(event.target.value)} placeholder="Hafta içi 09:00–18:00" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pickup-notes">Not</Label>
            <Textarea id="pickup-notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
          <div className="flex items-center justify-between border border-border px-3 py-2">
            <span className="text-sm">Kasada göster</span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
            {editingId ? (
              <Button variant="outline" onClick={reset}>
                Vazgeç
              </Button>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}

function RfqTab({ storeId, currency }: { storeId: string; currency: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(rfqDeskQuery(storeId));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [quote, setQuote] = useState("");
  const [status, setStatus] = useState<"new" | "quoted" | "won" | "lost">("quoted");

  const selected = data?.requests.find((request) => request.id === selectedId) ?? data?.requests[0] ?? null;
  const thread = (data?.messages ?? []).filter((message) => message.rfqId === selected?.id);

  const replyMutation = useMutation({
    mutationFn: () =>
      replyToRfqFn({
        data: {
          storeId,
          rfqId: selected!.id,
          body,
          ...(quote ? { quotedTotal: Number(quote) } : {}),
          status,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rfq-desk", storeId] });
      setBody("");
      setQuote("");
      toast.success("Yanıt gönderildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  if ((data?.requests.length ?? 0) === 0) {
    return (
      <section className="border border-border bg-card p-6 text-sm text-muted-foreground">
        Henüz toptan teklif talebi yok. Vitrindeki toptan formundan gelen talepler burada listelenir.
      </section>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <section className="border border-border bg-card p-3">
        <h2 className="mb-2 font-semibold">Talepler</h2>
        <ul className="space-y-1">
          {data?.requests.map((request) => (
            <li key={request.id}>
              <button
                type="button"
                onClick={() => setSelectedId(request.id)}
                className={`w-full border px-3 py-2 text-left text-sm transition ${
                  selected?.id === request.id ? "border-brand bg-brand/5" : "border-transparent hover:bg-muted/40"
                }`}
              >
                <span className="block font-medium">{request.companyName}</span>
                <span className="block text-xs text-muted-foreground">
                  {request.reference} • {formatMoney(request.requestedTotal, request.currency)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="border border-border bg-card p-4">
        {selected ? (
          <>
            <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-3">
              <div>
                <h2 className="font-semibold">{selected.companyName}</h2>
                <p className="text-xs text-muted-foreground">
                  {selected.contactName} • {selected.email} • talep{" "}
                  {formatMoney(selected.requestedTotal, selected.currency)}
                </p>
              </div>
              <Badge variant="outline">{selected.status}</Badge>
            </header>

            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {thread.length === 0 ? (
                <p className="text-sm text-muted-foreground">Bu talep için henüz mesaj yok.</p>
              ) : (
                thread.map((message) => (
                  <div
                    key={message.id}
                    className={`border border-border p-3 text-sm ${
                      message.authorKind === "rep" ? "bg-brand/5" : "bg-muted/30"
                    }`}
                  >
                    <p className="text-xs text-muted-foreground">
                      {message.authorKind === "rep" ? "Temsilci" : "Alıcı"} • {formatDateTime(message.createdAt)}
                      {message.quotedTotal !== null
                        ? ` • teklif ${formatMoney(message.quotedTotal, selected.currency || currency)}`
                        : ""}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 space-y-3 border-t border-border pt-4">
              <div className="space-y-2">
                <Label htmlFor="rfq-body">Yanıt</Label>
                <Textarea id="rfq-body" rows={4} value={body} onChange={(event) => setBody(event.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="rfq-quote">Teklif tutarı</Label>
                  <Input id="rfq-quote" type="number" min="0" value={quote} onChange={(event) => setQuote(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rfq-status">Durum</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
                    <SelectTrigger id="rfq-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Yeni</SelectItem>
                      <SelectItem value="quoted">Teklif verildi</SelectItem>
                      <SelectItem value="won">Kazanıldı</SelectItem>
                      <SelectItem value="lost">Kaybedildi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                className="w-full"
                disabled={!body.trim() || replyMutation.isPending}
                onClick={() => replyMutation.mutate()}
              >
                {replyMutation.isPending ? "Gönderiliyor…" : "Yanıtı gönder"}
              </Button>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
