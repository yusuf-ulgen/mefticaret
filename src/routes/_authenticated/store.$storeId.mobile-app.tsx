import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Apple,
  Bell,
  Eye,
  EyeOff,
  GripVertical,
  Hammer,
  Layers,
  Plus,
  RotateCcw,
  Save,
  Send,
  Smartphone,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MobilePagesPanel } from "@/components/mobile-pages-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  DEEP_LINK_KINDS,
  DEEP_LINK_LABELS,
  PUSH_AUDIENCES,
  PUSH_AUDIENCE_LABELS,
  PUSH_TRIGGERS,
  PUSH_TRIGGER_META,
  TAB_LABELS,
  WIDGET_CATALOG,
  buildDeepLink,
  defaultMobileAppConfig,
  defaultWidget,
  parseDeepLink,
  type MobileAppConfig,
  type MobileWidget,
  type MobileWidgetType,
  type PushAudience,
  type PushTrigger,
} from "@/lib/mobile-app";
import {
  getMobileApp,
  publishMobileApp,
  requestMobileAppBuild,
  saveMobileAppDraft,
  saveMobilePushAutomation,
  sendMobilePushCampaign,
} from "@/lib/mobile-app.functions";

import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/store/$storeId/mobile-app")({
  head: () => ({
    meta: [
      { title: "Mobil Uygulama Oluşturucu — Mefticaret" },
      {
        name: "description",
        content:
          "Kod yazmadan iOS ve Android uygulamanızın tasarımını sürükle-bırak ile kurun, push bildirim otomasyonlarını yönetin ve mağaza yayınına hazırlayın.",
      },
      { property: "og:title", content: "Mobil Uygulama Oluşturucu — Mefticaret" },
      {
        property: "og:description",
        content: "Sürükle-bırak mobil tasarım editörü, canlı cihaz önizlemesi ve push bildirim otomasyonları.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MobileAppBuilderPage,
});

type PushAutomationRow = {
  trigger: PushTrigger;
  isActive: boolean;
  delayMinutes: number;
  title: string;
  body: string;
  imageUrl: string;
  deepLink: string;
  discountCode: string;
};

function MobileAppBuilderPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const load = useServerFn(getMobileApp);
  const saveDraft = useServerFn(saveMobileAppDraft);
  const publish = useServerFn(publishMobileApp);
  const sendPush = useServerFn(sendMobilePushCampaign);
  const build = useServerFn(requestMobileAppBuild);

  const { data } = useQuery({
    queryKey: ["mobile-app", storeId],
    queryFn: () => load({ data: { storeId } }),
  });

  const saved = data?.draft ?? defaultMobileAppConfig();
  const [config, setConfig] = useState<MobileAppConfig>(saved);
  const [platform, setPlatform] = useState<"ios" | "android">("ios");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (data?.draft) setConfig(data.draft);
  }, [data?.draft]);

  const dirty = JSON.stringify(config) !== JSON.stringify(saved);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["mobile-app", storeId] });

  const draftSave = useMutation({
    mutationFn: () => saveDraft({ data: { storeId, config } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Taslak kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const publishApp = useMutation({
    mutationFn: () => publish({ data: { storeId, config } }),
    onSuccess: async (result) => {
      await invalidate();
      toast.success(`Uygulama tasarımı yayınlandı (v${result.version})`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const buildApp = useMutation({
    mutationFn: (target: "ios" | "android" | "both") => build({ data: { storeId, platform: target } }),
    onSuccess: async (result) => {
      await invalidate();
      toast.success(`Build isteği alındı — sürüm kodu ${result.buildNumber}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const patchBranding = (value: Partial<MobileAppConfig["branding"]>) =>
    setConfig((current) => ({ ...current, branding: { ...current.branding, ...value } }));
  const patchCommerce = (value: Partial<MobileAppConfig["commerce"]>) =>
    setConfig((current) => ({ ...current, commerce: { ...current.commerce, ...value } }));
  const patchPublishing = (value: Partial<MobileAppConfig["publishing"]>) =>
    setConfig((current) => ({ ...current, publishing: { ...current.publishing, ...value } }));

  const updateWidget = (id: string, value: Partial<MobileWidget>) =>
    setConfig((current) => ({
      ...current,
      home: current.home.map((widget) => (widget.id === id ? { ...widget, ...value } : widget)),
    }));

  const addWidget = (type: MobileWidgetType) => {
    const widget = defaultWidget(type);
    setConfig((current) => ({ ...current, home: [...current.home, widget] }));
    setSelected(widget.id);
    toast.success(`${WIDGET_CATALOG.find((item) => item.type === type)?.name} eklendi`);
  };

  const removeWidget = (id: string) => {
    setConfig((current) => ({ ...current, home: current.home.filter((widget) => widget.id !== id) }));
    setSelected((current) => (current === id ? null : current));
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setConfig((current) => {
      const from = current.home.findIndex((widget) => widget.id === active.id);
      const to = current.home.findIndex((widget) => widget.id === over.id);
      if (from < 0 || to < 0) return current;
      const home = [...current.home];
      const [moved] = home.splice(from, 1);
      if (moved) home.splice(to, 0, moved);
      return { ...current, home };
    });
  };

  const activeWidget = config.home.find((widget) => widget.id === selected) ?? null;

  return (
    <AppShell
      storeId={storeId}
      title="Mobil Uygulama Oluşturucu"
      description="Kod yazmadan iOS & Android uygulamanızın tasarımını, bildirimlerini ve yayın ayarlarını yönetin."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {data?.publishedAt ? (
            <Badge variant="secondary">Yayında · v{data.version}</Badge>
          ) : (
            <Badge variant="outline">Henüz yayınlanmadı</Badge>
          )}
          <Button variant="outline" onClick={() => setConfig(saved)} disabled={!dirty}>
            <RotateCcw className="mr-2 size-4" /> Geri al
          </Button>
          <Button variant="outline" onClick={() => draftSave.mutate()} disabled={!dirty || draftSave.isPending}>
            <Save className="mr-2 size-4" /> Taslağı kaydet
          </Button>
          <Button onClick={() => publishApp.mutate()} disabled={publishApp.isPending}>
            <Upload className="mr-2 size-4" /> Yayınla
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="min-w-0 space-y-6">
          <Tabs defaultValue="layout">
            <TabsList className="flex h-auto flex-wrap">
              <TabsTrigger value="layout">App Layout</TabsTrigger>
              <TabsTrigger value="branding">Marka & Ayarlar</TabsTrigger>
              <TabsTrigger value="navigation">Navigasyon</TabsTrigger>
              <TabsTrigger value="push">Push Bildirimleri</TabsTrigger>
              <TabsTrigger value="pages">Sayfalar</TabsTrigger>
              <TabsTrigger value="publish">Yayınlama</TabsTrigger>
            </TabsList>

            {/* --------------------------- LAYOUT --------------------------- */}
            <TabsContent value="layout" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Bileşen ekle</CardTitle>
                  <CardDescription>Mobil ana sayfaya eklemek istediğin bileşeni seç.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {WIDGET_CATALOG.map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => addWidget(item.type)}
                      className="flex items-start gap-3 rounded-lg border p-3 text-left transition hover:border-primary"
                    >
                      <span aria-hidden className="text-lg">
                        {item.emoji}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1 text-sm font-semibold">
                          {item.name}
                          <Plus className="size-3.5 text-muted-foreground" />
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span>
                      </span>
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ana sayfa düzeni</CardTitle>
                  <CardDescription>Sürükleyerek sırala, göz simgesiyle gizle, tıklayarak düzenle.</CardDescription>
                </CardHeader>
                <CardContent>
                  <DndContext
                    collisionDetection={closestCenter}
                    modifiers={[restrictToVerticalAxis]}
                    onDragEnd={onDragEnd}
                  >
                    <SortableContext
                      items={config.home.map((widget) => widget.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {config.home.map((widget) => (
                          <SortableWidgetRow
                            key={widget.id}
                            widget={widget}
                            active={widget.id === selected}
                            onSelect={() => setSelected(widget.id === selected ? null : widget.id)}
                            onToggle={() => updateWidget(widget.id, { visible: !widget.visible })}
                            onRemove={() => removeWidget(widget.id)}
                          />
                        ))}
                        {config.home.length === 0 ? (
                          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                            Henüz bileşen yok. Yukarıdan ekleyerek başla.
                          </p>
                        ) : null}
                      </div>
                    </SortableContext>
                  </DndContext>
                </CardContent>
              </Card>

              {activeWidget ? (
                <WidgetSettings widget={activeWidget} onChange={(value) => updateWidget(activeWidget.id, value)} />
              ) : null}
            </TabsContent>

            {/* -------------------------- BRANDING -------------------------- */}
            <TabsContent value="branding" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Uygulama kimliği</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Uygulama adı">
                    <Input
                      value={config.branding.appName}
                      onChange={(event) => patchBranding({ appName: event.target.value })}
                    />
                  </Field>
                  <Field label="Slogan">
                    <Input
                      value={config.branding.tagline}
                      onChange={(event) => patchBranding({ tagline: event.target.value })}
                    />
                  </Field>
                  <Field label="Uygulama ikonu (görsel adresi)">
                    <Input
                      value={config.branding.appIconUrl}
                      placeholder="https://..."
                      onChange={(event) => patchBranding({ appIconUrl: event.target.value })}
                    />
                  </Field>
                  <Field label="Açılış ekranı görseli">
                    <Input
                      value={config.branding.splashImageUrl}
                      placeholder="https://..."
                      onChange={(event) => patchBranding({ splashImageUrl: event.target.value })}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Mağaza açıklaması (store listeleme metni)">
                      <Textarea
                        rows={3}
                        value={config.branding.description}
                        onChange={(event) => patchBranding({ description: event.target.value })}
                      />
                    </Field>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Renk & tipografi</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {(
                    [
                      ["primary", "Ana renk"],
                      ["accent", "Vurgu rengi"],
                      ["background", "Arka plan"],
                      ["surface", "Kart yüzeyi"],
                      ["text", "Metin"],
                      ["splashBackground", "Açılış ekranı zemini"],
                    ] as const
                  ).map(([key, label]) => (
                    <Field key={key} label={label}>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={config.branding[key]}
                          onChange={(event) => patchBranding({ [key]: event.target.value } as never)}
                          className="size-10 shrink-0 cursor-pointer rounded border bg-transparent"
                        />
                        <Input
                          value={config.branding[key]}
                          onChange={(event) => patchBranding({ [key]: event.target.value } as never)}
                        />
                      </div>
                    </Field>
                  ))}
                  <Field label="Yazı tipi">
                    <Select
                      value={config.branding.headingFont}
                      onValueChange={(value) => patchBranding({ headingFont: value as never })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Geist", "Inter", "Montserrat", "Nunito Sans", "Poppins"].map((font) => (
                          <SelectItem key={font} value={font}>
                            {font}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={`Köşe yuvarlaklığı: ${config.branding.radius}px`}>
                    <Slider
                      min={0}
                      max={32}
                      step={1}
                      value={[config.branding.radius]}
                      onValueChange={([value]) => patchBranding({ radius: value ?? 14 })}
                    />
                  </Field>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Mobile-exclusive alışveriş</CardTitle>
                  <CardDescription>Hızlı ödeme, uygulamaya özel indirim ve mobil arama özellikleri.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["applePay", "Apple Pay ile tek tıkla ödeme"],
                      ["googlePay", "Google Pay ile tek tıkla ödeme"],
                      ["savedCards", "Kayıtlı kart ile hızlı ödeme"],
                      ["buyNowButton", "“Şimdi Satın Al” butonu"],
                      ["stickyAddToCart", "Alt sabit “Sepete Ekle” çubuğu"],
                      ["whatsappShare", "WhatsApp / sosyal paylaşım"],
                      ["barcodeScan", "Barkod & QR ile ürün arama"],
                      ["voiceSearch", "Sesli arama"],
                    ] as const
                  ).map(([key, label]) => (
                    <ToggleRow
                      key={key}
                      label={label}
                      checked={config.commerce[key]}
                      onChange={(value) => patchCommerce({ [key]: value } as never)}
                    />
                  ))}
                  <ToggleRow
                    label="Uygulamaya özel indirim"
                    checked={config.commerce.appOnlyDiscountEnabled}
                    onChange={(value) => patchCommerce({ appOnlyDiscountEnabled: value })}
                  />
                  <Field label="İndirim kodu">
                    <Input
                      value={config.commerce.appOnlyDiscountCode}
                      onChange={(event) => patchCommerce({ appOnlyDiscountCode: event.target.value.toUpperCase() })}
                    />
                  </Field>
                  <Field label={`İndirim oranı: %${config.commerce.appOnlyDiscountPercent}`}>
                    <Slider
                      min={0}
                      max={90}
                      step={1}
                      value={[config.commerce.appOnlyDiscountPercent]}
                      onValueChange={([value]) => patchCommerce({ appOnlyDiscountPercent: value ?? 10 })}
                    />
                  </Field>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ------------------------- NAVIGATION ------------------------- */}
            <TabsContent value="navigation" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Alt sekme çubuğu</CardTitle>
                  <CardDescription>Uygulamanın altındaki ana navigasyon sekmelerini düzenle.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {config.navigation.tabs.map((tab, index) => (
                    <div key={tab.key} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto]">
                      <Field label={TAB_LABELS[tab.key]}>
                        <Input
                          value={tab.label}
                          onChange={(event) =>
                            setConfig((current) => ({
                              ...current,
                              navigation: {
                                ...current.navigation,
                                tabs: current.navigation.tabs.map((item, i) =>
                                  i === index ? { ...item, label: event.target.value } : item,
                                ),
                              },
                            }))
                          }
                        />
                      </Field>
                      <ToggleRow
                        label="Görünür"
                        checked={tab.visible}
                        onChange={(value) =>
                          setConfig((current) => ({
                            ...current,
                            navigation: {
                              ...current.navigation,
                              tabs: current.navigation.tabs.map((item, i) =>
                                i === index ? { ...item, visible: value } : item,
                              ),
                            },
                          }))
                        }
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Yan menü (drawer)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ToggleRow
                    label="Yan menü açık"
                    checked={config.navigation.showDrawer}
                    onChange={(value) =>
                      setConfig((current) => ({
                        ...current,
                        navigation: { ...current.navigation, showDrawer: value },
                      }))
                    }
                  />
                  {config.navigation.drawer.map((item, index) => (
                    <div key={item.id} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
                      <Field label="Başlık">
                        <Input
                          value={item.label}
                          onChange={(event) =>
                            setConfig((current) => ({
                              ...current,
                              navigation: {
                                ...current.navigation,
                                drawer: current.navigation.drawer.map((row, i) =>
                                  i === index ? { ...row, label: event.target.value } : row,
                                ),
                              },
                            }))
                          }
                        />
                      </Field>
                      <DeepLinkField
                        value={item.link}
                        onChange={(link) =>
                          setConfig((current) => ({
                            ...current,
                            navigation: {
                              ...current.navigation,
                              drawer: current.navigation.drawer.map((row, i) => (i === index ? { ...row, link } : row)),
                            },
                          }))
                        }
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="self-end"
                        onClick={() =>
                          setConfig((current) => ({
                            ...current,
                            navigation: {
                              ...current.navigation,
                              drawer: current.navigation.drawer.filter((_, i) => i !== index),
                            },
                          }))
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() =>
                      setConfig((current) => ({
                        ...current,
                        navigation: {
                          ...current.navigation,
                          drawer: [
                            ...current.navigation.drawer,
                            { id: `d${current.navigation.drawer.length + 1}`, label: "Yeni bağlantı", link: buildDeepLink("home") },
                          ],
                        },
                      }))
                    }
                  >
                    <Plus className="mr-2 size-4" /> Bağlantı ekle
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ---------------------------- PUSH ---------------------------- */}
            <TabsContent value="push" className="mt-4 space-y-4">
              <PushPanel
                storeId={storeId}
                automations={(data?.automations ?? []) as PushAutomationRow[]}
                devices={data?.devices ?? { total: 0, ios: 0, android: 0 }}
                campaigns={data?.campaigns ?? []}
                onSend={(input) => sendPush({ data: { storeId, ...input } })}
                onSaved={invalidate}
              />
            </TabsContent>

            {/* --------------------------- PAGES ---------------------------- */}
            <TabsContent value="pages" className="mt-4 space-y-4">
              <MobilePagesPanel
                storeId={storeId}
                storeSlug={data?.storeSlug}
                branding={config.branding}
              />
            </TabsContent>


            {/* -------------------------- PUBLISH -------------------------- */}
            <TabsContent value="publish" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">App Store & Play Store ayarları</CardTitle>
                  <CardDescription>
                    Build alabilmek için uygulama adı, ikon ve mağaza kimlikleri zorunludur.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="iOS Bundle ID">
                    <Input
                      value={config.publishing.iosBundleId}
                      placeholder="com.magazam.app"
                      onChange={(event) => patchPublishing({ iosBundleId: event.target.value })}
                    />
                  </Field>
                  <Field label="Android paket adı">
                    <Input
                      value={config.publishing.androidPackage}
                      placeholder="com.magazam.app"
                      onChange={(event) => patchPublishing({ androidPackage: event.target.value })}
                    />
                  </Field>
                  <Field label="App Store bağlantısı">
                    <Input
                      value={config.publishing.appStoreUrl}
                      onChange={(event) => patchPublishing({ appStoreUrl: event.target.value })}
                    />
                  </Field>
                  <Field label="Google Play bağlantısı">
                    <Input
                      value={config.publishing.playStoreUrl}
                      onChange={(event) => patchPublishing({ playStoreUrl: event.target.value })}
                    />
                  </Field>
                  <Field label="Sürüm adı">
                    <Input
                      value={config.publishing.versionName}
                      onChange={(event) => patchPublishing({ versionName: event.target.value })}
                    />
                  </Field>
                  <Field label="Yayın kanalı">
                    <Select
                      value={config.publishing.channel}
                      onValueChange={(value) => patchPublishing({ channel: value as never })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="internal">Dahili test</SelectItem>
                        <SelectItem value="beta">Beta (TestFlight / Kapalı test)</SelectItem>
                        <SelectItem value="production">Yayın (Production)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Sürüm notları">
                      <Textarea
                        rows={3}
                        value={config.publishing.releaseNotes}
                        onChange={(event) => patchPublishing({ releaseNotes: event.target.value })}
                      />
                    </Field>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Build servisi</CardTitle>
                  <CardDescription>
                    Build isteği kuyruğa alınır; .ipa / .aab çıktısı için Apple ve Google geliştirici hesabı
                    kimlik bilgilerinin tanımlı olması gerekir. Mevcut sürüm kodu: {config.publishing.buildNumber}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => buildApp.mutate("ios")} disabled={buildApp.isPending}>
                    <Apple className="mr-2 size-4" /> iOS build (.ipa)
                  </Button>
                  <Button variant="outline" onClick={() => buildApp.mutate("android")} disabled={buildApp.isPending}>
                    <Smartphone className="mr-2 size-4" /> Android build (.aab)
                  </Button>
                  <Button onClick={() => buildApp.mutate("both")} disabled={buildApp.isPending}>
                    <Hammer className="mr-2 size-4" /> Her ikisi
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* ----------------------- LIVE DEVICE PREVIEW ----------------------- */}
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={platform === "ios" ? "default" : "outline"} onClick={() => setPlatform("ios")}>
              <Apple className="mr-2 size-4" /> iOS
            </Button>
            <Button
              size="sm"
              variant={platform === "android" ? "default" : "outline"}
              onClick={() => setPlatform("android")}
            >
              <Smartphone className="mr-2 size-4" /> Android
            </Button>
            {dirty ? <Badge variant="secondary">Kaydedilmemiş değişiklik</Badge> : null}
          </div>
          <div className="rounded-xl border bg-muted/30 p-4">
            <DeviceSimulator config={config} platform={platform} onSelect={setSelected} selected={selected} />
          </div>
          <p className="text-xs text-muted-foreground">
            Mobil uygulama bu tasarımı <code>/api/public/mobile-app/&lt;magaza-slug&gt;</code> adresindeki JSON
            şemasından okur; “Yayınla” dediğinde tüm cihazlar yeni sürümü alır.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/* Alt bileşenler                                                      */
/* ------------------------------------------------------------------ */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
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

function DeepLinkField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const parsed = parseDeepLink(value);
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <Field label="Hedef">
        <Select value={parsed.kind} onValueChange={(kind) => onChange(buildDeepLink(kind as never, parsed.handle))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DEEP_LINK_KINDS.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {DEEP_LINK_LABELS[kind]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label={parsed.kind === "url" ? "Adres (https://)" : "Kısa ad (slug)"}>
        <Input
          value={parsed.handle ?? ""}
          placeholder={parsed.kind === "url" ? "https://..." : "kasmir-kazak"}
          onChange={(event) => onChange(buildDeepLink(parsed.kind, event.target.value))}
        />
      </Field>
    </div>
  );
}

function SortableWidgetRow({
  widget,
  active,
  onSelect,
  onToggle,
  onRemove,
}: {
  widget: MobileWidget;
  active: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id });
  const meta = WIDGET_CATALOG.find((item) => item.type === widget.type);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-card p-3",
        active && "border-primary",
        isDragging && "opacity-70",
      )}
    >
      <button
        type="button"
        className="cursor-grab text-muted-foreground"
        aria-label="Sırala"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span aria-hidden>{meta?.emoji}</span>
          {meta?.name}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{widget.title || meta?.description}</span>
      </button>
      <Button variant="ghost" size="icon" onClick={onToggle} aria-label="Görünürlük">
        {widget.visible ? <Eye className="size-4" /> : <EyeOff className="size-4 text-muted-foreground" />}
      </Button>
      <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Sil">
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

function WidgetSettings({
  widget,
  onChange,
}: {
  widget: MobileWidget;
  onChange: (value: Partial<MobileWidget>) => void;
}) {
  const meta = WIDGET_CATALOG.find((item) => item.type === widget.type);
  const hasItems = ["stories", "hero_carousel", "lookbook"].includes(widget.type);
  const hasProducts = ["product_grid", "flash_sale", "category_circles"].includes(widget.type);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <span aria-hidden className="mr-2">
            {meta?.emoji}
          </span>
          {meta?.name} ayarları
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Başlık">
          <Input value={widget.title} onChange={(event) => onChange({ title: event.target.value })} />
        </Field>
        <Field label="Alt başlık">
          <Input value={widget.subtitle} onChange={(event) => onChange({ subtitle: event.target.value })} />
        </Field>
        {widget.type === "banner" || widget.type === "lookbook" ? (
          <Field label="Görsel adresi">
            <Input
              value={widget.imageUrl}
              placeholder="https://..."
              onChange={(event) => onChange({ imageUrl: event.target.value })}
            />
          </Field>
        ) : null}
        {hasProducts ? (
          <>
            <Field label={`Gösterilecek adet: ${widget.limit}`}>
              <Slider
                min={1}
                max={24}
                step={1}
                value={[widget.limit]}
                onValueChange={([value]) => onChange({ limit: value ?? 6 })}
              />
            </Field>
            <Field label={`Kolon sayısı: ${widget.columns}`}>
              <Slider
                min={1}
                max={3}
                step={1}
                value={[widget.columns]}
                onValueChange={([value]) => onChange({ columns: value ?? 2 })}
              />
            </Field>
          </>
        ) : null}
        {widget.type === "flash_sale" ? (
          <Field label="Bitiş zamanı">
            <Input
              type="datetime-local"
              value={widget.endsAt}
              onChange={(event) => onChange({ endsAt: event.target.value })}
            />
          </Field>
        ) : null}
        {widget.type === "hero_carousel" ? (
          <ToggleRow
            label="Otomatik kaydır"
            checked={widget.autoplay}
            onChange={(value) => onChange({ autoplay: value })}
          />
        ) : null}
        <div className="sm:col-span-2">
          <DeepLinkField value={widget.link} onChange={(link) => onChange({ link })} />
        </div>

        {hasItems ? (
          <div className="space-y-3 sm:col-span-2">
            <Label className="text-sm font-medium">Öğeler</Label>
            {widget.items.map((item, index) => (
              <div key={item.id} className="space-y-3 rounded-lg border p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <Field label="Etiket">
                    <Input
                      value={item.label}
                      onChange={(event) =>
                        onChange({
                          items: widget.items.map((row, i) =>
                            i === index ? { ...row, label: event.target.value } : row,
                          ),
                        })
                      }
                    />
                  </Field>
                  <Field label="Görsel adresi">
                    <Input
                      value={item.imageUrl}
                      placeholder="https://..."
                      onChange={(event) =>
                        onChange({
                          items: widget.items.map((row, i) =>
                            i === index ? { ...row, imageUrl: event.target.value } : row,
                          ),
                        })
                      }
                    />
                  </Field>
                  <Button
                    variant="outline"
                    size="icon"
                    className="self-end"
                    onClick={() => onChange({ items: widget.items.filter((_, i) => i !== index) })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <DeepLinkField
                  value={item.link}
                  onChange={(link) =>
                    onChange({ items: widget.items.map((row, i) => (i === index ? { ...row, link } : row)) })
                  }
                />
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() =>
                onChange({
                  items: [
                    ...widget.items,
                    {
                      id: `i${widget.items.length + 1}-${widget.id}`,
                      label: "Yeni öğe",
                      imageUrl: "",
                      link: buildDeepLink("collection", ""),
                    },
                  ],
                })
              }
            >
              <Plus className="mr-2 size-4" /> Öğe ekle
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* --------------------------- Push panel --------------------------- */

function PushPanel({
  storeId,
  automations,
  devices,
  campaigns,
  onSend,
  onSaved,
}: {
  storeId: string;
  automations: PushAutomationRow[];
  devices: { total: number; ios: number; android: number };
  campaigns: { id: string; title: string; audience: string; status: string; recipients_count: number; created_at: string }[];
  onSend: (input: {
    title: string;
    body: string;
    imageUrl: string;
    deepLink: string;
    audience: PushAudience;
    scheduledAt?: string;
  }) => Promise<{ status: string; recipients: number; providerConfigured: boolean }>;
  onSaved: () => Promise<unknown>;
}) {
  const saveAutomation = useServerFn(saveMobilePushAutomation);
  const [rows, setRows] = useState<PushAutomationRow[]>(automations);
  useEffect(() => setRows(automations), [automations]);

  const [manual, setManual] = useState({
    title: "",
    body: "",
    imageUrl: "",
    deepLink: buildDeepLink("home"),
    audience: "all" as PushAudience,
    scheduledAt: "",
  });

  const send = useMutation({
    mutationFn: () =>
      onSend({
        title: manual.title,
        body: manual.body,
        imageUrl: manual.imageUrl,
        deepLink: manual.deepLink,
        audience: manual.audience,
        ...(manual.scheduledAt ? { scheduledAt: manual.scheduledAt } : {}),
      }),
    onSuccess: async (result) => {
      await onSaved();
      setManual((current) => ({ ...current, title: "", body: "" }));
      toast.success(
        result.status === "sent"
          ? `Bildirim ${result.recipients} cihaza gönderildi`
          : result.providerConfigured
            ? `Bildirim planlandı (${result.recipients} cihaz)`
            : `Bildirim kuyruğa alındı (${result.recipients} cihaz). Gönderim için push servisi bağlantısı gerekiyor.`,
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const persist = useMutation({
    mutationFn: (row: PushAutomationRow) => saveAutomation({ data: { storeId, ...row } }),
    onSuccess: async () => {
      await onSaved();
      toast.success("Otomasyon kuralı kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const update = (trigger: PushTrigger, value: Partial<PushAutomationRow>) =>
    setRows((current) => current.map((row) => (row.trigger === trigger ? { ...row, ...value } : row)));

  const sorted = useMemo(
    () => PUSH_TRIGGERS.map((trigger) => rows.find((row) => row.trigger === trigger)).filter(Boolean) as PushAutomationRow[],
    [rows],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kayıtlı uygulama cihazları</CardTitle>
          <CardDescription>
            Toplam {devices.total} cihaz · iOS {devices.ios} · Android {devices.android}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manuel bildirim gönder</CardTitle>
          <CardDescription>Görsel, metin ve derin bağlantı ile anlık duyuru/indirim bildirimi.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Başlık">
            <Input
              value={manual.title}
              placeholder="Bugüne özel %20 indirim"
              onChange={(event) => setManual((current) => ({ ...current, title: event.target.value }))}
            />
          </Field>
          <Field label="Hedef kitle">
            <Select
              value={manual.audience}
              onValueChange={(value) => setManual((current) => ({ ...current, audience: value as PushAudience }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PUSH_AUDIENCES.map((audience) => (
                  <SelectItem key={audience} value={audience}>
                    {PUSH_AUDIENCE_LABELS[audience]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Metin">
              <Textarea
                rows={2}
                value={manual.body}
                onChange={(event) => setManual((current) => ({ ...current, body: event.target.value }))}
              />
            </Field>
          </div>
          <Field label="Görsel adresi (opsiyonel)">
            <Input
              value={manual.imageUrl}
              placeholder="https://..."
              onChange={(event) => setManual((current) => ({ ...current, imageUrl: event.target.value }))}
            />
          </Field>
          <Field label="Planlanan zaman (opsiyonel)">
            <Input
              type="datetime-local"
              value={manual.scheduledAt}
              onChange={(event) => setManual((current) => ({ ...current, scheduledAt: event.target.value }))}
            />
          </Field>
          <div className="sm:col-span-2">
            <DeepLinkField value={manual.deepLink} onChange={(deepLink) => setManual((c) => ({ ...c, deepLink }))} />
          </div>
          <div className="sm:col-span-2">
            <Button onClick={() => send.mutate()} disabled={manual.title.trim().length < 3 || send.isPending}>
              <Send className="mr-2 size-4" /> Gönder
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Otomatik push senaryoları</CardTitle>
          <CardDescription>Terk edilmiş sepet, kargo durumu, fiyat düşüşü ve stok bildirimleri.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sorted.map((row) => {
            const meta = PUSH_TRIGGER_META[row.trigger];
            return (
              <div key={row.trigger} className="space-y-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <Bell className="size-4" /> {meta.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{meta.description}</p>
                  </div>
                  <Switch
                    checked={row.isActive}
                    onCheckedChange={(value) => update(row.trigger, { isActive: value })}
                    aria-label={`${meta.label} aktif`}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Başlık">
                    <Input value={row.title} onChange={(e) => update(row.trigger, { title: e.target.value })} />
                  </Field>
                  <Field label="Gecikme (dakika)">
                    <Input
                      type="number"
                      min={0}
                      max={20160}
                      value={row.delayMinutes}
                      onChange={(e) => update(row.trigger, { delayMinutes: Number(e.target.value) })}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Metin">
                      <Textarea rows={2} value={row.body} onChange={(e) => update(row.trigger, { body: e.target.value })} />
                    </Field>
                  </div>
                  <Field label="İndirim kodu (opsiyonel)">
                    <Input
                      value={row.discountCode}
                      onChange={(e) => update(row.trigger, { discountCode: e.target.value.toUpperCase() })}
                    />
                  </Field>
                  <Field label="Görsel adresi (opsiyonel)">
                    <Input value={row.imageUrl} onChange={(e) => update(row.trigger, { imageUrl: e.target.value })} />
                  </Field>
                  <div className="sm:col-span-2">
                    <DeepLinkField value={row.deepLink} onChange={(deepLink) => update(row.trigger, { deepLink })} />
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => persist.mutate(row)} disabled={persist.isPending}>
                  <Save className="mr-2 size-4" /> Kaydet
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gönderim geçmişi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz bildirim gönderilmedi.</p>
          ) : (
            campaigns.map((campaign) => (
              <div key={campaign.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{campaign.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(campaign.created_at).toLocaleString("tr-TR")} ·{" "}
                    {PUSH_AUDIENCE_LABELS[campaign.audience as PushAudience] ?? campaign.audience}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={campaign.status === "sent" ? "secondary" : "outline"}>
                    {campaign.status === "sent" ? "Gönderildi" : campaign.status === "scheduled" ? "Kuyrukta" : campaign.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{campaign.recipients_count} cihaz</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ----------------------- Device simulator ------------------------ */

function DeviceSimulator({
  config,
  platform,
  selected,
  onSelect,
}: {
  config: MobileAppConfig;
  platform: "ios" | "android";
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const { branding, navigation } = config;
  const tabs = navigation.tabs.filter((tab) => tab.visible);
  const radius = branding.radius;

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[360px] overflow-hidden border-8 border-neutral-900 bg-white shadow-xl",
        platform === "ios" ? "rounded-[42px]" : "rounded-[22px]",
      )}
      style={{ background: branding.background, color: branding.text }}
    >
      <div
        className="flex items-center justify-between px-5 py-2 text-[10px]"
        style={{ background: branding.primary, color: branding.background }}
      >
        <span>{platform === "ios" ? "9:41" : "09:41"}</span>
        <span>{branding.appName}</span>
        <span>100%</span>
      </div>

      <div className="h-[520px] space-y-3 overflow-y-auto p-3">
        {config.home
          .filter((widget) => widget.visible)
          .map((widget) => (
            <button
              key={widget.id}
              type="button"
              onClick={() => onSelect(widget.id)}
              className={cn("block w-full text-left", selected === widget.id && "ring-2 ring-offset-2")}
              style={{ borderRadius: radius }}
            >
              <WidgetPreview widget={widget} config={config} />
            </button>
          ))}
        {config.home.filter((w) => w.visible).length === 0 ? (
          <p className="p-6 text-center text-xs opacity-60">Görünür bileşen yok</p>
        ) : null}
      </div>

      <div
        className="flex items-center justify-around border-t px-2 py-2 text-[10px]"
        style={{ background: branding.surface, borderColor: `${branding.text}22` }}
      >
        {tabs.map((tab, index) => (
          <span
            key={tab.key}
            className="flex flex-col items-center gap-1"
            style={{ color: index === 0 ? branding.accent : `${branding.text}99` }}
          >
            <Layers className="size-4" />
            {tab.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function WidgetPreview({ widget, config }: { widget: MobileWidget; config: MobileAppConfig }) {
  const { branding } = config;
  const radius = branding.radius;
  const surface = { background: branding.surface, borderRadius: radius };

  switch (widget.type) {
    case "announcement_ticker":
      return (
        <div className="truncate px-3 py-2 text-[11px]" style={{ background: branding.accent, color: "#fff", borderRadius: radius }}>
          {widget.title}
        </div>
      );
    case "search_bar":
      return (
        <div className="flex items-center gap-2 px-3 py-2 text-[11px] opacity-70" style={surface}>
          🔍 {widget.title || "Ara"}
          {config.commerce.barcodeScan ? <span className="ml-auto">▤</span> : null}
          {config.commerce.voiceSearch ? <span>🎙️</span> : null}
        </div>
      );
    case "stories":
      return (
        <div className="flex gap-3 overflow-hidden">
          {(widget.items.length ? widget.items : [{ id: "a", label: "Hikaye", imageUrl: "", link: "" }]).map((item) => (
            <div key={item.id} className="flex w-14 shrink-0 flex-col items-center gap-1">
              <span
                className="size-14 rounded-full border-2"
                style={{ borderColor: branding.accent, background: branding.surface }}
              />
              <span className="w-full truncate text-center text-[9px]">{item.label}</span>
            </div>
          ))}
        </div>
      );
    case "hero_carousel":
      return (
        <div className="flex h-32 flex-col justify-end p-3 text-[11px] font-semibold text-white" style={{ borderRadius: radius, background: `linear-gradient(140deg, ${branding.primary}, ${branding.accent})` }}>
          {widget.items[0]?.label ?? widget.title}
        </div>
      );
    case "category_circles":
      return (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: Math.min(widget.limit, 5) }).map((_, index) => (
            <div key={index} className="flex w-14 shrink-0 flex-col items-center gap-1">
              <span className="size-12 rounded-full" style={{ background: `${branding.primary}18` }} />
              <span className="text-[9px] opacity-70">Kategori</span>
            </div>
          ))}
        </div>
      );
    case "flash_sale":
      return (
        <div className="space-y-2 p-3" style={surface}>
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span>{widget.title}</span>
            <span style={{ color: branding.accent }}>02:14:35</span>
          </div>
          <ProductGridPreview widget={widget} config={config} />
        </div>
      );
    case "product_grid":
      return (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold">{widget.title}</p>
          <ProductGridPreview widget={widget} config={config} />
        </div>
      );
    case "lookbook":
      return (
        <div className="relative h-36" style={{ borderRadius: radius, background: `${branding.primary}14` }}>
          <span className="absolute left-1/3 top-1/2 size-5 rounded-full border-2 border-white" style={{ background: branding.accent }} />
          <span className="absolute bottom-2 left-3 text-[10px] font-semibold">{widget.title}</span>
        </div>
      );
    case "banner":
      return (
        <div className="flex h-20 items-center justify-center text-[11px] font-semibold text-white" style={{ borderRadius: radius, background: branding.primary }}>
          {widget.title}
        </div>
      );
    default:
      return (
        <div className="space-y-1 p-3" style={surface}>
          <p className="text-[11px] font-semibold">{widget.title}</p>
          <p className="text-[10px] opacity-70">{widget.subtitle}</p>
        </div>
      );
  }
}

function ProductGridPreview({ widget, config }: { widget: MobileWidget; config: MobileAppConfig }) {
  const { branding } = config;
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${widget.columns}, minmax(0, 1fr))` }}>
      {Array.from({ length: Math.min(widget.limit, widget.columns * 2) }).map((_, index) => (
        <div key={index} className="overflow-hidden border" style={{ borderRadius: branding.radius, borderColor: `${branding.text}18` }}>
          <div className="aspect-square" style={{ background: `linear-gradient(140deg, ${branding.accent}22, ${branding.primary}18)` }} />
          <div className="space-y-1 p-2">
            <p className="truncate text-[9px]">Örnek ürün</p>
            <p className="text-[10px] font-semibold">1.290 ₺</p>
          </div>
        </div>
      ))}
    </div>
  );
}
