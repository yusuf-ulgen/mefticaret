import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ExternalLink, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import {
  deleteSiteSection,
  fetchSiteSectionsAdmin,
  reorderSiteSections,
  saveSiteSection,
} from "@/lib/site-content.functions";
import {
  ICON_NAMES,
  ITEM_TEMPLATES,
  SECTION_KINDS,
  type SiteSection,
  type SiteSectionItem,
} from "@/lib/site-content";

const DESCRIPTION =
  "Platform ana sayfasındaki tüm bölümleri ekle, düzenle, sırala, yayından kaldır veya sil.";

export const Route = createFileRoute("/_authenticated/admin/frontend/landing")({
  head: () => ({
    meta: [
      { title: "Ana Sayfa Yönetimi — Süper Admin" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Ana Sayfa Yönetimi — Süper Admin" },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: AdminLandingPage,
});

type Row = SiteSection & { id: string };

function normalize(row: Record<string, unknown>): Row {
  return {
    id: row["id"] as string,
    section_key: row["section_key"] as string,
    kind: row["kind"] as string,
    eyebrow: (row["eyebrow"] as string | null) ?? null,
    title: (row["title"] as string | null) ?? null,
    subtitle: (row["subtitle"] as string | null) ?? null,
    primary_label: (row["primary_label"] as string | null) ?? null,
    primary_href: (row["primary_href"] as string | null) ?? null,
    secondary_label: (row["secondary_label"] as string | null) ?? null,
    secondary_href: (row["secondary_href"] as string | null) ?? null,
    badge: (row["badge"] as string | null) ?? null,
    items: Array.isArray(row["items"]) ? (row["items"] as SiteSectionItem[]) : [],
    sort_order: Number(row["sort_order"] ?? 0),
    is_enabled: row["is_enabled"] !== false,
  };
}

function AdminLandingPage() {
  const { isPlatformAdmin } = useAuth();
  const client = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Row>>({});

  const sections = useQuery({
    queryKey: ["admin-site-sections"],
    enabled: isPlatformAdmin,
    queryFn: async () => {
      const rows = (await fetchSiteSectionsAdmin()) as unknown as Record<string, unknown>[];
      return rows.map(normalize);
    },
  });

  const rows = useMemo(
    () => (sections.data ?? []).map((row) => drafts[row.id] ?? row),
    [sections.data, drafts],
  );

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ["admin-site-sections"] });
    void client.invalidateQueries({ queryKey: ["site-sections"] });
  };

  const save = useMutation({
    mutationFn: async (row: Row) =>
      saveSiteSection({
        data: {
          sectionKey: row.section_key,
          kind: row.kind,
          eyebrow: row.eyebrow,
          title: row.title,
          subtitle: row.subtitle,
          primaryLabel: row.primary_label,
          primaryHref: row.primary_href,
          secondaryLabel: row.secondary_label,
          secondaryHref: row.secondary_href,
          badge: row.badge,
          items: row.items,
          sortOrder: row.sort_order,
          isEnabled: row.is_enabled,
        },
      }),
    onSuccess: (_data, row) => {
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      invalidate();
      toast.success("Bölüm kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => deleteSiteSection({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Bölüm silindi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reorder = useMutation({
    mutationFn: async (order: { id: string; sortOrder: number }[]) =>
      reorderSiteSections({ data: { order } }),
    onSuccess: () => {
      invalidate();
      toast.success("Sıralama güncellendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const patch = (row: Row, changes: Partial<Row>) =>
    setDrafts((prev) => ({ ...prev, [row.id]: { ...row, ...changes } }));

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    reorder.mutate(next.map((row, position) => ({ id: row.id, sortOrder: (position + 1) * 10 })));
  };

  const createSection = () => {
    const key = window.prompt("Yeni bölüm anahtarı (örn. kampanya-seridi)")?.trim().toLowerCase();
    if (!key) return;
    save.mutate({
      id: "new",
      section_key: key.replace(/[^a-z0-9-]/g, "-"),
      kind: "cards",
      eyebrow: null,
      title: "Yeni bölüm",
      subtitle: null,
      primary_label: null,
      primary_href: null,
      secondary_label: null,
      secondary_href: null,
      badge: null,
      items: [],
      sort_order: (rows.at(-1)?.sort_order ?? 0) + 10,
      is_enabled: false,
    });
  };

  return (
    <AdminShell
      title="Ana Sayfa Yönetimi"
      description={DESCRIPTION}
      actions={
        <>
          <Button variant="outline" size="sm" asChild>
            <a href="/" target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1.5 size-4" /> Ana sayfayı aç
            </a>
          </Button>
          <Button size="sm" onClick={createSection}>
            <Plus className="mr-1.5 size-4" /> Bölüm ekle
          </Button>
        </>
      }
    >
      {sections.isLoading ? (
        <p className="text-sm text-muted-foreground">Bölümler yükleniyor…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz bölüm yok.</p>
      ) : (
        <div className="space-y-4">
          <nav className="surface-card flex flex-wrap gap-2 p-3" aria-label="Bölümlere git">
            {rows.map((row) => (
              <a
                key={`jump-${row.id}`}
                href={`#bolum-${row.section_key}`}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                {SECTION_KINDS.find((k) => k.value === row.kind)?.label ?? row.kind}
                {row.is_enabled ? "" : " · kapalı"}
              </a>
            ))}
          </nav>
          {rows.map((row, index) => {
            const dirty = Boolean(drafts[row.id]);
            const template = ITEM_TEMPLATES[row.kind] ?? { title: "Yeni kart", text: "" };
            return (
              <section key={row.id} id={`bolum-${row.section_key}`} className="surface-card scroll-mt-24 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-display text-base font-semibold">
                      {row.title || row.section_key}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.section_key} · {SECTION_KINDS.find((k) => k.value === row.kind)?.label ?? row.kind}
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {row.is_enabled ? "Yayında" : "Kapalı"}
                    </span>
                    <Switch
                      checked={row.is_enabled}
                      aria-label={`${row.section_key} bölümünü yayınla`}
                      onCheckedChange={(checked) => patch(row, { is_enabled: checked })}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Yukarı taşı"
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Aşağı taşı"
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Bölümü sil"
                      onClick={() => {
                        if (window.confirm(`${row.section_key} bölümü silinsin mi?`)) remove.mutate(row.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                    <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate(row)}>
                      <Save className="mr-1.5 size-4" /> Kaydet
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field
                    label="Üst etiket"
                    value={row.eyebrow}
                    onChange={(value) => patch(row, { eyebrow: value })}
                  />
                  <Field label="Başlık" value={row.title} onChange={(value) => patch(row, { title: value })} />
                  <div className="md:col-span-2">
                    <Label className="text-xs">Açıklama</Label>
                    <Textarea
                      className="mt-1"
                      rows={3}
                      value={row.subtitle ?? ""}
                      onChange={(event) => patch(row, { subtitle: event.target.value })}
                    />
                  </div>
                  <Field
                    label="Ana buton metni"
                    value={row.primary_label}
                    onChange={(value) => patch(row, { primary_label: value })}
                  />
                  <Field
                    label="Ana buton bağlantısı"
                    value={row.primary_href}
                    onChange={(value) => patch(row, { primary_href: value })}
                  />
                  <Field
                    label="İkinci buton metni"
                    value={row.secondary_label}
                    onChange={(value) => patch(row, { secondary_label: value })}
                  />
                  <Field
                    label="İkinci buton bağlantısı"
                    value={row.secondary_href}
                    onChange={(value) => patch(row, { secondary_href: value })}
                  />
                  <Field
                    label="Rozet / sayaç"
                    value={row.badge}
                    onChange={(value) => patch(row, { badge: value })}
                  />
                  <div>
                    <Label className="text-xs">Bölüm türü</Label>
                    <select
                      className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={row.kind}
                      onChange={(event) => patch(row, { kind: event.target.value })}
                    >
                      {SECTION_KINDS.map((kind) => (
                        <option key={kind.value} value={kind.value}>
                          {kind.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Kartlar ({row.items.length})
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => patch(row, { items: [...row.items, { ...template }] })}
                    >
                      <Plus className="mr-1.5 size-4" /> Kart ekle
                    </Button>
                  </div>

                  <div className="mt-3 space-y-3">
                    {row.items.map((item, itemIndex) => (
                      <div key={itemIndex} className="rounded-xl border border-border p-3">
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                          {Object.keys({ ...template, ...item }).map((field) => (
                            <div key={field}>
                              <Label className="text-[11px]">{field}</Label>
                              {field === "icon" ? (
                                <select
                                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                  value={item[field] ?? ""}
                                  onChange={(event) => {
                                    const items = [...row.items];
                                    items[itemIndex] = { ...item, [field]: event.target.value };
                                    patch(row, { items });
                                  }}
                                >
                                  {ICON_NAMES.map((name) => (
                                    <option key={name} value={name}>
                                      {name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <Input
                                  className="mt-1"
                                  value={item[field] ?? ""}
                                  onChange={(event) => {
                                    const items = [...row.items];
                                    items[itemIndex] = { ...item, [field]: event.target.value };
                                    patch(row, { items });
                                  }}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const items = [...row.items];
                              const target = itemIndex - 1;
                              if (target < 0) return;
                              const [moved] = items.splice(itemIndex, 1);
                              items.splice(target, 0, moved!);
                              patch(row, { items });
                            }}
                          >
                            Yukarı
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const items = [...row.items];
                              const target = itemIndex + 1;
                              if (target >= items.length) return;
                              const [moved] = items.splice(itemIndex, 1);
                              items.splice(target, 0, moved!);
                              patch(row, { items });
                            }}
                          >
                            Aşağı
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              patch(row, { items: row.items.filter((_, i) => i !== itemIndex) })
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input className="mt-1" value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
