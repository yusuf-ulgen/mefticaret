import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Blocks,
  Code2,
  Eye,
  EyeOff,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { DeviceFrame, DeviceSwitcher, type PreviewDevice } from "@/components/device-preview";
import { StorefrontSections, type SectionProduct } from "@/components/storefront-sections";
import { ThemeVersionsPanel } from "@/components/theme-versions-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { collectionsQuery, productsQuery } from "@/lib/catalog-queries";
import { THEME_SECTIONS, type ResolvedSection, type SectionSettings } from "@/lib/theme-sections";
import { themeSectionsQuery } from "@/lib/theme-sections-queries";
import {
  addThemeSection,
  removeThemeSection,
  reorderThemeSections,
  resetThemeSections,
  saveThemeCode,
  updateThemeSection,
} from "@/lib/theme-sections.functions";
import { storeThemeQuery } from "@/lib/theme-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/theme-sections")({
  head: () => ({
    meta: [
      { title: "Tema Bileşenleri — Mefticaret" },
      {
        name: "description",
        content:
          "Vitrinini modüler tema bileşenleriyle kur: header, hero, banner, ürün grid, slider, SSS, newsletter, özel HTML/CSS/JS.",
      },
      { property: "og:title", content: "Tema Bileşenleri — Mefticaret" },
      {
        property: "og:description",
        content: "Sürükle-sırala modüler bileşenlerle mağaza vitrinini kod yazmadan tasarla.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ThemeSectionsPage,
});

function ThemeSectionsPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: sections, isLoading } = useQuery(themeSectionsQuery(storeId));
  const { data: theme } = useQuery(storeThemeQuery(storeId));
  const { data: products } = useQuery(productsQuery(storeId));
  const { data: collections } = useQuery(collectionsQuery(storeId));

  const add = useServerFn(addThemeSection);
  const update = useServerFn(updateThemeSection);
  const remove = useServerFn(removeThemeSection);
  const reorder = useServerFn(reorderThemeSections);
  const reset = useServerFn(resetThemeSections);
  const persistCode = useServerFn(saveThemeCode);

  const [newType, setNewType] = useState<string>(THEME_SECTIONS[0]!.type);
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [dragId, setDragId] = useState<string | null>(null);
  const [css, setCss] = useState("");
  const [js, setJs] = useState("");

  useEffect(() => {
    setCss(theme?.custom_css ?? "");
    setJs(theme?.custom_js ?? "");
  }, [theme]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["theme-sections", storeId] });

  const addMutation = useMutation({
    mutationFn: () => add({ data: { storeId, type: newType as (typeof THEME_SECTIONS)[number]["type"] } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Bileşen eklendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resetMutation = useMutation({
    mutationFn: () => reset({ data: { storeId } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Varsayılan düzen uygulandı");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const codeMutation = useMutation({
    mutationFn: () => persistCode({ data: { storeId, customCss: css, customJs: js } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["store-theme", storeId] });
      toast.success("Özel kod kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const applyOrder = async (ids: string[]) => {
    await reorder({ data: { storeId, sectionIds: ids } });
    await invalidate();
  };

  const dropOn = async (targetId: string) => {
    if (!sections || !dragId || dragId === targetId) return;
    const ids = sections.map((section) => section.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ...ids.splice(from, 1));
    setDragId(null);
    await applyOrder(ids);
    toast.success("Sıralama güncellendi");
  };

  const move = async (index: number, direction: -1 | 1) => {
    if (!sections) return;
    const ids = sections.map((section) => section.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    await applyOrder(ids);
  };

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

  const bodySections = (sections ?? []).filter(
    (section) => section.isEnabled && section.definition.slot === "body",
  );

  return (
    <AppShell storeId={storeId} title="Tema Bileşenleri">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Blocks className="size-4" /> Modüler bileşenler
            </CardTitle>
            <CardDescription>
              Vitrin sayfası, sıralanabilir bileşenlerden oluşur. Header, footer ve duyuru çubuğu tüm
              sayfalarda; diğer bileşenler ana sayfada görünür.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="grid gap-2">
              <Label>Bileşen ekle</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="w-[260px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THEME_SECTIONS.map((section) => (
                    <SelectItem key={section.type} value={section.type}>
                      {section.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
              <Plus className="mr-2 size-4" /> Ekle
            </Button>
            <Button
              variant="outline"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
            >
              <RotateCcw className="mr-2 size-4" /> Varsayılan düzen
            </Button>
          </CardContent>
        </Card>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Bileşenler yükleniyor…</p>
        ) : (sections ?? []).length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Henüz bileşen tanımlanmadı. “Varsayılan düzen” ile hızlı başlayabilirsin — o zamana kadar
              vitrin klasik şablonla yayınlanır.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {(sections ?? []).map((section, index) => (
              <SectionEditor
                key={section.id}
                section={section}
                index={index}
                total={(sections ?? []).length}
                collections={(collections ?? []).map((collection) => collection.slug)}
                isDragging={dragId === section.id}
                onDragStart={() => setDragId(section.id)}
                onDragEnd={() => setDragId(null)}
                onDropOn={() => void dropOn(section.id)}
                onMove={move}
                onDelete={async () => {
                  await remove({ data: { storeId, sectionId: section.id } });
                  await invalidate();
                  toast.success("Bileşen kaldırıldı");
                }}
                onSave={async (settings, isEnabled) => {
                  await update({
                    data: { storeId, sectionId: section.id, type: section.type, isEnabled, settings },
                  });
                  await invalidate();
                  toast.success(`${section.definition.label} güncellendi`);
                }}
              />
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code2 className="size-4" /> Özel CSS & JavaScript
            </CardTitle>
            <CardDescription>
              Tema düzeyinde çalışır. CSS vitrinin tamamına uygulanır; JavaScript yalnızca tarayıcıda
              yürütülür.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="custom-css">Özel CSS</Label>
              <Textarea
                id="custom-css"
                value={css}
                onChange={(event) => setCss(event.target.value)}
                rows={10}
                className="font-mono text-xs"
                placeholder=".product-card { box-shadow: none; }"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="custom-js">Özel JavaScript</Label>
              <Textarea
                id="custom-js"
                value={js}
                onChange={(event) => setJs(event.target.value)}
                rows={10}
                className="font-mono text-xs"
                placeholder="console.log('merhaba');"
              />
            </div>
            <div>
              <Button onClick={() => codeMutation.mutate()} disabled={codeMutation.isPending}>
                <Save className="mr-2 size-4" /> Kodu kaydet
              </Button>
            </div>
          </CardContent>
        </Card>

        <ThemeVersionsPanel storeId={storeId} />



        <Card>
          <CardHeader>
            <CardTitle>Canlı önizleme</CardTitle>
            <CardDescription>
              Gövde bileşenleri mağaza temasıyla birlikte, seçtiğin cihaz genişliğinde önizlenir.
            </CardDescription>
            <div className="pt-2">
              <DeviceSwitcher value={device} onChange={setDevice} />
            </div>
          </CardHeader>
          <CardContent>
            {bodySections.length === 0 ? (
              <p className="text-sm text-muted-foreground">Önizlenecek aktif gövde bileşeni yok.</p>
            ) : (
              <DeviceFrame device={device}>
                <div className="p-5" style={{ background: theme?.background_color ?? "#fbf9f5" }}>
                <StorefrontSections
                  sections={sections ?? []}
                  context={{
                    theme: theme ?? null,
                    storeSlug: "preview",
                    storeName: "Önizleme",
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
              </DeviceFrame>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function SectionEditor({
  section,
  index,
  total,
  collections,
  isDragging,
  onDragStart,
  onDragEnd,
  onDropOn,
  onMove,
  onDelete,
  onSave,
}: {
  section: ResolvedSection;
  index: number;
  total: number;
  collections: string[];
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropOn: () => void;
  onMove: (index: number, direction: -1 | 1) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  onSave: (settings: SectionSettings, isEnabled: boolean) => void | Promise<void>;
}) {
  const [settings, setSettings] = useState<SectionSettings>(section.settings);
  const [enabled, setEnabled] = useState(section.isEnabled);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSettings(section.settings);
    setEnabled(section.isEnabled);
  }, [section]);

  const set = (key: string, value: string | number | boolean) =>
    setSettings((current) => ({ ...current, [key]: value }));

  return (
    <Card
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDropOn();
      }}
      className={isDragging ? "opacity-60 ring-2 ring-primary" : undefined}
    >
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            title="Sürükleyerek sırala"
            className="mt-1 cursor-grab text-muted-foreground active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </span>
          <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            {section.definition.label}
            <Badge variant={section.definition.slot === "chrome" ? "secondary" : "outline"}>
              {section.definition.slot === "chrome" ? "Tüm sayfalar" : "Ana sayfa"}
            </Badge>
            {enabled ? null : <Badge variant="destructive">Kapalı</Badge>}
          </CardTitle>
          <CardDescription>{section.definition.description}</CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => onMove(index, -1)} disabled={index === 0}>
            <ArrowUp className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onMove(index, 1)}
            disabled={index === total - 1}
          >
            <ArrowDown className="size-4" />
          </Button>
          <div className="flex items-center gap-2 pl-2">
            {enabled ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Bileşeni aç/kapat" />
          </div>
          <Button variant="ghost" size="icon" onClick={() => void onDelete()}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {section.definition.fields.map((field) => {
            const id = `${section.id}-${field.key}`;
            const value = settings[field.key];
            return (
              <div
                key={field.key}
                className={
                  field.kind === "code" || field.kind === "lines" || field.kind === "textarea"
                    ? "grid gap-2 md:col-span-2"
                    : "grid gap-2"
                }
              >
                <Label htmlFor={id}>{field.label}</Label>
                {field.kind === "boolean" ? (
                  <Switch
                    id={id}
                    checked={Boolean(value)}
                    onCheckedChange={(checked) => set(field.key, checked)}
                  />
                ) : field.kind === "select" ? (
                  <Select value={String(value ?? "")} onValueChange={(next) => set(field.key, next)}>
                    <SelectTrigger id={id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(field.options ?? []).map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.kind === "number" ? (
                  <Input
                    id={id}
                    type="number"
                    min={field.min}
                    max={field.max}
                    value={Number(value ?? 0)}
                    onChange={(event) => set(field.key, Number(event.target.value))}
                  />
                ) : field.kind === "textarea" || field.kind === "lines" || field.kind === "code" ? (
                  <Textarea
                    id={id}
                    rows={field.kind === "code" ? 8 : 4}
                    className={field.kind === "code" ? "font-mono text-xs" : undefined}
                    value={String(value ?? "")}
                    onChange={(event) => set(field.key, event.target.value)}
                  />
                ) : (
                  <Input
                    id={id}
                    value={String(value ?? "")}
                    placeholder={field.placeholder}
                    onChange={(event) => set(field.key, event.target.value)}
                  />
                )}
                {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
                {field.key === "collectionSlug" && collections.length ? (
                  <p className="text-xs text-muted-foreground">
                    Koleksiyon slugları: {collections.slice(0, 6).join(", ")}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
        <Button
          onClick={async () => {
            setBusy(true);
            try {
              await onSave(settings, enabled);
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
        >
          <Save className="mr-2 size-4" /> Kaydet
        </Button>
      </CardContent>
    </Card>
  );
}
