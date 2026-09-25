import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Download, ExternalLink, Loader2, ShoppingBag, Star } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { DeviceFrame, DeviceSwitcher, type PreviewDevice } from "@/components/device-preview";
import { PageRenderer } from "@/components/theme-v2/page-renderer";
import { useRenderCtx } from "@/components/theme-v2/use-render-ctx";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/mefti";
import { CATEGORY_LABEL } from "@/lib/theme-system-v2";
import { tsGetTemplate, tsInstallTemplate, tsReview } from "@/lib/theme-system-v2.functions";
import { presetToPages } from "@/lib/theme-v2";
import { cn } from "@/lib/utils";

const DESCRIPTION = "Tema detayı: ekran görüntüleri, canlı önizleme, özellikler ve mağaza yorumları.";

export const Route = createFileRoute("/_authenticated/store/$storeId/theme-marketplace/$templateId")({
  head: () => ({
    meta: [
      { title: "Tema Detayı — Mefticaret" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Tema Detayı — Mefticaret" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TemplateDetail,
});

function TemplateDetail() {
  const { storeId, templateId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const get = useServerFn(tsGetTemplate);
  const install = useServerFn(tsInstallTemplate);
  const review = useServerFn(tsReview);
  const ctx = useRenderCtx(storeId);
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [shotDevice, setShotDevice] = useState<"desktop" | "mobile" | "tablet">("desktop");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const q = useQuery({ queryKey: ["ts-template", storeId, templateId], queryFn: () => get({ data: { storeId, templateId } }), retry: false });
  const parsed = useMemo(() => { let n = 0; return q.data ? presetToPages(q.data.template.structure_json, () => `d-${n++}`) : null; }, [q.data]);

  const install$ = useMutation({
    mutationFn: () => install({ data: { storeId, templateId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ts-library", storeId] });
      toast.success("Tema kütüphanene eklendi.");
      void navigate({ to: "/store/$storeId/theme-library", params: { storeId } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Tema yüklenemedi."),
  });
  const review$ = useMutation({
    mutationFn: () => review({ data: { storeId, templateId, rating, comment } }),
    onSuccess: () => { toast.success("Yorumun kaydedildi."); qc.invalidateQueries({ queryKey: ["ts-template", storeId, templateId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Yorum kaydedilemedi."),
  });

  const back = <Button asChild variant="outline"><Link to="/store/$storeId/theme-marketplace" params={{ storeId }}><ArrowLeft className="mr-1 size-4" />Markete dön</Link></Button>;
  if (q.isLoading) return <AppShell storeId={storeId} title="Tema" actions={back}><div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin" /></div></AppShell>;
  if (q.isError || !q.data) return <AppShell storeId={storeId} title="Tema" actions={back}><p className="text-sm text-muted-foreground">{q.error instanceof Error ? q.error.message : "Tema bulunamadı."}</p></AppShell>;

  const { template: tpl, screenshots, reviews, myReview } = q.data;
  const paid = Number(tpl.price) > 0;
  const shots = screenshots.filter((s) => s.device_type === shotDevice);
  const features = Array.isArray(tpl.features) ? tpl.features : [];

  return (
    <AppShell storeId={storeId} title={tpl.name} description={tpl.description} actions={back}>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Canlı önizleme</h2>
              <DeviceSwitcher value={device} onChange={setDevice} />
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-xl border bg-muted/40 p-3">
              {parsed ? <DeviceFrame device={device}><PageRenderer sections={parsed.pages["home"] ?? []} settings={parsed.settings} ctx={ctx} /></DeviceFrame> : null}
            </div>
            <p className="text-xs text-muted-foreground">Önizleme kendi ürünlerinle gösteriliyor.</p>
          </section>

          {screenshots.length ? (
            <section className="space-y-3">
              <div className="flex gap-2">
                {(["desktop", "tablet", "mobile"] as const).map((d) => (
                  <button key={d} type="button" onClick={() => setShotDevice(d)} className={cn("h-10 rounded-full border px-4 text-sm", shotDevice === d && "border-foreground bg-foreground text-background")}>
                    {d === "desktop" ? "Masaüstü" : d === "tablet" ? "Tablet" : "Mobil"}
                  </button>
                ))}
              </div>
              <div className="flex snap-x gap-3 overflow-x-auto pb-2">
                {shots.length ? shots.map((s) => <img key={s.id} src={s.url} alt={`${tpl.name} ekran görüntüsü`} loading="lazy" className="h-64 shrink-0 snap-start rounded-lg border object-cover" />) : <p className="text-sm text-muted-foreground">Bu cihaz için görüntü yok.</p>}
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-base font-semibold">Yorumlar ({tpl.rating_count})</h2>
            <Card><CardContent className="space-y-3 p-4">
              <p className="text-sm font-medium">{myReview ? "Yorumunu güncelle" : "Bu temayı puanla"}</p>
              <div className="flex gap-1" role="radiogroup" aria-label="Puan">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={(rating || myReview?.rating || 0) === n} aria-label={`${n} yıldız`} onClick={() => setRating(n)} className="flex size-11 items-center justify-center">
                    <Star className={cn("size-6", n <= (rating || myReview?.rating || 0) ? "fill-current" : "text-muted-foreground")} />
                  </button>
                ))}
              </div>
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={myReview?.comment || "Deneyimini yaz (isteğe bağlı)"} maxLength={1000} />
              <Button className="h-11" disabled={!rating || review$.isPending} onClick={() => review$.mutate()}>Gönder</Button>
            </CardContent></Card>
            {reviews.length ? reviews.map((r) => (
              <div key={r.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{r.author_name || "Mağaza"}</span>
                  <span className="inline-flex items-center gap-0.5">{Array.from({ length: r.rating }, (_, i) => <Star key={i} className="size-3.5 fill-current" />)}</span>
                </div>
                {r.comment ? <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p> : null}
              </div>
            )) : <p className="text-sm text-muted-foreground">Henüz yorum yok.</p>}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card><CardContent className="space-y-4 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-semibold">{paid ? formatMoney(Number(tpl.price), tpl.currency) : "Ücretsiz"}</span>
              <span className="inline-flex items-center gap-1 text-sm"><Star className="size-4 fill-current" />{Number(tpl.rating_avg).toFixed(1)}</span>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <dt>Kategori</dt><dd className="text-foreground">{CATEGORY_LABEL[tpl.category] ?? tpl.category}</dd>
              <dt>Sürüm</dt><dd className="text-foreground">{tpl.version}</dd>
              <dt>Yazar</dt><dd className="text-foreground">{tpl.author}</dd>
              <dt>Kurulum</dt><dd className="text-foreground">{tpl.downloads_count}</dd>
            </dl>
            {paid ? (
              <Button asChild className="h-11 w-full"><Link to="/store/$storeId/theme-store" params={{ storeId }}><ShoppingBag className="mr-1 size-4" />Satın al</Link></Button>
            ) : (
              <Button className="h-11 w-full" disabled={install$.isPending} onClick={() => install$.mutate()}>
                {install$.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Download className="mr-1 size-4" />}Kütüphaneye yükle
              </Button>
            )}
            {paid ? <Button variant="outline" className="h-11 w-full" disabled={install$.isPending} onClick={() => install$.mutate()}>Satın aldım, yükle</Button> : null}
            {tpl.preview_url ? <Button asChild variant="outline" className="h-11 w-full"><a href={tpl.preview_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1 size-4" />Canlı demo</a></Button> : null}
          </CardContent></Card>
          {features.length ? (
            <Card><CardContent className="space-y-2 p-4">
              <h3 className="text-sm font-semibold">Özellikler</h3>
              <ul className="space-y-1.5 text-sm">{features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" />{f}</li>)}</ul>
            </CardContent></Card>
          ) : null}
        </aside>
      </div>
    </AppShell>
  );
}
