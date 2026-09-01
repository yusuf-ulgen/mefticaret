import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ExternalLink, ImageUp, Palette, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { DeviceFrame, DeviceSwitcher, type PreviewDevice } from "@/components/device-preview";
import { StorefrontPreview, type ThemeDraft } from "@/components/storefront-preview";
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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { productsQuery } from "@/lib/catalog-queries";
import { uploadStoreLogo } from "@/lib/media";
import { myStoresQuery } from "@/lib/store-queries";
import { FONT_PAIRS, THEME_LAYOUTS, THEME_PRESETS } from "@/lib/theme-presets";
import { storeThemeQuery } from "@/lib/theme-queries";
import { saveTheme } from "@/lib/theme.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/store/$storeId/themes")({
  head: () => ({
    meta: [
      { title: "Tema Editörü — Mefticaret" },
      {
        name: "description",
        content:
          "Mağaza vitrinini hazır şablonlar, renkler, tipografi ve hero içerikleriyle canlı önizlemeli düzenle.",
      },
      { property: "og:title", content: "Tema Editörü — Mefticaret" },
      {
        property: "og:description",
        content: "Görsel tema editörü ile vitrinini kod yazmadan tasarla ve yayınla.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ThemesPage,
});

const DEFAULT_DRAFT: ThemeDraft & { preset: string; isPublished: boolean } = {
  preset: "ink-saffron",
  primaryColor: "#1f2933",
  accentColor: "#e0a136",
  backgroundColor: "#fbf9f5",
  fontPair: "sora-manrope",
  radius: 0.75,
  layout: "hero-grid",
  heroTitle: "Yeni sezon burada",
  heroSubtitle: "Seçkin parçalar, hızlı teslimat, güvenli ödeme.",
  heroCtaLabel: "Koleksiyonu keşfet",
  announcement: "",
  showAnnouncement: false,
  isPublished: false,
  logoUrl: "",
  buttonStyle: "solid",
  cardStyle: "soft",
  contentWidth: 1140,
  sectionSpacing: 48,
};

const BUTTON_STYLES = [
  { value: "solid", label: "Dolgulu" },
  { value: "outline", label: "Çerçeveli" },
  { value: "pill", label: "Kapsül" },
  { value: "ghost", label: "Yumuşak" },
  { value: "square", label: "Keskin köşe" },
];

const CARD_STYLES = [
  { value: "soft", label: "Yumuşak kart" },
  { value: "bordered", label: "Çerçeveli kart" },
  { value: "flat", label: "Çerçevesiz" },
  { value: "shadow", label: "Gölgeli" },
];

function ThemesPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: theme, isLoading } = useQuery(storeThemeQuery(storeId));
  const { data: products } = useQuery(productsQuery(storeId));
  const { user } = useAuth();
  const { data: stores } = useQuery(myStoresQuery(user?.id));
  const persist = useServerFn(saveTheme);

  const [draft, setDraft] = useState(DEFAULT_DRAFT);

  useEffect(() => {
    if (!theme) return;
    setDraft({
      preset: theme.preset,
      primaryColor: theme.primary_color,
      accentColor: theme.accent_color,
      backgroundColor: theme.background_color,
      fontPair: theme.font_pair,
      radius: Number(theme.radius),
      layout: theme.layout,
      heroTitle: theme.hero_title,
      heroSubtitle: theme.hero_subtitle,
      heroCtaLabel: theme.hero_cta_label,
      announcement: theme.announcement ?? "",
      showAnnouncement: theme.show_announcement,
      isPublished: theme.is_published,
      logoUrl: theme.logo_url ?? "",
      buttonStyle: theme.button_style ?? "solid",
      cardStyle: theme.card_style ?? "soft",
      contentWidth: Number(theme.content_width ?? 1140),
      sectionSpacing: Number(theme.section_spacing ?? 48),
    });
  }, [theme]);

  const currentStore = stores?.find((row) => row.id === storeId);
  const storeName = currentStore?.name ?? "Mağazam";
  const storeSlug = currentStore?.slug ?? null;

  const mutation = useMutation({
    mutationFn: () =>
      persist({
        data: {
          storeId,
          preset: draft.preset,
          primaryColor: draft.primaryColor,
          accentColor: draft.accentColor,
          backgroundColor: draft.backgroundColor,
          fontPair: draft.fontPair,
          radius: draft.radius,
          layout: draft.layout,
          heroTitle: draft.heroTitle,
          heroSubtitle: draft.heroSubtitle,
          heroCtaLabel: draft.heroCtaLabel,
          announcement: draft.announcement || null,
          showAnnouncement: draft.showAnnouncement,
          isPublished: draft.isPublished,
          logoUrl: draft.logoUrl || null,
          buttonStyle: draft.buttonStyle as "solid",
          cardStyle: draft.cardStyle as "soft",
          contentWidth: draft.contentWidth,
          sectionSpacing: draft.sectionSpacing,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["store-theme", storeId] });
      toast.success(draft.isPublished ? "Tema kaydedildi ve yayında" : "Tema taslak olarak kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [uploading, setUploading] = useState(false);

  const handleLogo = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadStoreLogo(storeId, file);
      setDraft((current) => ({ ...current, logoUrl: url }));
      toast.success("Logo yüklendi, kaydetmeyi unutma");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <AppShell
      storeId={storeId}
      title="Tema editörü"
      description="Vitrin görünümünü hazır şablon, renk, tipografi ve hero içerikleriyle tasarla."
      actions={
        <div className="flex items-center gap-2">
          {storeSlug ? (
            <Button asChild variant="outline" className="gap-2">
              <Link to="/s/$slug" params={{ slug: storeSlug }} target="_blank">
                <ExternalLink className="size-4" />
                Vitrini gör
              </Link>
            </Button>
          ) : null}
          <Button className="gap-2" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            <Save className="size-4" />
            Kaydet
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          <section className="surface-card space-y-4 p-5">
            <header className="flex items-center gap-2">
              <Palette className="size-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wide">Hazır şablonlar</h2>
            </header>
            <div className="grid gap-3 sm:grid-cols-2">
              {THEME_PRESETS.map((preset) => (
                <button
                  key={preset.code}
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      preset: preset.code,
                      primaryColor: preset.primary,
                      accentColor: preset.accent,
                      backgroundColor: preset.background,
                      fontPair: preset.fontPair,
                      radius: preset.radius,
                      layout: preset.layout,
                    }))
                  }
                  className={cn(
                    "rounded-xl border p-3 text-left transition hover:border-primary",
                    draft.preset === preset.code ? "border-primary ring-2 ring-primary/25" : "border-border",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{preset.name}</span>
                    {draft.preset === preset.code ? <Check className="size-4 text-primary" /> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{preset.description}</p>
                  <div className="mt-2 flex gap-1">
                    {[preset.primary, preset.accent, preset.background].map((color) => (
                      <span
                        key={color}
                        className="size-4 rounded-full border border-border"
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="surface-card space-y-4 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide">Renkler & tipografi</h2>
            {(
              [
                ["primaryColor", "Ana renk"],
                ["accentColor", "Vurgu rengi"],
                ["backgroundColor", "Zemin rengi"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{label}</Label>
                <div className="flex gap-2">
                  <input
                    id={key}
                    type="color"
                    className="h-10 w-14 cursor-pointer rounded-md border border-border bg-transparent"
                    value={draft[key]}
                    onChange={(event) => set(key, event.target.value)}
                  />
                  <Input value={draft[key]} onChange={(event) => set(key, event.target.value)} />
                </div>
              </div>
            ))}

            <div className="space-y-2">
              <Label>Yazı tipi ikilisi</Label>
              <Select value={draft.fontPair} onValueChange={(value) => set("fontPair", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_PAIRS.map((pair) => (
                    <SelectItem key={pair.value} value={pair.value}>
                      {pair.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Düzen</Label>
              <Select value={draft.layout} onValueChange={(value) => set("layout", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THEME_LAYOUTS.map((layout) => (
                    <SelectItem key={layout.value} value={layout.value}>
                      {layout.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Köşe yumuşaklığı: {draft.radius.toFixed(2)}rem</Label>
              <Slider
                min={0}
                max={2}
                step={0.05}
                value={[draft.radius]}
                onValueChange={([value]) => set("radius", value ?? 0)}
              />
            </div>
          </section>

          <section className="surface-card space-y-4 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide">Logo & bileşenler</h2>

            <div className="space-y-2">
              <Label>Logo</Label>
              {draft.logoUrl ? (
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <img src={draft.logoUrl} alt="Mağaza logosu" className="h-10 w-auto" />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => set("logoUrl", "")}
                    aria-label="Logoyu kaldır"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ) : null}
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground hover:border-primary">
                <ImageUp className="size-4" />
                {uploading ? "Yükleniyor…" : "Logo yükle (PNG, SVG, JPG)"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleLogo(file);
                    event.target.value = "";
                  }}
                />
              </label>
              <Input
                placeholder="veya logo adresi (https://…)"
                value={draft.logoUrl}
                onChange={(event) => set("logoUrl", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Buton stili</Label>
              <Select value={draft.buttonStyle} onValueChange={(value) => set("buttonStyle", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUTTON_STYLES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ürün kartı stili</Label>
              <Select value={draft.cardStyle} onValueChange={(value) => set("cardStyle", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARD_STYLES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>İçerik genişliği: {draft.contentWidth}px</Label>
              <Slider
                min={900}
                max={1600}
                step={20}
                value={[draft.contentWidth]}
                onValueChange={([value]) => set("contentWidth", value ?? 1140)}
              />
            </div>

            <div className="space-y-2">
              <Label>Bölüm boşluğu: {draft.sectionSpacing}px</Label>
              <Slider
                min={0}
                max={140}
                step={4}
                value={[draft.sectionSpacing]}
                onValueChange={([value]) => set("sectionSpacing", value ?? 48)}
              />
            </div>
          </section>

          <section className="surface-card space-y-4 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide">Vitrin içeriği</h2>
            <div className="space-y-2">
              <Label htmlFor="hero-title">Hero başlık</Label>
              <Input
                id="hero-title"
                value={draft.heroTitle}
                onChange={(event) => set("heroTitle", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hero-sub">Hero alt başlık</Label>
              <Textarea
                id="hero-sub"
                rows={2}
                value={draft.heroSubtitle}
                onChange={(event) => set("heroSubtitle", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hero-cta">Buton yazısı</Label>
              <Input
                id="hero-cta"
                value={draft.heroCtaLabel}
                onChange={(event) => set("heroCtaLabel", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="announcement">Duyuru çubuğu</Label>
              <Input
                id="announcement"
                placeholder="Örn. 500 TL üzeri kargo bedava"
                value={draft.announcement}
                onChange={(event) => set("announcement", event.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm">Duyuruyu göster</span>
              <Switch
                checked={draft.showAnnouncement}
                onCheckedChange={(value) => set("showAnnouncement", value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Yayında</p>
                <p className="text-xs text-muted-foreground">
                  Kapalıysa tema taslak kalır, ziyaretçiler göremez.
                </p>
              </div>
              <Switch
                checked={draft.isPublished}
                onCheckedChange={(value) => set("isPublished", value)}
              />
            </div>
          </section>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-sm font-semibold uppercase tracking-wide">Canlı önizleme</h2>
            <Badge variant={draft.isPublished ? "default" : "secondary"}>
              {draft.isPublished ? "Yayında" : "Taslak"}
            </Badge>
            {isLoading ? <span className="text-xs text-muted-foreground">Yükleniyor…</span> : null}
            </div>
            <DeviceSwitcher value={device} onChange={setDevice} />
          </div>
          <DeviceFrame device={device}>
            <StorefrontPreview
              theme={draft}
              storeName={storeName}
              device={device}
              products={(products ?? []).map((product) => ({
                id: product.id,
                title: product.title,
                base_price: Number(product.base_price),
                currency: product.currency,
              }))}
            />
          </DeviceFrame>
        </div>
      </div>
    </AppShell>
  );
}
