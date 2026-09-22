/**
 * Besleme oluşturma / düzenleme paneli.
 * Kaynağı analiz eder (ürün düğümünü bulur, sütunları listeler), alan
 * eşleştirmesini önerir ve beslemeyi kaydeder.
 */

import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
import { Switch } from "@/components/ui/switch";
import { ConnectionSettings } from "@/components/xml-integrator/connection-settings";
import { DeltaSyncSettings } from "@/components/xml-integrator/delta-sync-settings";
import {
  DEFAULT_FTP_CONFIG,
  type ConnectionType,
  type FtpConfig,
} from "@/lib/xml-connection";
import {
  DEFAULT_DELTA_SYNC_CONFIG,
  type DeltaSyncConfig,
} from "@/lib/xml-delta-sync";
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
  type FieldMapping,
  type TargetFieldGroup,
  type XmlAuthType,
  type XmlDirection,
  type XmlPlatform,
  type XmlSchedule,
  type XmlSourceFormat,
} from "@/lib/xml-integrator";

export type FeedFormValue = {
  id?: string;
  name: string;
  direction: XmlDirection;
  platform: XmlPlatform;
  sourceFormat: XmlSourceFormat;
  sourceUrl: string;
  itemPath: string;
  authType: XmlAuthType;
  hasCredentials?: boolean;
  outputFilename: string;
  schedule: XmlSchedule;
  cronExpression: string;
  fieldMapping: FieldMapping;
  currency: string;
  priceMarkup: number | null;
  isActive: boolean;
  deltaSync: DeltaSyncConfig;
  lastFullSyncAt?: string | null;
  connectionType: ConnectionType;
  ftpConfig: FtpConfig;
  hasFtpPassword?: boolean;
  webhookToken?: string | null;
};

export const emptyFeed: FeedFormValue = {
  name: "",
  direction: "import",
  platform: "generic",
  sourceFormat: "xml",
  sourceUrl: "",
  itemPath: "",
  authType: "none",
  outputFilename: "",
  schedule: "daily",
  cronExpression: "",
  fieldMapping: {},
  currency: "TRY",
  priceMarkup: null,
  isActive: true,
  deltaSync: { ...DEFAULT_DELTA_SYNC_CONFIG },
  connectionType: "url",
  ftpConfig: { ...DEFAULT_FTP_CONFIG },
};

const GROUPS = Object.keys(TARGET_FIELD_GROUP_LABELS) as TargetFieldGroup[];

export function FeedSheet({
  storeId,
  open,
  value,
  onOpenChange,
  onSaved,
}: {
  storeId: string;
  open: boolean;
  value: FeedFormValue;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FeedFormValue>(value);
  const [authFields, setAuthFields] = useState<Record<string, string>>({});
  const analyze = useServerFn(analyzeXmlSource);
  const save = useServerFn(saveXmlFeed);
  const set = <K extends keyof FeedFormValue>(key: K, next: FeedFormValue[K]) =>
    setForm((current) => ({ ...current, [key]: next }));

  // Panel her açılışta seçili besleme ile senkronlanır.
  const [syncKey, setSyncKey] = useState(`${value.id ?? "new"}:${open}`);
  const currentKey = `${value.id ?? "new"}:${open}`;
  if (syncKey !== currentKey) {
    setSyncKey(currentKey);
    setForm(value);
    setAuthFields({});
  }

  const analysis = useMutation({
    mutationFn: () =>
      analyze({
        data: {
          storeId,
          ...(form.id ? { feedId: form.id } : {}),
          sourceUrl: form.sourceUrl.trim(),
          sourceFormat: form.sourceFormat,
          ...(form.itemPath ? { itemPath: form.itemPath } : {}),
          authType: form.authType,
          authConfig: authFields,
          connectionType: form.connectionType,
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
          ...(form.id ? { feedId: form.id } : {}),
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
          ...(form.schedule === "custom" && form.cronExpression.trim()
            ? { cronExpression: form.cronExpression.trim() }
            : {}),
          fieldMapping: form.fieldMapping,
          filterRules: {},
          transformRules: {},
          priceMarkup: form.priceMarkup,
          currency: form.currency,
          isActive: form.isActive,
          deltaSyncConfig: form.deltaSync,
          connectionType: form.connectionType,
          ftpConfig: form.ftpConfig,
        },
      }),
    onSuccess: () => {
      toast.success(form.id ? "Besleme güncellendi" : "Besleme oluşturuldu");
      onOpenChange(false);
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const webhookUrl = form.webhookToken
    ? `${typeof window === "undefined" ? "" : window.location.origin}/api/public/xml-feed-push/${form.webhookToken}`
    : null;
  const columns = analysis.data?.columns ?? [];
  const samples = analysis.data?.sampleRows ?? [];
  const missing = useMemo(() => missingRequiredFields(form.fieldMapping), [form.fieldMapping]);
  const isImport = form.direction === "import";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[100dvh] w-screen max-w-none overflow-y-auto rounded-none p-4 sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-lg sm:p-6">
        <DialogHeader>
          <DialogTitle>{form.id ? "Beslemeyi düzenle" : "Yeni besleme"}</DialogTitle>
          <DialogDescription>
            Tedarikçi dosyasından ürün çekin veya pazaryeri için XML çıktısı üretin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="feed-name">Besleme adı</Label>
              <Input id="feed-name" value={form.name} onChange={(event) => set("name", event.target.value)} placeholder="Örn. Bacio toptan listesi" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="feed-direction">Yön</Label>
              <select
                id="feed-direction"
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
              <Label htmlFor="feed-platform">{isImport ? "Kaynak" : "Pazaryeri"}</Label>
              <select
                id="feed-platform"
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
              <Label htmlFor="feed-schedule">Çalışma sıklığı</Label>
              <select
                id="feed-schedule"
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

          {form.schedule === "custom" ? (
            <div className="space-y-1">
              <Label htmlFor="feed-cron">Cron ifadesi (UTC)</Label>
              <Input
                id="feed-cron"
                value={form.cronExpression}
                onChange={(event) => set("cronExpression", event.target.value)}
                placeholder="0 */4 * * *"
              />
            </div>
          ) : null}

          {isImport ? (
            <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
              <ConnectionSettings
                idPrefix="feed-conn"
                connectionType={form.connectionType}
                ftpConfig={form.ftpConfig}
                hasFtpPassword={form.hasFtpPassword}
                webhookUrl={webhookUrl}
                onConnectionTypeChange={(next) => set("connectionType", next)}
                onFtpConfigChange={(next) => set("ftpConfig", next)}
              />

              <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
                {form.connectionType === "url" ? (
                  <div className="space-y-1">
                    <Label htmlFor="feed-url">Kaynak bağlantısı</Label>
                    <Input id="feed-url" value={form.sourceUrl} onChange={(event) => set("sourceUrl", event.target.value)} placeholder="https://tedarikci.com/urunler.xml" />
                  </div>
                ) : <div />}
                <div className="space-y-1">
                  <Label htmlFor="feed-format">Dosya türü</Label>
                  <select
                    id="feed-format"
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


              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="feed-auth">Giriş gerekiyor mu?</Label>
                  <select
                    id="feed-auth"
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                    value={form.authType}
                    onChange={(event) => set("authType", event.target.value as XmlAuthType)}
                  >
                    {XML_AUTH_TYPES.map((item) => (
                      <option key={item} value={item}>{XML_AUTH_TYPE_LABELS[item]}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="feed-item-path">Ürün düğümü</Label>
                  <Input id="feed-item-path" value={form.itemPath} onChange={(event) => set("itemPath", event.target.value)} placeholder="Otomatik bulunur" />
                </div>
              </div>

              {form.authType !== "none" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {authFieldsFor(form.authType).map((field) => (
                    <div key={field.key} className="space-y-1">
                      <Label htmlFor={`auth-${field.key}`}>{field.label}</Label>
                      <Input
                        id={`auth-${field.key}`}
                        type={field.secret ? "password" : "text"}
                        value={authFields[field.key] ?? ""}
                        placeholder={form.hasCredentials ? "Kayıtlı — değiştirmek için yazın" : ""}
                        onChange={(event) => setAuthFields((current) => ({ ...current, [field.key]: event.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              <Button
                type="button"
                variant="outline"
                disabled={
                  analysis.isPending ||
                  form.connectionType === "webhook" ||
                  form.connectionType === "sftp" ||
                  (form.connectionType === "url" && !form.sourceUrl.trim()) ||
                  ((form.connectionType === "ftp") && (!form.id || !form.ftpConfig.host))
                }
                onClick={() => analysis.mutate()}
              >
                {analysis.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Wand2 className="mr-1 size-4" />}
                Kaynağı incele ve alanları eşleştir
              </Button>

              {analysis.data ? (
                <div className="space-y-2 rounded-lg border bg-card p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{analysis.data.totalRows} ürün</Badge>
                    <Badge variant="secondary">{analysis.data.columns.length} alan</Badge>
                    <Badge variant="outline">{XML_SOURCE_FORMAT_LABELS[analysis.data.format as XmlSourceFormat]}</Badge>
                    {analysis.data.rootPath ? <Badge variant="outline">Düğüm: {analysis.data.rootPath}</Badge> : null}
                  </div>
                  {analysis.data.rootCandidates.length > 1 ? (
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor="root-pick">Yanlış düğüm mü bulundu?</Label>
                      <select
                        id="root-pick"
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
                      Örnek: {Object.entries(samples[0]).slice(0, 4).map(([key, val]) => `${key}=${String(val).slice(0, 30)}`).join(" · ")}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {columns.length ? (
                <div className="space-y-4">
                  {GROUPS.map((group) => (
                    <div key={group} className="space-y-2">
                      <p className="text-xs font-medium uppercase text-muted-foreground">{TARGET_FIELD_GROUP_LABELS[group]}</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {TARGET_FIELDS.filter((field) => field.group === group).map((field) => (
                          <div key={field.key} className="space-y-1">
                            <Label className="text-xs" htmlFor={`map-${field.key}`}>
                              {field.label}
                              {field.required ? <span className="text-destructive"> *</span> : null}
                            </Label>
                            <select
                              id={`map-${field.key}`}
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
                </div>
              ) : null}
            </section>
          ) : (
            <section className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="feed-output">Çıktı dosya adı</Label>
                <Input id="feed-output" value={form.outputFilename} onChange={(event) => set("outputFilename", event.target.value)} placeholder="trendyol-urunler.xml" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="feed-currency">Para birimi</Label>
                <Input id="feed-currency" maxLength={3} value={form.currency} onChange={(event) => set("currency", event.target.value.toUpperCase())} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="feed-markup">Fiyat farkı (%)</Label>
                <Input
                  id="feed-markup"
                  type="number"
                  value={form.priceMarkup ?? ""}
                  onChange={(event) => set("priceMarkup", event.target.value === "" ? null : Number(event.target.value))}
                  placeholder="Örn. 10"
                />
              </div>
            </section>
          )}

          {isImport ? (
            <DeltaSyncSettings
              idPrefix="feed-delta"
              value={form.deltaSync}
              onChange={(next) => set("deltaSync", next)}
              lastFullSyncAt={form.lastFullSyncAt ?? null}
            />
          ) : null}

          <div className="flex items-center justify-between rounded-xl border bg-card p-4">
            <Label htmlFor="feed-active">Besleme aktif</Label>
            <Switch id="feed-active" checked={form.isActive} onCheckedChange={(checked) => set("isActive", checked)} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Vazgeç</Button>
          <Button disabled={form.name.trim().length < 2 || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function authFieldsFor(authType: XmlAuthType): Array<{ key: string; label: string; secret?: boolean }> {
  if (authType === "basic") {
    return [
      { key: "username", label: "Kullanıcı adı" },
      { key: "password", label: "Şifre", secret: true },
    ];
  }
  if (authType === "bearer") return [{ key: "token", label: "Erişim anahtarı", secret: true }];
  if (authType === "header") {
    return [
      { key: "headerName", label: "Başlık adı" },
      { key: "headerValue", label: "Başlık değeri", secret: true },
    ];
  }
  if (authType === "query") {
    return [
      { key: "queryName", label: "Parametre adı" },
      { key: "queryValue", label: "Parametre değeri", secret: true },
    ];
  }
  return [];
}
