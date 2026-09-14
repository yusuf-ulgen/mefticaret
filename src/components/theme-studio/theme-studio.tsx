import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Layers,
  Loader2,
  MousePointerClick,
  Plus,
  Redo2,
  Rocket,
  Save,
  Settings2,
  Undo2,
} from "lucide-react";

import { ThemeSettingsDialog } from "@/components/theme-editor/theme-settings-dialog";
import { ThemeSettingsPanel } from "@/components/theme-editor/theme-settings-panel";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resolveDesignTokens } from "@/lib/theme-design";
import { SECTION_BY_TYPE } from "@/lib/theme-sections";
import { cn } from "@/lib/utils";

import { StudioFieldProvider } from "./fields/studio-context";
import { StudioAddSection } from "./studio-add-section";
import { PREVIEW_DEVICES, PREVIEW_PAGES, StudioCanvas, type PreviewDevice, type PreviewPage } from "./studio-canvas";
import { StudioInspector } from "./studio-inspector";
import { StudioSectionList } from "./studio-section-list";
import { StudioVersions } from "./studio-versions";
import { useThemeStudio } from "./use-theme-studio";

type Pane = "sections" | "preview" | "inspector";

/**
 * Tema Stüdyosu: üç panelli (bölümler / canlı önizleme / ayarlar) vitrin editörü.
 * Satıcı panelinde ve süper yönetici panelinde aynı bileşen kullanılır.
 */
export function ThemeStudio({ storeId, backTo }: { storeId: string; backTo: "store" | "admin" }) {
  const studio = useThemeStudio(storeId);

  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [page, setPage] = useState<PreviewPage>("home");
  const [zoom, setZoom] = useState(1);
  const [inspectorMode, setInspectorMode] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"sections" | "theme">("sections");
  const [addOpen, setAddOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [pane, setPane] = useState<Pane>("preview");

  const { save, dirty, saving, undo, redo } = studio;
  const selectedId = studio.selectedId;

  // Klavye kısayolları: kaydet, geri al/yinele, kopyala, gizle, sil, bölüm ekle.
  useEffect(() => {
    const isTyping = (target: EventTarget | null) => {
      const node = target as HTMLElement | null;
      if (!node) return false;
      return (
        node.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(node.tagName)
      );
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        studio.setSelectedId(null);
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && !isTyping(event.target)) {
        if (!selectedId) return;
        event.preventDefault();
        studio.deleteSection(selectedId);
        return;
      }
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        if (dirty && !saving) save();
      } else if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redo();
      } else if (key === "d" && selectedId) {
        event.preventDefault();
        studio.duplicateSection(selectedId);
      } else if (key === "h" && selectedId) {
        event.preventDefault();
        studio.toggleSection(selectedId);
      } else if (key === "a" && event.shiftKey) {
        event.preventDefault();
        setAddOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, redo, save, saving, selectedId, studio, undo]);

  // Kaydedilmemiş değişiklikle sayfadan ayrılma uyarısı.
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const slug = studio.store?.slug ?? null;

  const pagePath = useMemo(() => {
    if (!slug || page === "home") return null;
    if (page === "product") {
      const first = studio.products[0]?.slug;
      return first ? `/s/${slug}/p/${first}` : null;
    }
    if (page === "collection") {
      const first = studio.collections[0]?.slug;
      return first ? `/s/${slug}/c/${first}` : `/s/${slug}/products`;
    }
    if (page === "cart") return `/s/${slug}/cart`;
    return `/s/${slug}/search`;
  }, [page, slug, studio.collections, studio.products]);

  const designTokens =
    studio.designDraft ?? resolveDesignTokens((studio.theme as { design_tokens?: unknown } | null)?.design_tokens);

  const selectSection = (id: string) => {
    studio.setSelectedId(id);
    setSidebarTab("sections");
    if (window.innerWidth < 1024) setPane("inspector");
  };

  const resetSelected = () => {
    const selected = studio.selected;
    if (!selected) return;
    const defaults = SECTION_BY_TYPE.get(selected.section.type)?.defaults;
    if (defaults) studio.setSettings({ ...defaults });
  };

  const status = saving ? "Kaydediliyor…" : dirty ? "Kaydedilmedi" : studio.savedAt ? "Kaydedildi" : "";

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-2 py-2 lg:h-14 lg:flex-nowrap lg:px-3 lg:py-0">
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild variant="ghost" size="icon" aria-label="Panele dön">
            {backTo === "admin" ? (
              <Link to="/admin/frontend">
                <ArrowLeft className="size-4" />
              </Link>
            ) : (
              <Link to="/store/$storeId/dashboard" params={{ storeId }}>
                <ArrowLeft className="size-4" />
              </Link>
            )}
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{studio.store?.name ?? "Tema Stüdyosu"}</p>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">Tema Stüdyosu</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center gap-1.5">
          <select
            aria-label="Önizlenen sayfa"
            value={page}
            onChange={(event) => setPage(event.target.value as PreviewPage)}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs font-medium"
          >
            {PREVIEW_PAGES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
          <div className="flex items-center rounded-md border border-border p-0.5">
            {PREVIEW_DEVICES.map((entry) => (
              <Button
                key={entry.value}
                size="icon"
                variant={device === entry.value ? "secondary" : "ghost"}
                className="size-7"
                onClick={() => setDevice(entry.value)}
                aria-label={entry.label}
                aria-pressed={device === entry.value}
              >
                <entry.icon className="size-3.5" />
              </Button>
            ))}
          </div>
          <select
            aria-label="Yakınlaştırma"
            value={String(zoom)}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="hidden h-8 rounded-md border border-border bg-background px-2 text-xs font-medium xl:block"
          >
            {[0.6, 0.75, 0.9, 1].map((value) => (
              <option key={value} value={value}>
                %{Math.round(value * 100)}
              </option>
            ))}
          </select>
          <Button
            size="icon"
            variant={inspectorMode ? "secondary" : "ghost"}
            className="size-8"
            onClick={() => setInspectorMode((current) => !current)}
            aria-label="Önizlemeden bölüm seç"
            aria-pressed={inspectorMode}
          >
            <MousePointerClick className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          <Button size="icon" variant="ghost" className="size-8" disabled={!studio.canUndo} onClick={undo} aria-label="Geri al">
            <Undo2 className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" className="size-8" disabled={!studio.canRedo} onClick={redo} aria-label="Yinele">
            <Redo2 className="size-4" />
          </Button>
          <span className="hidden text-[11px] text-muted-foreground xl:inline">{status}</span>
          <Button size="sm" disabled={!dirty || saving} onClick={save}>
            {saving ? (
              <Loader2 className="size-3.5 animate-spin sm:mr-1.5" />
            ) : dirty ? (
              <Save className="size-3.5 sm:mr-1.5" />
            ) : (
              <Check className="size-3.5 sm:mr-1.5" />
            )}
            <span className="hidden sm:inline">Kaydet</span>
          </Button>
          {slug ? (
            <Button asChild size="sm" variant="outline">
              <a href={`/s/${slug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Vitrini aç</span>
              </a>
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" disabled={studio.publishing} onClick={studio.publishTheme}>
            {studio.publishing ? (
              <Loader2 className="size-3.5 animate-spin sm:mr-1.5" />
            ) : (
              <Rocket className="size-3.5 sm:mr-1.5" />
            )}
            <span className="hidden sm:inline">Yayınla</span>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside
          className={cn(
            "min-h-0 w-full shrink-0 flex-col border-border bg-card lg:flex lg:w-[292px] lg:border-r",
            pane === "sections" ? "flex flex-1" : "hidden",
          )}
        >
          <div className="border-b border-border px-3 py-2">
            <Tabs value={sidebarTab} onValueChange={(value) => setSidebarTab(value as "sections" | "theme")}>
              <TabsList className="w-full">
                <TabsTrigger value="sections" className="flex-1 text-xs">
                  Bölümler
                </TabsTrigger>
                <TabsTrigger value="theme" className="flex-1 text-xs">
                  Tema ayarları
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {sidebarTab === "sections" ? (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                <span className="text-[11px] text-muted-foreground">Sürükleyerek sırala</span>
                <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                  <Plus className="mr-1 size-3.5" /> Bölüm ekle
                </Button>
              </div>
              <ScrollArea className="min-h-0 flex-1 px-2 py-2">
                {studio.isLoading ? (
                  <p className="p-3 text-sm text-muted-foreground" aria-busy="true">
                    Yükleniyor…
                  </p>
                ) : studio.items.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    Henüz bölüm yok. “Bölüm ekle” ile ilk bölümünü oluştur.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {(["header", "body", "footer"] as const).map((group) => (
                      <StudioSectionList
                        key={group}
                        group={group}
                        items={studio.groups[group]}
                        selectedId={studio.selectedId}
                        onSelect={selectSection}
                        onReorder={(ids) => studio.reorderGroup(group, ids)}
                        onToggle={studio.toggleSection}
                        onDuplicate={studio.duplicateSection}
                        onDelete={studio.deleteSection}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </>
          ) : (
            <ScrollArea className="min-h-0 flex-1 px-3 py-3">
              <ThemeSettingsPanel
                storeId={storeId}
                theme={studio.theme}
                onOpenBrandDialog={() => setBrandOpen(true)}
                onDraftChange={studio.setDesignDraft}
              />
            </ScrollArea>
          )}
        </aside>

        <main className={cn("flex min-h-0 min-w-0 flex-1 flex-col", pane === "preview" ? "flex" : "hidden lg:flex")}>
          <StudioCanvas
            device={device}
            page={page}
            zoom={zoom}
            inspector={inspectorMode}
            pagePath={pagePath}
            sections={studio.previewSections}
            designTokens={designTokens}
            theme={studio.theme}
            storeSlug={slug ?? "preview"}
            storeName={studio.store?.name ?? "Önizleme"}
            storeCurrency={studio.store?.currency ?? "TRY"}
            products={studio.previewProducts}
            collections={studio.previewCollections}
            commerce={studio.previewCommerce}
            onPickSection={selectSection}
          />
        </main>

        <aside
          className={cn(
            "min-h-0 w-full shrink-0 flex-col border-border bg-card lg:flex lg:w-[320px] lg:border-l",
            pane === "inspector" ? "flex flex-1" : "hidden",
          )}
        >
          <StudioInspector
            item={studio.selected}
            onChange={studio.setSetting}
            onReset={resetSelected}
            onToggle={() => studio.selected && studio.toggleSection(studio.selected.id)}
            onDelete={() => studio.selected && studio.deleteSection(studio.selected.id)}
          />
        </aside>

        {/* Mobil panel geçişi */}
        <nav
          aria-label="Editör panelleri"
          className="flex shrink-0 items-center justify-around border-t border-border bg-card lg:hidden"
        >
          <PaneButton active={pane === "sections"} onClick={() => setPane("sections")} label="Bölümler">
            <Layers className="size-4" />
          </PaneButton>
          <PaneButton active={pane === "preview"} onClick={() => setPane("preview")} label="Önizleme">
            <MousePointerClick className="size-4" />
          </PaneButton>
          <PaneButton active={pane === "inspector"} onClick={() => setPane("inspector")} label="Ayarlar">
            <Settings2 className="size-4" />
          </PaneButton>
        </nav>
      </div>

      <StudioAddSection
        open={addOpen}
        onOpenChange={setAddOpen}
        pending={studio.adding}
        onAdd={(type) => {
          studio.addSection(type);
          setAddOpen(false);
        }}
      />
      <ThemeSettingsDialog storeId={storeId} theme={studio.theme} open={brandOpen} onOpenChange={setBrandOpen} />
    </div>
  );
}

function PaneButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {children}
      {label}
    </button>
  );
}
