/**
 * Yeni besleme sihirbazı (4 adım):
 * 1) Temel bilgiler + yön + platform
 * 2) Bağlantı adresi, kimlik doğrulama tipi ve bağlantı testi
 * 3) Zamanlama (hazır sıklıklar veya özel cron)
 * 4) Özet, kayıt ve alan eşleme ekranına yönlendirme
 */

import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Check, Loader2, PlugZap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DeltaSyncSettings } from "@/components/xml-integrator/delta-sync-settings";
import { authFieldsFor, emptyFeed, type FeedFormValue } from "@/components/xml-integrator/feed-sheet";
import { DirectionBadge, PlatformMark } from "@/components/xml-integrator/shared";
import { analyzeXmlSource, saveXmlFeed } from "@/lib/xml-integrator.functions";
import {
  XML_AUTH_TYPES,
  XML_AUTH_TYPE_LABELS,
  XML_DIRECTIONS,
  XML_DIRECTION_LABELS,
  XML_PLATFORMS,
  XML_PLATFORM_LABELS,
  XML_SCHEDULES,
  XML_SCHEDULE_LABELS,
  XML_SOURCE_FORMATS,
  XML_SOURCE_FORMAT_LABELS,
  isValidCron,
  nextCronRun,
  type XmlAuthType,
  type XmlDirection,
  type XmlPlatform,
  type XmlSchedule,
  type XmlSourceFormat,
} from "@/lib/xml-integrator";
import { validationRulesFor } from "@/lib/xml-export-generators";


const STEPS = ["Temel bilgiler", "Bağlantı", "Zamanlama", "Özet"] as const;

const CRON_PRESETS: Array<{ expression: string; label: string }> = [
  { expression: "0 * * * *", label: "Her saat başı" },
  { expression: "0 */4 * * *", label: "4 saatte bir" },
  { expression: "30 2 * * *", label: "Her gece 02:30 (UTC)" },
  { expression: "0 6 * * 1", label: "Pazartesi 06:00 (UTC)" },
];

export function XmlFeedWizard({ storeId }: { storeId: string }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const analyze = useServerFn(analyzeXmlSource);
  const save = useServerFn(saveXmlFeed);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FeedFormValue>(emptyFeed);
  const [authFields, setAuthFields] = useState<Record<string, string>>({});
  const set = <K extends keyof FeedFormValue>(key: K, next: FeedFormValue[K]) =>
    setForm((current) => ({ ...current, [key]: next }));

  const isImport = form.direction === "import";
  const cronOk = form.schedule !== "custom" || isValidCron(form.cronExpression.trim());
  const cronNext = form.schedule === "custom" && cronOk ? nextCronRun(form.cronExpression.trim()) : null;

  /** 2. adım: kaynağa gerçekten bağlanır, satır ve alan sayısını döndürür. */
  const testConnection = useMutation({
    mutationFn: () =>
      analyze({
        data: {
          storeId,
          sourceUrl: form.sourceUrl.trim(),
          sourceFormat: form.sourceFormat,
          ...(form.itemPath.trim() ? { itemPath: form.itemPath.trim() } : {}),
          authType: form.authType,
          authConfig: authFields,
        },
      }),
    onSuccess: (result) => {
      set("sourceFormat", result.format as XmlSourceFormat);
      if (result.rootPath) set("itemPath", result.rootPath);
      setForm((current) => ({
        ...current,
        fieldMapping: { ...result.suggestedMapping, ...current.fieldMapping },
      }));
      toast.success(`Bağlantı başarılı — ${result.totalRows} kayıt, ${result.columns.length} alan`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          storeId,
          name: form.name.trim(),
          direction: form.direction,
          platform: form.platform,
          sourceFormat: form.sourceFormat,
          ...(form.sourceUrl.trim() ? { sourceUrl: form.sourceUrl.trim() } : {}),
          ...(form.itemPath.trim() ? { itemPath: form.itemPath.trim() } : {}),
          authType: form.authType,
          authConfig: authFields,
          ...(form.outputFilename.trim() ? { outputFilename: form.outputFilename.trim() } : {}),
          schedule: form.schedule,
          ...(form.schedule === "custom" ? { cronExpression: form.cronExpression.trim() } : {}),
          fieldMapping: form.fieldMapping,
          filterRules: {},
          transformRules: {},
          priceMarkup: form.priceMarkup,
          currency: form.currency,
          isActive: form.isActive,
          deltaSyncConfig: form.deltaSync,
        },
      }),
    onSuccess: (result) => {
      toast.success("Besleme oluşturuldu, alan eşleme ekranı açılıyor");
      void client.invalidateQueries({ queryKey: ["xml-integrator", storeId] });
      void navigate({
        to: "/store/$storeId/xml-integrator/feeds/$feedId/mapper",
        params: { storeId, feedId: result.id },
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const test = testConnection.data;

  const canContinue = () => {
    if (step === 0) return form.name.trim().length >= 2;
    if (step === 1) return isImport ? form.sourceUrl.trim().length > 8 : form.outputFilename.trim().length > 3;
    if (step === 2) return cronOk;
    return true;
  };

  const selectClass = "h-9 w-full rounded-md border bg-background px-2 text-sm";

  return (
    <div className="space-y-4">
      <ol className="-mx-1 flex gap-2 overflow-x-auto px-1 text-xs">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={`flex items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1.5 ${
              index === step ? "bg-foreground text-background" : "bg-card text-muted-foreground"
            }`}
          >
            {index < step ? <Check className="size-3" /> : <span>{index + 1}.</span>}
            {label}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <div className="space-y-1">
            <Label htmlFor="wiz-name">Besleme adı</Label>
            <Input
              id="wiz-name"
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="Örn. Bacio toptan listesi"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="wiz-direction">Yön</Label>
              <select
                id="wiz-direction"
                className={selectClass}
                value={form.direction}
                onChange={(event) => set("direction", event.target.value as XmlDirection)}
              >
                {XML_DIRECTIONS.map((item) => (
                  <option key={item} value={item}>{XML_DIRECTION_LABELS[item]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="wiz-platform">{isImport ? "Kaynak platform" : "Hedef pazaryeri"}</Label>
              <select
                id="wiz-platform"
                className={selectClass}
                value={form.platform}
                onChange={(event) => set("platform", event.target.value as XmlPlatform)}
              >
                {XML_PLATFORMS.map((item) => (
                  <option key={item} value={item}>{XML_PLATFORM_LABELS[item]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 p-3">
            <DirectionBadge direction={form.direction} />
            <PlatformMark platform={form.platform} />
          </div>
          <p className="text-xs text-muted-foreground">
            {isImport
              ? "İçe aktarım: tedarikçi dosyasındaki ürünler mağazanıza akar."
              : "Dışa aktarım: mağazanızdaki ürünler pazaryeri dosyasına yazılır."}
          </p>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="space-y-3 rounded-xl border bg-card p-4">
          {isImport ? (
            <>
              <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
                <div className="space-y-1">
                  <Label htmlFor="wiz-url">Kaynak bağlantısı (URL)</Label>
                  <Input
                    id="wiz-url"
                    value={form.sourceUrl}
                    onChange={(event) => {
                      set("sourceUrl", event.target.value);
                      testConnection.reset();
                    }}
                    placeholder="https://tedarikci.com/urunler.xml"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="wiz-format">Dosya türü</Label>
                  <select
                    id="wiz-format"
                    className={selectClass}
                    value={form.sourceFormat}
                    onChange={(event) => set("sourceFormat", event.target.value as XmlSourceFormat)}
                  >
                    {XML_SOURCE_FORMATS.filter((item) => item !== "xlsx").map((item) => (
                      <option key={item} value={item}>{XML_SOURCE_FORMAT_LABELS[item]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="wiz-auth">Kimlik doğrulama tipi</Label>
                  <select
                    id="wiz-auth"
                    className={selectClass}
                    value={form.authType}
                    onChange={(event) => {
                      set("authType", event.target.value as XmlAuthType);
                      testConnection.reset();
                    }}
                  >
                    {XML_AUTH_TYPES.map((item) => (
                      <option key={item} value={item}>{XML_AUTH_TYPE_LABELS[item]}</option>
                    ))}
                  </select>
                </div>
                {authFieldsFor(form.authType).map((field) => (
                  <div key={field.key} className="space-y-1">
                    <Label htmlFor={`wiz-auth-${field.key}`}>{field.label}</Label>
                    <Input
                      id={`wiz-auth-${field.key}`}
                      type={field.secret ? "password" : "text"}
                      value={authFields[field.key] ?? ""}
                      onChange={(event) =>
                        setAuthFields((current) => ({ ...current, [field.key]: event.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={testConnection.isPending || form.sourceUrl.trim().length < 9}
                  onClick={() => testConnection.mutate()}
                >
                  {testConnection.isPending ? (
                    <Loader2 className="mr-1 size-4 animate-spin" />
                  ) : (
                    <PlugZap className="mr-1 size-4" />
                  )}
                  Bağlantıyı test et
                </Button>
                {test ? (
                  <>
                    <Badge className="bg-success/10 text-success">Bağlantı doğrulandı</Badge>
                    <Badge variant="secondary">{test.totalRows} kayıt</Badge>
                    <Badge variant="secondary">{test.columns.length} alan</Badge>
                    {test.rootPath ? <Badge variant="outline">Düğüm: {test.rootPath}</Badge> : null}
                  </>
                ) : null}
              </div>

              {test && test.rootCandidates.length > 1 ? (
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="wiz-root">Ürün düğümü</Label>
                  <select
                    id="wiz-root"
                    className={selectClass}
                    value={form.itemPath}
                    onChange={(event) => {
                      set("itemPath", event.target.value);
                      testConnection.reset();
                    }}
                  >
                    {test.rootCandidates.map((candidate) => (
                      <option key={candidate.path} value={candidate.path}>
                        {candidate.path} ({candidate.count} kayıt)
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <p className="text-xs text-muted-foreground">
                Test sırasında dosya sunucuda indirilir; kullanıcı adı, şifre ve anahtarlar tarayıcıya geri
                gönderilmez.
              </p>
            </>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="wiz-output">Çıktı dosya adı</Label>
                <Input
                  id="wiz-output"
                  value={form.outputFilename}
                  onChange={(event) => set("outputFilename", event.target.value)}
                  placeholder="trendyol-urunler.xml"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="wiz-currency">Para birimi</Label>
                <Input
                  id="wiz-currency"
                  maxLength={3}
                  value={form.currency}
                  onChange={(event) => set("currency", event.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="wiz-markup">Fiyat farkı (%)</Label>
                <Input
                  id="wiz-markup"
                  type="number"
                  value={form.priceMarkup ?? ""}
                  onChange={(event) =>
                    set("priceMarkup", event.target.value === "" ? null : Number(event.target.value))
                  }
                />
              </div>
            </div>
          )}
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <div className="space-y-1">
            <Label htmlFor="wiz-schedule">Çalışma sıklığı</Label>
            <select
              id="wiz-schedule"
              className={selectClass}
              value={form.schedule}
              onChange={(event) => set("schedule", event.target.value as XmlSchedule)}
            >
              {XML_SCHEDULES.map((item) => (
                <option key={item} value={item}>{XML_SCHEDULE_LABELS[item]}</option>
              ))}
            </select>
          </div>

          {form.schedule === "custom" ? (
            <div className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor="wiz-cron">Cron ifadesi (UTC, 5 alan)</Label>
                <Input
                  id="wiz-cron"
                  value={form.cronExpression}
                  onChange={(event) => set("cronExpression", event.target.value)}
                  placeholder="0 */4 * * *"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {CRON_PRESETS.map((preset) => (
                  <Button
                    key={preset.expression}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => set("cronExpression", preset.expression)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              {form.cronExpression.trim() ? (
                cronOk && cronNext ? (
                  <p className="text-xs text-success">
                    Geçerli ifade — ilk çalışma: {cronNext.toLocaleString("tr-TR", { timeZone: "UTC" })} (UTC)
                  </p>
                ) : (
                  <p className="text-xs text-destructive">
                    Geçersiz cron ifadesi. Biçim: dakika saat gün ay haftagünü (örn. 0 */4 * * *)
                  </p>
                )
              ) : (
                <p className="text-xs text-muted-foreground">
                  Sıra: dakika, saat, ayın günü, ay, haftanın günü. Örnek: 0 3 * * * → her gün 03:00 (UTC).
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {form.schedule === "manual"
                ? "Elle seçildi: besleme yalnızca “Şimdi çalıştır” ile çalışır."
                : `Besleme ${XML_SCHEDULE_LABELS[form.schedule].toLowerCase()} otomatik çalışır.`}
            </p>
          )}

          {isImport ? (
            <DeltaSyncSettings
              idPrefix="wiz-delta"
              value={form.deltaSync}
              onChange={(next) => set("deltaSync", next)}
            />
          ) : null}

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="wiz-active">Besleme aktif</Label>
            <Switch id="wiz-active" checked={form.isActive} onCheckedChange={(checked) => set("isActive", checked)} />
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-3 rounded-xl border bg-card p-4 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <DirectionBadge direction={form.direction} />
            <PlatformMark platform={form.platform} />
          </div>
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Ad</dt><dd className="font-medium">{form.name}</dd></div>
            <div>
              <dt className="text-muted-foreground">Zamanlama</dt>
              <dd>
                {XML_SCHEDULE_LABELS[form.schedule]}
                {form.schedule === "custom" ? ` · ${form.cronExpression.trim()}` : ""}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">{isImport ? "Kaynak" : "Çıktı"}</dt>
              <dd className="truncate">{isImport ? form.sourceUrl : form.outputFilename}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Kimlik doğrulama</dt>
              <dd>{XML_AUTH_TYPE_LABELS[form.authType]}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Bağlantı testi</dt>
              <dd>{test ? `${test.totalRows} kayıt, ${test.columns.length} alan` : "Yapılmadı"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Önerilen eşleşme</dt>
              <dd>{Object.keys(form.fieldMapping).length} alan</dd>
            </div>
          </dl>
          {!isImport ? (
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-xs font-medium">
                {XML_PLATFORM_LABELS[form.platform]} zorunlu alan kuralları
              </p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {validationRulesFor(form.platform).map((rule) => (
                  <li key={rule.code}>• {rule.label}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Bu kurallara uymayan ürünler XML'e eklenmez; nedenleri Kayıtlar sayfasında listelenir.
              </p>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {isImport
              ? "Kaydettikten sonra alan eşleme ekranı açılır; zorunlu alanları orada bağlayabilirsiniz."
              : "Kaydettikten sonra besleme listesinde \"XML üret\" ile dosyayı oluşturup adresini kopyalayabilirsiniz."}
          </p>

        </section>
      ) : null}

      <div className="flex gap-2">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((current) => current - 1)}>
          <ArrowLeft className="mr-1 size-4" /> Geri
        </Button>
        {step < STEPS.length - 1 ? (
          <Button disabled={!canContinue()} onClick={() => setStep((current) => current + 1)}>
            İleri <ArrowRight className="ml-1 size-4" />
          </Button>
        ) : (
          <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Kaydet ve alan eşlemeye geç
          </Button>
        )}
      </div>
    </div>
  );
}
