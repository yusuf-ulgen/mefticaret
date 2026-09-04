import { useEffect, useState } from "react";
import { Check, Download, Palette, Save } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FONT_PAIRS, THEME_LAYOUTS, THEME_PRESETS } from "@/lib/theme-presets";
import { saveTheme } from "@/lib/theme.functions";
import { applyThemeTemplate } from "@/lib/theme-templates.functions";
import { THEME_TEMPLATES } from "@/lib/theme-templates";

export type ThemeSettingsSource = {
  preset: string;
  primary_color: string;
  accent_color: string;
  background_color: string;
  font_pair: string;
  radius: number | string;
  layout: string;
  hero_title: string;
  hero_subtitle: string;
  hero_cta_label: string;
  announcement: string | null;
  show_announcement: boolean;
  is_published: boolean;
  logo_url: string | null;
  button_style: string | null;
  card_style: string | null;
  content_width: number | string | null;
  section_spacing: number | string | null;
};

type ThemeSettingsDraft = {
  preset: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  fontPair: string;
  radius: number;
  layout: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCtaLabel: string;
  announcement: string;
  showAnnouncement: boolean;
  isPublished: boolean;
  logoUrl: string;
  buttonStyle: "solid" | "outline" | "pill" | "ghost" | "square";
  cardStyle: "soft" | "bordered" | "flat" | "shadow";
  contentWidth: number;
  sectionSpacing: number;
};

const DEFAULT_DRAFT: ThemeSettingsDraft = {
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
  ["solid", "Dolgulu"],
  ["outline", "Çerçeveli"],
  ["pill", "Kapsül"],
  ["ghost", "Yumuşak"],
  ["square", "Keskin köşe"],
] as const;

const CARD_STYLES = [
  ["soft", "Yumuşak kart"],
  ["bordered", "Çerçeveli kart"],
  ["flat", "Çerçevesiz"],
  ["shadow", "Gölgeli"],
] as const;

function draftFromTheme(theme: ThemeSettingsSource | null | undefined): ThemeSettingsDraft {
  if (!theme) return DEFAULT_DRAFT;
  return {
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
    buttonStyle: (theme.button_style as ThemeSettingsDraft["buttonStyle"]) ?? "solid",
    cardStyle: (theme.card_style as ThemeSettingsDraft["cardStyle"]) ?? "soft",
    contentWidth: Number(theme.content_width ?? 1140),
    sectionSpacing: Number(theme.section_spacing ?? 48),
  };
}

export function ThemeSettingsDialog({
  open,
  onOpenChange,
  storeId,
  theme,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  theme: ThemeSettingsSource | null | undefined;
}) {
  const queryClient = useQueryClient();
  const persist = useServerFn(saveTheme);
  const applyTemplateFn = useServerFn(applyThemeTemplate);
  const [draft, setDraft] = useState<ThemeSettingsDraft>(() => draftFromTheme(theme));

  useEffect(() => {
    if (open) setDraft(draftFromTheme(theme));
  }, [open, theme]);

  const saveMutation = useMutation({
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
          buttonStyle: draft.buttonStyle,
          cardStyle: draft.cardStyle,
          contentWidth: draft.contentWidth,
          sectionSpacing: draft.sectionSpacing,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["store-theme", storeId] });
      toast.success("Tema ayarları kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const applyMutation = useMutation({
    mutationFn: (code: string) => applyTemplateFn({ data: { storeId, code } }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["store-theme", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["theme-sections", storeId] }),
      ]);
      toast.success("Tema uygulandı; bölümler ve ayarlar çalışma alanına aktarıldı");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const set = <K extends keyof ThemeSettingsDraft>(key: K, value: ThemeSettingsDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="size-4 text-primary" /> Tema ayarları
          </DialogTitle>
          <DialogDescription>
            Şablon, marka görünümü ve vitrin içeriği aynı çalışma alanından yönetilir. Değişiklikleri kaydetmeden önce canlı önizlemede kontrol edebilirsin.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Hazır temalar</h3>
                <p className="text-xs text-muted-foreground">Bir başlangıç seç, ardından blokları sağ panelden özelleştir.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {THEME_TEMPLATES.map((template) => (
                  <article key={template.code} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold">{template.name}</h4>
                        <p className="text-xs text-muted-foreground">{template.tagline}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {theme?.preset === template.code ? <Badge variant="secondary">Aktif</Badge> : null}
                        {template.store?.featured ? <Badge>Öne çıkan</Badge> : null}
                        <Badge variant="outline">
                          {template.store?.price
                            ? `${template.store.price.toLocaleString("tr-TR")} ₺`
                            : "Ücretsiz"}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{template.description}</p>
                    {template.store?.features?.length ? (
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {template.store.features.slice(0, 4).map((feature) => (
                          <li key={feature}>• {feature}</li>
                        ))}
                      </ul>
                    ) : null}
                    {template.store?.priceNote ? (
                      <p className="mt-2 text-[11px] text-muted-foreground">{template.store.priceNote}</p>
                    ) : null}
                    <Button
                      size="sm"
                      className="mt-3 w-full gap-2"
                      disabled={applyMutation.isPending}
                      onClick={() => applyMutation.mutate(template.code)}
                    >
                      <Download className="size-3.5" /> Temayı uygula
                    </Button>
                  </article>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
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
                    className={`rounded-lg border p-2 text-left transition hover:border-primary ${draft.preset === preset.code ? "border-primary ring-2 ring-primary/20" : "border-border"}`}
                  >
                    <span className="flex items-center justify-between text-xs font-medium">
                      {preset.name}
                      {draft.preset === preset.code ? <Check className="size-3.5 text-primary" /> : null}
                    </span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">{preset.description}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {(
                [
                  ["primaryColor", "Ana renk"],
                  ["accentColor", "Vurgu rengi"],
                  ["backgroundColor", "Zemin rengi"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`theme-${key}`}>{label}</Label>
                  <div className="flex gap-2">
                    <input
                      id={`theme-${key}`}
                      type="color"
                      value={draft[key]}
                      onChange={(event) => set(key, event.target.value)}
                      className="h-10 w-12 cursor-pointer rounded-md border border-border bg-transparent"
                    />
                    <Input value={draft[key]} onChange={(event) => set(key, event.target.value)} />
                  </div>
                </div>
              ))}
            </section>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Yazı tipi ikilisi</Label>
                <Select value={draft.fontPair} onValueChange={(value) => set("fontPair", value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FONT_PAIRS.map((pair) => <SelectItem key={pair.value} value={pair.value}>{pair.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sayfa düzeni</Label>
                <Select value={draft.layout} onValueChange={(value) => set("layout", value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {THEME_LAYOUTS.map((layout) => <SelectItem key={layout.value} value={layout.value}>{layout.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Köşe yumuşaklığı: {draft.radius.toFixed(2)}rem</Label>
                <Slider min={0} max={2} step={0.05} value={[draft.radius]} onValueChange={([value]) => set("radius", value ?? 0)} />
              </div>
              <div className="space-y-2">
                <Label>İçerik genişliği: {draft.contentWidth}px</Label>
                <Slider min={900} max={1600} step={20} value={[draft.contentWidth]} onValueChange={([value]) => set("contentWidth", value ?? 1140)} />
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <section className="space-y-4 rounded-lg border border-border p-4">
              <div>
                <h3 className="text-sm font-semibold">Vitrin kimliği</h3>
                <p className="text-xs text-muted-foreground">Logo ve ana sayfa mesajını tek yerden güncelle.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="theme-logo">Logo adresi</Label>
                <Input id="theme-logo" placeholder="https://…" value={draft.logoUrl} onChange={(event) => set("logoUrl", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="theme-hero-title">Ana başlık</Label>
                <Input id="theme-hero-title" value={draft.heroTitle} onChange={(event) => set("heroTitle", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="theme-hero-subtitle">Alt başlık</Label>
                <Textarea id="theme-hero-subtitle" rows={3} value={draft.heroSubtitle} onChange={(event) => set("heroSubtitle", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="theme-hero-cta">Ana buton yazısı</Label>
                <Input id="theme-hero-cta" value={draft.heroCtaLabel} onChange={(event) => set("heroCtaLabel", event.target.value)} />
              </div>
            </section>

            <section className="space-y-4 rounded-lg border border-border p-4">
              <div className="space-y-2">
                <Label htmlFor="theme-announcement">Duyuru çubuğu</Label>
                <Input id="theme-announcement" placeholder="Örn. 500 TL üzeri kargo bedava" value={draft.announcement} onChange={(event) => set("announcement", event.target.value)} />
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm">Duyuruyu göster</span>
                <Switch checked={draft.showAnnouncement} onCheckedChange={(value) => set("showAnnouncement", value)} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Buton stili</Label>
                  <Select value={draft.buttonStyle} onValueChange={(value) => set("buttonStyle", value as ThemeSettingsDraft["buttonStyle"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{BUTTON_STYLES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ürün kartı stili</Label>
                  <Select value={draft.cardStyle} onValueChange={(value) => set("cardStyle", value as ThemeSettingsDraft["cardStyle"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CARD_STYLES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Bölüm boşluğu: {draft.sectionSpacing}px</Label>
                <Slider min={0} max={140} step={4} value={[draft.sectionSpacing]} onValueChange={([value]) => set("sectionSpacing", value ?? 48)} />
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <div>
                  <p className="text-sm font-medium">Temayı yayına al</p>
                  <p className="text-xs text-muted-foreground">Kapalıysa değişiklikler taslak olarak kalır.</p>
                </div>
                <Switch checked={draft.isPublished} onCheckedChange={(value) => set("isPublished", value)} />
              </div>
            </section>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Kapat</Button>
          <Button className="gap-2" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            <Save className="size-4" /> {saveMutation.isPending ? "Kaydediliyor…" : "Ayarları kaydet"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
