/**
 * Yeni besleme sihirbazı: 4 adımda bağlantı, kaynak incelemesi, alan
 * eşleştirmesi ve özet/kayıt.
 */

import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Check, Loader2, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { authFieldsFor, emptyFeed, type FeedFormValue } from "@/components/xml-integrator/feed-sheet";
import { analyzeXmlSource, saveXmlFeed } from "@/lib/xml-integrator.functions";
import {
  TARGET_FIELDS,
  TARGET_FIELD_GROUP_LABELS,
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
  missingRequiredFields,
  type TargetFieldGroup,
  type XmlAuthType,
  type XmlDirection,
  type XmlPlatform,
  type XmlSchedule,
  type XmlSourceFormat,
} from "@/lib/xml-integrator";

const STEPS = ["Bağlantı", "Kaynağı incele", "Alan eşleme", "Özet"] as const;
const GROUPS = Object.keys(TARGET_FIELD_GROUP_LABELS) as TargetFieldGroup[];

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

  const analysis = useMutation({
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
      toast.success(`${result.totalRows} ürün bulundu, ${result.columns.length} alan okundu`);
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
          fieldMapping: form.fieldMapping,
          filterRules: {},
          transformRules: {},
          priceMarkup: form.priceMarkup,
          currency: form.currency,
          isActive: form.isActive,
        },
      }),
    onSuccess: () => {
      toast.success("Besleme oluşturuldu");
      void client.invalidateQueries({ queryKey: ["xml-integrator", storeId] });
      void navigate({ to: "/store/$storeId/xml-integrator/feeds", params: { storeId } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const columns = analysis.data?.columns ?? [];
  const samples = analysis.data?.sampleRows ?? [];
  const missing = useMemo(() => missingRequiredFields(form.fieldMapping), [form.fieldMapping]);

  const canContinue = () => {
    if (step === 0) {
      if (form.name.trim().length < 2) return false;
      return isImport ? form.sourceUrl.trim().length > 8 : form.outputFilename.trim().length > 3;
    }
    if (step === 1) return isImport ? columns.length > 0 : true;
    if (step === 2) return isImport ? missing.length === 0 : true;
    return true;
  };

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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="wiz-name">Besleme adı</Label>
              <Input id="wiz-name" value={form.name} onChange={(event) => set("name", event.target.value)} placeholder="Örn. Bacio toptan listesi" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wiz-direction">Yön</Label>
              <select
                id="wiz-direction"
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={form.direction}
                onChange={(event) => set("direction", event.target.value as XmlDirection)}
              >
                {XML_DIRECTIONS.map((item) => (
                  <option key={item} value={item}>{XML_DIRECTION_LABELS[item]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="wiz-platform">{isImport ? "Kaynak" : "Pazaryeri"}</Label>
              <select
                id="wiz-platform"
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={form.platform}
                onChange={(event) => set("platform", event.target.value as XmlPlatform)}
              >
                {XML_PLATFORMS.map((item) => (
                  <option key={item} value={item}>{XML_PLATFORM_LABELS[item]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="wiz-schedule">Çalışma sıklığı</Label>
              <select
                id="wiz-schedule"
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={form.schedule}
                onChange={(event) => set("schedule", event.target.value as XmlSchedule)}
              >
                {XML_SCHEDULES.map((item) => (
                  <option key={item} value={item}>{XML_SCHEDULE_LABELS[item]}</option>
                ))}
              </select>
            </div>
          </div>

          {isImport ? (
            <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
              <div className="space-y-1">
                <Label htmlFor="wiz-url">Kaynak bağlantısı</Label>
                <Input id="wiz-url" value={form.sourceUrl} onChange={(event) => set("sourceUrl", event.target.value)} placeholder="https://tedarikci.com/urunler.xml" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="wiz-format">Dosya türü</Label>
                <select
                  id="wiz-format"
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={form.sourceFormat}
                  onChange={(event) => set("sourceFormat", event.target.value as XmlSourceFormat)}
                >
                  {XML_SOURCE_FORMATS.filter((item) => item !== "xlsx").map((item) => (
                    <option key={item} value={item}>{XML_SOURCE_FORMAT_LABELS[item]}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="wiz-output">Çıktı dosya adı</Label>
                <Input id="wiz-output" value={form.outputFilename} onChange={(event) => set("outputFilename", event.target.value)} placeholder="trendyol-urunler.xml" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="wiz-currency">Para birimi</Label>
                <Input id="wiz-currency" maxLength={3} value={form.currency} onChange={(event) => set("currency", event.target.value.toUpperCase())} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="wiz-markup">Fiyat farkı (%)</Label>
                <Input
                  id="wiz-markup"
                  type="number"
                  value={form.priceMarkup ?? ""}
                  onChange={(event) => set("priceMarkup", event.target.value === "" ? null : Number(event.target.value))}
                />
              </div>
            </div>
          )}

          {isImport ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="wiz-auth">Giriş gerekiyor mu?</Label>
                <select
                  id="wiz-auth"
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={form.authType}
                  onChange={(event) => set("authType", event.target.value as XmlAuthType)}
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
                    onChange={(event) => setAuthFields((current) => ({ ...current, [field.key]: event.target.value }))}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 1 ? (
        <section className="space-y-3 rounded-xl border bg-card p-4">
          {isImport ? (
            <>
              <Button type="button" variant="outline" disabled={analysis.isPending} onClick={() => analysis.mutate()}>
                {analysis.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Wand2 className="mr-1 size-4" />}
                Kaynağı incele
              </Button>
              {analysis.data ? (
                <div className="space-y-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{analysis.data.totalRows} ürün</Badge>
                    <Badge variant="secondary">{analysis.data.columns.length} alan</Badge>
                    <Badge variant="outline">{XML_SOURCE_FORMAT_LABELS[analysis.data.format as XmlSourceFormat]}</Badge>
                    {analysis.data.rootPath ? <Badge variant="outline">Düğüm: {analysis.data.rootPath}</Badge> : null}
                  </div>
                  {analysis.data.rootCandidates.length > 1 ? (
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor="wiz-root">Yanlış düğüm mü bulundu?</Label>
                      <select
                        id="wiz-root"
                        className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                        value={form.itemPath}
                        onChange={(event) => {
                          set("itemPath", event.target.value);
                          analysis.reset();
                        }}
                      >
                        {analysis.data.rootCandidates.map((candidate) => (
                          <option key={candidate.path} value={candidate.path}>
                            {candidate.path} ({candidate.count} kayıt)
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  {samples[0] ? (
                    <p className="text-muted-foreground">
                      Örnek: {Object.entries(samples[0]).slice(0, 4).map(([key, value]) => `${key}=${String(value).slice(0, 30)}`).join(" · ")}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Dosyayı okuyup ürün listesini ve alanları çıkarır; kimlik bilgileri yalnız sunucuda kullanılır.
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Dışa aktarımda kaynak incelemesi gerekmez; ürünler mağazanızdan alınır.
            </p>
          )}
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4 rounded-xl border bg-card p-4">
          {isImport && columns.length ? (
            <>
              {GROUPS.map((group) => (
                <div key={group} className="space-y-2">
                  <p className="text-xs font-medium uppercase text-muted-foreground">{TARGET_FIELD_GROUP_LABELS[group]}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {TARGET_FIELDS.filter((field) => field.group === group).map((field) => (
                      <div key={field.key} className="space-y-1">
                        <Label className="text-xs" htmlFor={`wiz-map-${field.key}`}>
                          {field.label}
                          {field.required ? <span className="text-destructive"> *</span> : null}
                        </Label>
                        <select
                          id={`wiz-map-${field.key}`}
                          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                          value={form.fieldMapping[field.key] ?? ""}
                          onChange={(event) =>
                            setForm((current) => {
                              const next = { ...current.fieldMapping };
                              if (event.target.value) next[field.key] = event.target.value;
                              else delete next[field.key];
                              return { ...current, fieldMapping: next };
                            })
                          }
                        >
                          <option value="">— eşleştirilmedi —</option>
                          {columns.map((column) => (
                            <option key={column} value={column}>{column}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {missing.length ? (
                <p className="text-xs text-destructive">
                  Eksik zorunlu alan: {missing.map((field) => field.label).join(", ")}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              {isImport
                ? "Önce önceki adımda kaynağı inceleyin."
                : "Dışa aktarımda alan eşlemesi pazaryeri şablonundan gelir."}
            </p>
          )}
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-3 rounded-xl border bg-card p-4 text-sm">
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Ad</dt><dd className="font-medium">{form.name}</dd></div>
            <div><dt className="text-muted-foreground">Yön</dt><dd>{XML_DIRECTION_LABELS[form.direction]}</dd></div>
            <div><dt className="text-muted-foreground">Platform</dt><dd>{XML_PLATFORM_LABELS[form.platform]}</dd></div>
            <div><dt className="text-muted-foreground">Sıklık</dt><dd>{XML_SCHEDULE_LABELS[form.schedule]}</dd></div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">{isImport ? "Kaynak" : "Çıktı"}</dt>
              <dd className="truncate">{isImport ? form.sourceUrl : form.outputFilename}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Eşleşen alan</dt>
              <dd>{Object.keys(form.fieldMapping).length}</dd>
            </div>
          </dl>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="wiz-active">Besleme aktif</Label>
            <Switch id="wiz-active" checked={form.isActive} onCheckedChange={(checked) => set("isActive", checked)} />
          </div>
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
            Beslemeyi oluştur
          </Button>
        )}
      </div>
    </div>
  );
}
