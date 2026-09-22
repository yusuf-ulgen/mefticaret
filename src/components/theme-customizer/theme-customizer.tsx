/**
 * Canlı önizleme customizer: solda ayarlar, sağda gerçek vitrin (iframe).
 * Değişiklikler 300 ms gecikmeyle geçici önizleme oturumuna yazılır ve
 * aynı anda iframe'e postMessage ile iletilir — yayınlanana kadar kaydedilmez.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Monitor, RotateCcw, Smartphone, Tablet, Upload } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FONT_PAIRS, THEME_LAYOUTS } from "@/lib/theme-presets";
import { storeQuery } from "@/lib/store-queries";
import { storeThemeQuery } from "@/lib/theme-queries";
import {
  BUTTON_STYLES,
  CARD_STYLES,
  PREVIEW_MESSAGE_TYPE,
  sanitizePreviewValue,
  type PreviewKey,
  type PreviewSettings,
  type PreviewValue,
} from "@/lib/theme-preview";
import {
  discardThemePreview,
  patchThemePreviewSetting,
  publishThemePreview,
  startThemePreview,
} from "@/lib/theme-preview.functions";

const DEVICES = [
  { key: "desktop", label: "Masaüstü", width: "100%", icon: Monitor },
  { key: "tablet", label: "Tablet", width: "820px", icon: Tablet },
  { key: "mobile", label: "Mobil", width: "393px", icon: Smartphone },
] as const;

type DeviceKey = (typeof DEVICES)[number]["key"];

export function ThemeCustomizer({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const { data: store } = useQuery(storeQuery(storeId));
  const { data: theme } = useQuery(storeThemeQuery(storeId));

  const start = useServerFn(startThemePreview);
  const patch = useServerFn(patchThemePreviewSetting);
  const publish = useServerFn(publishThemePreview);
  const discard = useServerFn(discardThemePreview);

  const [token, setToken] = useState<string | null>(null);
  const [draft, setDraft] = useState<PreviewSettings>({});
  const [device, setDevice] = useState<DeviceKey>("desktop");
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const timers = useRef(new Map<PreviewKey, number>());

  const session = useQuery({
    queryKey: ["theme-preview-session", storeId],
    queryFn: () => start({ data: { storeId } }),
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    if (session.data?.previewToken) setToken(session.data.previewToken);
  }, [session.data?.previewToken]);

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const id of map.values()) window.clearTimeout(id);
      map.clear();
    };
  }, []);

  const value = useCallback(
    (key: PreviewKey): PreviewValue | undefined => {
      if (draft[key] !== undefined) return draft[key];
      const current = theme as unknown as Record<string, PreviewValue | null> | null | undefined;
      const raw = current?.[key];
      return raw === null || raw === undefined ? undefined : raw;
    },
    [draft, theme],
  );

  const setValue = useCallback(
    (key: PreviewKey, next: PreviewValue) => {
      const clean = sanitizePreviewValue(key, next);
      if (clean === null) return;
      setDraft((current) => ({ ...current, [key]: clean }));

      // Anlık görsel güncelleme: iframe sayfa yenilemeden değeri uygular.
      if (token) {
        frameRef.current?.contentWindow?.postMessage(
          { type: PREVIEW_MESSAGE_TYPE, token, key, value: clean },
          window.location.origin,
        );
      }

      // 300 ms debounce ile geçici oturuma yaz.
      const existing = timers.current.get(key);
      if (existing) window.clearTimeout(existing);
      const id = window.setTimeout(() => {
        timers.current.delete(key);
        if (!token) return;
        void patch({ data: { storeId, token, key, value: clean } }).catch((error: Error) =>
          toast.error(error.message),
        );
      }, 300);
      timers.current.set(key, id);
    },
    [patch, storeId, token],
  );

  const publishMutation = useMutation({
    mutationFn: () => {
      if (!token) throw new Error("Önizleme oturumu hazır değil");
      return publish({ data: { storeId, token } });
    },
    onSuccess: async (result) => {
      setDraft({});
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["store-theme", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["storefront", store?.slug] }),
      ]);
      frameRef.current?.contentWindow?.location.reload();
      toast.success(`Yayınlandı — ${result.applied} ayar mağazaya işlendi`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const discardMutation = useMutation({
    mutationFn: () => {
      if (!token) throw new Error("Önizleme oturumu hazır değil");
      return discard({ data: { storeId, token } });
    },
    onSuccess: async () => {
      setDraft({});
      setToken(null);
      await queryClient.invalidateQueries({ queryKey: ["theme-preview-session", storeId] });
      toast.success("Değişiklikler iptal edildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const previewUrl = useMemo(() => {
    if (!store?.slug || !token) return null;
    return `/s/${store.slug}?preview_token=${token}`;
  }, [store?.slug, token]);

  const dirty = Object.keys(draft).length > 0;
  const deviceWidth = DEVICES.find((item) => item.key === device)?.width ?? "100%";

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Görünüm ayarları</CardTitle>
            {dirty ? <Badge variant="secondary">Kaydedilmedi</Badge> : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <ColorField label="Ana renk" value={String(value("primary_color") ?? "#1f2933")} onChange={(v) => setValue("primary_color", v)} />
            <ColorField label="Vurgu rengi" value={String(value("accent_color") ?? "#e0a136")} onChange={(v) => setValue("accent_color", v)} />
            <ColorField label="Arka plan" value={String(value("background_color") ?? "#fbf9f5")} onChange={(v) => setValue("background_color", v)} />

            <div className="space-y-2">
              <Label>Yazı tipi çifti</Label>
              <Select value={String(value("font_pair") ?? "sora-manrope")} onValueChange={(v) => setValue("font_pair", v)}>
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
              <Select value={String(value("layout") ?? "hero-grid")} onValueChange={(v) => setValue("layout", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THEME_LAYOUTS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Buton stili</Label>
                <Select value={String(value("button_style") ?? "solid")} onValueChange={(v) => setValue("button_style", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUTTON_STYLES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kart stili</Label>
                <Select value={String(value("card_style") ?? "soft")} onValueChange={(v) => setValue("card_style", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_STYLES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <SliderField
              label="Köşe yumuşaklığı"
              value={Number(value("radius") ?? 0.75)}
              min={0}
              max={2}
              step={0.05}
              suffix="rem"
              onChange={(v) => setValue("radius", v)}
            />
            <SliderField
              label="İçerik genişliği"
              value={Number(value("content_width") ?? 1140)}
              min={900}
              max={1600}
              step={20}
              suffix="px"
              onChange={(v) => setValue("content_width", v)}
            />
            <SliderField
              label="Bölüm aralığı"
              value={Number(value("section_spacing") ?? 48)}
              min={16}
              max={120}
              step={4}
              suffix="px"
              onChange={(v) => setValue("section_spacing", v)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vitrin metinleri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Başlık</Label>
              <Input value={String(value("hero_title") ?? "")} onChange={(e) => setValue("hero_title", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Alt başlık</Label>
              <Textarea
                rows={3}
                value={String(value("hero_subtitle") ?? "")}
                onChange={(e) => setValue("hero_subtitle", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Buton yazısı</Label>
              <Input
                value={String(value("hero_cta_label") ?? "")}
                onChange={(e) => setValue("hero_cta_label", e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <Label className="text-sm">Duyuru çubuğu</Label>
              <Switch
                checked={Boolean(value("show_announcement") ?? false)}
                onCheckedChange={(checked) => setValue("show_announcement", checked)}
              />
            </div>
            <div className="space-y-2">
              <Label>Duyuru metni</Label>
              <Input
                value={String(value("announcement") ?? "")}
                onChange={(e) => setValue("announcement", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => publishMutation.mutate()}
            disabled={!token || !dirty || publishMutation.isPending}
          >
            {publishMutation.isPending ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <Upload className="mr-1 size-4" />
            )}
            Yayınla
          </Button>
          <Button
            variant="outline"
            onClick={() => discardMutation.mutate()}
            disabled={!token || discardMutation.isPending}
          >
            <RotateCcw className="mr-1 size-4" /> İptal et
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Canlı önizleme</CardTitle>
          <div className="flex gap-1">
            {DEVICES.map((item) => (
              <Button
                key={item.key}
                size="sm"
                variant={device === item.key ? "secondary" : "ghost"}
                onClick={() => setDevice(item.key)}
              >
                <item.icon className="size-4" />
                <span className="sr-only">{item.label}</span>
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {session.error ? (
            <p className="text-sm text-destructive">Önizleme başlatılamadı: {(session.error as Error).message}</p>
          ) : previewUrl ? (
            <div className="mx-auto overflow-hidden rounded-xl border bg-background" style={{ width: deviceWidth, maxWidth: "100%" }}>
              <iframe
                ref={frameRef}
                src={previewUrl}
                title="Mağaza önizlemesi"
                className="h-[70vh] w-full border-0"
              />
            </div>
          ) : (
            <div className="flex h-[70vh] items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" /> Önizleme hazırlanıyor…
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 cursor-pointer rounded border bg-transparent"
          aria-label={label}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      </div>
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-xs text-muted-foreground">
          {value}
          {suffix}
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([next]) => onChange(next ?? value)} />
    </div>
  );
}
