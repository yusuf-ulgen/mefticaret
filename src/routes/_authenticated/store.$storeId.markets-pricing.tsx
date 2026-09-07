import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Coins, Globe2, Loader2, Plus, RefreshCcw, Sparkles, Trash2, TriangleAlert } from "lucide-react";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { productsQuery } from "@/lib/catalog-queries";
import {
  liveRatesQuery,
  marketsQuery,
  platformCurrenciesQuery,
  priceListsQuery,
  pricingCampaignsQuery,
  pricingRulesQuery,
  pricingSettingsQuery,
  rateHistoryQuery,
  storeCurrenciesQuery,
  type Market,
} from "@/lib/markets-pricing-queries";
import {
  refreshExchangeRates,
  removeMarket,
  removePricingCampaign,
  removePricingRule,
  removeStoreCurrency,
  saveMarket,
  savePriceList,
  savePricingCampaign,
  savePricingRule,
  savePricingSettings,
  saveStoreCurrency,
  simulatePricing,
} from "@/lib/markets-pricing.functions";
import {
  MARKUP_TYPE_LABELS,
  PRICE_SOURCE_LABELS,
  RATE_FREQUENCY_LABELS,
  ROUNDING_LABELS,
  formatMarketPrice,
  type MarkupType,
  type RoundingMode,
} from "@/lib/pricing-engine";

export const Route = createFileRoute("/_authenticated/store/$storeId/markets-pricing")({
  head: () => ({
    meta: [
      { title: "Marketler & Fiyatlandırma — Mefticaret" },
      {
        name: "description",
        content:
          "Çoklu para birimi, ülke bazlı market fiyatları, döviz kurları, fiyat listeleri ve kural tabanlı fiyatlandırmayı tek panelden yönetin.",
      },
      { property: "og:title", content: "Marketler & Fiyatlandırma — Mefticaret" },
      {
        property: "og:description",
        content: "Global fiyatlandırma motoru: kur güncelleme, market fiyatları, kampanya kurları ve simülatör.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MarketsPricingPage,
});

const MARKUP_OPTIONS = Object.entries(MARKUP_TYPE_LABELS) as [MarkupType, string][];
const ROUNDING_OPTIONS = Object.entries(ROUNDING_LABELS) as [RoundingMode, string][];

type CurrencyInput = {
  storeId: string;
  currency: string;
  isActive: boolean;
  markupType: MarkupType;
  markupValue: number;
  rounding: RoundingMode;
  useManualRate: boolean;
  manualRate: number | null;
};

function MarketsPricingPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();

  const settings = useQuery(pricingSettingsQuery(storeId));
  const currencies = useQuery(storeCurrenciesQuery(storeId));
  const platform = useQuery(platformCurrenciesQuery());
  const markets = useQuery(marketsQuery(storeId));
  const priceLists = useQuery(priceListsQuery(storeId));
  const rules = useQuery(pricingRulesQuery(storeId));
  const campaigns = useQuery(pricingCampaignsQuery(storeId));
  const rates = useQuery(liveRatesQuery(storeId));
  const history = useQuery(rateHistoryQuery(storeId));
  const products = useQuery(productsQuery(storeId));

  const invalidate = (keys: string[]) => {
    for (const key of keys) void queryClient.invalidateQueries({ queryKey: [key, storeId] });
  };

  const baseCurrency = settings.data?.base_currency ?? "TRY";
  const platformList = platform.data ?? [];

  /* ---------------------------------- Kurlar --------------------------------- */
  const refreshFn = useServerFn(refreshExchangeRates);
  const refreshMutation = useMutation({
    mutationFn: () => refreshFn({ data: { storeId } }),
    onSuccess: (result) => {
      toast.success(
        result.updated > 0
          ? `${result.updated} kur güncellendi${result.provider ? ` (${result.provider})` : ""}`
          : result.failedOver
            ? "Sağlayıcılara ulaşılamadı; son geçerli kurlar kullanılıyor"
            : "Kurlar güncel",
      );
      invalidate(["live-rates", "rate-history", "pricing-settings"]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  /* --------------------------------- Ayarlar -------------------------------- */
  const settingsFn = useServerFn(savePricingSettings);
  const [settingsDraft, setSettingsDraft] = useState<Record<string, string>>({});
  const draft = (field: string, fallback: string) => settingsDraft[field] ?? fallback;

  const settingsMutation = useMutation({
    mutationFn: () =>
      settingsFn({
        data: {
          storeId,
          baseCurrency: draft("baseCurrency", baseCurrency),
          updateFrequency: draft("updateFrequency", settings.data?.update_frequency ?? "daily") as
            | "manual"
            | "hourly"
            | "six_hourly"
            | "daily",
          defaultMarkupType: draft("markupType", settings.data?.default_markup_type ?? "none") as MarkupType,
          defaultMarkupValue: Number(draft("markupValue", String(settings.data?.default_markup_value ?? 0))) || 0,
          defaultRounding: draft("rounding", settings.data?.default_rounding ?? "none") as RoundingMode,
          minMarginPercent:
            draft("minMargin", settings.data?.min_margin_percent?.toString() ?? "") === ""
              ? null
              : Number(draft("minMargin", String(settings.data?.min_margin_percent ?? 0))),
          maxChangePercent:
            draft("maxChange", settings.data?.max_change_percent?.toString() ?? "") === ""
              ? null
              : Number(draft("maxChange", String(settings.data?.max_change_percent ?? 0))),
          requireApproval: draft("approval", String(settings.data?.require_approval ?? false)) === "true",
          staleAfterHours: Number(draft("stale", String(settings.data?.stale_after_hours ?? 36))) || 36,
          geolocationEnabled: draft("geo", String(settings.data?.geolocation_enabled ?? true)) === "true",
          providerCode: draft("provider", settings.data?.provider_code ?? "") || null,
        },
      }),
    onSuccess: () => {
      toast.success("Fiyatlandırma ayarları kaydedildi");
      invalidate(["pricing-settings"]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  /* ------------------------------ Para birimleri ---------------------------- */
  const currencyFn = useServerFn(saveStoreCurrency);
  const removeCurrencyFn = useServerFn(removeStoreCurrency);
  const [newCurrency, setNewCurrency] = useState("");

  const currencyMutation = useMutation({
    mutationFn: (input: CurrencyInput) => currencyFn({ data: input }),
    onSuccess: () => {
      toast.success("Para birimi kaydedildi");
      invalidate(["store-currencies", "live-rates"]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeCurrencyMutation = useMutation({
    mutationFn: (currency: string) => removeCurrencyFn({ data: { storeId, currency } }),
    onSuccess: () => {
      toast.success("Para birimi kaldırıldı");
      invalidate(["store-currencies"]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  /* -------------------------------- Marketler ------------------------------- */
  const marketFn = useServerFn(saveMarket);
  const removeMarketFn = useServerFn(removeMarket);
  const [marketDialog, setMarketDialog] = useState<Partial<Market> | null>(null);
  const [marketCountries, setMarketCountries] = useState("");

  const marketMutation = useMutation({
    mutationFn: () => {
      const value = marketDialog ?? {};
      return marketFn({
        data: {
          storeId,
          id: value.id ?? null,
          name: value.name ?? "",
          code: value.code ?? "",
          countryCode: value.country_code ? value.country_code.toUpperCase() : null,
          currency: (value.currency ?? baseCurrency).toUpperCase(),
          locale: value.locale ?? null,
          domain: value.domain ?? null,
          urlPrefix: value.url_prefix ?? null,
          taxIncluded: value.tax_included ?? true,
          priceListId: value.price_list_id ?? null,
          markupType: (value.markup_type ?? "none") as MarkupType,
          markupValue: Number(value.markup_value ?? 0),
          rounding: (value.rounding ?? "none") as RoundingMode,
          isDefault: value.is_default ?? false,
          isActive: value.is_active ?? true,
          countries: marketCountries
            .split(/[,\s]+/)
            .map((code) => code.trim().toUpperCase())
            .filter((code) => code.length === 2),
        },
      });
    },
    onSuccess: () => {
      toast.success("Market kaydedildi");
      setMarketDialog(null);
      setMarketCountries("");
      invalidate(["markets"]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMarketMutation = useMutation({
    mutationFn: (id: string) => removeMarketFn({ data: { storeId, id } }),
    onSuccess: () => {
      toast.success("Market silindi");
      invalidate(["markets"]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  /* ----------------------------- Fiyat listeleri ---------------------------- */
  const priceListFn = useServerFn(savePriceList);
  const [listDraft, setListDraft] = useState({ name: "", code: "", currency: baseCurrency, kind: "wholesale" });
  const priceListMutation = useMutation({
    mutationFn: () =>
      priceListFn({
        data: {
          storeId,
          id: null,
          name: listDraft.name,
          code: listDraft.code || listDraft.name.toLowerCase().replace(/\s+/g, "-"),
          currency: listDraft.currency,
          kind: listDraft.kind as "retail" | "wholesale" | "b2b" | "campaign" | "vip",
          isActive: true,
          startsAt: null,
          endsAt: null,
        },
      }),
    onSuccess: () => {
      toast.success("Fiyat listesi oluşturuldu");
      setListDraft({ name: "", code: "", currency: baseCurrency, kind: "wholesale" });
      invalidate(["price-lists"]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  /* --------------------------- Kurallar & kampanya -------------------------- */
  const ruleFn = useServerFn(savePricingRule);
  const removeRuleFn = useServerFn(removePricingRule);
  const [ruleDraft, setRuleDraft] = useState({
    name: "",
    priority: "100",
    actionType: "increase_percent",
    actionValue: "5",
    rounding: "psych_99",
    currency: "",
    minPrice: "",
  });

  const ruleMutation = useMutation({
    mutationFn: () =>
      ruleFn({
        data: {
          storeId,
          id: null,
          name: ruleDraft.name,
          description: null,
          priority: Number(ruleDraft.priority) || 0,
          isActive: true,
          conditions: {
            ...(ruleDraft.currency ? { currencies: [ruleDraft.currency] } : {}),
            ...(ruleDraft.minPrice ? { minPrice: Number(ruleDraft.minPrice) } : {}),
          },
          actions: {
            type: ruleDraft.actionType,
            value: Number(ruleDraft.actionValue) || 0,
            rounding: ruleDraft.rounding,
          },
          startsAt: null,
          endsAt: null,
        },
      }),
    onSuccess: () => {
      toast.success("Fiyat kuralı eklendi");
      setRuleDraft({ ...ruleDraft, name: "" });
      invalidate(["pricing-rules"]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeRuleMutation = useMutation({
    mutationFn: (id: string) => removeRuleFn({ data: { storeId, id } }),
    onSuccess: () => {
      toast.success("Kural silindi");
      invalidate(["pricing-rules"]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const campaignFn = useServerFn(savePricingCampaign);
  const removeCampaignFn = useServerFn(removePricingCampaign);
  const [campaignDraft, setCampaignDraft] = useState({
    name: "",
    currency: "",
    rate: "",
    markupType: "none",
    markupValue: "0",
    rounding: "none",
    startsAt: "",
    endsAt: "",
  });

  const campaignMutation = useMutation({
    mutationFn: () =>
      campaignFn({
        data: {
          storeId,
          id: null,
          name: campaignDraft.name,
          currency: campaignDraft.currency || baseCurrency,
          rate: campaignDraft.rate ? Number(campaignDraft.rate) : null,
          markupType: campaignDraft.markupType as MarkupType,
          markupValue: Number(campaignDraft.markupValue) || 0,
          rounding: campaignDraft.rounding as RoundingMode,
          marketId: null,
          priceListId: null,
          startsAt: campaignDraft.startsAt ? new Date(campaignDraft.startsAt).toISOString() : null,
          endsAt: campaignDraft.endsAt ? new Date(campaignDraft.endsAt).toISOString() : null,
          isActive: true,
        },
      }),
    onSuccess: () => {
      toast.success("Kampanya kuru eklendi");
      setCampaignDraft({ ...campaignDraft, name: "" });
      invalidate(["pricing-campaigns"]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeCampaignMutation = useMutation({
    mutationFn: (id: string) => removeCampaignFn({ data: { storeId, id } }),
    onSuccess: () => {
      toast.success("Kampanya silindi");
      invalidate(["pricing-campaigns"]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  /* -------------------------------- Simülatör ------------------------------- */
  const simulateFn = useServerFn(simulatePricing);
  const [simMarket, setSimMarket] = useState<string>("");
  const simulation = useMutation({
    mutationFn: () =>
      simulateFn({
        data: {
          storeId,
          marketId: simMarket || null,
          currency: null,
          countryCode: null,
          productIds: (products.data ?? []).slice(0, 25).map((product) => String(product.id)),
        },
      }),
    onError: (error: Error) => toast.error(error.message),
  });

  const activeCurrencies = useMemo(
    () => (currencies.data ?? []).filter((row) => row.is_active).map((row) => row.currency),
    [currencies.data],
  );

  const staleWarning = (settings.data?.last_rate_sync_at ?? null) === null && activeCurrencies.length > 1;

  return (
    <AppShell storeId={storeId} title="Marketler & Fiyatlandırma">
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Coins className="size-5 text-primary" /> Marketler & fiyatlandırma
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Ana para birimi, ülke bazlı marketler, döviz kurları, fiyat listeleri ve kural tabanlı fiyatlandırma.
              Tüm fiyatlar sunucuda hesaplanır; vitrin ve kasa aynı sonucu kullanır.
            </p>
          </div>
          <Button onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending}>
            {refreshMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 size-4" />
            )}
            Kurları güncelle
          </Button>
        </header>

        {staleWarning ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <TriangleAlert className="mt-0.5 size-4 text-destructive" />
            <span>
              Kurlar henüz hiç güncellenmedi. “Kurları güncelle” ile canlı kurları çekin; aksi halde yalnızca ana
              para birimi fiyatları gösterilir.
            </span>
          </div>
        ) : null}

        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">Genel</TabsTrigger>
            <TabsTrigger value="currencies">Para birimleri</TabsTrigger>
            <TabsTrigger value="markets">Marketler</TabsTrigger>
            <TabsTrigger value="lists">Fiyat listeleri</TabsTrigger>
            <TabsTrigger value="rules">Kurallar & kampanyalar</TabsTrigger>
            <TabsTrigger value="simulator">Simülatör</TabsTrigger>
            <TabsTrigger value="history">Kur geçmişi</TabsTrigger>
          </TabsList>

          {/* ------------------------------- GENEL ------------------------------- */}
          <TabsContent value="overview" className="space-y-4 pt-4">
            {settings.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <section className="grid grid-cols-1 gap-4 rounded-xl border bg-card p-5 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Ana para birimi</Label>
                  <Select
                    value={draft("baseCurrency", baseCurrency)}
                    onValueChange={(value) => setSettingsDraft((prev) => ({ ...prev, baseCurrency: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {platformList.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.code} — {currency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Kur güncelleme sıklığı</Label>
                  <Select
                    value={draft("updateFrequency", settings.data?.update_frequency ?? "daily")}
                    onValueChange={(value) => setSettingsDraft((prev) => ({ ...prev, updateFrequency: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(RATE_FREQUENCY_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Varsayılan yuvarlama</Label>
                  <Select
                    value={draft("rounding", settings.data?.default_rounding ?? "none")}
                    onValueChange={(value) => setSettingsDraft((prev) => ({ ...prev, rounding: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROUNDING_OPTIONS.map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Varsayılan kur marjı</Label>
                  <div className="flex gap-2">
                    <Select
                      value={draft("markupType", settings.data?.default_markup_type ?? "none")}
                      onValueChange={(value) => setSettingsDraft((prev) => ({ ...prev, markupType: value }))}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MARKUP_OPTIONS.map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      inputMode="decimal"
                      value={draft("markupValue", String(settings.data?.default_markup_value ?? 0))}
                      onChange={(event) =>
                        setSettingsDraft((prev) => ({ ...prev, markupValue: event.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Minimum kâr marjı (%)</Label>
                  <Input
                    inputMode="decimal"
                    placeholder="Boş = kapalı"
                    value={draft("minMargin", settings.data?.min_margin_percent?.toString() ?? "")}
                    onChange={(event) => setSettingsDraft((prev) => ({ ...prev, minMargin: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Maksimum fiyat değişimi (%)</Label>
                  <Input
                    inputMode="decimal"
                    placeholder="Boş = kapalı"
                    value={draft("maxChange", settings.data?.max_change_percent?.toString() ?? "")}
                    onChange={(event) => setSettingsDraft((prev) => ({ ...prev, maxChange: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kur tazelik süresi (saat)</Label>
                  <Input
                    inputMode="numeric"
                    value={draft("stale", String(settings.data?.stale_after_hours ?? 36))}
                    onChange={(event) => setSettingsDraft((prev) => ({ ...prev, stale: event.target.value }))}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <Label htmlFor="geo" className="text-xs">
                    Ziyaretçi konumuna göre market öner
                  </Label>
                  <Switch
                    id="geo"
                    checked={draft("geo", String(settings.data?.geolocation_enabled ?? true)) === "true"}
                    onCheckedChange={(checked) =>
                      setSettingsDraft((prev) => ({ ...prev, geo: String(checked) }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <Label htmlFor="approval" className="text-xs">
                    Büyük fiyat değişimlerinde onay istensin
                  </Label>
                  <Switch
                    id="approval"
                    checked={draft("approval", String(settings.data?.require_approval ?? false)) === "true"}
                    onCheckedChange={(checked) =>
                      setSettingsDraft((prev) => ({ ...prev, approval: String(checked) }))
                    }
                  />
                </div>
                <div className="md:col-span-3">
                  <Button onClick={() => settingsMutation.mutate()} disabled={settingsMutation.isPending}>
                    {settingsMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    Ayarları kaydet
                  </Button>
                  {settings.data?.last_rate_sync_at ? (
                    <span className="ml-3 text-xs text-muted-foreground">
                      Son kur güncellemesi:{" "}
                      {new Date(settings.data.last_rate_sync_at).toLocaleString("tr-TR")}
                    </span>
                  ) : null}
                </div>
              </section>
            )}
          </TabsContent>

          {/* --------------------------- PARA BİRİMLERİ -------------------------- */}
          <TabsContent value="currencies" className="space-y-4 pt-4">
            <section className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
              <div className="space-y-2">
                <Label>Para birimi ekle</Label>
                <Select value={newCurrency} onValueChange={setNewCurrency}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="ISO 4217 para birimi seç" />
                  </SelectTrigger>
                  <SelectContent>
                    {platformList
                      .filter((currency) => !activeCurrencies.includes(currency.code))
                      .map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.code} — {currency.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                disabled={!newCurrency || currencyMutation.isPending}
                onClick={() =>
                  currencyMutation.mutate({
                    storeId,
                    currency: newCurrency,
                    isActive: true,
                    markupType: (settings.data?.default_markup_type ?? "none") as MarkupType,
                    markupValue: Number(settings.data?.default_markup_value ?? 0),
                    rounding: (settings.data?.default_rounding ?? "none") as RoundingMode,
                    useManualRate: false,
                    manualRate: null,
                  })
                }
              >
                <Plus className="mr-2 size-4" /> Ekle
              </Button>
            </section>

            <section className="divide-y rounded-xl border bg-card">
              {currencies.isLoading ? (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (currencies.data ?? []).length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">Henüz para birimi eklenmemiş.</p>
              ) : (
                (currencies.data ?? []).map((row) => {
                  const live = (rates.data ?? []).find(
                    (rate) => rate.quote_currency === row.currency && rate.base_currency === baseCurrency,
                  );
                  return (
                    <div key={row.id} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-6 md:items-end">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {row.currency} {row.is_base ? <Badge>Ana</Badge> : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {row.is_base
                            ? "Temel fiyatlar bu para biriminde"
                            : live
                              ? `1 ${baseCurrency} = ${Number(live.rate).toFixed(4)} ${row.currency} (${live.source})`
                              : "Kur yok"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Marj türü</Label>
                        <Select
                          value={row.markup_type}
                          onValueChange={(value) =>
                            currencyMutation.mutate({
                              storeId,
                              currency: row.currency,
                              isActive: row.is_active,
                              markupType: value as MarkupType,
                              markupValue: Number(row.markup_value),
                              rounding: row.rounding as RoundingMode,
                              useManualRate: row.use_manual_rate,
                              manualRate: row.manual_rate,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MARKUP_OPTIONS.map(([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Marj değeri</Label>
                        <Input
                          defaultValue={String(row.markup_value)}
                          inputMode="decimal"
                          onBlur={(event) =>
                            currencyMutation.mutate({
                              storeId,
                              currency: row.currency,
                              isActive: row.is_active,
                              markupType: row.markup_type as MarkupType,
                              markupValue: Number(event.target.value) || 0,
                              rounding: row.rounding as RoundingMode,
                              useManualRate: row.use_manual_rate,
                              manualRate: row.manual_rate,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Yuvarlama</Label>
                        <Select
                          value={row.rounding}
                          onValueChange={(value) =>
                            currencyMutation.mutate({
                              storeId,
                              currency: row.currency,
                              isActive: row.is_active,
                              markupType: row.markup_type as MarkupType,
                              markupValue: Number(row.markup_value),
                              rounding: value as RoundingMode,
                              useManualRate: row.use_manual_rate,
                              manualRate: row.manual_rate,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROUNDING_OPTIONS.map(([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Manuel kur</Label>
                        <Input
                          defaultValue={row.manual_rate ? String(row.manual_rate) : ""}
                          placeholder="Boş = otomatik"
                          inputMode="decimal"
                          disabled={row.is_base}
                          onBlur={(event) => {
                            const value = Number(event.target.value);
                            currencyMutation.mutate({
                              storeId,
                              currency: row.currency,
                              isActive: row.is_active,
                              markupType: row.markup_type as MarkupType,
                              markupValue: Number(row.markup_value),
                              rounding: row.rounding as RoundingMode,
                              useManualRate: Number.isFinite(value) && value > 0,
                              manualRate: Number.isFinite(value) && value > 0 ? value : null,
                            });
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={row.is_active}
                          disabled={row.is_base}
                          onCheckedChange={(checked) =>
                            currencyMutation.mutate({
                              storeId,
                              currency: row.currency,
                              isActive: checked,
                              markupType: row.markup_type as MarkupType,
                              markupValue: Number(row.markup_value),
                              rounding: row.rounding as RoundingMode,
                              useManualRate: row.use_manual_rate,
                              manualRate: row.manual_rate,
                            })
                          }
                          aria-label={`${row.currency} aktif`}
                        />
                        {row.is_base ? null : (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`${row.currency} kaldır`}
                            onClick={() => removeCurrencyMutation.mutate(row.currency)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          </TabsContent>

          {/* ------------------------------ MARKETLER ---------------------------- */}
          <TabsContent value="markets" className="space-y-4 pt-4">
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setMarketDialog({ currency: baseCurrency, tax_included: true, is_active: true });
                  setMarketCountries("");
                }}
              >
                <Plus className="mr-2 size-4" /> Market ekle
              </Button>
            </div>

            <section className="divide-y rounded-xl border bg-card">
              {markets.isLoading ? (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : (markets.data ?? []).length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  Henüz market yok. Ülke veya bölge bazlı fiyatlandırma için market oluşturun.
                </p>
              ) : (
                (markets.data ?? []).map((market) => (
                  <div key={market.id} className="flex flex-wrap items-center gap-3 p-4">
                    <Globe2 className="size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {market.name}
                        {market.is_default ? <Badge variant="secondary">Varsayılan</Badge> : null}
                        {market.is_active ? null : <Badge variant="outline">Kapalı</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {market.currency} · {market.country_code ?? "Genel"} ·{" "}
                        {market.tax_included ? "vergi dahil" : "vergi hariç"} ·{" "}
                        {ROUNDING_LABELS[market.rounding as RoundingMode] ?? market.rounding}
                        {market.domain ? ` · ${market.domain}` : ""}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setMarketDialog(market);
                        setMarketCountries("");
                      }}
                    >
                      Düzenle
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${market.name} sil`}
                      onClick={() => removeMarketMutation.mutate(market.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))
              )}
            </section>
          </TabsContent>

          {/* --------------------------- FİYAT LİSTELERİ ------------------------- */}
          <TabsContent value="lists" className="space-y-4 pt-4">
            <section className="grid grid-cols-1 gap-3 rounded-xl border bg-card p-4 md:grid-cols-5 md:items-end">
              <div className="space-y-1 md:col-span-2">
                <Label>Liste adı</Label>
                <Input
                  value={listDraft.name}
                  onChange={(event) => setListDraft((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Toptan Fiyat Listesi"
                />
              </div>
              <div className="space-y-1">
                <Label>Tür</Label>
                <Select value={listDraft.kind} onValueChange={(value) => setListDraft((prev) => ({ ...prev, kind: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retail">Perakende</SelectItem>
                    <SelectItem value="wholesale">Toptan</SelectItem>
                    <SelectItem value="b2b">B2B</SelectItem>
                    <SelectItem value="campaign">Kampanya</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Para birimi</Label>
                <Select
                  value={listDraft.currency}
                  onValueChange={(value) => setListDraft((prev) => ({ ...prev, currency: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(activeCurrencies.length > 0 ? activeCurrencies : [baseCurrency]).map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                disabled={listDraft.name.trim().length < 2 || priceListMutation.isPending}
                onClick={() => priceListMutation.mutate()}
              >
                <Plus className="mr-2 size-4" /> Oluştur
              </Button>
            </section>

            <section className="divide-y rounded-xl border bg-card">
              {(priceLists.data ?? []).length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  Fiyat listesi yok. Toptan/B2B fiyatları için liste oluşturup markete bağlayın.
                </p>
              ) : (
                (priceLists.data ?? []).map((list) => (
                  <div key={list.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{list.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {list.code} · {list.currency} · {list.kind}
                      </p>
                    </div>
                    <Badge variant={list.is_active ? "secondary" : "outline"}>
                      {list.is_active ? "Aktif" : "Kapalı"}
                    </Badge>
                  </div>
                ))
              )}
            </section>
          </TabsContent>

          {/* -------------------------- KURALLAR & KAMPANYA ---------------------- */}
          <TabsContent value="rules" className="space-y-6 pt-4">
            <section className="space-y-3 rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold">Yeni fiyat kuralı (EĞER → İSE)</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-6 md:items-end">
                <div className="space-y-1 md:col-span-2">
                  <Label>Kural adı</Label>
                  <Input
                    value={ruleDraft.name}
                    onChange={(event) => setRuleDraft((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="EUR fiyatlarına %5 ekle"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Para birimi (EĞER)</Label>
                  <Select
                    value={ruleDraft.currency || "all"}
                    onValueChange={(value) =>
                      setRuleDraft((prev) => ({ ...prev, currency: value === "all" ? "" : value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tümü</SelectItem>
                      {activeCurrencies.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Aksiyon</Label>
                  <Select
                    value={ruleDraft.actionType}
                    onValueChange={(value) => setRuleDraft((prev) => ({ ...prev, actionType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="increase_percent">Yüzde artır</SelectItem>
                      <SelectItem value="decrease_percent">Yüzde azalt</SelectItem>
                      <SelectItem value="increase_amount">Tutar ekle</SelectItem>
                      <SelectItem value="decrease_amount">Tutar çıkar</SelectItem>
                      <SelectItem value="set">Sabit fiyat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Değer</Label>
                  <Input
                    inputMode="decimal"
                    value={ruleDraft.actionValue}
                    onChange={(event) => setRuleDraft((prev) => ({ ...prev, actionValue: event.target.value }))}
                  />
                </div>
                <Button disabled={ruleDraft.name.trim().length < 2 || ruleMutation.isPending} onClick={() => ruleMutation.mutate()}>
                  <Plus className="mr-2 size-4" /> Kural ekle
                </Button>
              </div>
            </section>

            <section className="divide-y rounded-xl border bg-card">
              {(rules.data ?? []).length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Fiyat kuralı yok.</p>
              ) : (
                (rules.data ?? []).map((rule) => (
                  <div key={rule.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{rule.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Öncelik {rule.priority} · {JSON.stringify(rule.conditions)} → {JSON.stringify(rule.actions)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${rule.name} sil`}
                      onClick={() => removeRuleMutation.mutate(rule.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))
              )}
            </section>

            <section className="space-y-3 rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold">Kampanya kuru (tarih aralıklı)</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-6 md:items-end">
                <div className="space-y-1 md:col-span-2">
                  <Label>Kampanya adı</Label>
                  <Input
                    value={campaignDraft.name}
                    onChange={(event) => setCampaignDraft((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Black Friday EUR kuru"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Para birimi</Label>
                  <Select
                    value={campaignDraft.currency || baseCurrency}
                    onValueChange={(value) => setCampaignDraft((prev) => ({ ...prev, currency: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(activeCurrencies.length > 0 ? activeCurrencies : [baseCurrency]).map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Sabit kur</Label>
                  <Input
                    inputMode="decimal"
                    placeholder="Boş = canlı kur"
                    value={campaignDraft.rate}
                    onChange={(event) => setCampaignDraft((prev) => ({ ...prev, rate: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Başlangıç</Label>
                  <Input
                    type="date"
                    value={campaignDraft.startsAt}
                    onChange={(event) => setCampaignDraft((prev) => ({ ...prev, startsAt: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Bitiş</Label>
                  <Input
                    type="date"
                    value={campaignDraft.endsAt}
                    onChange={(event) => setCampaignDraft((prev) => ({ ...prev, endsAt: event.target.value }))}
                  />
                </div>
                <Button
                  disabled={campaignDraft.name.trim().length < 2 || campaignMutation.isPending}
                  onClick={() => campaignMutation.mutate()}
                >
                  <Plus className="mr-2 size-4" /> Kampanya ekle
                </Button>
              </div>
            </section>

            <section className="divide-y rounded-xl border bg-card">
              {(campaigns.data ?? []).length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Kampanya kuru yok.</p>
              ) : (
                (campaigns.data ?? []).map((campaign) => (
                  <div key={campaign.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{campaign.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {campaign.currency}
                        {campaign.rate ? ` · sabit kur ${campaign.rate}` : " · canlı kur"}
                        {campaign.starts_at
                          ? ` · ${new Date(campaign.starts_at).toLocaleDateString("tr-TR")}`
                          : ""}
                        {campaign.ends_at ? ` → ${new Date(campaign.ends_at).toLocaleDateString("tr-TR")}` : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${campaign.name} sil`}
                      onClick={() => removeCampaignMutation.mutate(campaign.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))
              )}
            </section>
          </TabsContent>

          {/* ------------------------------ SİMÜLATÖR ---------------------------- */}
          <TabsContent value="simulator" className="space-y-4 pt-4">
            <section className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
              <div className="space-y-1">
                <Label>Market</Label>
                <Select value={simMarket || "default"} onValueChange={(value) => setSimMarket(value === "default" ? "" : value)}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Varsayılan market" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Varsayılan market</SelectItem>
                    {(markets.data ?? []).map((market) => (
                      <SelectItem key={market.id} value={market.id}>
                        {market.name} ({market.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => simulation.mutate()}
                disabled={simulation.isPending || (products.data ?? []).length === 0}
              >
                {simulation.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 size-4" />
                )}
                Fiyatları hesapla
              </Button>
            </section>

            {simulation.data ? (
              <section className="rounded-xl border bg-card">
                <div className="flex flex-wrap items-center gap-2 border-b p-4 text-xs text-muted-foreground">
                  <Badge variant="secondary">
                    {simulation.data.baseCurrency} → {simulation.data.currency}
                  </Badge>
                  <span>Kur: {simulation.data.rate}</span>
                  <span>Kaynak: {simulation.data.rateSource}</span>
                  {simulation.data.campaign ? <Badge>{simulation.data.campaign.name}</Badge> : null}
                  {simulation.data.rateStale ? <Badge variant="outline">Kur eski</Badge> : null}
                </div>
                <div className="divide-y">
                  {simulation.data.rows.map((row) => (
                    <div key={`${row.productId}-${row.variantId ?? ""}`} className="flex flex-wrap items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{row.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {PRICE_SOURCE_LABELS[row.source] ?? row.source}
                          {row.marginWarning ? " · minimum marj uygulandı" : ""}
                          {row.changeGuardApplied ? " · değişim limiti uygulandı" : ""}
                        </p>
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatMarketPrice(row.basePrice, simulation.data?.baseCurrency ?? "TRY")}
                      </span>
                      <span className="text-sm font-medium tabular-nums">
                        {formatMarketPrice(row.price, row.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <p className="text-sm text-muted-foreground">
                Seçtiğiniz market için ilk 25 ürünün sunucuda hesaplanmış fiyatını görün.
              </p>
            )}
          </TabsContent>

          {/* ------------------------------- GEÇMİŞ ------------------------------ */}
          <TabsContent value="history" className="pt-4">
            <section className="divide-y rounded-xl border bg-card">
              {history.isLoading ? (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (history.data ?? []).length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">Kur geçmişi henüz yok.</p>
              ) : (
                (history.data ?? []).map((row) => (
                  <div key={row.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                    <span className="w-28 font-medium">
                      {row.base_currency}/{row.quote_currency}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {row.old_rate ? Number(row.old_rate).toFixed(4) : "—"} →{" "}
                      <strong className="text-foreground">{Number(row.new_rate).toFixed(4)}</strong>
                    </span>
                    <Badge variant="outline">{row.provider_code ?? row.source}</Badge>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleString("tr-TR")}
                    </span>
                  </div>
                ))
              )}
            </section>
          </TabsContent>
        </Tabs>
      </div>

      {/* ----------------------------- MARKET DIALOG ---------------------------- */}
      <Dialog open={marketDialog !== null} onOpenChange={(open) => (open ? null : setMarketDialog(null))}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{marketDialog?.id ? "Marketi düzenle" : "Yeni market"}</DialogTitle>
            <DialogDescription>
              Market; ülke(ler), para birimi, dil, vergi davranışı ve fiyat listesini birlikte tanımlar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Market adı</Label>
              <Input
                value={marketDialog?.name ?? ""}
                onChange={(event) => setMarketDialog((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Kod</Label>
              <Input
                value={marketDialog?.code ?? ""}
                onChange={(event) => setMarketDialog((prev) => ({ ...prev, code: event.target.value }))}
                placeholder="eu"
              />
            </div>
            <div className="space-y-1">
              <Label>Ana ülke (ISO 2)</Label>
              <Input
                value={marketDialog?.country_code ?? ""}
                maxLength={2}
                onChange={(event) =>
                  setMarketDialog((prev) => ({ ...prev, country_code: event.target.value.toUpperCase() }))
                }
                placeholder="DE"
              />
            </div>
            <div className="space-y-1">
              <Label>Para birimi</Label>
              <Select
                value={marketDialog?.currency ?? baseCurrency}
                onValueChange={(value) => setMarketDialog((prev) => ({ ...prev, currency: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(activeCurrencies.length > 0 ? activeCurrencies : [baseCurrency]).map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Dil</Label>
              <Input
                value={marketDialog?.locale ?? ""}
                onChange={(event) => setMarketDialog((prev) => ({ ...prev, locale: event.target.value }))}
                placeholder="de-DE"
              />
            </div>
            <div className="space-y-1">
              <Label>Alan adı / URL öneki</Label>
              <Input
                value={marketDialog?.url_prefix ?? ""}
                onChange={(event) => setMarketDialog((prev) => ({ ...prev, url_prefix: event.target.value }))}
                placeholder="/de"
              />
            </div>
            <div className="space-y-1">
              <Label>Fiyat listesi</Label>
              <Select
                value={marketDialog?.price_list_id ?? "none"}
                onValueChange={(value) =>
                  setMarketDialog((prev) => ({ ...prev, price_list_id: value === "none" ? null : value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Yok</SelectItem>
                  {(priceLists.data ?? []).map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name} ({list.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Yuvarlama</Label>
              <Select
                value={(marketDialog?.rounding as string) ?? "none"}
                onValueChange={(value) => setMarketDialog((prev) => ({ ...prev, rounding: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROUNDING_OPTIONS.map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Market marjı türü</Label>
              <Select
                value={(marketDialog?.markup_type as string) ?? "none"}
                onValueChange={(value) => setMarketDialog((prev) => ({ ...prev, markup_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MARKUP_OPTIONS.map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Market marjı değeri</Label>
              <Input
                inputMode="decimal"
                value={String(marketDialog?.markup_value ?? 0)}
                onChange={(event) =>
                  setMarketDialog((prev) => ({ ...prev, markup_value: Number(event.target.value) || 0 }))
                }
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Ek ülkeler (virgülle, ISO 2)</Label>
              <Input
                value={marketCountries}
                onChange={(event) => setMarketCountries(event.target.value)}
                placeholder="AT, NL, BE, FR"
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <Label htmlFor="market-tax" className="text-xs">
                Fiyatlar vergi dahil
              </Label>
              <Switch
                id="market-tax"
                checked={marketDialog?.tax_included ?? true}
                onCheckedChange={(checked) => setMarketDialog((prev) => ({ ...prev, tax_included: checked }))}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <Label htmlFor="market-default" className="text-xs">
                Varsayılan market
              </Label>
              <Switch
                id="market-default"
                checked={marketDialog?.is_default ?? false}
                onCheckedChange={(checked) => setMarketDialog((prev) => ({ ...prev, is_default: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMarketDialog(null)}>
              Vazgeç
            </Button>
            <Button
              onClick={() => marketMutation.mutate()}
              disabled={marketMutation.isPending || (marketDialog?.name ?? "").trim().length < 2}
            >
              {marketMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
