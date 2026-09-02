import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Loader2,
  Monitor,
  Plus,
  Redo2,
  RotateCcw,
  Rocket,
  Save,
  Settings2,
  Smartphone,
  Tablet,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { AddSectionDialog } from "@/components/theme-editor/add-section-dialog";
import { SettingField, isWideWidget, widgetFor, type FieldValue } from "@/components/theme-editor/fields";
import { SectionTree, type DraftSection } from "@/components/theme-editor/section-tree";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { collectionsQuery, productsQuery } from "@/lib/catalog-queries";
import { StorefrontSections, type SectionProduct } from "@/components/storefront-sections";
import { storeQuery } from "@/lib/store-queries";
import { storeThemeQuery } from "@/lib/theme-queries";
import { themeSectionsQuery } from "@/lib/theme-sections-queries";
import type { ResolvedSection, SectionField, SectionSettings, ThemeSectionType } from "@/lib/theme-sections";
import {
  addThemeSection,
  removeThemeSection,
  reorderThemeSections,
  updateThemeSection,
} from "@/lib/theme-sections.functions";
import { publishThemeVersion } from "@/lib/theme-versions.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/store/$storeId/theme-editor")({
  head: () => ({
    meta: [
      { title: "Tema Düzenleyici — Mefticaret" },
      {
        name: "description",
        content:
          "Sürükle-bırak bölüm ağacı, canlı önizleme ve dinamik ayar formuyla mağaza vitrinini kod yazmadan tasarla.",
      },
      { property: "og:title", content: "Tema Düzenleyici — Mefticaret" },
      {
        property: "og:description",
        content: "Bölümleri sırala, ayarları anında önizle, taslak kaydet ve yayınla.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ThemeEditorPage,
});

type PreviewDevice = "desktop" | "tablet" | "mobile";

const DEVICES: { value: PreviewDevice; label: string; icon: typeof Monitor; width: number | null }[] = [
  { value: "desktop", label: "Masaüstü", icon: Monitor, width: null },
  { value: "tablet", label: "Tablet", icon: Tablet, width: 768 },
  { value: "mobile", label: "Mobil", icon: Smartphone, width: 390 },
];

/** Kaydedilmemiş yerel taslak: sıralama + bölüm ayarları. */
type Draft = {
  order: string[];
  items: Record<string, { settings: SectionSettings; isEnabled: boolean }>;
};

function draftFromServer(sections: ResolvedSection[]): Draft {
  return {
    order: sections.map((section) => section.id),
    items: Object.fromEntries(
      sections.map((section) => [section.id, { settings: { ...section.settings }, isEnabled: section.isEnabled }]),
    ),
  };
}

function sameDraft(a: Draft, b: Draft) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Alanları sağ paneldeki sekmelere dağıtır. */
function tabOf(field: SectionField): "content" | "design" | "layout" {
  const widget = widgetFor(field);
  const key = field.key.toLowerCase();
  if (widget === "color" || widget === "font" || key.includes("style") || key.includes("tone")) return "design";
  if (
    widget === "range" ||
    key.includes("columns") ||
    key.includes("align") ||
    key.includes("position") ||
    key.includes("width") ||
    key.includes("height") ||
    key.includes("padding")
  ) {
    return "layout";
  }
  return "content";
}

function ThemeEditorPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: sections, isLoading } = useQuery(themeSectionsQuery(storeId));
  const { data: theme } = useQuery(storeThemeQuery(storeId));
  const { data: store } = useQuery(storeQuery(storeId));
  const { data: products } = useQuery(productsQuery(storeId));
  const { data: collections } = useQuery(collectionsQuery(storeId));

  const add = useServerFn(addThemeSection);
  const update = useServerFn(updateThemeSection);
  const remove = useServerFn(removeThemeSection);
  const reorder = useServerFn(reorderThemeSections);
  const publish = useServerFn(publishThemeVersion);

  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"content" | "design" | "layout">("content");
  const [addOpen, setAddOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  /** Mobilde tek seferde tek panel gösterilir. */
  const [pane, setPane] = useState<"sections" | "preview" | "settings">("preview");

  const [history, setHistory] = useState<Draft[]>([]);
  const [cursor, setCursor] = useState(-1);
  const baseRef = useRef<Draft>({ order: [], items: {} });

  const draft = history[cursor] ?? baseRef.current;

  const resetFromServer = useCallback((rows: ResolvedSection[]) => {
    const next = draftFromServer(rows);
    baseRef.current = next;
    setHistory([next]);
    setCursor(0);
  }, []);

  useEffect(() => {
    if (!sections) return;
    // Sunucu verisi değiştiğinde (ekleme/silme/yayınlama) taslağı sıfırla.
    const serverDraft = draftFromServer(sections);
    if (!sameDraft(serverDraft, baseRef.current)) resetFromServer(sections);
    setSelectedId((current) => (current && serverDraft.items[current] ? current : (serverDraft.order[0] ?? null)));
  }, [sections, resetFromServer]);

  const pushDraft = (next: Draft) => {
    const trimmed = history.slice(0, cursor + 1);
    trimmed.push(next);
    const capped = trimmed.slice(-50);
    setHistory(capped);
    setCursor(capped.length - 1);
  };

  const dirty = !sameDraft(draft, baseRef.current);
  const canUndo = cursor > 0;
  const canRedo = cursor >= 0 && cursor < history.length - 1;

  const sectionById = useMemo(
    () => new Map((sections ?? []).map((section) => [section.id, section])),
    [sections],
  );

  const items: DraftSection[] = useMemo(
    () =>
      draft.order
        .map((id) => {
          const section = sectionById.get(id);
          if (!section) return null;
          return { id, isEnabled: draft.items[id]?.isEnabled ?? section.isEnabled, section };
        })
        .filter((item): item is DraftSection => item !== null),
    [draft, sectionById],
  );

  /** Önizleme, sunucu satırlarını yerel taslak ayarlarıyla birleştirir. */
  const previewSections: ResolvedSection[] = useMemo(
    () =>
      items.map((item, index) => ({
        ...item.section,
        position: index,
        isEnabled: item.isEnabled,
        settings: draft.items[item.id]?.settings ?? item.section.settings,
      })),
    [items, draft],
  );

  const previewProducts: SectionProduct[] = useMemo(
    () =>
      (products ?? []).slice(0, 12).map((product) => ({
        id: product.id,
        title: product.title,
        slug: product.slug,
        description: product.description,
        base_price: product.base_price,
        compare_at_price: product.compare_at_price,
        currency: product.currency,
        product_type: product.product_type,
        tags: product.tags,
        coverUrl: null,
      })),
    [products],
  );

  const selected = selectedId ? sectionById.get(selectedId) : undefined;
  const selectedDraft = selectedId ? draft.items[selectedId] : undefined;

  const setSetting = (key: string, value: FieldValue) => {
    if (!selectedId || !selectedDraft) return;
    pushDraft({
      order: draft.order,
      items: {
        ...draft.items,
        [selectedId]: { ...selectedDraft, settings: { ...selectedDraft.settings, [key]: value } },
      },
    });
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["theme-sections", storeId] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const base = baseRef.current;
      if (JSON.stringify(base.order) !== JSON.stringify(draft.order)) {
        await reorder({ data: { storeId, sectionIds: draft.order } });
      }
      for (const id of draft.order) {
        const next = draft.items[id];
        const previous = base.items[id];
        const section = sectionById.get(id);
        if (!next || !section) continue;
        if (previous && JSON.stringify(previous) === JSON.stringify(next)) continue;
        await update({
          data: {
            storeId,
            sectionId: id,
            type: section.type,
            isEnabled: next.isEnabled,
            settings: next.settings,
          },
        });
      }
    },
    onSuccess: async () => {
      baseRef.current = draft;
      setSavedAt(new Date());
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addMutation = useMutation({
    mutationFn: (type: ThemeSectionType) => add({ data: { storeId, type } }),
    onSuccess: async () => {
      setAddOpen(false);
      await invalidate();
      toast.success("Bölüm eklendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (sectionId: string) => remove({ data: { storeId, sectionId } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Bölüm silindi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      const source = sectionById.get(sectionId);
      if (!source) throw new Error("Bölüm bulunamadı");
      const created = (await add({ data: { storeId, type: source.type } })) as { id?: string } | null;
      const newId = created?.id;
      if (newId) {
        await update({
          data: {
            storeId,
            sectionId: newId,
            type: source.type,
            isEnabled: draft.items[sectionId]?.isEnabled ?? true,
            settings: draft.items[sectionId]?.settings ?? source.settings,
          },
        });
      }
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Bölüm çoğaltıldı");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (dirty) await saveMutation.mutateAsync();
      return publish({ data: { storeId } });
    },
    onSuccess: async () => {
      await Promise.all([
        invalidate(),
        queryClient.invalidateQueries({ queryKey: ["theme-versions", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["store-theme", storeId] }),
      ]);
      toast.success("Tema yayınlandı");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Otomatik kaydetme: 30 saniyede bir bekleyen değişiklikleri gönderir.
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setInterval(() => {
      if (!saveMutation.isPending) saveMutation.mutate();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [dirty, saveMutation]);

  // Klavye kısayolları: kaydet, geri al, yinele.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        if (dirty) saveMutation.mutate();
      } else if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        setCursor((current) => (current > 0 ? current - 1 : current));
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        setCursor((current) => (current < history.length - 1 ? current + 1 : current));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, history.length, saveMutation]);

  const fields = selected?.definition.fields ?? [];
  const tabsWithFields = (["content", "design", "layout"] as const).filter((name) =>
    fields.some((field) => tabOf(field) === name),
  );
  const activeTab = tabsWithFields.includes(tab) ? tab : (tabsWithFields[0] ?? "content");
  const visibleFields = fields.filter((field) => tabOf(field) === activeTab);
  const deviceWidth = DEVICES.find((entry) => entry.value === device)?.width ?? null;
  const storefrontPath = store?.slug ? `/s/${store.slug}` : null;

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="flex h-full min-h-0 flex-col">
        {/* Üst çubuk */}
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-2 py-2 lg:h-14 lg:flex-nowrap lg:gap-4 lg:px-3 lg:py-0">
          <div className="flex min-w-0 items-center gap-2">
            <Button asChild variant="ghost" size="icon" aria-label="Panele dön">
              <Link to="/store/$storeId/dashboard" params={{ storeId }}>
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <span className="truncate text-sm font-semibold">{store?.name ?? "Mağaza"}</span>
            <Badge variant={theme?.is_published ? "secondary" : "outline"}>
              {theme?.is_published ? "Yayında" : "Taslak"}
            </Badge>
          </div>

          <div className="order-3 inline-flex w-full justify-center rounded-lg border border-border p-1 sm:order-none sm:w-auto">
            {DEVICES.map((entry) => (
              <button
                key={entry.value}
                type="button"
                onClick={() => {
                  setDevice(entry.value);
                  setPane("preview");
                }}
                aria-pressed={device === entry.value}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition sm:flex-none",
                  device === entry.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <entry.icon className="size-3.5" />
                {entry.label}
              </button>
            ))}
          </div>


          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Geri al"
              disabled={!canUndo}
              onClick={() => setCursor((current) => Math.max(0, current - 1))}
            >
              <Undo2 className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Yinele"
              disabled={!canRedo}
              onClick={() => setCursor((current) => Math.min(history.length - 1, current + 1))}
            >
              <Redo2 className="size-4" />
            </Button>
            <span className="mr-1 hidden text-[11px] text-muted-foreground xl:inline">
              {saveMutation.isPending
                ? "Kaydediliyor…"
                : dirty
                  ? "Kaydedilmedi"
                  : savedAt
                    ? "Kaydedildi"
                    : ""}
            </span>
            <Button
              size="sm"
              disabled={!dirty || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin sm:mr-1.5" />
              ) : dirty ? (
                <Save className="size-3.5 sm:mr-1.5" />
              ) : (
                <Check className="size-3.5 sm:mr-1.5" />
              )}
              <span className="hidden sm:inline">Kaydet</span>
            </Button>
            {storefrontPath ? (
              <Button asChild size="sm" variant="outline">
                <a href={storefrontPath} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">Önizle</span>
                </a>
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              disabled={publishMutation.isPending}
              onClick={() => publishMutation.mutate()}
            >
              {publishMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin sm:mr-1.5" />
              ) : (
                <Rocket className="size-3.5 sm:mr-1.5" />
              )}
              <span className="hidden sm:inline">Yayınla</span>
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Sol panel */}
          <aside
            className={cn(
              "min-h-0 w-full shrink-0 flex-col border-border bg-card lg:flex lg:w-[280px] lg:border-r",
              pane === "sections" ? "flex flex-1" : "hidden",
            )}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
              <span className="text-sm font-semibold">Bölümler</span>
              <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                <Plus className="mr-1 size-3.5" /> Ekle
              </Button>
            </div>
            <ScrollArea className="flex-1 px-2 py-2">
              {isLoading ? (
                <p className="p-3 text-sm text-muted-foreground">Yükleniyor…</p>
              ) : items.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">
                  Henüz bölüm yok. “Ekle” ile ilk bölümünü oluştur.
                </p>
              ) : (
                <SectionTree
                  items={items}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onReorder={(ids) => pushDraft({ order: ids, items: draft.items })}
                  onToggle={(id) => {
                    const current = draft.items[id];
                    if (!current) return;
                    pushDraft({
                      order: draft.order,
                      items: { ...draft.items, [id]: { ...current, isEnabled: !current.isEnabled } },
                    });
                  }}
                  onDuplicate={(id) => duplicateMutation.mutate(id)}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              )}
            </ScrollArea>
            <div className="border-t border-border p-2">
              <Button asChild variant="ghost" size="sm" className="w-full justify-start">
                <Link to="/store/$storeId/themes" params={{ storeId }}>
                  <Settings2 className="mr-2 size-4" /> Tema ayarları
                </Link>
              </Button>
            </div>
          </aside>

          {/* Orta panel: canlı önizleme */}
          <main className="min-w-0 flex-1 overflow-auto bg-muted/40 p-4">
            <div
              className="mx-auto overflow-hidden rounded-xl border border-border bg-background shadow-sm transition-all duration-300"
              style={{ maxWidth: deviceWidth ? `${deviceWidth}px` : "100%" }}
            >
              <div style={{ background: theme?.background_color ?? undefined }}>
                <StorefrontSections
                  sections={previewSections.filter((section) => section.isEnabled)}
                  context={{
                    theme: theme ?? null,
                    storeSlug: store?.slug ?? "preview",
                    storeName: store?.name ?? "Önizleme",
                    storeCurrency: "TRY",
                    products: previewProducts,
                    collections: (collections ?? []).map((collection) => ({
                      id: collection.id,
                      title: collection.title,
                      slug: collection.slug,
                      description: collection.description,
                    })),
                    pages: [],
                    preview: true,
                  }}
                />
              </div>
            </div>
          </main>

          {/* Sağ panel: ayarlar */}
          <aside className="flex w-[320px] shrink-0 flex-col border-l border-border bg-card">
            <div className="border-b border-border px-3 py-2">
              <p className="truncate text-sm font-semibold">
                {selected?.definition.label ?? "Bölüm seçilmedi"}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {selected?.definition.description ?? "Sol panelden bir bölüm seç."}
              </p>
            </div>

            {selected && tabsWithFields.length > 1 ? (
              <div className="px-3 pt-2">
                <Tabs value={activeTab} onValueChange={(value) => setTab(value as typeof tab)}>
                  <TabsList className="w-full">
                    {tabsWithFields.map((name) => (
                      <TabsTrigger key={name} value={name} className="flex-1">
                        {name === "content" ? "İçerik" : name === "design" ? "Tasarım" : "Yerleşim"}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            ) : null}

            <ScrollArea className="flex-1 px-3 py-3">
              {!selected || !selectedDraft ? (
                <p className="text-sm text-muted-foreground">Ayarları görmek için bölüm seç.</p>
              ) : (
                <div className="space-y-4">
                  {visibleFields.map((field) => (
                    <div key={field.key} className={isWideWidget(widgetFor(field)) ? "" : ""}>
                      <SettingField
                        storeId={storeId}
                        id={`${selected.id}-${field.key}`}
                        field={field}
                        value={selectedDraft.settings[field.key] ?? ""}
                        onChange={(next) => setSetting(field.key, next)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {selected && selectedDraft ? (
              <div className="border-t border-border p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() =>
                    pushDraft({
                      order: draft.order,
                      items: {
                        ...draft.items,
                        [selected.id]: {
                          ...selectedDraft,
                          settings: { ...selected.definition.defaults },
                        },
                      },
                    })
                  }
                >
                  <RotateCcw className="mr-2 size-4" /> Varsayılanlara dön
                </Button>
              </div>
            ) : null}
          </aside>
        </div>
      </div>

      <AddSectionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        usedTypes={(sections ?? []).map((section) => section.type)}
        onAdd={(type) => addMutation.mutate(type)}
      />
    </div>
  );
}
