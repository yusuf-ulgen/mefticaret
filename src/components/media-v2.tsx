/** Medya Sistemi v2 arayüzü: yükleyici, filigran ayarları, detay ekleri ve görsel düzenleyici. */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Copy, Droplets, Loader2, RotateCcw, RotateCw, Redo2, Undo2, Upload, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { signMediaPaths } from "@/lib/media";
import { formatBytes } from "@/lib/media-library";
import { registerMediaAsset } from "@/lib/media-library.functions";
import type { MediaAsset } from "@/lib/media-library-queries";
import {
  ACCEPT_ATTRIBUTE_V2,
  applyWatermark,
  canvasToFile,
  processAndUpload,
  validateMediaFile,
  type FileProgress,
  type Watermark,
} from "@/lib/media-v2";
import { WATERMARK_POSITIONS, getMediaV2Boot, saveWatermarkSettings, type WatermarkSettings } from "@/lib/media-v2.functions";

const POSITION_LABELS: Record<string, string> = {
  top_left: "Sol üst", top_center: "Üst orta", top_right: "Sağ üst",
  center_left: "Sol orta", center: "Orta", center_right: "Sağ orta",
  bottom_left: "Sol alt", bottom_center: "Alt orta", bottom_right: "Sağ alt", tile: "Döşeme",
};

export function useMediaV2Boot(storeId: string) {
  const boot = useServerFn(getMediaV2Boot);
  return useQuery({
    queryKey: ["media-v2-boot", storeId],
    queryFn: async () => {
      const r = await boot({ data: { storeId } });
      if (!r.enabled) return r;
      let imageUrl: string | null = null;
      if (r.watermark?.image_path) imageUrl = (await signMediaPaths([r.watermark.image_path]))[r.watermark.image_path] ?? null;
      return { ...r, watermarkImageUrl: imageUrl };
    },
    staleTime: 30_000,
  });
}

type Boot = { usedBytes: number; limitBytes: number | null; watermark: WatermarkSettings | null; watermarkImageUrl: string | null };

function toWm(w: WatermarkSettings | null, url: string | null): Watermark | null {
  if (!w?.is_active) return null;
  return { ...w, opacity: Number(w.opacity), imageUrl: url };
}

type RegisterPayload = Awaited<ReturnType<typeof processAndUpload>>;

export function useRegisterV2(storeId: string) {
  const register = useServerFn(registerMediaAsset);
  return (p: RegisterPayload, folderId: string | null) =>
    register({ data: { storeId, folderId, bucket: "store-media", storageProvider: "supabase", ...p } });
}

export function MediaV2Uploader({ storeId, boot, folderId, onUploaded }: { storeId: string; boot: Boot; folderId: string | null; onUploaded: () => Promise<void> }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<FileProgress[]>([]);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [useWm, setUseWm] = useState(Boolean(boot.watermark?.is_active && boot.watermark.apply_scope === "all"));
  const [wmOpen, setWmOpen] = useState(false);
  const register = useRegisterV2(storeId);

  async function run(files: File[]) {
    if (!files.length || busy) return;
    setBusy(true);
    const state: FileProgress[] = files.map((f) => ({ name: f.name, status: "queued" }));
    const set = (i: number, patch: Partial<FileProgress>) => {
      state[i] = { ...state[i]!, ...patch };
      setItems([...state]);
    };
    setItems([...state]);
    const wm = useWm ? toWm(boot.watermark, boot.watermarkImageUrl) : null;
    let ok = 0;
    const queue = files.map((f, i) => [f, i] as const);
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const [file, i] = next;
        try {
          await validateMediaFile(file);
          set(i, { status: "processing" });
          const payload = await processAndUpload(storeId, file, { watermark: wm });
          set(i, { status: "uploading" });
          await register(payload, folderId);
          set(i, { status: "done" });
          ok++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Yüklenemedi";
          set(i, { status: /engellendi|desteklenmeyen|en fazla/.test(msg) ? "blocked" : "failed", message: msg });
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setBusy(false);
    if (ok) toast.success(`${ok} dosya yüklendi`);
    await Promise.all([onUploaded(), qc.invalidateQueries({ queryKey: ["media-v2-boot", storeId] })]);
  }

  const pct = boot.limitBytes ? Math.min(100, (boot.usedBytes / boot.limitBytes) * 100) : 0;
  const statusText: Record<FileProgress["status"], string> = {
    queued: "Sırada", processing: "İşleniyor", uploading: "Yükleniyor", done: "Tamam", blocked: "Engellendi", failed: "Hata",
  };

  return (
    <div
      className={`rounded-xl border-2 border-dashed p-4 transition-colors ${drag ? "border-primary bg-primary/5" : "border-border bg-card"}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); void run(Array.from(e.dataTransfer.files)); }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Dosyaları sürükleyin veya seçin</p>
          <p className="text-xs text-muted-foreground">
            Görsel (HEIC, TIFF, RAW dahil), video, ses, belge ve 3D model. Görseller otomatik WebP'ye çevrilir, konum bilgisi silinir.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={useWm} disabled={!boot.watermark?.is_active} onCheckedChange={setUseWm} /> Filigran uygula
          </label>
          <Button size="sm" variant="outline" onClick={() => setWmOpen(true)}><Droplets className="mr-2 size-4" />Filigran</Button>
          <Button size="sm" variant="outline" className="sm:hidden" onClick={() => camera.current?.click()}><Camera className="size-4" /></Button>
          <Button size="sm" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}Dosya seç
          </Button>
        </div>
      </div>
      <div className="mt-3 space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Bugünkü yükleme</span>
          <span>{formatBytes(boot.usedBytes)} / {boot.limitBytes ? formatBytes(boot.limitBytes) : "Sınırsız"}</span>
        </div>
        {boot.limitBytes ? <Progress value={pct} className="h-1.5" /> : null}
      </div>
      {items.length > 0 && (
        <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs">
          {items.map((it, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2 py-1">
              <span className="truncate">{it.name}</span>
              <span className={it.status === "done" ? "text-primary" : it.status === "failed" || it.status === "blocked" ? "text-destructive" : "text-muted-foreground"} title={it.message}>
                {statusText[it.status]}{it.message ? `: ${it.message}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      <input ref={input} type="file" multiple accept={ACCEPT_ATTRIBUTE_V2} className="hidden" onChange={(e) => { void run(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void run(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      <WatermarkDialog storeId={storeId} open={wmOpen} onOpenChange={setWmOpen} boot={boot} />
    </div>
  );
}

function WatermarkDialog({ storeId, open, onOpenChange, boot }: { storeId: string; open: boolean; onOpenChange: (v: boolean) => void; boot: Boot }) {
  const qc = useQueryClient();
  const save = useServerFn(saveWatermarkSettings);
  const w = boot.watermark;
  const [f, setF] = useState({
    isActive: w?.is_active ?? false,
    type: (w?.watermark_type ?? "text") as "text" | "image",
    text: w?.text_content ?? "",
    imagePath: w?.image_path ?? null,
    imageUrl: boot.watermarkImageUrl,
    color: w?.color ?? "#ffffff",
    opacity: Number(w?.opacity ?? 0.5),
    sizePercent: w?.size_percent ?? 20,
    position: w?.position ?? "bottom_right",
    marginX: w?.margin_x ?? 20,
    marginY: w?.margin_y ?? 20,
    applyScope: (w?.apply_scope ?? "all") as "all" | "products",
  });
  const [saving, setSaving] = useState(false);
  const preview = useRef<HTMLCanvasElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const c = preview.current;
    if (!c || !open) return;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0, "#94a3b8");
    g.addColorStop(1, "#334155");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    void applyWatermark(c, { is_active: true, watermark_type: f.type, text_content: f.text || "Mağazam", imageUrl: f.imageUrl, color: f.color, opacity: f.opacity, size_percent: f.sizePercent, position: f.position, margin_x: f.marginX / 4, margin_y: f.marginY / 4 }).catch(() => undefined);
  }, [f, open]);

  async function uploadLogo(file: File) {
    const { supabase } = await import("@/integrations/supabase/client");
    const path = `${storeId}/watermark/${crypto.randomUUID()}.png`;
    const { error } = await supabase.storage.from("store-media").upload(path, file, { contentType: file.type, upsert: false });
    if (error) return toast.error(error.message);
    setF((p) => ({ ...p, imagePath: path, imageUrl: URL.createObjectURL(file) }));
  }

  async function submit() {
    setSaving(true);
    try {
      await save({ data: { storeId, isActive: f.isActive, type: f.type, text: f.text || null, imagePath: f.imagePath, color: f.color, opacity: f.opacity, sizePercent: f.sizePercent, position: f.position as never, marginX: f.marginX, marginY: f.marginY, applyScope: f.applyScope } });
      toast.success("Filigran ayarları kaydedildi");
      await qc.invalidateQueries({ queryKey: ["media-v2-boot", storeId] });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Filigran ayarları</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm"><Switch checked={f.isActive} onCheckedChange={(v) => setF({ ...f, isActive: v })} />Filigran açık</label>
            <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as "text" | "image" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="text">Metin</SelectItem><SelectItem value="image">Logo</SelectItem></SelectContent>
            </Select>
            {f.type === "text" ? (
              <div className="flex gap-2">
                <Input maxLength={80} placeholder="© Mağazam" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
                <Input type="color" className="w-14 p-1" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} />
              </div>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => logoInput.current?.click()}>Logo seç (PNG)</Button>
                <input ref={logoInput} type="file" accept="image/png,image/webp,image/svg+xml" className="hidden" onChange={(e) => e.target.files?.[0] && void uploadLogo(e.target.files[0])} />
              </>
            )}
            <Label className="text-xs">Konum</Label>
            <Select value={f.position} onValueChange={(v) => setF({ ...f, position: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{[...WATERMARK_POSITIONS, "tile"].map((p) => <SelectItem key={p} value={p}>{POSITION_LABELS[p]}</SelectItem>)}</SelectContent>
            </Select>
            <Label className="text-xs">Saydamlık %{Math.round(f.opacity * 100)}</Label>
            <Slider min={5} max={100} value={[Math.round(f.opacity * 100)]} onValueChange={([v]) => setF({ ...f, opacity: (v ?? 50) / 100 })} />
            <Label className="text-xs">Boyut %{f.sizePercent}</Label>
            <Slider min={5} max={60} value={[f.sizePercent]} onValueChange={([v]) => setF({ ...f, sizePercent: v ?? 20 })} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" min={0} max={500} value={f.marginX} onChange={(e) => setF({ ...f, marginX: Number(e.target.value) || 0 })} aria-label="Yatay boşluk" />
              <Input type="number" min={0} max={500} value={f.marginY} onChange={(e) => setF({ ...f, marginY: Number(e.target.value) || 0 })} aria-label="Dikey boşluk" />
            </div>
            <Select value={f.applyScope} onValueChange={(v) => setF({ ...f, applyScope: v as "all" | "products" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Tüm yüklemelerde varsayılan açık</SelectItem><SelectItem value="products">Yalnız seçtiğimde uygula</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Canlı önizleme</p>
            <canvas ref={preview} width={400} height={300} className="w-full rounded-lg border border-border" />
            <p className="mt-2 text-xs text-muted-foreground">Mevcut görsellere uygulandığında orijinal korunur, yeni kopya oluşturulur.</p>
          </div>
        </div>
        <div className="flex justify-end"><Button onClick={() => void submit()} disabled={saving}>{saving && <Loader2 className="mr-2 size-4 animate-spin" />}Kaydet</Button></div>
      </DialogContent>
    </Dialog>
  );
}

export function MediaV2DetailExtra({ storeId, asset, boot, folderId, onDone }: { storeId: string; asset: MediaAsset; boot: Boot; folderId: string | null; onDone: () => Promise<void> }) {
  const [editor, setEditor] = useState(false);
  const [busy, setBusy] = useState(false);
  const register = useRegisterV2(storeId);
  const copy = (url: string) => void navigator.clipboard.writeText(url).then(() => toast.success("Bağlantı kopyalandı"));
  const sizes = [
    { label: "Orijinal", url: asset.displayUrl },
    ...asset.variants.map((v) => ({ label: `${v.width}px`, url: asset.variantUrls[v.path] ?? "" })),
    ...(asset.thumbUrl ? [{ label: "Küçük", url: asset.thumbUrl }] : []),
  ].filter((s) => s.url);

  async function applyWmCopy() {
    const wm = toWm(boot.watermark, boot.watermarkImageUrl);
    if (!wm) return toast.error("Önce filigranı açın");
    setBusy(true);
    try {
      const blob = await fetch(asset.displayUrl).then((r) => r.blob());
      const file = new File([blob], asset.file_name, { type: blob.type });
      const p = await processAndUpload(storeId, file, { watermark: wm, sourceAssetId: asset.id });
      await register(p, folderId);
      toast.success("Filigranlı kopya oluşturuldu");
      await onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Uygulanamadı");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3 text-xs">
      {asset.kind === "audio" && asset.displayUrl && <audio src={asset.displayUrl} controls className="w-full" />}
      {asset.color_palette?.length ? (
        <div className="flex items-center gap-1">
          <span className="mr-1 text-muted-foreground">Renkler</span>
          {asset.color_palette.map((c) => (
            <button key={c} type="button" title={c} onClick={() => copy(c)} className="size-5 rounded border border-border" style={{ backgroundColor: c }} />
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-1">
        {asset.metadata_stripped && <span className="rounded bg-muted px-1.5 py-0.5">Konum bilgisi silindi</span>}
        {asset.watermark_applied && <span className="rounded bg-muted px-1.5 py-0.5">Filigranlı</span>}
        {asset.original_format && <span className="rounded bg-muted px-1.5 py-0.5">Kaynak: {asset.original_format.toUpperCase()}</span>}
        {asset.duration_seconds ? <span className="rounded bg-muted px-1.5 py-0.5">{Math.floor(asset.duration_seconds / 60)}:{String(asset.duration_seconds % 60).padStart(2, "0")}</span> : null}
      </div>
      {sizes.length > 0 && (
        <div className="space-y-1">
          <p className="text-muted-foreground">Bağlantıyı kopyala (1 saat geçerli)</p>
          <div className="flex flex-wrap gap-1">
            {sizes.map((s) => <Button key={s.label} size="sm" variant="outline" className="h-7" onClick={() => copy(s.url)}><Copy className="mr-1 size-3" />{s.label}</Button>)}
          </div>
        </div>
      )}
      {asset.kind === "image" && asset.displayUrl && asset.mime_type !== "image/svg+xml" && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditor(true)}><Wand2 className="mr-1 size-3.5" />Düzenle</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void applyWmCopy()}>
            {busy ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Droplets className="mr-1 size-3.5" />}Filigranlı kopya
          </Button>
        </div>
      )}
      {editor && <ImageEditor storeId={storeId} asset={asset} folderId={folderId} onClose={() => setEditor(false)} onDone={onDone} />}
    </div>
  );
}

type Edit = { rotate: number; flipX: boolean; brightness: number; contrast: number; saturate: number; width: number };

function ImageEditor({ storeId, asset, folderId, onClose, onDone }: { storeId: string; asset: MediaAsset; folderId: string | null; onClose: () => void; onDone: () => Promise<void> }) {
  const register = useRegisterV2(storeId);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [hist, setHist] = useState<Edit[]>([]);
  const [future, setFuture] = useState<Edit[]>([]);
  const [e, setE] = useState<Edit>({ rotate: 0, flipX: false, brightness: 100, contrast: 100, saturate: 100, width: asset.width ?? 1200 });
  const [crop, setCrop] = useState<"free" | "1:1" | "4:5" | "16:9">("free");
  const [saving, setSaving] = useState(false);
  const view = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let url = "";
    void fetch(asset.displayUrl).then((r) => r.blob()).then((b) => {
      url = URL.createObjectURL(b);
      const i = new Image();
      i.onload = () => setImg(i);
      i.src = url;
    });
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [asset.displayUrl]);

  const change = (patch: Partial<Edit>) => { setHist((h) => [...h.slice(-29), e]); setFuture([]); setE({ ...e, ...patch }); };

  function render(target: HTMLCanvasElement, maxW: number) {
    if (!img) return;
    const ratio = crop === "1:1" ? 1 : crop === "4:5" ? 4 / 5 : crop === "16:9" ? 16 / 9 : img.width / img.height;
    let sw = img.width, sh = img.width / ratio;
    if (sh > img.height) { sh = img.height; sw = sh * ratio; }
    const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
    const rot = ((e.rotate % 360) + 360) % 360;
    const scale = Math.min(1, maxW / sw);
    const dw = Math.round(sw * scale), dh = Math.round(sh * scale);
    target.width = rot % 180 ? dh : dw;
    target.height = rot % 180 ? dw : dh;
    const ctx = target.getContext("2d")!;
    ctx.filter = `brightness(${e.brightness}%) contrast(${e.contrast}%) saturate(${e.saturate}%)`;
    ctx.translate(target.width / 2, target.height / 2);
    ctx.rotate((rot * Math.PI) / 180);
    if (e.flipX) ctx.scale(-1, 1);
    ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
  }

  useEffect(() => { if (view.current) render(view.current, 600); });

  async function saveCopy() {
    setSaving(true);
    try {
      const c = document.createElement("canvas");
      render(c, e.width);
      const file = await canvasToFile(c, asset.file_name);
      const p = await processAndUpload(storeId, file, { watermark: null, sourceAssetId: asset.id });
      await register(p, folderId);
      toast.success("Düzenlenmiş kopya kaydedildi");
      await onDone();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Görsel düzenleyici</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
          <div className="flex min-h-64 items-center justify-center rounded-lg bg-muted">
            {img ? <canvas ref={view} className="max-h-[60vh] max-w-full" /> : <Loader2 className="size-6 animate-spin" />}
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex gap-1">
              <Button size="icon" variant="outline" disabled={!hist.length} onClick={() => { setFuture((f) => [e, ...f]); setE(hist[hist.length - 1]!); setHist((h) => h.slice(0, -1)); }}><Undo2 className="size-4" /></Button>
              <Button size="icon" variant="outline" disabled={!future.length} onClick={() => { setHist((h) => [...h, e]); setE(future[0]!); setFuture((f) => f.slice(1)); }}><Redo2 className="size-4" /></Button>
              <Button size="icon" variant="outline" onClick={() => change({ rotate: e.rotate - 90 })}><RotateCcw className="size-4" /></Button>
              <Button size="icon" variant="outline" onClick={() => change({ rotate: e.rotate + 90 })}><RotateCw className="size-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => change({ flipX: !e.flipX })}>Çevir</Button>
            </div>
            <Select value={crop} onValueChange={(v) => setCrop(v as typeof crop)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="free">Kırpma yok</SelectItem><SelectItem value="1:1">Kare 1:1</SelectItem><SelectItem value="4:5">Ürün 4:5</SelectItem><SelectItem value="16:9">Geniş 16:9</SelectItem></SelectContent>
            </Select>
            {(["brightness", "contrast", "saturate"] as const).map((k) => (
              <div key={k} className="space-y-1">
                <Label className="text-xs">{k === "brightness" ? "Parlaklık" : k === "contrast" ? "Kontrast" : "Doygunluk"} %{e[k]}</Label>
                <Slider min={0} max={200} value={[e[k]]} onValueChange={([v]) => setE({ ...e, [k]: v ?? 100 })} onValueCommit={() => setHist((h) => [...h.slice(-29), e])} />
              </div>
            ))}
            <Label className="text-xs">Genişlik (px)</Label>
            <Input type="number" min={100} max={8000} value={e.width} onChange={(ev) => setE({ ...e, width: Math.max(100, Number(ev.target.value) || 100) })} />
            <Button className="w-full" disabled={!img || saving} onClick={() => void saveCopy()}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}Yeni dosya olarak kaydet
            </Button>
            <p className="text-muted-foreground">Orijinal dosya değiştirilmez.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
