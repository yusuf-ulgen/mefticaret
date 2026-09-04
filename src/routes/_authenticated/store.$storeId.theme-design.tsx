import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Monitor, Palette, RotateCcw, Save, Smartphone, Tablet } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { storeThemeQuery } from "@/lib/theme-queries";
import { saveThemeDesign } from "@/lib/theme-design.functions";
import {
  DESIGN_PRESETS,
  DEVICE_KEYS,
  DEVICE_LABELS,
  designCss,
  resolveDesignTokens,
  type DesignTokens,
  type DeviceKey,
  type Responsive,
} from "@/lib/theme-design";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/store/$storeId/theme-design")({
  head: () => ({
    meta: [
      { title: "Tasarım Sistemi — Mefticaret" },
      {
        name: "description",
        content:
          "Mağaza vitrininin renk, tipografi, boşluk, buton, kart ve hareket ayarlarını masaüstü, tablet ve mobil için ayrı ayrı yönet.",
      },
      { property: "og:title", content: "Tasarım Sistemi — Mefticaret" },
      {
        property: "og:description",
        content: "Renk paleti, yazı ölçeği, boşluklar ve hareket ayarlarını cihaz bazlı düzenle.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ThemeDesignPage,
});

const PREVIEW_DEVICES: { value: DeviceKey; icon: typeof Monitor; width: number }[] = [
  { value: "desktop", icon: Monitor, width: 980 },
  { value: "tablet", icon: Tablet, width: 768 },
  { value: "mobile", icon: Smartphone, width: 390 },
];

const COLOR_FIELDS: { key: keyof DesignTokens["colors"]; label: string }[] = [
  { key: "text", label: "Metin" },
  { key: "muted", label: "İkincil metin" },
  { key: "surface", label: "Kart yüzeyi" },
  { key: "border", label: "Çizgi / kenar" },
  { key: "secondary", label: "İkincil renk" },
  { key: "success", label: "Başarı" },
  { key: "danger", label: "Hata" },
  { key: "sale", label: "İndirim etiketi" },
];

function ThemeDesignPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: theme } = useQuery(storeThemeQuery(storeId));
  const persist = useServerFn(saveThemeDesign);

  const saved = useMemo(() => resolveDesignTokens(theme?.design_tokens), [theme?.design_tokens]);
  const [tokens, setTokens] = useState<DesignTokens>(saved);
  const [device, setDevice] = useState<DeviceKey>("desktop");

  useEffect(() => setTokens(saved), [saved]);

  const dirty = JSON.stringify(tokens) !== JSON.stringify(saved);

  const save = useMutation({
    mutationFn: () => persist({ data: { storeId, tokens } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["store-theme", storeId] });
      toast.success("Tasarım sistemi kaydedildi; vitrin bu ayarlarla görünecek");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const patch = <K extends keyof DesignTokens>(group: K, value: Partial<DesignTokens[K]>) =>
    setTokens((current) => ({ ...current, [group]: { ...current[group], ...value } }));

  const previewWidth = PREVIEW_DEVICES.find((item) => item.value === device)?.width ?? 980;

  return (
    <AppShell
      storeId={storeId}
      title="Tasarım Sistemi"
      description="Renk, tipografi, boşluk, buton, kart ve hareket ayarlarını masaüstü, tablet ve mobil için ayrı belirle."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/store/$storeId/theme-editor" params={{ storeId }}>
              <Palette className="mr-2 size-4" /> Tema düzenleyici
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setTokens(saved)} disabled={!dirty}>
            <RotateCcw className="mr-2 size-4" /> Geri al
          </Button>
          <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
            <Save className="mr-2 size-4" /> Kaydet
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hazır setler</CardTitle>
              <CardDescription>Tek tıkla tüm tasarım tokenlarını değiştir, sonra ince ayar yap.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {DESIGN_PRESETS.map((preset) => {
                const active = JSON.stringify(preset.tokens) === JSON.stringify(tokens);
                return (
                  <button
                    key={preset.code}
                    type="button"
                    onClick={() => setTokens(preset.tokens)}
                    className={cn(
                      "rounded-lg border p-4 text-left transition hover:border-primary",
                      active && "border-primary bg-muted/50",
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {preset.name}
                      {active ? <Check className="size-4 text-primary" /> : null}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">{preset.description}</span>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Tabs defaultValue="colors">
            <TabsList className="flex-wrap">
              <TabsTrigger value="colors">Renkler</TabsTrigger>
              <TabsTrigger value="type">Tipografi</TabsTrigger>
              <TabsTrigger value="space">Boşluklar</TabsTrigger>
              <TabsTrigger value="components">Buton & Kart</TabsTrigger>
              <TabsTrigger value="motion">Hareket</TabsTrigger>
            </TabsList>

            <TabsContent value="colors" className="mt-4">
              <Card>
                <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2">
                  {COLOR_FIELDS.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={`color-${field.key}`}>{field.label}</Label>
                      <div className="flex items-center gap-2">
                        <input
                          id={`color-${field.key}`}
                          type="color"
                          value={tokens.colors[field.key]}
                          onChange={(event) => patch("colors", { [field.key]: event.target.value } as never)}
                          className="size-10 shrink-0 cursor-pointer rounded border bg-transparent"
                        />
                        <Input
                          value={tokens.colors[field.key]}
                          onChange={(event) => patch("colors", { [field.key]: event.target.value } as never)}
                          className="min-w-0"
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="type" className="mt-4 space-y-4">
              <ResponsiveRow
                label="Başlık boyutu (px)"
                value={tokens.typography.headingSize}
                min={14}
                max={96}
                onChange={(next) => patch("typography", { headingSize: next })}
              />
              <ResponsiveRow
                label="Gövde metni boyutu (px)"
                value={tokens.typography.bodySize}
                min={11}
                max={26}
                onChange={(next) => patch("typography", { bodySize: next })}
              />
              <Card>
                <CardContent className="grid grid-cols-1 gap-5 pt-6 sm:grid-cols-2">
                  <SliderField
                    label="Başlık kalınlığı"
                    value={tokens.typography.headingWeight}
                    min={300}
                    max={900}
                    step={50}
                    onChange={(value) => patch("typography", { headingWeight: value })}
                  />
                  <SliderField
                    label="Gövde kalınlığı"
                    value={tokens.typography.bodyWeight}
                    min={300}
                    max={700}
                    step={50}
                    onChange={(value) => patch("typography", { bodyWeight: value })}
                  />
                  <SliderField
                    label="Satır aralığı"
                    value={tokens.typography.lineHeight}
                    min={1}
                    max={2.4}
                    step={0.05}
                    onChange={(value) => patch("typography", { lineHeight: value })}
                  />
                  <SliderField
                    label="Harf aralığı (px)"
                    value={tokens.typography.letterSpacing}
                    min={-2}
                    max={4}
                    step={0.1}
                    onChange={(value) => patch("typography", { letterSpacing: value })}
                  />
                  <SwitchField
                    label="Başlıklar büyük harf"
                    checked={tokens.typography.uppercaseHeadings}
                    onChange={(value) => patch("typography", { uppercaseHeadings: value })}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="space" className="mt-4 space-y-4">
              <ResponsiveRow
                label="Bölüm arası boşluk (px)"
                value={tokens.spacing.section}
                min={0}
                max={200}
                onChange={(next) => patch("spacing", { section: next })}
              />
              <ResponsiveRow
                label="Izgara boşluğu (px)"
                value={tokens.spacing.gridGap}
                min={0}
                max={64}
                onChange={(next) => patch("spacing", { gridGap: next })}
              />
              <ResponsiveRow
                label="Kenar boşluğu (px)"
                value={tokens.spacing.containerPadding}
                min={0}
                max={80}
                onChange={(next) => patch("spacing", { containerPadding: next })}
              />
            </TabsContent>

            <TabsContent value="components" className="mt-4">
              <Card>
                <CardContent className="grid grid-cols-1 gap-5 pt-6 sm:grid-cols-2">
                  <SliderField
                    label="Buton dikey iç boşluk (px)"
                    value={tokens.buttons.paddingY}
                    min={6}
                    max={28}
                    step={1}
                    onChange={(value) => patch("buttons", { paddingY: value })}
                  />
                  <SliderField
                    label="Buton yatay iç boşluk (px)"
                    value={tokens.buttons.paddingX}
                    min={8}
                    max={56}
                    step={1}
                    onChange={(value) => patch("buttons", { paddingX: value })}
                  />
                  <SliderField
                    label="Buton yazı kalınlığı"
                    value={tokens.buttons.weight}
                    min={400}
                    max={900}
                    step={50}
                    onChange={(value) => patch("buttons", { weight: value })}
                  />
                  <SwitchField
                    label="Buton metni büyük harf"
                    checked={tokens.buttons.uppercase}
                    onChange={(value) => patch("buttons", { uppercase: value })}
                  />
                  <SelectField
                    label="Buton hover efekti"
                    value={tokens.buttons.hover}
                    options={[
                      ["none", "Yok"],
                      ["lift", "Yukarı kalk"],
                      ["fade", "Solma"],
                      ["scale", "Büyüme"],
                    ]}
                    onChange={(value) => patch("buttons", { hover: value as DesignTokens["buttons"]["hover"] })}
                  />
                  <SliderField
                    label="Kart gölge yoğunluğu"
                    value={tokens.cards.shadow}
                    min={0}
                    max={3}
                    step={1}
                    onChange={(value) => patch("cards", { shadow: value })}
                  />
                  <SelectField
                    label="Kart hover efekti"
                    value={tokens.cards.hover}
                    options={[
                      ["none", "Yok"],
                      ["lift", "Yukarı kalk"],
                      ["zoom", "Büyüme"],
                      ["border", "Kenar vurgusu"],
                    ]}
                    onChange={(value) => patch("cards", { hover: value as DesignTokens["cards"]["hover"] })}
                  />
                  <SelectField
                    label="Ürün görseli oranı"
                    value={tokens.cards.imageRatio}
                    options={[
                      ["1x1", "Kare (1:1)"],
                      ["4x5", "Dikey (4:5)"],
                      ["3x4", "Dikey (3:4)"],
                      ["16x9", "Yatay (16:9)"],
                    ]}
                    onChange={(value) =>
                      patch("cards", { imageRatio: value as DesignTokens["cards"]["imageRatio"] })
                    }
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="motion" className="mt-4">
              <Card>
                <CardContent className="grid grid-cols-1 gap-5 pt-6 sm:grid-cols-2">
                  <SelectField
                    label="Bölüm giriş animasyonu"
                    value={tokens.motion.effect}
                    options={[
                      ["none", "Yok"],
                      ["fade", "Belirme"],
                      ["slide", "Aşağıdan kayma"],
                      ["zoom", "Yakınlaşma"],
                    ]}
                    onChange={(value) => patch("motion", { effect: value as DesignTokens["motion"]["effect"] })}
                  />
                  <SliderField
                    label="Animasyon süresi (ms)"
                    value={tokens.motion.duration}
                    min={0}
                    max={1200}
                    step={20}
                    onChange={(value) => patch("motion", { duration: value })}
                  />
                  <SwitchField
                    label="Hareket azaltma tercihine uy (erişilebilirlik)"
                    checked={tokens.motion.respectReducedMotion}
                    onChange={(value) => patch("motion", { respectReducedMotion: value })}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {PREVIEW_DEVICES.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.value}
                  size="sm"
                  variant={device === item.value ? "default" : "outline"}
                  onClick={() => setDevice(item.value)}
                >
                  <Icon className="mr-2 size-4" /> {DEVICE_LABELS[item.value]}
                </Button>
              );
            })}
            {dirty ? <Badge variant="secondary">Kaydedilmemiş değişiklik</Badge> : null}
          </div>
          <div className="overflow-x-auto rounded-xl border bg-muted/30 p-4">
            <div style={{ width: previewWidth, maxWidth: "100%" }}>
              <DesignPreview tokens={tokens} />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

/** Cihaz bazlı sayısal ayar satırı (masaüstü / tablet / mobil). */
function ResponsiveRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: Responsive;
  min: number;
  max: number;
  onChange: (next: Responsive) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{label}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {DEVICE_KEYS.map((key) => (
          <div key={key} className="space-y-2">
            <Label htmlFor={`${label}-${key}`} className="text-xs text-muted-foreground">
              {DEVICE_LABELS[key]}
            </Label>
            <Input
              id={`${label}-${key}`}
              type="number"
              min={min}
              max={max}
              value={value[key]}
              onChange={(event) => onChange({ ...value, [key]: Number(event.target.value) })}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="min-w-0">{label}</Label>
        <span className="shrink-0 text-xs text-muted-foreground">{value}</span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([next]) => onChange(next ?? value)} />
    </div>
  );
}

function SwitchField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <Label className="min-w-0 text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Tokenların canlı örneği: başlık, metin, buton ve ürün kartları. */
function DesignPreview({ tokens }: { tokens: DesignTokens }) {
  const css = designCss(tokens, ".sf-design-preview");
  return (
    <div
      className="sf-design-preview sf-root rounded-lg p-5"
      style={{ background: tokens.colors.surface, color: tokens.colors.text }}
    >
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="sf-section">
        <h2 style={{ margin: 0 }}>Yeni sezon burada</h2>
        <p style={{ color: tokens.colors.muted, marginTop: 8 }}>
          Seçkin parçalar, hızlı teslimat ve güvenli ödeme. Bu önizleme kaydettiğin tasarım ayarlarını kullanır.
        </p>
        <span
          className="sf-btn"
          style={{
            display: "inline-block",
            marginTop: 16,
            borderRadius: 999,
            background: tokens.colors.text,
            color: tokens.colors.surface,
          }}
        >
          Koleksiyonu keşfet
        </span>
        <div
          className="sf-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(var(--sf-cols, 3), minmax(0, 1fr))",
            marginTop: "var(--sf-section-space)",
          }}
        >
          {["Kaşmir kazak", "Deri çanta", "Koşu ayakkabısı"].map((title) => (
            <div
              key={title}
              className="sf-card"
              style={{
                border: `1px solid ${tokens.colors.border}`,
                borderRadius: 12,
                padding: 12,
                background: tokens.colors.surface,
              }}
            >
              <div
                style={{
                  aspectRatio: "var(--sf-image-ratio)",
                  borderRadius: 8,
                  background: `linear-gradient(140deg, ${tokens.colors.secondary}33, ${tokens.colors.text}18)`,
                }}
              />
              <h3 style={{ margin: "10px 0 4px" }}>{title}</h3>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <strong>1.290 ₺</strong>
                <span style={{ color: tokens.colors.sale, textDecoration: "line-through" }}>1.690 ₺</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
