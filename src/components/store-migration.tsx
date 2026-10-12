import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ENTITY_LABELS, MIGRATION_ENTITIES, type MigrationEntity } from "@/lib/migration/types";
import {
  migrationJobsQuery,
  migrationProvidersQuery,
  migrationSourcesQuery,
} from "@/lib/migration-queries";
import {
  deleteMigrationSource,
  previewMigration,
  saveMigrationSource,
  startMigrationJob,
  testMigrationConnection,
} from "@/lib/migration.functions";

/**
 * Mağaza Taşıma paneli: kaynak tanımlama, bağlantı testi, kuru çalışma
 * önizlemesi ve gerçek aktarım. Kimlik bilgileri yalnızca sunucuya gönderilir,
 * hiçbir zaman geri okunmaz.
 */

type Report = Awaited<ReturnType<typeof previewMigration>>;

const numberFmt = new Intl.NumberFormat("tr-TR");

export function StoreMigration({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const { data: providers = [] } = useQuery(migrationProvidersQuery());
  const { data: sources = [] } = useQuery(migrationSourcesQuery(storeId));
  const { data: jobs = [] } = useQuery(migrationJobsQuery(storeId));

  const [providerCode, setProviderCode] = useState<string>("");
  const [shopDomain, setShopDomain] = useState("");
  const [label, setLabel] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [scope, setScope] = useState<MigrationEntity[]>([...MIGRATION_ENTITIES]);
  const [activeSourceId, setActiveSourceId] = useState<string>("");
  const [report, setReport] = useState<Report | null>(null);

  const provider = useMemo(
    () => providers.find((item) => item.code === providerCode) ?? null,
    [providers, providerCode],
  );
  const activeSource = sources.find((source) => source.id === activeSourceId) ?? null;
  const selectableScope = provider ? provider.entities : MIGRATION_ENTITIES;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["migration"] });
  };

  const save = useMutation({
    mutationFn: () =>
      saveMigrationSource({
        data: {
          storeId,
          ...(activeSourceId ? { sourceId: activeSourceId } : {}),
          provider: providerCode,
          label: label || undefined,
          shopDomain: shopDomain || undefined,
          scope: scope.filter((entity) => selectableScope.includes(entity)),
          credentials,
        },
      }),
    onSuccess: (result) => {
      setActiveSourceId(result.sourceId ?? "");
      setCredentials({});
      toast.success("Kaynak kaydedildi");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const test = useMutation({
    mutationFn: (sourceId: string) => testMigrationConnection({ data: { storeId, sourceId } }),
    onSuccess: (result) => {
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const preview = useMutation({
    mutationFn: (sourceId: string) =>
      previewMigration({ data: { storeId, sourceId, scope: scopeFor(sourceId) } }),
    onSuccess: (result) => {
      setReport(result);
      toast.success("Kuru çalışma tamamlandı — hiçbir veri yazılmadı");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const run = useMutation({
    mutationFn: (sourceId: string) =>
      startMigrationJob({ data: { storeId, sourceId, scope: scopeFor(sourceId) } }),
    onSuccess: (result) => {
      setReport(result);
      toast.success("Aktarım tamamlandı");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (sourceId: string) => deleteMigrationSource({ data: { storeId, sourceId } }),
    onSuccess: () => {
      setActiveSourceId("");
      toast.success("Kaynak silindi");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function scopeFor(sourceId: string): MigrationEntity[] {
    const source = sources.find((item) => item.id === sourceId);
    const stored = Array.isArray(source?.scope) ? (source?.scope as MigrationEntity[]) : [];
    const chosen = scope.length > 0 ? scope : stored;
    return (chosen.length > 0 ? chosen : [...MIGRATION_ENTITIES]).filter((entity) =>
      MIGRATION_ENTITIES.includes(entity),
    );
  }

  function editSource(sourceId: string) {
    const source = sources.find((item) => item.id === sourceId);
    if (!source) return;
    setActiveSourceId(source.id);
    setProviderCode(source.provider);
    setLabel(source.label ?? "");
    setShopDomain(source.shop_domain ?? "");
    setScope(Array.isArray(source.scope) ? (source.scope as MigrationEntity[]) : [...MIGRATION_ENTITIES]);
    setCredentials({});
    setReport(null);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Kaynak mağaza</CardTitle>
          <CardDescription>
            Verilerini taşımak istediğin altyapıyı seç, erişim bilgilerini gir ve önce kuru çalışma yap.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Altyapı</Label>
              <Select
                value={providerCode}
                onValueChange={(value) => {
                  setProviderCode(value);
                  setCredentials({});
                  const next = providers.find((item) => item.code === value);
                  setScope((next?.entities as MigrationEntity[] | undefined) ?? [...MIGRATION_ENTITIES]);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Altyapı seç" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((item) => (
                    <SelectItem key={item.code} value={item.code}>
                      {item.name} · {item.region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kaynak adresi</Label>
              <Input
                value={shopDomain}
                onChange={(event) => setShopDomain(event.target.value)}
                placeholder="ornekmagaza.com veya besleme adresi"
              />
            </div>
            <div className="space-y-2">
              <Label>Etiket</Label>
              <Input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Eski mağaza"
              />
            </div>
          </div>

          {provider ? (
            <>
              <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">{provider.howTo}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {provider.credentialFields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label>
                      {field.label}
                      {field.optional ? " (opsiyonel)" : ""}
                    </Label>
                    <Input
                      type={field.secret ? "password" : "text"}
                      autoComplete="off"
                      value={credentials[field.key] ?? ""}
                      placeholder={field.placeholder ?? ""}
                      onChange={(event) =>
                        setCredentials((prev) => ({ ...prev, [field.key]: event.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <div className="space-y-2">
            <Label>Taşınacak veriler</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {MIGRATION_ENTITIES.map((entity) => {
                const disabled = !selectableScope.includes(entity);
                return (
                  <label
                    key={entity}
                    className="flex items-center gap-2 rounded-lg border p-2.5 text-sm data-[disabled=true]:opacity-50"
                    data-disabled={disabled}
                  >
                    <Checkbox
                      checked={scope.includes(entity)}
                      disabled={disabled}
                      onCheckedChange={(checked) =>
                        setScope((prev) =>
                          checked ? [...new Set([...prev, entity])] : prev.filter((item) => item !== entity),
                        )
                      }
                    />
                    <span>{ENTITY_LABELS[entity]}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save.mutate()} disabled={!providerCode || save.isPending}>
              {activeSourceId ? "Kaynağı güncelle" : "Kaynağı kaydet"}
            </Button>
            {activeSourceId ? (
              <>
                <Button variant="outline" onClick={() => test.mutate(activeSourceId)} disabled={test.isPending}>
                  Bağlantıyı test et
                </Button>
                <Button variant="outline" onClick={() => preview.mutate(activeSourceId)} disabled={preview.isPending}>
                  Kuru çalışma (önizleme)
                </Button>
                <Button onClick={() => run.mutate(activeSourceId)} disabled={run.isPending}>
                  Aktarımı başlat
                </Button>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {report ? (
        <Card>
          <CardHeader>
            <CardTitle>{report.dryRun ? "Kuru çalışma sonucu" : "Aktarım raporu"}</CardTitle>
            <CardDescription>
              {report.dryRun
                ? "Bu sonuçta hiçbir kayıt mağazana yazılmadı."
                : "Aynı kayıt tekrar aktarıldığında güncellenir, kopyalanmaz."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(report.totals).map(([entity, totals]) => (
                <div key={entity} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">{ENTITY_LABELS[entity as MigrationEntity]}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {report.dryRun
                      ? `${numberFmt.format(totals?.created ?? 0)} kayıt bulundu`
                      : `${numberFmt.format(totals?.created ?? 0)} yeni · ${numberFmt.format(totals?.updated ?? 0)} güncel · ${numberFmt.format(totals?.failed ?? 0)} hata`}
                  </p>
                </div>
              ))}
            </div>
            {report.errors.length > 0 ? (
              <ul className="space-y-1 text-sm text-destructive">
                {report.errors.slice(0, 10).map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Kayıtlı kaynaklar</CardTitle>
          <CardDescription>Bir kaynağı düzenlemek için üzerine tıkla.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz kaynak eklenmedi.</p>
          ) : (
            sources.map((source) => (
              <div
                key={source.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <button type="button" className="text-left" onClick={() => editSource(source.id)}>
                  <p className="text-sm font-medium">{source.label ?? source.provider}</p>
                  <p className="text-xs text-muted-foreground">
                    {source.provider}
                    {source.shop_domain ? ` · ${source.shop_domain}` : ""}
                  </p>
                </button>
                <div className="flex items-center gap-2">
                  <Badge variant={source.status === "error" ? "destructive" : "secondary"}>
                    {source.status === "error" ? "Hata" : "Hazır"}
                  </Badge>
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(source.id)}>
                    Sil
                  </Button>
                </div>
              </div>
            ))
          )}
          {sources.some((source) => source.last_error) ? (
            <p className="text-xs text-destructive">
              {sources.find((source) => source.last_error)?.last_error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aktarım geçmişi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz aktarım yapılmadı.</p>
          ) : (
            jobs.map((job) => (
              <div key={job.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">
                    {new Date(job.created_at).toLocaleString("tr-TR")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(Array.isArray(job.scope) ? (job.scope as string[]) : []).length} veri türü ·{" "}
                    {job.last_error ? job.last_error.slice(0, 120) : "hata yok"}
                  </p>
                </div>
                <Badge variant={job.status === "failed" ? "destructive" : "secondary"}>{job.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
