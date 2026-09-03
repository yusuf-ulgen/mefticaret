import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Download, Eye, Monitor, Palette, Smartphone, Sparkles, Tablet } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { StorefrontSections, type SectionProduct } from "@/components/storefront-sections";
import type { StoreTheme } from "@/components/storefront-chrome";
import { ThemeSettingsDialog } from "@/components/theme-editor/theme-settings-dialog";
import { ThemeVersionsPanel } from "@/components/theme-versions-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { collectionsQuery, productsQuery } from "@/lib/catalog-queries";
import { paymentMethodsQuery, shippingZonesQuery } from "@/lib/commerce-queries";
import { buildStorefrontCommerce } from "@/lib/storefront-commerce";
import { storeQuery } from "@/lib/store-queries";
import { storeThemeQuery } from "@/lib/theme-queries";
import { SECTION_BY_TYPE, type ResolvedSection, type SectionSettings } from "@/lib/theme-sections";
import { applyThemeTemplate } from "@/lib/theme-templates.functions";
import { THEME_TEMPLATES, type ThemeTemplate } from "@/lib/theme-templates";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/store/$storeId/theme-store")({
  head: () => ({
    meta: [
      { title: "Tema Mağazası — Mefticaret" },
      {
        name: "description",
        content:
          "Profesyonel hazır temaları kendi ürünlerinle canlı önizle, tek tıkla uygula, ayarla ve gerekirse eski sürüme dön.",
      },
      { property: "og:title", content: "Tema Mağazası — Mefticaret" },
      {
        property: "og:description",
        content: "Temaları kendi ürünlerinle canlı önizle, uygula ve sürümler arasında geri dön.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ThemeStorePage,
});

type PreviewDevice = "desktop" | "tablet" | "mobile";

const DEVICES: { value: PreviewDevice; label: string; icon: typeof Monitor; width: number | null }[] = [
  { value: "desktop", label: "Masaüstü", icon: Monitor, width: null },
  { value: "tablet", label: "Tablet", icon: Tablet, width: 768 },
  { value: "mobile", label: "Mobil", icon: Smartphone, width: 390 },
];

/** Şablon tema ayarlarını vitrin token yapısına çevirir (kayıt yapmadan önizleme için). */
function themeFromTemplate(template: ThemeTemplate): StoreTheme {
  const t = template.theme;
  return {
    primary_color: t.primaryColor,
    accent_color: t.accentColor,
    background_color: t.backgroundColor,
    font_pair: t.fontPair,
    radius: t.radius,
    layout: t.layout,
    hero_title: t.heroTitle,
    hero_subtitle: t.heroSubtitle,
    hero_cta_label: t.heroCtaLabel,
    announcement: t.announcement || null,
    show_announcement: t.showAnnouncement,
    logo_url: null,
    button_style: t.buttonStyle,
    card_style: t.cardStyle,
    content_width: t.contentWidth,
    section_spacing: t.sectionSpacing,
  };
}

/** Şablon bölümlerini önizleme için çözümlenmiş bölümlere çevirir. */
function sectionsFromTemplate(template: ThemeTemplate): ResolvedSection[] {
  return template.sections
    .map((section, index) => {
      const definition = SECTION_BY_TYPE.get(section.type);
      if (!definition) return null;
      const settings: SectionSettings = { ...definition.defaults };
      for (const [key, value] of Object.entries(section.settings ?? {})) {
        if (!(key in definition.defaults)) continue;
        settings[key] = value;
      }
      const resolved: ResolvedSection = {
        id: `${template.code}-${index}`,
        type: section.type,
        position: index,
        isEnabled: true,
        settings,
        definition,
      };
      return resolved;
    })
    .filter((section): section is ResolvedSection => section !== null);
}

function ThemeStorePage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: theme } = useQuery(storeThemeQuery(storeId));
  const { data: store } = useQuery(storeQuery(storeId));
  const { data: products } = useQuery(productsQuery(storeId));
  const { data: collections } = useQuery(collectionsQuery(storeId));
  const { data: shippingZones } = useQuery(shippingZonesQuery(storeId));
  const { data: paymentMethods } = useQuery(paymentMethodsQuery(storeId));
  const applyTemplate = useServerFn(applyThemeTemplate);

  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const previewTemplate = THEME_TEMPLATES.find((template) => template.code === previewCode) ?? null;

  const applyMutation = useMutation({
    mutationFn: (code: string) => applyTemplate({ data: { storeId, code } }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["store-theme", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["theme-sections", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["theme-versions", storeId] }),
      ]);
      setPreviewCode(null);
      toast.success("Tema mağazana uygulandı. Ayar panelinden ince ayar yapabilirsin.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Önizleme mağazanın gerçek kargo ve ödeme verisini kullanır.
  const previewCommerce = useMemo(
    () =>
      buildStorefrontCommerce({
        currency: store?.currency ?? "TRY",
        rates: (shippingZones ?? [])
          .filter((zone) => zone.is_active)
          .flatMap((zone) =>
            (zone.shipping_rates ?? [])
              .filter((rate) => rate.is_active)
              .map((rate) => ({
                title: rate.title,
                price: rate.price,
                free_over: rate.free_over,
                eta_days: rate.eta_days,
                zoneName: zone.name,
              })),
          ),
        payments: (paymentMethods ?? [])
          .filter((method) => method.is_active)
          .map((method) => ({
            display_name: method.display_name,
            installments_enabled: method.installments_enabled,
          })),
      }),
    [paymentMethods, shippingZones, store?.currency],
  );

  const previewProducts: SectionProduct[] = useMemo(
    () =>
      (products ?? []).slice(0, 16).map((product) => ({
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

  const previewWidth = DEVICES.find((item) => item.value === device)?.width ?? null;

  return (
    <AppShell
      storeId={storeId}
      title="Tema Mağazası"
      description="Temaları kendi ürünlerinle canlı önizle, tek tıkla kur, ayarla ve gerekirse eski sürüme dön."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setSettingsOpen(true)}>
            <Palette className="mr-2 size-4" /> Tema ayarları
          </Button>
          <Button asChild variant="outline">
            <Link to="/store/$storeId/theme-editor" params={{ storeId }}>
              Tema düzenleyici
            </Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-8">
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {THEME_TEMPLATES.map((template) => {
            const active = theme?.preset === template.code;
            return (
              <Card key={template.code} className="flex flex-col">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {template.name}
                        {active ? <Badge variant="secondary">Kurulu</Badge> : null}
                      </CardTitle>
                      <CardDescription>{template.tagline}</CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {template.store?.featured ? (
                        <Badge className="gap-1">
                          <Sparkles className="size-3" /> Öne çıkan
                        </Badge>
                      ) : null}
                      <Badge variant="outline">
                        {template.store?.price
                          ? `${template.store.price.toLocaleString("tr-TR")} ₺`
                          : "Ücretsiz"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <p className="text-sm text-muted-foreground">{template.description}</p>

                  <div className="flex flex-wrap gap-1.5">
                    {template.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="font-normal">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  {template.store?.features?.length ? (
                    <ul className="space-y-1.5 text-sm">
                      {template.store.features.map((feature) => (
                        <li key={feature} className="flex gap-2 text-muted-foreground">
                          <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <p className="text-xs text-muted-foreground">
                    {template.sections.length} hazır bölüm
                    {template.store?.priceNote ? ` · ${template.store.priceNote}` : ""}
                  </p>

                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button
                      className="flex-1 gap-2"
                      variant="outline"
                      onClick={() => {
                        setDevice("desktop");
                        setPreviewCode(template.code);
                      }}
                    >
                      <Eye className="size-4" /> Canlı demo
                    </Button>
                    <Button
                      className="flex-1 gap-2"
                      disabled={applyMutation.isPending}
                      onClick={() => applyMutation.mutate(template.code)}
                    >
                      <Download className="size-4" />
                      {active ? "Yeniden kur" : "Temayı kur"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tema güncellemelerinde sürüm alma ve tek tıkla geri dönme akışı. */}
        <ThemeVersionsPanel storeId={storeId} />
      </div>

      <ThemeSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        storeId={storeId}
        theme={theme}
      />

      <Dialog open={Boolean(previewTemplate)} onOpenChange={(open) => !open && setPreviewCode(null)}>
        <DialogContent className="flex h-[92vh] max-w-[min(1500px,96vw)] flex-col gap-4 overflow-hidden p-4 sm:p-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {previewTemplate?.name} canlı demo
              <Badge variant="secondary">Kendi ürünlerinle</Badge>
            </DialogTitle>
            <DialogDescription>
              Bu önizleme mağazanın gerçek ürün, koleksiyon, kargo ve ödeme verisiyle oluşturuldu.
              Beğenirsen aşağıdan uygula; uygulamadan önce mevcut temana hiçbir şey yazılmaz.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1 rounded-lg border border-border p-1">
              {DEVICES.map((item) => (
                <Button
                  key={item.value}
                  size="sm"
                  variant={device === item.value ? "secondary" : "ghost"}
                  onClick={() => setDevice(item.value)}
                >
                  <item.icon className="mr-2 size-4" /> {item.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setPreviewCode(null)}>
                Kapat
              </Button>
              <Button
                disabled={applyMutation.isPending}
                onClick={() => previewTemplate && applyMutation.mutate(previewTemplate.code)}
              >
                <Download className="mr-2 size-4" /> Bu temayı uygula
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-muted/30 p-3">
            {previewTemplate ? (
              <div
                className={cn("mx-auto bg-background shadow-sm transition-all")}
                style={{
                  width: previewWidth ? `${previewWidth}px` : "100%",
                  maxWidth: "100%",
                  backgroundColor: previewTemplate.theme.backgroundColor,
                }}
              >
                <StorefrontSections
                  sections={sectionsFromTemplate(previewTemplate)}
                  context={{
                    theme: themeFromTemplate(previewTemplate),
                    storeSlug: store?.slug ?? "preview",
                    storeName: store?.name ?? "Önizleme",
                    storeCurrency: store?.currency ?? "TRY",
                    products: previewProducts,
                    collections: (collections ?? []).map((collection) => ({
                      id: collection.id,
                      title: collection.title,
                      slug: collection.slug,
                      description: collection.description,
                    })),
                    pages: [],
                    commerce: previewCommerce,
                    preview: true,
                  }}
                />
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
