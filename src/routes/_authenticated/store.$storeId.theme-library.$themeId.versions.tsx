import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Eye, Loader2, Pin, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { DeviceFrame, DeviceSwitcher, type PreviewDevice } from "@/components/device-preview";
import { PageRenderer, type V2RenderContext } from "@/components/theme-v2/page-renderer";
import { useRenderCtx } from "@/components/theme-v2/use-render-ctx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { tsRestoreVersion, tsVersionSnapshot, tsVersions } from "@/lib/theme-system-v2.functions";
import type { V2Section } from "@/lib/theme-v2";

const DESCRIPTION = "Temanın otomatik kaydedilen sürümleri: önizle ve istediğin sürüme geri dön.";

export const Route = createFileRoute("/_authenticated/store/$storeId/theme-library/$themeId/versions")({
  head: () => ({
    meta: [
      { title: "Tema Sürüm Geçmişi — Mefticaret" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Tema Sürüm Geçmişi — Mefticaret" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VersionsPage,
});

const fmt = (d: string) => new Date(d).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });

function VersionsPage() {
  const { storeId, themeId } = Route.useParams();
  const qc = useQueryClient();
  const list = useServerFn(tsVersions);
  const snap = useServerFn(tsVersionSnapshot);
  const restore = useServerFn(tsRestoreVersion);
  const ctx = useRenderCtx(storeId);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [device, setDevice] = useState<PreviewDevice>("desktop");

  const q = useQuery({ queryKey: ["ts-versions", storeId, themeId], queryFn: () => list({ data: { storeId, themeId } }), retry: false });
  const pv = useQuery({ queryKey: ["ts-version", storeId, themeId, previewId], queryFn: () => snap({ data: { storeId, themeId, versionId: previewId! } }), enabled: Boolean(previewId) });
  const sections = useMemo(() => (pv.data?.pages["home"] ?? []) as unknown as V2Section[], [pv.data]);

  const restore$ = useMutation({
    mutationFn: (versionId: string) => restore({ data: { storeId, themeId, versionId } }),
    onSuccess: () => { setConfirmId(null); qc.invalidateQueries({ queryKey: ["ts-versions", storeId, themeId] }); toast.success("Tema bu sürüme döndürüldü. Vitrine yansıması için yayınla."); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Geri dönülemedi."),
  });

  return (
    <AppShell storeId={storeId} title={`Sürüm Geçmişi${q.data ? ` — ${q.data.theme.name}` : ""}`} description={DESCRIPTION}
      actions={<Button asChild variant="outline"><Link to="/store/$storeId/theme-library" params={{ storeId }}><ArrowLeft className="mr-1 size-4" />Kütüphane</Link></Button>}>
      {q.isError ? <p className="rounded-lg border p-6 text-sm text-muted-foreground">{q.error instanceof Error ? q.error.message : "Sürümler açılamadı."}</p>
        : q.isLoading ? <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin" /></div>
        : !q.data?.versions.length ? <p className="rounded-lg border p-6 text-sm text-muted-foreground">Henüz sürüm yok. Editörde her kayıt otomatik bir sürüm oluşturur.</p>
        : (
          <ol className="divide-y rounded-xl border">
            {q.data.versions.map((v, i) => (
              <li key={v.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  {i === 0 ? <Badge className="mb-1"><Pin className="mr-1 size-3" />Şu an geçerli</Badge> : null}
                  <p className="text-sm">{fmt(v.created_at)}{v.created_by_name ? ` · ${v.created_by_name}` : ""}</p>
                  <p className="text-sm text-muted-foreground">{v.label ? `${v.label} — ` : ""}"{v.summary}"</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="h-11 flex-1 sm:flex-none" onClick={() => setPreviewId(v.id)}><Eye className="mr-1 size-4" />Önizle</Button>
                  {i > 0 ? <Button className="h-11 flex-1 sm:flex-none" onClick={() => setConfirmId(v.id)}><RotateCcw className="mr-1 size-4" />Bu sürüme dön</Button> : null}
                </div>
              </li>
            ))}
          </ol>
        )}

      <Dialog open={Boolean(previewId)} onOpenChange={(o) => !o && setPreviewId(null)}>
        <DialogContent className="max-h-[95vh] max-w-6xl overflow-hidden p-0">
          <DialogHeader className="border-b p-4"><DialogTitle>Sürüm önizlemesi</DialogTitle><DialogDescription>Ana sayfanın o anki görünümü.</DialogDescription></DialogHeader>
          <div className="px-4"><DeviceSwitcher value={device} onChange={setDevice} /></div>
          <div className="max-h-[70vh] overflow-auto bg-muted/40 p-4">
            {pv.isLoading ? <Loader2 className="mx-auto size-6 animate-spin" /> : pv.data ? <DeviceFrame device={device}><PageRenderer sections={sections} settings={pv.data.settings} ctx={ctx as V2RenderContext} /></DeviceFrame> : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(confirmId)} onOpenChange={(o) => !o && setConfirmId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bu sürüme dönülsün mü?</DialogTitle><DialogDescription>Mevcut hâl önce otomatik yedeklenir; istersen tekrar geri alabilirsin.</DialogDescription></DialogHeader>
          <DialogFooter><Button className="h-11" disabled={restore$.isPending} onClick={() => confirmId && restore$.mutate(confirmId)}>{restore$.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}Geri dön</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
