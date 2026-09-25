import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { DeviceFrame, DeviceSwitcher, type PreviewDevice } from "@/components/device-preview";
import { PageRenderer, type V2RenderContext } from "@/components/theme-v2/page-renderer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { storeQuery } from "@/lib/store-queries";
import { storefrontQuery } from "@/lib/storefront-queries";
import { presetToPages } from "@/lib/theme-v2";
import { v2ApplyPreset, v2Bootstrap, v2ListPresets, v2Publish } from "@/lib/theme-v2.functions";

const DESCRIPTION = "Hazır tema tasarımlarını kendi ürünlerinle önizle, tek tıkla uygula ve mağazanı dakikalar içinde kur.";

export const Route = createFileRoute("/_authenticated/store/$storeId/theme-presets")({
  head: () => ({
    meta: [
      { title: "Hazır Temalar — Mefticaret" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Hazır Temalar — Mefticaret" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ThemePresetsPage,
});

type Preset = { id: string; name: string; structure: unknown };

function ThemePresetsPage() {
  const { storeId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const bootstrap = useServerFn(v2Bootstrap);
  const listPresets = useServerFn(v2ListPresets);
  const applyPreset = useServerFn(v2ApplyPreset);
  const publish = useServerFn(v2Publish);

  const { data: store } = useQuery(storeQuery(storeId));
  const { data: storefront } = useQuery({ ...storefrontQuery(store?.slug ?? ""), enabled: Boolean(store?.slug) });
  const boot = useQuery({ queryKey: ["v2-theme-boot", storeId], queryFn: () => bootstrap({ data: { storeId } }), retry: false });
  const presets = useQuery({
    queryKey: ["v2-presets", storeId],
    queryFn: () => listPresets({ data: { storeId } }) as Promise<Preset[]>,
    enabled: boot.isSuccess,
  });

  const [preview, setPreview] = useState<Preset | null>(null);
  const [device, setDevice] = useState<PreviewDevice>("desktop");

  const ctx: V2RenderContext = {
    storeSlug: store?.slug ?? "",
    currency: store?.currency ?? "TRY",
    products: (storefront?.products ?? []) as V2RenderContext["products"],
    collections: storefront?.collections ?? [],
    blogPages: (storefront?.blogPages ?? []) as NonNullable<V2RenderContext["blogPages"]>,
  };

  const parsed = useMemo(() => {
    const map = new Map<string, ReturnType<typeof presetToPages>>();
    let n = 0;
    for (const p of presets.data ?? []) map.set(p.id, presetToPages(p.structure, () => `p-${n++}`));
    return map;
  }, [presets.data]);

  const targetTheme = boot.data?.themes.find((t) => t.status === "active") ?? boot.data?.themes[0];

  const apply = useMutation({
    mutationFn: async ({ preset, andPublish }: { preset: Preset; andPublish: boolean }) => {
      if (!targetTheme) throw new Error("Tema bulunamadı.");
      await applyPreset({ data: { storeId, themeId: targetTheme.id, presetId: preset.id, mode: "full" } });
      if (andPublish) await publish({ data: { storeId, themeId: targetTheme.id } });
      return andPublish;
    },
    onSuccess: (published) => {
      qc.invalidateQueries({ queryKey: ["v2-theme-boot", storeId] });
      toast.success(published ? "Tema uygulandı ve mağazanda yayında." : "Tema uygulandı, editörde düzenleyebilirsin.");
      setPreview(null);
      if (!published) void navigate({ to: "/store/$storeId/theme-editor-v2", params: { storeId } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Tema uygulanamadı."),
  });

  return (
    <AppShell
      storeId={storeId}
      title="Hazır Temalar"
      description={DESCRIPTION}
      actions={
        <Button asChild variant="outline">
          <Link to="/store/$storeId/theme-editor-v2" params={{ storeId }}>Tema Editörü v2</Link>
        </Button>
      }
    >
      {boot.isError ? (
        <p className="text-sm text-muted-foreground">{boot.error instanceof Error ? boot.error.message : "Hazır temalar açılamadı."}</p>
      ) : presets.isLoading || boot.isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin" /></div>
      ) : !presets.data?.length ? (
        <p className="text-sm text-muted-foreground">Bu pakette hazır tema bulunmuyor.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {presets.data.map((preset) => {
            const p = parsed.get(preset.id);
            const s = (p?.settings ?? {}) as Record<string, unknown>;
            const swatches = ["color_primary", "color_secondary", "color_background", "color_text"].map((k) => String(s[k] ?? ""));
            return (
              <Card key={preset.id} className="overflow-hidden">
                <button type="button" onClick={() => setPreview(preset)} className="block h-56 w-full overflow-hidden border-b text-left" aria-label={`${preset.name} önizle`}>
                  <div className="pointer-events-none origin-top-left scale-[0.35]" style={{ width: "286%" }}>
                    {p ? <PageRenderer sections={p.pages["home"] ?? []} settings={p.settings} ctx={ctx} /> : null}
                  </div>
                </button>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{preset.name}</h3>
                    <div className="flex gap-1">
                      {swatches.map((c, i) => (
                        <span key={i} className="size-4 rounded-full border" style={{ background: c }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="h-11 flex-1" onClick={() => setPreview(preset)}><Eye className="mr-1 size-4" /> Önizle</Button>
                    <Button className="h-11 flex-1" disabled={apply.isPending} onClick={() => apply.mutate({ preset, andPublish: false })}>
                      <Wand2 className="mr-1 size-4" /> Uygula
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(preview)} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-h-[95vh] max-w-6xl overflow-hidden p-0">
          <DialogHeader className="border-b p-4">
            <DialogTitle>{preview?.name}</DialogTitle>
            <DialogDescription>Uygularsan ana sayfan bu tasarımla yeniden kurulur. Ürünlerin ve koleksiyonların değişmez.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4">
            <DeviceSwitcher value={device} onChange={setDevice} />
            <div className="flex gap-2">
              <Button variant="outline" className="h-11" disabled={apply.isPending} onClick={() => preview && apply.mutate({ preset: preview, andPublish: false })}>
                Uygula ve düzenle
              </Button>
              <Button className="h-11" disabled={apply.isPending} onClick={() => preview && apply.mutate({ preset: preview, andPublish: true })}>
                {apply.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Sparkles className="mr-1 size-4" />} Uygula ve yayınla
              </Button>
            </div>
          </div>
          <div className="max-h-[70vh] overflow-auto bg-muted/40 p-4">
            {preview ? (
              <DeviceFrame device={device}>
                <PageRenderer sections={parsed.get(preview.id)?.pages["home"] ?? []} settings={parsed.get(preview.id)!.settings} ctx={ctx} />
              </DeviceFrame>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
