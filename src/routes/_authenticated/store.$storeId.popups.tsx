import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MousePointerClick, Eye, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/ui/data-skeleton";
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
import { storePopupsQuery } from "@/lib/marketing-tools-queries";
import { deleteStorePopup, toggleStorePopup, upsertStorePopup } from "@/lib/marketing-tools.functions";
import {
  POPUP_ANIMATIONS,
  POPUP_ANIMATION_LABELS,
  POPUP_FREQUENCIES,
  POPUP_FREQUENCY_LABELS,
  POPUP_PAGE_TARGETS,
  POPUP_PAGE_TARGET_LABELS,
  POPUP_POSITIONS,
  POPUP_POSITION_LABELS,
  parseDisplayRules,
  type PopupAnimation,
  type PopupFrequency,
  type PopupPageTarget,
  type PopupPosition,
} from "@/lib/popups";

export const Route = createFileRoute("/_authenticated/store/$storeId/popups")({
  head: () => {
    const title = "Animasyonlu Popup Yöneticisi — Mefticaret";
    const description =
      "Vitrininizde gösterilecek animasyonlu popup kampanyalarını oluşturun, zamanlayın ve performansını takip edin.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: () => (
    <AppShell title="Popup Yöneticisi" description="Bu sayfa şu anda yüklenemedi.">
      <div className="surface-card p-10 text-center text-sm text-muted-foreground">
        Bir sorun oluştu. Sayfayı yenilemeyi deneyin.
      </div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell title="Popup Yöneticisi" description="Kayıt bulunamadı.">
      <div className="surface-card p-10 text-center text-sm text-muted-foreground">
        Aradığınız popup bulunamadı.
      </div>
    </AppShell>
  ),
  component: PopupsPage,
});

type PopupRow = NonNullable<Awaited<ReturnType<NonNullable<ReturnType<typeof storePopupsQuery>["queryFn"]>>>>[number];

const EMPTY_FORM = {
  id: undefined as string | undefined,
  name: "",
  isActive: false,
  animation: "fade" as PopupAnimation,
  position: "center" as PopupPosition,
  headline: "",
  body: "",
  ctaLabel: "",
  ctaUrl: "",
  imageUrl: "",
  accentColor: "#1f2933",
  delaySeconds: "3",
  frequency: "session" as PopupFrequency,
  pages: ["all"] as PopupPageTarget[],
  startsAt: "",
  endsAt: "",
};

function toDatetimeLocal(iso: string | null) {
  if (!iso) return "";
  return iso.slice(0, 16);
}

function fromDatetimeLocal(value: string) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function PopupPreview({ form }: { form: typeof EMPTY_FORM }) {
  return (
    <div className="relative h-64 overflow-hidden rounded-xl border border-dashed border-border/60 bg-muted/30 p-4">
      <p className="mb-3 text-xs font-medium uppercase text-muted-foreground">Canlı önizleme</p>
      <div
        className="mx-auto max-w-xs rounded-xl border bg-card p-4 shadow-lg"
        style={{ borderColor: form.accentColor || undefined }}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold">{form.headline || "Başlık girin"}</h3>
          <span className="text-xs text-muted-foreground">✕</span>
        </div>
        {form.imageUrl ? (
          <img src={form.imageUrl} alt="" className="mt-2 max-h-24 w-full rounded-lg object-cover" />
        ) : null}
        {form.body ? <p className="mt-2 text-xs text-muted-foreground">{form.body}</p> : null}
        {form.ctaLabel ? (
          <span
            className="mt-3 inline-block rounded-md px-3 py-1.5 text-xs font-semibold text-white"
            style={{ background: form.accentColor || "#1f2933" }}
          >
            {form.ctaLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function PopupsPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: popups, isLoading } = useQuery(storePopupsQuery(storeId));

  const save = useServerFn(upsertStorePopup);
  const remove = useServerFn(deleteStorePopup);
  const toggle = useServerFn(toggleStorePopup);

  const [form, setForm] = useState(EMPTY_FORM);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["marketing-tools", storeId, "popups"] });

  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: form.id,
          storeId,
          name: form.name,
          isActive: form.isActive,
          animation: form.animation,
          position: form.position,
          headline: form.headline,
          body: form.body,
          ctaLabel: form.ctaLabel || null,
          ctaUrl: form.ctaUrl || null,
          imageUrl: form.imageUrl || null,
          accentColor: form.accentColor || null,
          delaySeconds: Number(form.delaySeconds) || 0,
          frequency: form.frequency,
          pages: form.pages,
          startsAt: fromDatetimeLocal(form.startsAt),
          endsAt: fromDatetimeLocal(form.endsAt),
          sortOrder: 0,
        },
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success(form.id ? "Popup güncellendi" : "Popup oluşturuldu");
      setForm(EMPTY_FORM);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { storeId, id } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Popup silindi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleMutation = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) => toggle({ data: { storeId, ...input } }),
    onSuccess: () => invalidate(),
    onError: (error: Error) => toast.error(error.message),
  });

  function editPopup(popup: PopupRow) {
    const rules = parseDisplayRules(popup.display_rules);
    setForm({
      id: popup.id,
      name: popup.name,
      isActive: popup.is_active,
      animation: popup.animation as PopupAnimation,
      position: popup.position as PopupPosition,
      headline: popup.headline ?? "",
      body: popup.body ?? "",
      ctaLabel: popup.cta_label ?? "",
      ctaUrl: popup.cta_url ?? "",
      imageUrl: popup.image_url ?? "",
      accentColor: popup.accent_color ?? "#1f2933",
      delaySeconds: String(rules.delaySeconds),
      frequency: rules.frequency,
      pages: rules.pages,
      startsAt: toDatetimeLocal(popup.starts_at),
      endsAt: toDatetimeLocal(popup.ends_at),
    });
  }

  function togglePage(page: PopupPageTarget) {
    setForm((prev) => {
      const has = prev.pages.includes(page);
      const next = has ? prev.pages.filter((p) => p !== page) : [...prev.pages, page];
      return { ...prev, pages: next.length ? next : ["all"] };
    });
  }

  return (
    <AppShell
      storeId={storeId}
      title="Animasyonlu Popup Yöneticisi"
      description="Vitrininizde gösterilecek popup kampanyalarını oluşturun ve performansını izleyin."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <form
            className="surface-card space-y-4 p-6"
            onSubmit={(event) => {
              event.preventDefault();
              saveMutation.mutate();
            }}
          >
            <h2 className="text-lg font-semibold">{form.id ? "Popup düzenle" : "Yeni popup"}</h2>
            <div className="space-y-2">
              <Label htmlFor="p-name">Ad (yalnızca panelde görünür)</Label>
              <Input
                id="p-name"
                required
                minLength={2}
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Kış kampanyası popup'ı"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-headline">Başlık</Label>
              <Input
                id="p-headline"
                value={form.headline}
                onChange={(event) => setForm((prev) => ({ ...prev, headline: event.target.value }))}
                placeholder="%20 indirim kaçmasın!"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-body">Metin</Label>
              <Textarea
                id="p-body"
                rows={3}
                value={form.body}
                onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="p-cta-label">Buton etiketi</Label>
                <Input
                  id="p-cta-label"
                  value={form.ctaLabel}
                  onChange={(event) => setForm((prev) => ({ ...prev, ctaLabel: event.target.value }))}
                  placeholder="Alışverişe başla"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-cta-url">Buton linki</Label>
                <Input
                  id="p-cta-url"
                  value={form.ctaUrl}
                  onChange={(event) => setForm((prev) => ({ ...prev, ctaUrl: event.target.value }))}
                  placeholder="/koleksiyon/kis"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-image">Görsel URL</Label>
              <Input
                id="p-image"
                value={form.imageUrl}
                onChange={(event) => setForm((prev) => ({ ...prev, imageUrl: event.target.value }))}
                placeholder="https://…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="p-accent">Vurgu rengi</Label>
                <Input
                  id="p-accent"
                  type="color"
                  className="h-10 p-1"
                  value={form.accentColor}
                  onChange={(event) => setForm((prev) => ({ ...prev, accentColor: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-delay">Gecikme (sn)</Label>
                <Input
                  id="p-delay"
                  type="number"
                  min={0}
                  max={120}
                  value={form.delaySeconds}
                  onChange={(event) => setForm((prev) => ({ ...prev, delaySeconds: event.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Animasyon</Label>
                <Select
                  value={form.animation}
                  onValueChange={(next) => setForm((prev) => ({ ...prev, animation: next as PopupAnimation }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POPUP_ANIMATIONS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {POPUP_ANIMATION_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Konum</Label>
                <Select
                  value={form.position}
                  onValueChange={(next) => setForm((prev) => ({ ...prev, position: next as PopupPosition }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POPUP_POSITIONS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {POPUP_POSITION_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Sıklık</Label>
              <Select
                value={form.frequency}
                onValueChange={(next) => setForm((prev) => ({ ...prev, frequency: next as PopupFrequency }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POPUP_FREQUENCIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {POPUP_FREQUENCY_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sayfa hedefi</Label>
              <div className="flex flex-wrap gap-2">
                {POPUP_PAGE_TARGETS.map((value) => (
                  <Badge
                    key={value}
                    variant={form.pages.includes(value) ? "default" : "secondary"}
                    className="cursor-pointer"
                    onClick={() => togglePage(value)}
                  >
                    {POPUP_PAGE_TARGET_LABELS[value]}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="p-starts">Başlangıç</Label>
                <Input
                  id="p-starts"
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) => setForm((prev) => ({ ...prev, startsAt: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-ends">Bitiş</Label>
                <Input
                  id="p-ends"
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(event) => setForm((prev) => ({ ...prev, endsAt: event.target.value }))}
                />
              </div>
            </div>
            <label className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 text-sm">
              <span>Aktif</span>
              <Switch
                checked={form.isActive}
                onCheckedChange={(next) => setForm((prev) => ({ ...prev, isActive: next }))}
              />
            </label>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Kaydediliyor…" : form.id ? "Güncelle" : "Oluştur"}
              </Button>
              {form.id ? (
                <Button type="button" variant="outline" onClick={() => setForm(EMPTY_FORM)}>
                  Vazgeç
                </Button>
              ) : null}
            </div>
          </form>

          <PopupPreview form={form} />
        </div>

        <div className="lg:col-span-2">
          {isLoading ? (
            <CardSkeleton count={4} />
          ) : (popups ?? []).length === 0 ? (
            <div className="surface-card p-10 text-center">
              <Sparkles className="mx-auto mb-3 size-6 text-muted-foreground" />
              <p className="font-medium">Henüz popup yok</p>
              <p className="text-sm text-muted-foreground">Soldaki formla ilk popup'ını oluştur.</p>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {(popups ?? []).map((popup) => (
                <li key={popup.id} className="surface-card space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{popup.name}</p>
                      <p className="text-xs text-muted-foreground">{popup.headline}</p>
                    </div>
                    <Switch
                      checked={popup.is_active}
                      aria-label={`${popup.name} popup'ını aç/kapat`}
                      onCheckedChange={(next) => toggleMutation.mutate({ id: popup.id, isActive: next })}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">{POPUP_ANIMATION_LABELS[popup.animation as PopupAnimation]}</Badge>
                    <Badge variant="secondary">{POPUP_POSITION_LABELS[popup.position as PopupPosition]}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="size-3.5" /> {popup.impressions ?? 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <MousePointerClick className="size-3.5" /> {popup.clicks ?? 0}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => editPopup(popup)}>
                      Düzenle
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => deleteMutation.mutate(popup.id)}
                    >
                      <Trash2 className="mr-1 size-3.5" /> Sil
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
