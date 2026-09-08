import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Palette, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveThemeDesign } from "@/lib/theme-design.functions";
import { DEFAULT_DESIGN_TOKENS, resolveDesignTokens, type DesignTokens } from "@/lib/theme-design";

/** Sidebar içinde çalışan global tema ayarları sekmesi (renk, tipografi, yerleşim, sepet, etiket). */
export function ThemeSettingsPanel({
  storeId,
  theme,
  onOpenBrandDialog,
  onDraftChange,
}: {
  storeId: string;
  theme: unknown;
  onOpenBrandDialog: () => void;
  onDraftChange?: (tokens: DesignTokens) => void;
}) {
  const queryClient = useQueryClient();
  const save = useServerFn(saveThemeDesign);

  const serverTokens = useMemo(
    () => resolveDesignTokens((theme as { design_tokens?: unknown } | null)?.design_tokens),
    [theme],
  );
  const [draft, setDraft] = useState<DesignTokens>(serverTokens);

  useEffect(() => {
    setDraft(serverTokens);
  }, [serverTokens]);

  // Canlı önizlemenin anında güncellenmesi için taslağı üst bileşene bildir.
  useEffect(() => {
    onDraftChange?.(draft);
  }, [draft, onDraftChange]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(serverTokens);

  const patch = <K extends keyof DesignTokens>(group: K, value: Partial<DesignTokens[K]>) =>
    setDraft((current) => ({ ...current, [group]: { ...current[group], ...value } }));

  const mutation = useMutation({
    mutationFn: () => save({ data: { storeId, tokens: draft } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["store-theme", storeId] });
      toast.success("Tema ayarları kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const colorRow = (label: string, key: keyof DesignTokens["colors"]) => (
    <div key={key} className="flex items-center justify-between gap-2">
      <Label htmlFor={`color-${key}`} className="text-xs">
        {label}
      </Label>
      <input
        id={`color-${key}`}
        type="color"
        value={draft.colors[key]}
        onChange={(event) => patch("colors", { [key]: event.target.value } as Partial<DesignTokens["colors"]>)}
        className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent"
      />
    </div>
  );

  const numberRow = (
    label: string,
    value: number,
    onChange: (next: number) => void,
    { min, max, step = 1 }: { min: number; max: number; step?: number },
  ) => (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-8 w-24 text-xs"
      />
    </div>
  );

  const switchRow = (label: string, value: boolean, onChange: (next: boolean) => void) => (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs">{label}</Label>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );

  const group = (title: string, children: React.ReactNode) => (
    <section className="space-y-2 rounded-lg border border-border p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );

  return (
    <div className="space-y-3">
      <Button variant="outline" size="sm" className="w-full justify-start" onClick={onOpenBrandDialog}>
        <Palette className="mr-2 size-4" /> Marka renkleri, font ve logo
      </Button>

      {group(
        "Renkler",
        <div className="space-y-2">
          {colorRow("Yüzey", "surface")}
          {colorRow("Metin", "text")}
          {colorRow("İkincil metin", "muted")}
          {colorRow("Kenarlık", "border")}
          {colorRow("İndirim", "sale")}
          {colorRow("Başarı", "success")}
        </div>,
      )}

      {group(
        "Tipografi",
        <div className="space-y-2">
          {numberRow("Başlık boyutu (masaüstü)", draft.typography.headingSize.desktop, (next) =>
            patch("typography", {
              headingSize: { ...draft.typography.headingSize, desktop: next },
            }), { min: 14, max: 96 })}
          {numberRow("Başlık boyutu (mobil)", draft.typography.headingSize.mobile, (next) =>
            patch("typography", {
              headingSize: { ...draft.typography.headingSize, mobile: next },
            }), { min: 14, max: 64 })}
          {numberRow("Gövde boyutu", draft.typography.bodySize.desktop, (next) =>
            patch("typography", { bodySize: { ...draft.typography.bodySize, desktop: next } }), {
            min: 11,
            max: 26,
          })}
          {numberRow("Satır yüksekliği", draft.typography.lineHeight, (next) =>
            patch("typography", { lineHeight: next }), { min: 1, max: 2.4, step: 0.05 })}
          {switchRow("Başlıklar büyük harf", draft.typography.uppercaseHeadings, (next) =>
            patch("typography", { uppercaseHeadings: next }))}
        </div>,
      )}

      {group(
        "Yerleşim",
        <div className="space-y-2">
          {numberRow("Bölüm boşluğu (masaüstü)", draft.spacing.section.desktop, (next) =>
            patch("spacing", { section: { ...draft.spacing.section, desktop: next } }), { min: 0, max: 200 })}
          {numberRow("Izgara boşluğu", draft.spacing.gridGap.desktop, (next) =>
            patch("spacing", { gridGap: { ...draft.spacing.gridGap, desktop: next } }), { min: 0, max: 64 })}
          {numberRow("İç kenar boşluğu", draft.spacing.containerPadding.desktop, (next) =>
            patch("spacing", { containerPadding: { ...draft.spacing.containerPadding, desktop: next } }), {
            min: 0,
            max: 80,
          })}
          {numberRow("Kart gölgesi (0-3)", draft.cards.shadow, (next) => patch("cards", { shadow: next }), {
            min: 0,
            max: 3,
          })}
        </div>,
      )}

      {group(
        "Sepet & ödeme",
        <div className="space-y-2">
          {switchRow("Sepet çekmecesi olarak açılsın", draft.commerce.cartMode === "drawer", (next) =>
            patch("commerce", { cartMode: next ? "drawer" : "page" }))}
          {switchRow("Ücretsiz kargo barı", draft.commerce.freeShippingBar, (next) =>
            patch("commerce", { freeShippingBar: next }))}
          {numberRow(
            "Eşik (0 = kargo tarifesi)",
            draft.commerce.freeShippingThreshold,
            (next) => patch("commerce", { freeShippingThreshold: next }),
            { min: 0, max: 1_000_000, step: 10 },
          )}
          {switchRow("Sepette ürün önerisi", draft.commerce.upsell, (next) => patch("commerce", { upsell: next }))}
        </div>,
      )}

      {group(
        "Etiketler",
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs" htmlFor="badge-sale">
              İndirim etiketi
            </Label>
            <Input
              id="badge-sale"
              value={draft.badges.saleLabel}
              onChange={(event) => patch("badges", { saleLabel: event.target.value })}
              className="h-8 w-32 text-xs"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {"{indirim}"} yazdığın yere indirim oranı gelir. Örnek: -%{"{indirim}"}
          </p>
          {colorBadgeRow("İndirim rengi", draft.badges.saleColor, (next) => patch("badges", { saleColor: next }))}
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs" htmlFor="badge-soldout">
              Tükendi etiketi
            </Label>
            <Input
              id="badge-soldout"
              value={draft.badges.soldOutLabel}
              onChange={(event) => patch("badges", { soldOutLabel: event.target.value })}
              className="h-8 w-32 text-xs"
            />
          </div>
        </div>,
      )}

      <div className="flex gap-2">
        <Button size="sm" className="flex-1" disabled={!dirty || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <Save className="mr-1.5 size-3.5" />
          )}
          Ayarları kaydet
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setDraft(DEFAULT_DESIGN_TOKENS)}
          aria-label="Varsayılanlara dön"
        >
          <RotateCcw className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function colorBadgeRow(label: string, value: string, onChange: (next: string) => void) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs">{label}</Label>
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent"
      />
    </div>
  );
}
