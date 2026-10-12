import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, RotateCcw, Save, Search, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime } from "@/lib/mefti";
import { platformSettingsQuery } from "@/lib/platform-admin-queries";
import { savePlatformSetting, savePlatformSettings } from "@/lib/platform-admin.functions";
import {
  MANAGED_SETTING_KEYS,
  PLATFORM_SETTING_GROUPS,
  toFormValue,
  toStoredValue,
  type SettingField,
  type SettingGroup,
} from "@/lib/platform-settings-schema";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Sistem ayarları — Süper Admin" },
      {
        name: "description",
        content:
          "Marka, erişim, ticaret, güvenlik, bildirim ve SEO ayarlarını kod değişikliği olmadan yönet.",
      },
      { property: "og:title", content: "Sistem ayarları — Süper Admin" },
      {
        property: "og:description",
        content: "Bakım modu, kayıt açıklığı, komisyon, vergi ve para birimi varsayılanları.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminSettings,
});

type Draft = { key: string; value: string; label: string; description: string; isPublic: boolean };

function AdminSettings() {
  const { isPlatformAdmin } = useAuth();
  const queryClient = useQueryClient();
  const settings = useQuery(platformSettingsQuery(isPlatformAdmin));
  const saveSetting = useServerFn(savePlatformSetting);
  const saveSettings = useServerFn(savePlatformSettings);

  const [activeGroup, setActiveGroup] = useState<string>(PLATFORM_SETTING_GROUPS[0]!.id);
  const [search, setSearch] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState<Draft | null>(null);
  const [rawDrafts, setRawDrafts] = useState<Record<string, string>>({});

  const rows = settings.data ?? [];

  const stored = useMemo(() => {
    const map: Record<string, { value: unknown; updatedAt: string | null }> = {};
    for (const row of rows) {
      map[String(row["key"])] = {
        value: row["value"],
        updatedAt: row["updated_at"] ? String(row["updated_at"]) : null,
      };
    }
    return map;
  }, [rows]);

  const currentValue = (field: SettingField) =>
    values[field.key] ?? toFormValue(field, stored[field.key]?.value);

  const isDirty = (field: SettingField) =>
    values[field.key] !== undefined &&
    values[field.key] !== toFormValue(field, stored[field.key]?.value);

  const bulkMutation = useMutation({
    mutationFn: (fields: SettingField[]) =>
      saveSettings({
        data: {
          items: fields.map((field) => ({
            key: field.key,
            value: toStoredValue(field, currentValue(field)),
            label: field.label,
            description: field.description,
            isPublic: field.isPublic,
          })),
        },
      }),
    onSuccess: (_result, fields) => {
      setValues((prev) => {
        const next = { ...prev };
        for (const field of fields) delete next[field.key];
        return next;
      });
      toast.success("Ayarlar kaydedildi");
      queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const singleMutation = useMutation({
    mutationFn: (input: Draft) =>
      saveSetting({
        data: {
          key: input.key,
          value: input.value,
          label: input.label || undefined,
          description: input.description || undefined,
          isPublic: input.isPublic,
        },
      }),
    onSuccess: () => {
      toast.success("Ayar kaydedildi");
      setCreating(null);
      queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const term = search.trim().toLowerCase();
  const matches = (field: SettingField) =>
    !term ||
    field.label.toLowerCase().includes(term) ||
    field.key.toLowerCase().includes(term) ||
    (field.description ?? "").toLowerCase().includes(term);

  const visibleGroups: SettingGroup[] = useMemo(() => {
    const filtered = PLATFORM_SETTING_GROUPS.map((group) => ({
      ...group,
      fields: group.fields.filter(matches),
    })).filter((group) => group.fields.length > 0);
    if (term) return filtered;
    return filtered.filter((group) => group.id === activeGroup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, activeGroup]);

  const dirtyCount = PLATFORM_SETTING_GROUPS.flatMap((g) => g.fields).filter(isDirty).length;

  const customRows = rows.filter((row) => !MANAGED_SETTING_KEYS.has(String(row["key"])));

  return (
    <AdminShell
      title="Sistem ayarları"
      description="Platform davranışı kodda sabit değildir; tüm varsayılanlar buradan yönetilir."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {dirtyCount > 0 ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setValues({})}
              disabled={bulkMutation.isPending}
            >
              <RotateCcw className="size-4" /> Değişiklikleri geri al
            </Button>
          ) : null}
          <Button
            size="sm"
            disabled={dirtyCount === 0 || bulkMutation.isPending}
            onClick={() =>
              bulkMutation.mutate(PLATFORM_SETTING_GROUPS.flatMap((g) => g.fields).filter(isDirty))
            }
          >
            <Save className="size-4" /> Tümünü kaydet{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ayar ara"
              aria-label="Ayar ara"
              className="pl-9"
            />
          </div>
          <nav className="surface-card overflow-hidden p-1" aria-label="Ayar grupları">
            {PLATFORM_SETTING_GROUPS.map((group) => {
              const groupDirty = group.fields.filter(isDirty).length;
              const active = !term && group.id === activeGroup;
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setActiveGroup(group.id);
                  }}
                  aria-current={active ? "true" : undefined}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                    active ? "bg-foreground text-background" : "hover:bg-muted"
                  }`}
                >
                  <span className="min-w-0 truncate">{group.title}</span>
                  {groupDirty > 0 ? (
                    <span className="rounded-full bg-primary/15 px-2 text-[11px] text-primary">
                      {groupDirty}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="space-y-5">
          {settings.isLoading ? (
            <p className="surface-card p-6 text-sm text-muted-foreground">Ayarlar yükleniyor…</p>
          ) : null}

          {visibleGroups.map((group) => {
            const groupDirty = group.fields.filter(isDirty);
            return (
              <section key={group.id} className="surface-card p-5">
                <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
                  <div>
                    <h2 className="flex items-center gap-2 text-base font-semibold">
                      <Settings2 className="size-4 text-muted-foreground" /> {group.title}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={groupDirty.length === 0 || bulkMutation.isPending}
                    onClick={() => bulkMutation.mutate(groupDirty)}
                  >
                    <Save className="size-4" /> Bu bölümü kaydet
                  </Button>
                </header>

                <div className="divide-y divide-border/60">
                  {group.fields.map((field) => (
                    <SettingRow
                      key={field.key}
                      field={field}
                      value={currentValue(field)}
                      dirty={isDirty(field)}
                      saved={Boolean(stored[field.key])}
                      updatedAt={stored[field.key]?.updatedAt ?? null}
                      onChange={(next) => setValues((prev) => ({ ...prev, [field.key]: next }))}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {visibleGroups.length === 0 ? (
            <p className="surface-card p-6 text-sm text-muted-foreground">
              “{search}” için ayar bulunamadı.
            </p>
          ) : null}

          <section className="surface-card p-5">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
              <div>
                <h2 className="text-base font-semibold">Gelişmiş anahtarlar</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Şemada tanımlı olmayan özel ayarlar. JSON veya metin değer girebilirsiniz.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setCreating({ key: "", value: "", label: "", description: "", isPublic: false })
                }
              >
                <Plus className="size-4" /> Yeni ayar
              </Button>
            </header>

            {creating ? (
              <form
                className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  singleMutation.mutate(creating);
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="new-key">Anahtar</Label>
                  <Input
                    id="new-key"
                    value={creating.key}
                    onChange={(event) => setCreating({ ...creating, key: event.target.value })}
                    placeholder="platform.example"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-label">Etiket</Label>
                  <Input
                    id="new-label"
                    value={creating.label}
                    onChange={(event) => setCreating({ ...creating, label: event.target.value })}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="new-value">Değer (JSON veya metin)</Label>
                  <Textarea
                    id="new-value"
                    rows={2}
                    value={creating.value}
                    onChange={(event) => setCreating({ ...creating, value: event.target.value })}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    id="new-public"
                    checked={creating.isPublic}
                    onCheckedChange={(checked) => setCreating({ ...creating, isPublic: checked })}
                  />
                  <Label htmlFor="new-public" className="text-xs">
                    Herkese açık (storefront okuyabilir)
                  </Label>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setCreating(null)}>
                    Vazgeç
                  </Button>
                  <Button type="submit" disabled={singleMutation.isPending}>
                    Kaydet
                  </Button>
                </div>
              </form>
            ) : null}

            <div className="divide-y divide-border/60">
              {customRows.map((row) => {
                const key = String(row["key"]);
                const raw = rawDrafts[key] ?? JSON.stringify(row["value"] ?? "");
                return (
                  <form
                    key={key}
                    className="flex flex-wrap items-end gap-3 py-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      singleMutation.mutate({
                        key,
                        value: raw,
                        label: String(row["label"] ?? ""),
                        description: String(row["description"] ?? ""),
                        isPublic: Boolean(row["is_public"]),
                      });
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{String(row["label"] ?? key)}</p>
                        <Badge variant="secondary">{key}</Badge>
                        {row["is_public"] ? <Badge>Herkese açık</Badge> : null}
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Son güncelleme:{" "}
                        {row["updated_at"] ? formatDateTime(String(row["updated_at"])) : "—"}
                      </p>
                    </div>
                    <div className="w-full sm:w-72">
                      <Label htmlFor={`value-${key}`} className="text-xs">
                        Değer
                      </Label>
                      <Input
                        id={`value-${key}`}
                        value={raw}
                        onChange={(event) =>
                          setRawDrafts({ ...rawDrafts, [key]: event.target.value })
                        }
                      />
                    </div>
                    <Button type="submit" size="sm" disabled={singleMutation.isPending}>
                      Kaydet
                    </Button>
                  </form>
                );
              })}
              {customRows.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">Özel ayar kaydı yok.</p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </AdminShell>
  );
}

function SettingRow({
  field,
  value,
  dirty,
  saved,
  updatedAt,
  onChange,
}: {
  field: SettingField;
  value: string;
  dirty: boolean;
  saved: boolean;
  updatedAt: string | null;
  onChange: (next: string) => void;
}) {
  const id = `setting-${field.key}`;
  return (
    <div className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-[1fr_minmax(0,320px)] sm:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={id} className="text-sm font-medium">
            {field.label}
          </Label>
          {field.isPublic ? (
            <Badge variant="secondary" className="text-[10px]">
              Herkese açık
            </Badge>
          ) : null}
          {dirty ? <Badge className="text-[10px]">Kaydedilmedi</Badge> : null}
          {!saved ? (
            <Badge variant="outline" className="text-[10px]">
              Varsayılan
            </Badge>
          ) : null}
        </div>
        {field.description ? (
          <p className="mt-1 text-xs text-muted-foreground">{field.description}</p>
        ) : null}
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
          {field.key}
          {updatedAt ? ` · ${formatDateTime(updatedAt)}` : ""}
        </p>
      </div>

      <div className="sm:justify-self-end sm:text-right">
        {field.type === "boolean" ? (
          <div className="flex items-center gap-2 sm:justify-end">
            <Switch
              id={id}
              checked={value === "true"}
              onCheckedChange={(checked) => onChange(checked ? "true" : "false")}
            />
            <span className="text-xs text-muted-foreground">
              {value === "true" ? "Açık" : "Kapalı"}
            </span>
          </div>
        ) : field.type === "select" ? (
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger id={id} className="w-full sm:w-64">
              <SelectValue placeholder="Seçin" />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : field.type === "textarea" ? (
          <Textarea
            id={id}
            rows={3}
            value={value}
            placeholder={field.placeholder}
            onChange={(event) => onChange(event.target.value)}
            className="w-full sm:w-80"
          />
        ) : field.type === "color" ? (
          <div className="flex items-center gap-2 sm:justify-end">
            <input
              id={id}
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#111111"}
              onChange={(event) => onChange(event.target.value)}
              className="size-9 cursor-pointer rounded-md border border-border bg-transparent"
              aria-label={field.label}
            />
            <Input
              value={value}
              onChange={(event) => onChange(event.target.value)}
              className="w-28 font-mono text-xs"
              aria-label={`${field.label} kodu`}
            />
          </div>
        ) : field.type === "number" ? (
          <div className="flex items-center gap-2 sm:justify-end">
            <Input
              id={id}
              type="number"
              value={value}
              min={field.min}
              max={field.max}
              step={field.step ?? 1}
              onChange={(event) => onChange(event.target.value)}
              className="w-full sm:w-40"
            />
            {field.suffix ? (
              <span className="text-xs text-muted-foreground">{field.suffix}</span>
            ) : null}
          </div>
        ) : (
          <Input
            id={id}
            value={value}
            placeholder={field.placeholder}
            onChange={(event) => onChange(event.target.value)}
            className="w-full sm:w-80"
          />
        )}
      </div>
    </div>
  );
}
