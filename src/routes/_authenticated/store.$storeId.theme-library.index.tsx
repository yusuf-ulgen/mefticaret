import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Archive, CheckCircle2, Copy, Download, Eye, History, Link2, Loader2, MoreVertical, Paintbrush, Pencil, Plus, Rocket, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { storeQuery } from "@/lib/store-queries";
import { tsExport, tsImport, tsLibrary, tsPreviewToken, tsThemeAction } from "@/lib/theme-system-v2.functions";
import { buildThemeZip, downloadBlob, parseThemeZip, type ParsedThemeZip } from "@/lib/theme-zip";
import { cn } from "@/lib/utils";

const DESCRIPTION = "Mağazanın temaları: aktif temayı özelleştir, taslakları yayınla, sürümlere dön, zip indir veya yükle.";

export const Route = createFileRoute("/_authenticated/store/$storeId/theme-library/")({
  head: () => ({
    meta: [
      { title: "Tema Kütüphanesi — Mefticaret" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Tema Kütüphanesi — Mefticaret" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LibraryPage,
});

type Lib = Awaited<ReturnType<typeof tsLibrary>>;
type Theme = Lib["themes"][number];
const STATUS: Record<Theme["status"], string> = { active: "Aktif", draft: "Taslak", archived: "Arşivde" };
const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" }) : "—");

function LibraryPage() {
  const { storeId } = Route.useParams();
  const qc = useQueryClient();
  const lib = useServerFn(tsLibrary);
  const act = useServerFn(tsThemeAction);
  const exp = useServerFn(tsExport);
  const imp = useServerFn(tsImport);
  const tok = useServerFn(tsPreviewToken);
  const { data: store } = useQuery(storeQuery(storeId));

  const q = useQuery({ queryKey: ["ts-library", storeId], queryFn: () => lib({ data: { storeId } }), retry: false });
  const [renaming, setRenaming] = useState<Theme | null>(null);
  const [newName, setNewName] = useState("");
  const [deleting, setDeleting] = useState<Theme | null>(null);
  const [share, setShare] = useState<{ url: string; expires: string } | null>(null);
  const [pending, setPending] = useState<ParsedThemeZip & { conflicts: string[]; blockedHtml: boolean; rename: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["ts-library", storeId] });
  const action = useMutation({
    mutationFn: (v: { theme: Theme; action: "publish" | "duplicate" | "rename" | "archive" | "unarchive" | "delete"; name?: string }) =>
      act({ data: { storeId, themeId: v.theme.id, action: v.action, ...(v.name ? { name: v.name } : {}) } }),
    onSuccess: (_r, v) => {
      refresh();
      setRenaming(null); setDeleting(null);
      toast.success({ publish: "Tema yayınlandı.", duplicate: "Tema kopyalandı.", rename: "Tema adı güncellendi.", archive: "Tema arşivlendi.", unarchive: "Tema taslaklara alındı.", delete: "Tema silindi." }[v.action]);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "İşlem başarısız."),
  });

  const preview = useMutation({
    mutationFn: async ({ theme, open }: { theme: Theme; open: boolean }) => {
      const r = await tok({ data: { storeId, themeId: theme.id } });
      const url = `${window.location.origin}/preview/${store?.slug ?? ""}?theme=${theme.id}&token=${encodeURIComponent(r.token)}`;
      return { url, expires: r.expires_at, open };
    },
    onSuccess: (r) => (r.open ? window.open(r.url, "_blank", "noopener") : setShare({ url: r.url, expires: r.expires })),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Önizleme bağlantısı oluşturulamadı."),
  });

  const download = useMutation({
    mutationFn: async (theme: Theme) => {
      const bundle = await exp({ data: { storeId, themeId: theme.id } });
      downloadBlob(buildThemeZip(bundle), `${theme.name.toLocaleLowerCase("tr").replace(/[^a-z0-9]+/g, "-") || "tema"}.zip`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Zip hazırlanamadı."),
  });

  const readZip = async (file: File) => {
    try {
      const parsed = await parseThemeZip(file);
      const dry = await imp({ data: { storeId, manifest: parsed.manifest, assets: parsed.assets, dryRun: true } });
      setPending({ ...parsed, conflicts: dry.conflicts, blockedHtml: dry.blockedHtml, rename: dry.conflicts.length ? `${parsed.manifest.name} (içe aktarılan)` : parsed.manifest.name });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Zip okunamadı.");
    }
  };
  const doImport = useMutation({
    mutationFn: () => imp({ data: { storeId, manifest: pending!.manifest, assets: pending!.assets, rename: pending!.rename } }),
    onSuccess: () => { setPending(null); refresh(); toast.success("Tema taslak olarak eklendi."); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Tema yüklenemedi."),
  });

  const flags = q.data?.flags;
  const active = q.data?.themes.find((t) => t.status === "active") ?? null;
  const others = q.data?.themes.filter((t) => t.status !== "active") ?? [];

  const menu = (t: Theme) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-11" aria-label={`${t.name} işlemleri`}><MoreVertical className="size-4" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => preview.mutate({ theme: t, open: true })}><Eye className="mr-2 size-4" />Önizle</DropdownMenuItem>
        <DropdownMenuItem onClick={() => preview.mutate({ theme: t, open: false })}><Link2 className="mr-2 size-4" />Önizleme bağlantısı paylaş</DropdownMenuItem>
        {t.status !== "active" ? <DropdownMenuItem onClick={() => action.mutate({ theme: t, action: "publish" })}><Rocket className="mr-2 size-4" />Yayınla</DropdownMenuItem> : null}
        <DropdownMenuItem onClick={() => action.mutate({ theme: t, action: "duplicate" })}><Copy className="mr-2 size-4" />Kopyala</DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setRenaming(t); setNewName(t.name); }}><Pencil className="mr-2 size-4" />Yeniden adlandır</DropdownMenuItem>
        {flags?.versions ? <DropdownMenuItem asChild><Link to="/store/$storeId/theme-library/$themeId/versions" params={{ storeId, themeId: t.id }}><History className="mr-2 size-4" />Sürüm geçmişi</Link></DropdownMenuItem> : null}
        {flags?.exportZip ? <DropdownMenuItem onClick={() => download.mutate(t)}><Download className="mr-2 size-4" />İndir (.zip)</DropdownMenuItem> : null}
        {t.status === "draft" ? <DropdownMenuItem onClick={() => action.mutate({ theme: t, action: "archive" })}><Archive className="mr-2 size-4" />Arşivle</DropdownMenuItem> : null}
        {t.status === "archived" ? <DropdownMenuItem onClick={() => action.mutate({ theme: t, action: "unarchive" })}><Archive className="mr-2 size-4" />Arşivden çıkar</DropdownMenuItem> : null}
        {t.status !== "active" ? (<><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" onClick={() => setDeleting(t)}><Trash2 className="mr-2 size-4" />Sil</DropdownMenuItem></>) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const swatch = (t: Theme) => (
    <div className="flex h-28 items-end gap-1.5 rounded-lg border p-3" style={{ background: String(t.settings["color_background"] ?? "") }}>
      {["color_primary", "color_secondary", "color_text", "color_surface"].map((k) => <span key={k} className="size-6 rounded-full border" style={{ background: String(t.settings[k] ?? "") }} />)}
    </div>
  );

  return (
    <AppShell storeId={storeId} title="Tema Kütüphanesi" description={DESCRIPTION}
      actions={flags?.marketplace ? <Button asChild><Link to="/store/$storeId/theme-marketplace" params={{ storeId }}><Plus className="mr-1 size-4" />Yeni tema ekle</Link></Button> : undefined}>
      {q.isError ? (
        <p className="rounded-lg border p-6 text-sm text-muted-foreground">{q.error instanceof Error ? q.error.message : "Kütüphane açılamadı."}</p>
      ) : q.isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin" /></div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Aktif tema</h2>
            {active ? (
              <Card><CardContent className="grid gap-4 p-4 sm:grid-cols-[240px_1fr]">
                {active.template?.preview_image_url ? <img src={active.template.preview_image_url} alt={active.name} className="h-28 w-full rounded-lg border object-cover" /> : swatch(active)}
                <div className="flex flex-col justify-between gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{active.name} <span className="text-sm font-normal text-muted-foreground">v{active.version}</span></p>
                      <p className="mt-1 inline-flex items-center gap-1 text-sm"><CheckCircle2 className="size-4" />Aktif · yayın {fmt(active.published_at)}</p>
                    </div>
                    {menu(active)}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild className="h-11"><Link to="/store/$storeId/theme-editor-v2" params={{ storeId }}><Paintbrush className="mr-1 size-4" />Özelleştir</Link></Button>
                    <Button variant="outline" className="h-11" disabled={preview.isPending} onClick={() => preview.mutate({ theme: active, open: true })}><Eye className="mr-1 size-4" />Önizle</Button>
                  </div>
                </div>
              </CardContent></Card>
            ) : <p className="rounded-lg border p-4 text-sm text-muted-foreground">Henüz yayında bir v2 tema yok. Aşağıdan bir temayı yayınla.</p>}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Diğer temalar ({others.length})</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {others.map((t) => (
                <Card key={t.id}><CardContent className="space-y-3 p-4">
                  {swatch(t)}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">Güncellendi {fmt(t.updated_at)}</p>
                    </div>
                    <Badge variant={t.status === "archived" ? "outline" : "secondary"}>{STATUS[t.status]}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button className="h-11 flex-1" variant={t.status === "archived" ? "outline" : "default"} disabled={action.isPending}
                      onClick={() => action.mutate({ theme: t, action: t.status === "archived" ? "unarchive" : "publish" })}>
                      {t.status === "archived" ? "Aktifleştir" : "Yayınla"}
                    </Button>
                    {menu(t)}
                  </div>
                </CardContent></Card>
              ))}
            </div>
          </section>

          {flags?.importZip ? (
            <section
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) void readZip(f); }}
              className={cn("rounded-xl border-2 border-dashed p-6 text-center", drag && "border-foreground bg-muted/50")}>
              <Upload className="mx-auto size-6" />
              <p className="mt-2 text-sm font-medium">Tema zip dosyasını buraya sürükle</p>
              <p className="text-xs text-muted-foreground">theme.json + assets/ · en fazla 5 MB</p>
              <Button variant="outline" className="mt-3 h-11" onClick={() => fileRef.current?.click()}>Dosya seç</Button>
              <input ref={fileRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void readZip(f); e.target.value = ""; }} />
            </section>
          ) : null}
        </div>
      )}

      <Dialog open={Boolean(renaming)} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Yeniden adlandır</DialogTitle><DialogDescription>Tema adı yalnız panelde görünür.</DialogDescription></DialogHeader>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={120} className="h-11" aria-label="Tema adı" />
          <DialogFooter><Button className="h-11" disabled={!newName.trim() || action.isPending} onClick={() => renaming && action.mutate({ theme: renaming, action: "rename", name: newName.trim() })}>Kaydet</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tema silinsin mi?</DialogTitle><DialogDescription>"{deleting?.name}" ve tüm sürümleri kalıcı olarak silinir.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="destructive" className="h-11" disabled={action.isPending} onClick={() => deleting && action.mutate({ theme: deleting, action: "delete" })}>Sil</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(share)} onOpenChange={(o) => !o && setShare(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Önizleme bağlantısı</DialogTitle><DialogDescription>Bağlantıya sahip herkes bu temayı görebilir. Geçerlilik: {fmt(share?.expires ?? null)}</DialogDescription></DialogHeader>
          <Input readOnly value={share?.url ?? ""} className="h-11 font-mono text-xs" onFocus={(e) => e.target.select()} aria-label="Önizleme bağlantısı" />
          <DialogFooter><Button className="h-11" onClick={() => { void navigator.clipboard.writeText(share?.url ?? ""); toast.success("Bağlantı kopyalandı."); }}>Kopyala</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pending)} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tema yüklensin mi?</DialogTitle><DialogDescription>Tema taslak olarak eklenir, yayındaki temana dokunulmaz.</DialogDescription></DialogHeader>
          {pending ? (
            <div className="space-y-3 text-sm">
              <dl className="grid grid-cols-2 gap-1">
                <dt className="text-muted-foreground">Sayfa</dt><dd>{Object.keys(pending.manifest.snapshot.pages).length}</dd>
                <dt className="text-muted-foreground">Bölüm</dt><dd>{Object.values(pending.manifest.snapshot.pages).reduce((n, p) => n + p.length, 0)}</dd>
                <dt className="text-muted-foreground">Dosya</dt><dd>{pending.assets.length}</dd>
              </dl>
              <div className="flex gap-1">{["color_primary", "color_secondary", "color_background", "color_text"].map((k) => <span key={k} className="size-6 rounded-full border" style={{ background: String(pending.manifest.snapshot.settings[k] ?? "") }} />)}</div>
              {pending.conflicts.length ? <p className="rounded-md border p-2 text-xs">Aynı adlı tema zaten var ({pending.conflicts.join(", ")}). Yeni bir ad ver:</p> : null}
              <Input value={pending.rename} onChange={(e) => setPending({ ...pending, rename: e.target.value })} maxLength={120} className="h-11" aria-label="Yeni tema adı" />
              {pending.blockedHtml ? <p className="text-xs text-destructive">Bu tema Özel HTML içeriyor; paketinde kapalı olduğu için yüklenemez.</p> : null}
              {pending.warnings.length ? <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">{pending.warnings.map((w) => <li key={w}>{w}</li>)}</ul> : null}
            </div>
          ) : null}
          <DialogFooter><Button className="h-11" disabled={!pending?.rename.trim() || pending.blockedHtml || doImport.isPending} onClick={() => doImport.mutate()}>{doImport.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}Onayla ve yükle</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
