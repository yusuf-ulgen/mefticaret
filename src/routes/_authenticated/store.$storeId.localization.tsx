import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Globe, Coins, Percent, RefreshCw, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n, LOCALE_LIST, type Locale } from "@/lib/i18n";
import {
  CURRENCY_LIST,
  buildRateTable,
  formatCurrency,
  formatRate,
  normalizeCurrency,
  resolveRate,
  toDisplayMoney,
  type CurrencyCode,
} from "@/lib/money";
import { calculateTax, type TaxRule } from "@/lib/tax-engine";
import { storeQuery, storeSettingsQuery } from "@/lib/store-queries";
import { currencyRatesQuery, taxClassesQuery, taxRulesQuery } from "@/lib/localization-queries";
import {
  deleteTaxClass,
  deleteTaxRule,
  refreshCurrencyRates,
  saveCurrencyRate,
  saveLocalizationSettings,
  saveTaxClass,
  saveTaxRule,
} from "@/lib/localization.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/localization")({
  head: () => ({
    meta: [
      { title: "Dil, Para Birimi & Vergi — Mefticaret" },
      {
        name: "description",
        content:
          "Mağazanın dillerini, ana ve görüntüleme para birimlerini, kurlarını ve ülke/bölge bazlı vergi kurallarını tek ekranda yönet.",
      },
      { property: "og:title", content: "Dil, Para Birimi & Vergi — Mefticaret" },
      {
        property: "og:description",
        content: "Çoklu dil, çoklu para birimi ve modüler vergi motoru yönetimi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LocalizationPage,
});

function LocalizationPage() {
  const { storeId } = Route.useParams();
  const { t, locale, setLocale, meta } = useI18n();
  const queryClient = useQueryClient();

  const { data: store } = useQuery(storeQuery(storeId));
  const { data: settings } = useQuery(storeSettingsQuery(storeId));
  const { data: rates } = useQuery(currencyRatesQuery(storeId));
  const { data: classes } = useQuery(taxClassesQuery(storeId));
  const { data: rules } = useQuery(taxRulesQuery(storeId));

  const [defaultLocale, setDefaultLocale] = useState<Locale>("tr");
  const [supported, setSupported] = useState<Locale[]>(["tr", "en"]);
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>("TRY");
  const [displayCurrencies, setDisplayCurrencies] = useState<CurrencyCode[]>(["TRY"]);
  const [autoRates, setAutoRates] = useState(false);
  const [taxRate, setTaxRate] = useState("20");
  const [taxIncluded, setTaxIncluded] = useState(true);

  useEffect(() => {
    if (!settings) return;
    setDefaultLocale((settings.default_locale as Locale) ?? "tr");
    setSupported(((settings.supported_locales as Locale[]) ?? ["tr"]).slice());
    setBaseCurrency(normalizeCurrency(settings.base_currency ?? store?.currency));
    setDisplayCurrencies(
      ((settings.display_currencies as string[]) ?? ["TRY"]).map((code) =>
        normalizeCurrency(code),
      ),
    );
    setAutoRates(Boolean(settings.auto_currency_rates));
    setTaxRate(String(settings.default_tax_rate ?? 20));
    setTaxIncluded(Boolean(settings.tax_included_prices ?? true));
  }, [settings, store?.currency]);

  const rateTable = useMemo(() => buildRateTable(rates), [rates]);

  const saveSettings = useMutation({
    mutationFn: () =>
      saveLocalizationSettings({
        data: {
          storeId,
          defaultLocale,
          supportedLocales: supported,
          baseCurrency,
          displayCurrencies,
          autoCurrencyRates: autoRates,
          defaultTaxRate: Number(taxRate) || 0,
          taxIncludedPrices: taxIncluded,
        },
      }),
    onSuccess: () => {
      toast.success("Ayarlar kaydedildi");
      void queryClient.invalidateQueries({ queryKey: ["store-settings", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const refresh = useMutation({
    mutationFn: () =>
      refreshCurrencyRates({
        data: { storeId, baseCurrency, quoteCurrencies: displayCurrencies },
      }),
    onSuccess: (result) => {
      toast.success(`${result.updated} kur güncellendi`);
      void queryClient.invalidateQueries({ queryKey: ["currency-rates", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setRate = useMutation({
    mutationFn: (input: { quote: CurrencyCode; rate: number }) =>
      saveCurrencyRate({
        data: {
          storeId,
          baseCurrency,
          quoteCurrency: input.quote,
          rate: input.rate,
        },
      }),
    onSuccess: () => {
      toast.success("Kur kaydedildi");
      void queryClient.invalidateQueries({ queryKey: ["currency-rates", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  }

  return (
    <AppShell storeId={storeId} title={t("localization.title")}>
      <div className="space-y-6" dir={meta.dir}>
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Globe className="size-5 text-primary" /> {t("localization.title")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("localization.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">{t("common.language")}</Label>
            <Select value={locale} onValueChange={(value) => setLocale(value as Locale)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALE_LIST.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
              {saveSettings.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </header>

        {/* Diller */}
        <section className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">{t("localization.languages")}</h2>
          <p className="text-xs text-muted-foreground">{t("localization.languagesHelp")}</p>
          <div className="mt-3 grid gap-4 md:grid-cols-[240px_1fr]">
            <div className="space-y-1">
              <Label className="text-xs">{t("localization.defaultLocale")}</Label>
              <Select value={defaultLocale} onValueChange={(value) => setDefaultLocale(value as Locale)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCALE_LIST.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("localization.supportedLocales")}</Label>
              <div className="flex flex-wrap gap-2">
                {LOCALE_LIST.map((item) => {
                  const active = supported.includes(item.value);
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setSupported((prev) => toggle(prev, item.value))}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {item.label}
                      {item.dir === "rtl" ? " · RTL" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Para birimleri */}
        <section className="rounded-xl border bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Coins className="size-4 text-primary" /> {t("localization.currencies")}
          </h2>
          <div className="mt-3 grid gap-4 md:grid-cols-[240px_1fr]">
            <div className="space-y-1">
              <Label className="text-xs">{t("localization.baseCurrency")}</Label>
              <Select
                value={baseCurrency}
                onValueChange={(value) => setBaseCurrency(value as CurrencyCode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_LIST.map((item) => (
                    <SelectItem key={item.code} value={item.code}>
                      {item.code} · {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[0.7rem] text-muted-foreground">
                {t("localization.baseCurrencyHelp")}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("localization.displayCurrencies")}</Label>
              <div className="flex flex-wrap gap-2">
                {CURRENCY_LIST.map((item) => {
                  const active = displayCurrencies.includes(item.code);
                  return (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => setDisplayCurrencies((prev) => toggle(prev, item.code))}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {item.symbol} {item.code}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Switch checked={autoRates} onCheckedChange={setAutoRates} id="auto-rates" />
                <Label htmlFor="auto-rates" className="text-xs">
                  {t("localization.autoRates")}
                </Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refresh.mutate()}
                  disabled={refresh.isPending}
                >
                  <RefreshCw className="mr-2 size-4" /> {t("localization.refreshRates")}
                </Button>
              </div>
              <p className="text-[0.7rem] text-muted-foreground">{t("localization.autoRatesHelp")}</p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">{t("common.currency")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("localization.rates")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("localization.preview")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("localization.manualRate")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {displayCurrencies.map((code) => {
                  const rate = resolveRate(rateTable, baseCurrency, code);
                  const display = toDisplayMoney(
                    { amount: 1000, currency: baseCurrency },
                    code,
                    rateTable,
                  );
                  return (
                    <tr key={code}>
                      <td className="px-3 py-2 font-medium">
                        {code}
                        {code === baseCurrency ? (
                          <Badge variant="secondary" className="ml-2">
                            {t("localization.baseCurrency")}
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        {rate === null ? "—" : `1 ${baseCurrency} = ${formatRate(rate)} ${code}`}
                      </td>
                      <td className="px-3 py-2">
                        {formatCurrency(1000, baseCurrency)} →{" "}
                        <span className="font-medium">
                          {formatCurrency(display.amount, display.currency)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {code === baseCurrency ? (
                          "—"
                        ) : (
                          <ManualRateInput
                            defaultValue={rate ?? 1}
                            onSubmit={(value) => setRate.mutate({ quote: code, rate: value })}
                            pending={setRate.isPending}
                            label={t("common.save")}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Vergi motoru */}
        <TaxSection
          storeId={storeId}
          classes={classes ?? []}
          rules={rules ?? []}
          taxRate={taxRate}
          setTaxRate={setTaxRate}
          taxIncluded={taxIncluded}
          setTaxIncluded={setTaxIncluded}
          currency={baseCurrency}
        />
      </div>
    </AppShell>
  );
}

function ManualRateInput({
  defaultValue,
  onSubmit,
  pending,
  label,
}: {
  defaultValue: number;
  onSubmit: (value: number) => void;
  pending: boolean;
  label: string;
}) {
  const [value, setValue] = useState(String(defaultValue));
  useEffect(() => setValue(String(defaultValue)), [defaultValue]);
  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="h-8 w-28"
        inputMode="decimal"
      />
      <Button
        size="sm"
        variant="outline"
        disabled={pending || !Number(value)}
        onClick={() => onSubmit(Number(value))}
      >
        {label}
      </Button>
    </div>
  );
}

function TaxSection({
  storeId,
  classes,
  rules,
  taxRate,
  setTaxRate,
  taxIncluded,
  setTaxIncluded,
  currency,
}: {
  storeId: string;
  classes: { id: string; name: string; code: string; is_default?: boolean }[];
  rules: TaxRule[];
  taxRate: string;
  setTaxRate: (value: string) => void;
  taxIncluded: boolean;
  setTaxIncluded: (value: boolean) => void;
  currency: CurrencyCode;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const [className, setClassName] = useState("");
  const [classCode, setClassCode] = useState("");
  const [ruleName, setRuleName] = useState("");
  const [ruleClass, setRuleClass] = useState("all");
  const [ruleCountry, setRuleCountry] = useState("");
  const [ruleRegion, setRuleRegion] = useState("");
  const [ruleRate, setRuleRate] = useState("20");
  const [rulePriority, setRulePriority] = useState("0");

  const [simAmount, setSimAmount] = useState("1000");
  const [simCountry, setSimCountry] = useState("TR");
  const [simRegion, setSimRegion] = useState("");
  const [simClass, setSimClass] = useState("all");

  function invalidate(key: string) {
    void queryClient.invalidateQueries({ queryKey: [key, storeId] });
  }

  const addClass = useMutation({
    mutationFn: () =>
      saveTaxClass({ data: { storeId, name: className, code: classCode, isDefault: false } }),
    onSuccess: () => {
      setClassName("");
      setClassCode("");
      invalidate("tax-classes");
      toast.success("Vergi sınıfı kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeClass = useMutation({
    mutationFn: (classId: string) => deleteTaxClass({ data: { storeId, classId } }),
    onSuccess: () => invalidate("tax-classes"),
    onError: (error: Error) => toast.error(error.message),
  });

  const addRule = useMutation({
    mutationFn: () =>
      saveTaxRule({
        data: {
          storeId,
          name: ruleName,
          taxClassId: ruleClass === "all" ? null : ruleClass,
          countryCode: ruleCountry.trim() ? ruleCountry.trim().toUpperCase() : null,
          region: ruleRegion.trim() ? ruleRegion.trim() : null,
          rate: Number(ruleRate) || 0,
          priority: Number(rulePriority) || 0,
          isActive: true,
        },
      }),
    onSuccess: () => {
      setRuleName("");
      setRuleCountry("");
      setRuleRegion("");
      invalidate("tax-rules");
      toast.success("Vergi kuralı kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeRule = useMutation({
    mutationFn: (ruleId: string) => deleteTaxRule({ data: { storeId, ruleId } }),
    onSuccess: () => invalidate("tax-rules"),
    onError: (error: Error) => toast.error(error.message),
  });

  const simulation = useMemo(
    () =>
      calculateTax([{ amount: Number(simAmount) || 0, taxClassId: simClass === "all" ? null : simClass }], {
        rules,
        defaultRate: Number(taxRate) || 0,
        pricesIncludeTax: taxIncluded,
        country: simCountry || null,
        region: simRegion || null,
      }),
    [simAmount, simClass, rules, taxRate, taxIncluded, simCountry, simRegion],
  );

  const classLabel = (id: string | null) =>
    id ? (classes.find((item) => item.id === id)?.name ?? "—") : t("common.all");

  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Percent className="size-4 text-primary" /> {t("tax.title")}
      </h2>

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">{t("tax.defaultRate")} (%)</Label>
          <Input value={taxRate} onChange={(event) => setTaxRate(event.target.value)} inputMode="decimal" />
        </div>
        <div className="flex items-end gap-3">
          <Switch id="tax-included" checked={taxIncluded} onCheckedChange={setTaxIncluded} />
          <Label htmlFor="tax-included" className="text-xs">
            {taxIncluded ? t("tax.pricesIncludeTax") : t("tax.pricesExcludeTax")}
          </Label>
        </div>
      </div>

      {/* Vergi sınıfları */}
      <div className="mt-6">
        <h3 className="text-sm font-medium">{t("tax.classes")}</h3>
        <p className="text-xs text-muted-foreground">{t("tax.classesHelp")}</p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">{t("common.name")}</Label>
            <Input
              value={className}
              onChange={(event) => setClassName(event.target.value)}
              className="h-9 w-44"
              placeholder="Standart"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("common.code")}</Label>
            <Input
              value={classCode}
              onChange={(event) => setClassCode(event.target.value)}
              className="h-9 w-40"
              placeholder="standart"
            />
          </div>
          <Button
            size="sm"
            onClick={() => addClass.mutate()}
            disabled={addClass.isPending || !className.trim() || !classCode.trim()}
          >
            <Plus className="mr-2 size-4" /> {t("common.add")}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {classes.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("common.empty")}</p>
          ) : (
            classes.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
              >
                {item.name} <code className="text-muted-foreground">{item.code}</code>
                {item.is_default ? <Badge variant="secondary">{t("common.default")}</Badge> : null}
                <button
                  type="button"
                  aria-label={t("common.delete")}
                  onClick={() => removeClass.mutate(item.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Vergi kuralları */}
      <div className="mt-6">
        <h3 className="text-sm font-medium">{t("tax.rules")}</h3>
        <p className="text-xs text-muted-foreground">{t("tax.rulesHelp")}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <Input
            value={ruleName}
            onChange={(event) => setRuleName(event.target.value)}
            placeholder={t("common.name")}
            className="h-9"
          />
          <Select value={ruleClass} onValueChange={setRuleClass}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {classes.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={ruleCountry}
            onChange={(event) => setRuleCountry(event.target.value)}
            placeholder={`${t("common.country")} (TR)`}
            className="h-9"
            maxLength={2}
          />
          <Input
            value={ruleRegion}
            onChange={(event) => setRuleRegion(event.target.value)}
            placeholder={t("common.region")}
            className="h-9"
          />
          <Input
            value={ruleRate}
            onChange={(event) => setRuleRate(event.target.value)}
            placeholder={`${t("common.rate")} %`}
            className="h-9"
            inputMode="decimal"
          />
          <div className="flex gap-2">
            <Input
              value={rulePriority}
              onChange={(event) => setRulePriority(event.target.value)}
              placeholder={t("common.priority")}
              className="h-9 w-20"
              inputMode="numeric"
            />
            <Button
              size="sm"
              onClick={() => addRule.mutate()}
              disabled={addRule.isPending || !ruleName.trim()}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">{t("common.name")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("tax.classes")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("common.country")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("common.region")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("common.rate")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("common.priority")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-xs text-muted-foreground">
                    {t("common.empty")}
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id}>
                    <td className="px-3 py-2 font-medium">{rule.name}</td>
                    <td className="px-3 py-2">{classLabel(rule.tax_class_id)}</td>
                    <td className="px-3 py-2">{rule.country_code ?? t("tax.anyCountry")}</td>
                    <td className="px-3 py-2">{rule.region ?? t("tax.anyRegion")}</td>
                    <td className="px-3 py-2 text-right">{Number(rule.rate)}%</td>
                    <td className="px-3 py-2 text-right">{rule.priority}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        aria-label={t("common.delete")}
                        onClick={() => removeRule.mutate(rule.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simülatör */}
      <div className="mt-6 rounded-lg border bg-muted/20 p-3">
        <h3 className="text-sm font-medium">{t("tax.simulator")}</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Input value={simAmount} onChange={(event) => setSimAmount(event.target.value)} className="h-9" />
          <Input
            value={simCountry}
            onChange={(event) => setSimCountry(event.target.value)}
            className="h-9"
            maxLength={2}
            placeholder={t("common.country")}
          />
          <Input
            value={simRegion}
            onChange={(event) => setSimRegion(event.target.value)}
            className="h-9"
            placeholder={t("common.region")}
          />
          <Select value={simClass} onValueChange={setSimClass}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {classes.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">{t("tax.netAmount")}</dt>
            <dd className="font-semibold">{formatCurrency(simulation.totals.net, currency)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("tax.taxAmount")} ({simulation.groups[0]?.percent ?? 0}%)
            </dt>
            <dd className="font-semibold">{formatCurrency(simulation.totals.tax, currency)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("tax.grossAmount")}</dt>
            <dd className="font-semibold">{formatCurrency(simulation.totals.gross, currency)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
