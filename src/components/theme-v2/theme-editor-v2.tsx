import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Copy, ExternalLink, Layers, Loader2, Palette, Plus, Redo2, Save, Sparkles, Undo2, Upload } from "lucide-react";
import { toast } from "sonner";

import { DeviceFrame, DeviceSwitcher, type PreviewDevice } from "@/components/device-preview";
import { StudioField } from "@/components/theme-studio/studio-field";
import { StudioFieldProvider } from "@/components/theme-studio/fields/studio-context";
import { ImagePickerField } from "@/components/theme-studio/fields/studio-image-field";
import { V2ErrorState } from "@/components/v2/feature-gate";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { storeQuery } from "@/lib/store-queries";
import { storefrontQuery } from "@/lib/storefront-queries";
import {
  V2_BLOCKS,
  V2_GLOBAL_GROUPS,
  V2_PAGE_LABELS,
  V2_SECTIONS,
  V2_SECTION_TYPES,
  blockSettings,
  globalSettings,
  historyInit,
  historyPush,
  historyRedo,
  historyUndo,
  pageKey,
  presetToPages,
  sectionSettings,
  type History,
  type V2BlockType,
  type V2PageType,
  type V2Section,
  type V2SectionType,
  type V2Settings,
  type V2Value,
} from "@/lib/theme-v2";
import { v2ApplyPreset, v2Bootstrap, v2ListPresets, v2LoadPage, v2Publish, v2SavePage, v2ThemeAction } from "@/lib/theme-v2.functions";
import { cn } from "@/lib/utils";

import { PageRenderer, type V2RenderContext } from "./page-renderer";
import { SectionTree, arrayMove } from "./section-tree";

type Doc = { settings: V2Settings; sections: V2Section[] };
const IMAGE_KEYS = new Set(["background_url", "image_url", "src_url", "logo_url", "favicon_url"]);
const isColorKey = (k: string) => k.startsWith("color_") || k.startsWith("dark_color_") || k === "button_bg" || k === "button_text";
const EDITOR_PAGES: V2PageType[] = ["home", "product", "collection", "cart", "blog", "article", "custom"];
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `n${Date.now()}${Math.random().toString(36).slice(2)}`);

function findNode(sections: V2Section[], id: string | null) {
  if (!id) return null;
  for (const s of sections) {
    if (s.id === id) return { kind: "section" as const, section: s };
    const b = s.blocks.find((x) => x.id === id);
    if (b) return { kind: "block" as const, section: s, block: b };
  }
  return null;
}

function mapNode(sections: V2Section[], id: string, fn: (settings: V2Settings, visible: boolean) => { settings: V2Settings; visible: boolean }): V2Section[] {
  return sections.map((s) => {
    if (s.id === id) return { ...s, ...fn(s.settings, s.visible) };
    if (!s.blocks.some((b) => b.id === id)) return s;
    return { ...s, blocks: s.blocks.map((b) => (b.id === id ? { ...b, ...fn(b.settings, b.visible) } : b)) };
  });
}

function SettingsForm({ fields, values, idPrefix, onChange }: { fields: typeof V2_BLOCKS.heading.fields; values: V2Settings; idPrefix: string; onChange: (key: string, v: V2Value) => void }) {
  return (
    <div className="space-y-3.5">
      {fields.map((field) => {
        const id = `${idPrefix}-${field.key}`;
        const value = values[field.key] ?? "";
        if (IMAGE_KEYS.has(field.key)) {
          return <ImagePickerField key={field.key} id={id} label={field.label} help={field.help} value={String(value)} onChange={(v) => onChange(field.key, v)} />;
        }
        if (isColorKey(field.key)) {
          const hex = /^#[0-9a-f]{6}$/i.test(String(value)) ? String(value) : "#000000";
          return (
            <div key={field.key} className="flex items-center justify-between gap-3">
              <label htmlFor={id} className="text-sm">{field.label}</label>
              <div className="flex items-center gap-2">
                <input id={id} type="color" value={hex} onChange={(e) => onChange(field.key, e.target.value)} className="size-9 cursor-pointer rounded-md border bg-transparent p-0.5" aria-label={field.label} />
                <input value={String(value)} onChange={(e) => onChange(field.key, e.target.value)} className="h-9 w-24 rounded-md border bg-background px-2 font-mono text-xs" aria-label={`${field.label} kodu`} placeholder="#000000" />
              </div>
            </div>
          );
        }
        const f = field.key === "product_id" ? { ...field, key: "product_handle" } : field;
        return <StudioField key={field.key} id={id} field={f} value={value} onChange={(v) => onChange(field.key, v)} />;
      })}
    </div>
  );
}

export function ThemeEditorV2({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const bootstrap = useServerFn(v2Bootstrap);
  const loadPage = useServerFn(v2LoadPage);
  const savePage = useServerFn(v2SavePage);
  const publish = useServerFn(v2Publish);
  const themeAction = useServerFn(v2ThemeAction);
  const listPresets = useServerFn(v2ListPresets);
  const applyPreset = useServerFn(v2ApplyPreset);

  const { data: store } = useQuery(storeQuery(storeId));
  const { data: storefront } = useQuery({ ...storefrontQuery(store?.slug ?? ""), enabled: Boolean(store?.slug) });
  const boot = useQuery({ queryKey: ["v2-theme-boot", storeId], queryFn: () => bootstrap({ data: { storeId } }), retry: false });

  const [themeId, setThemeId] = useState<string | null>(null);
  const [pageType, setPageType] = useState<V2PageType>("home");
  const [handle, setHandle] = useState("sayfa");
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [leftTab, setLeftTab] = useState<"sections" | "theme">("sections");
  const [mobilePane, setMobilePane] = useState<"list" | "preview">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<History<Doc> | null>(null);
  const [savedDoc, setSavedDoc] = useState<Doc | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; label: string } | null>(null);

  useEffect(() => {
    const themes = boot.data?.themes ?? [];
    if (!themeId && themes.length) setThemeId((themes.find((t) => t.status === "active") ?? themes[0])!.id);
  }, [boot.data, themeId]);

  const pHandle = pageType === "custom" ? handle : null;
  const key = themeId ? `v2draft:${themeId}:${pageKey(pageType, pHandle)}` : null;
  const page = useQuery({
    queryKey: ["v2-theme-page", storeId, themeId, pageType, pHandle],
    queryFn: () => loadPage({ data: { storeId, themeId: themeId!, pageType, handle: pHandle } }),
    enabled: Boolean(themeId) && boot.isSuccess,
    staleTime: Infinity,
  });

  // Sunucu verisi geldiğinde geçmişi başlat; kaydedilmemiş taslak varsa geri yükle.
  useEffect(() => {
    if (!page.data || !key) return;
    const server: Doc = { settings: globalSettings(page.data.theme.settings), sections: page.data.sections };
    setSavedDoc(server);
    let initial = server;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const draft = JSON.parse(raw) as Doc;
        if (draft && Array.isArray(draft.sections)) {
          initial = { settings: globalSettings(draft.settings), sections: draft.sections };
          toast.info("Kaydedilmemiş taslağın geri yüklendi.");
        }
      }
    } catch {
      /* bozuk taslak yok sayılır */
    }
    setHistory(historyInit(initial));
    setSelectedId(null);
  }, [page.data, key]);

  const doc = history?.present ?? null;
  const dirty = Boolean(doc && savedDoc && doc !== savedDoc && JSON.stringify(doc) !== JSON.stringify(savedDoc));

  useEffect(() => {
    if (!key || !doc) return;
    try {
      if (dirty) window.localStorage.setItem(key, JSON.stringify(doc));
      else window.localStorage.removeItem(key);
    } catch {
      /* depolama dolu olabilir */
    }
  }, [doc, dirty, key]);

  const commit = useCallback((fn: (d: Doc) => Doc) => setHistory((h) => (h ? historyPush(h, fn(h.present)) : h)), []);
  const undo = useCallback(() => setHistory((h) => (h ? historyUndo(h) : h)), []);
  const redo = useCallback(() => setHistory((h) => (h ? historyRedo(h) : h)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable=true]")) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // Değer girişlerini tek adımda birleştir (yazarken her harf ayrı adım olmasın).
  const lastEdit = useRef<{ id: string; key: string; at: number } | null>(null);
  const setValue = (id: string, k: string, v: V2Value) => {
    const now = Date.now();
    const merge = lastEdit.current && lastEdit.current.id === id && lastEdit.current.key === k && now - lastEdit.current.at < 800;
    lastEdit.current = { id, key: k, at: now };
    setHistory((h) => {
      if (!h) return h;
      const next = id === "__global" ? { ...h.present, settings: { ...h.present.settings, [k]: v } } : { ...h.present, sections: mapNode(h.present.sections, id, (s, visible) => ({ settings: { ...s, [k]: v }, visible })) };
      return merge ? { ...h, present: next } : historyPush(h, next);
    });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!doc || !page.data || !themeId) return;
      await savePage({ data: { storeId, themeId, pageId: page.data.pageId, settings: doc.settings, sections: doc.sections } });
    },
    onSuccess: async () => {
      if (key) window.localStorage.removeItem(key);
      toast.success("Taslak kaydedildi.");
      await qc.invalidateQueries({ queryKey: ["v2-theme-page", storeId, themeId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Kaydedilemedi"),
  });

  const pub = useMutation({
    mutationFn: async () => {
      if (dirty) await save.mutateAsync();
      await publish({ data: { storeId, themeId: themeId! } });
    },
    onSuccess: async () => {
      toast.success("Tema yayınlandı. Vitrin birkaç saniye içinde güncellenir.");
      await qc.invalidateQueries({ queryKey: ["v2-theme-boot", storeId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Yayınlanamadı"),
  });

  const action = useMutation({
    mutationFn: (a: "create" | "duplicate") => themeAction({ data: { storeId, action: a, ...(themeId ? { themeId } : {}), ...(a === "create" ? { name: "Yeni tema" } : {}) } }),
    onSuccess: async (res, a) => {
      toast.success(a === "create" ? "Yeni tema oluşturuldu." : "Tema kopyalandı.");
      await qc.invalidateQueries({ queryKey: ["v2-theme-boot", storeId] });
      if (res && typeof res === "object" && "id" in res) setThemeId(String(res.id));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "İşlem başarısız"),
  });

  const flags = boot.data?.flags ?? { presets: false, customHtml: false };
  const products = storefront?.products ?? [];
  const collections = storefront?.collections ?? [];
  const ctx: V2RenderContext = {
    storeSlug: store?.slug ?? "",
    currency: store?.currency ?? "TRY",
    products: products as V2RenderContext["products"],
    collections,
    blogPages: (storefront?.blogPages ?? []) as NonNullable<V2RenderContext["blogPages"]>,
    editing: { selectedId },
  };

  const selected = doc ? findNode(doc.sections, selectedId) : null;

  const addSection = (type: V2SectionType) => {
    const def = V2_SECTIONS[type];
    const id = uid();
    const defaultBlocks: V2BlockType[] = type === "hero" ? ["heading", "paragraph", "button"] : type === "rich_text" || type === "image_with_text" || type === "banner" ? ["heading", "paragraph"] : [];
    commit((d) => ({ ...d, sections: [...d.sections, { id, type, visible: true, settings: sectionSettings(type), blocks: defaultBlocks.filter((b) => def.blocks.includes(b)).map((b) => ({ id: uid(), type: b, visible: true, settings: blockSettings(b) })) }] }));
    setSelectedId(id);
    setAddOpen(false);
  };

  const remove = (id: string) => {
    commit((d) => ({ ...d, sections: d.sections.filter((s) => s.id !== id).map((s) => ({ ...s, blocks: s.blocks.filter((b) => b.id !== id) })) }));
    if (selectedId === id) setSelectedId(null);
  };

  const pickFromCanvas = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest("[data-v2-block], [data-v2-section]");
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(el.getAttribute("data-v2-block") ?? el.getAttribute("data-v2-section"));
  };

  if (boot.isError) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <V2ErrorState error={boot.error} />
        <Button asChild variant="ghost" className="mt-4"><Link to="/store/$storeId" params={{ storeId }}><ArrowLeft className="mr-1.5 size-4" /> Panele dön</Link></Button>
      </div>
    );
  }

  const inspector = selected ? (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold">{selected.kind === "block" ? V2_BLOCKS[selected.block.type].label : V2_SECTIONS[selected.section.type].label}</p>
        <p className="text-xs text-muted-foreground">{selected.kind === "block" ? V2_BLOCKS[selected.block.type].description : V2_SECTIONS[selected.section.type].description}</p>
      </div>
      <SettingsForm
        idPrefix={selectedId!}
        fields={selected.kind === "block" ? V2_BLOCKS[selected.block.type].fields : V2_SECTIONS[selected.section.type].fields}
        values={selected.kind === "block" ? selected.block.settings : selected.section.settings}
        onChange={(k, v) => setValue(selectedId!, k, v)}
      />
    </div>
  ) : (
    <p className="py-10 text-center text-sm text-muted-foreground">Ayarlarını görmek için bir bölüm ya da blok seç. Önizlemede de tıklayabilirsin.</p>
  );

  const globalPanel = doc ? (
    <div className="space-y-2">
      {V2_GLOBAL_GROUPS.map((group) => {
        const locked = group.flag === "v2_dark_mode" && !boot.data?.flags.darkMode;
        return (
          <details key={group.id} className="group rounded-lg border" open={group.id === "colors"}>
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-sm font-medium">
              {group.label}
              <span className="text-xs text-muted-foreground group-open:rotate-180">▾</span>
            </summary>
            <div className="border-t p-3">
              {locked ? (
                <p className="text-xs text-muted-foreground">Koyu mod paketinde kapalı.</p>
              ) : (
                <SettingsForm idPrefix={`g-${group.id}`} fields={group.fields} values={doc.settings} onChange={(k, v) => setValue("__global", k, v)} />
              )}
            </div>
          </details>
        );
      })}
    </div>
  ) : null;

  const tree = doc ? (
    <SectionTree
      sections={doc.sections}
      selectedId={selectedId}
      allowHtml={flags.customHtml}
      onSelect={setSelectedId}
      onReorderSections={(from, to) => commit((d) => ({ ...d, sections: arrayMove(d.sections, from, to) }))}
      onReorderBlocks={(sid, from, to) => commit((d) => ({ ...d, sections: d.sections.map((s) => (s.id === sid ? { ...s, blocks: arrayMove(s.blocks, from, to) } : s)) }))}
      onToggle={(id) => commit((d) => ({ ...d, sections: mapNode(d.sections, id, (settings, visible) => ({ settings, visible: !visible })) }))}
      onDelete={(id, label) => setConfirmDelete({ id, label })}
      onAddBlock={(sid, type) => {
        const id = uid();
        commit((d) => ({ ...d, sections: d.sections.map((s) => (s.id === sid ? { ...s, blocks: [...s.blocks, { id, type, visible: true, settings: blockSettings(type) }] } : s)) }));
        setSelectedId(id);
      }}
      onAddSection={() => setAddOpen(true)}
    />
  ) : null;

  const preview = doc ? (
    <div onClickCapture={pickFromCanvas}>
      <DeviceFrame device={device}>
        <PageRenderer sections={doc.sections} settings={doc.settings} ctx={ctx} />
      </DeviceFrame>
    </div>
  ) : null;

  const loading = boot.isLoading || page.isLoading || !doc;

  return (
    <StudioFieldProvider value={{ storeId, products: products.map((p) => ({ id: p.id, title: p.title, slug: p.slug })), collections: collections.map((c) => ({ id: c.id, title: c.title, slug: c.slug })) }}>
      <div className="flex h-dvh flex-col bg-background">
        {/* Üst çubuk */}
        <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          <Button asChild variant="ghost" size="icon" className="size-11" aria-label="Panele dön">
            <Link to="/store/$storeId" params={{ storeId }}><ArrowLeft className="size-4" /></Link>
          </Button>
          <Select value={themeId ?? ""} onValueChange={(v) => setThemeId(v)}>
            <SelectTrigger className="h-11 w-40 sm:w-48"><SelectValue placeholder="Tema" /></SelectTrigger>
            <SelectContent>
              {(boot.data?.themes ?? []).filter((t) => t.status !== "archived").map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}{t.status === "active" ? " · Yayında" : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={pageType} onValueChange={(v) => setPageType(v as V2PageType)}>
            <SelectTrigger className="h-11 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{EDITOR_PAGES.map((p) => <SelectItem key={p} value={p}>{V2_PAGE_LABELS[p]}</SelectItem>)}</SelectContent>
          </Select>
          {pageType === "custom" ? (
            <input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80) || "sayfa")} aria-label="Sayfa adresi" className="h-11 w-28 rounded-md border border-input bg-background px-2 text-sm" />
          ) : null}
          <div className="hidden md:block"><DeviceSwitcher value={device} onChange={setDevice} /></div>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-11" onClick={undo} disabled={!history?.past.length} aria-label="Geri al (Ctrl+Z)"><Undo2 className="size-4" /></Button>
            <Button variant="ghost" size="icon" className="size-11" onClick={redo} disabled={!history?.future.length} aria-label="Yinele (Ctrl+Y)"><Redo2 className="size-4" /></Button>
            {flags.presets ? <Button variant="ghost" size="icon" className="size-11" onClick={() => setPresetOpen(true)} aria-label="Hazır tasarımlar"><Sparkles className="size-4" /></Button> : null}
            <Button variant="ghost" size="icon" className="size-11" onClick={() => action.mutate("duplicate")} disabled={!themeId || action.isPending} aria-label="Temayı kopyala"><Copy className="size-4" /></Button>
            <Button variant="ghost" size="icon" className="hidden size-11 sm:inline-flex" onClick={() => action.mutate("create")} disabled={action.isPending} aria-label="Yeni tema"><Plus className="size-4" /></Button>
            {store?.slug ? <Button asChild variant="ghost" size="icon" className="size-11" aria-label="Vitrini aç" title="Vitrini aç"><a href={`/s/${store.slug}?v=${Date.now()}`} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /></a></Button> : null}
            <Button variant="outline" className="h-11" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
              {save.isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Save className="mr-1.5 size-4" />}<span className="hidden sm:inline">Kaydet</span>
            </Button>
            <Button className="h-11" onClick={() => pub.mutate()} disabled={pub.isPending || !themeId}>
              {pub.isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Upload className="mr-1.5 size-4" />}Yayınla
            </Button>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-1 items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : isMobile ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-border p-2">
              <Tabs value={mobilePane === "preview" ? "preview" : leftTab} onValueChange={(v) => { if (v === "preview") setMobilePane("preview"); else { setMobilePane("list"); setLeftTab(v as "sections" | "theme"); } }}>
                <TabsList className="grid h-11 w-full grid-cols-3">
                  <TabsTrigger value="sections" className="h-9"><Layers className="mr-1 size-4" />Bölümler</TabsTrigger>
                  <TabsTrigger value="theme" className="h-9"><Palette className="mr-1 size-4" />Tema</TabsTrigger>
                  <TabsTrigger value="preview" className="h-9">Önizleme</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {mobilePane === "preview" ? preview : leftTab === "theme" ? globalPanel : tree}
            </div>
            <Sheet open={Boolean(selected)} onOpenChange={(o) => { if (!o) setSelectedId(null); }}>
              <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
                <SheetHeader><SheetTitle>Ayarlar</SheetTitle></SheetHeader>
                <div className="px-4 pb-6">{inspector}</div>
              </SheetContent>
            </Sheet>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_320px]">
            <aside className="flex min-h-0 flex-col border-r border-border">
              <div className="p-2">
                <Tabs value={leftTab} onValueChange={(v) => setLeftTab(v as "sections" | "theme")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="sections"><Layers className="mr-1 size-3.5" />Bölümler</TabsTrigger>
                    <TabsTrigger value="theme"><Palette className="mr-1 size-3.5" />Tema ayarları</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <ScrollArea className="min-h-0 flex-1 px-2 pb-3">{leftTab === "theme" ? <div className="px-1">{globalPanel}</div> : tree}</ScrollArea>
            </aside>
            <main className="min-h-0 overflow-y-auto bg-muted/30 p-4">{preview}</main>
            <aside className="min-h-0 border-l border-border">
              <ScrollArea className="h-full p-4">{inspector}</ScrollArea>
            </aside>
          </div>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bölüm ekle</DialogTitle>
            <DialogDescription>Sayfanın sonuna eklenir; sonra sürükleyerek yerini değiştirebilirsin.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {V2_SECTION_TYPES.map((type) => {
              const def = V2_SECTIONS[type];
              const locked = type === "custom_html" && !flags.customHtml;
              return (
                <button key={type} type="button" disabled={locked} onClick={() => addSection(type)}
                  className={cn("min-h-16 rounded-xl border border-border p-3 text-left transition hover:border-primary hover:bg-primary/5", locked && "cursor-not-allowed opacity-50")}>
                  <p className="text-sm font-semibold">{def.label}</p>
                  <p className="text-xs text-muted-foreground">{locked ? "Bu pakette kapalı." : def.description}</p>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(confirmDelete)} onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDelete?.label} silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>Kaydetmeden önce "Geri al" ile geri getirebilirsin.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Vazgeç</AlertDialogCancel>
            <AlertDialogAction className="h-11" onClick={() => { if (confirmDelete) remove(confirmDelete.id); setConfirmDelete(null); }}>Sil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {presetOpen && themeId ? (
        <PresetDialog
          storeId={storeId}
          ctx={{ ...ctx, editing: undefined }}
          onClose={() => setPresetOpen(false)}
          load={() => listPresets({ data: { storeId } })}
          onApply={async (presetId, mode) => {
            if (dirty) await save.mutateAsync();
            await applyPreset({ data: { storeId, themeId, presetId, mode } });
            if (key) window.localStorage.removeItem(key);
            await qc.invalidateQueries({ queryKey: ["v2-theme-page", storeId, themeId] });
            toast.success(mode === "full" ? "Hazır tasarım sıfırdan uygulandı." : "Renk ve yazı tipleri uygulandı.");
            setPresetOpen(false);
          }}
        />
      ) : null}
    </StudioFieldProvider>
  );
}

function PresetDialog({ storeId, ctx, load, onApply, onClose }: {
  storeId: string; ctx: V2RenderContext;
  load: () => Promise<Array<{ id: string; name: string; structure: unknown }>>;
  onApply: (presetId: string, mode: "style" | "full") => Promise<void>;
  onClose: () => void;
}) {
  const presets = useQuery({ queryKey: ["v2-presets", storeId], queryFn: load });
  const [active, setActive] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const current = presets.data?.find((p) => p.id === active) ?? presets.data?.[0];
  const parsed = useMemo(() => (current ? presetToPages(current.structure, uid) : null), [current]);

  const run = async (mode: "style" | "full") => {
    if (!current) return;
    setBusy(true);
    try {
      await onApply(current.id, mode);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Uygulanamadı");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Hazır tasarımlar</DialogTitle>
          <DialogDescription>"Uygula" yalnız renk ve yazı tiplerini değiştirir. "Sıfırdan uygula" bölümleri de değiştirir.</DialogDescription>
        </DialogHeader>
        {presets.isLoading ? <Loader2 className="mx-auto size-5 animate-spin" /> : null}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(presets.data ?? []).map((p) => (
            <button key={p.id} type="button" onClick={() => setActive(p.id)} className={cn("min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium", current?.id === p.id ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{p.name}</button>
          ))}
        </div>
        {parsed ? (
          <div className="max-h-[45dvh] overflow-y-auto rounded-xl border border-border">
            <div className="pointer-events-none origin-top scale-[.6]" style={{ width: "166%" }}>
              <PageRenderer sections={parsed.pages["home"] ?? []} settings={parsed.settings} ctx={ctx} />
            </div>
          </div>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" className="h-11" disabled={busy || !current} onClick={() => run("full")}>Sıfırdan uygula</Button>
          <Button className="h-11" disabled={busy || !current} onClick={() => run("style")}>{busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}Uygula</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
