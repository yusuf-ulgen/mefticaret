import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  FileText,
  FolderPlus,
  Folder,
  ImageOff,
  Loader2,
  Pencil,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/mefti";
import {
  ACCEPT_ATTRIBUTE,
  DEFAULT_UPLOAD_OPTIONS,
  MEDIA_KIND_LABELS,
  formatBytes,
  uploadMediaFile,
  UPLOAD_BUCKET,
  UPLOAD_PROVIDER,
  type MediaKind,
} from "@/lib/media-library";
import {
  createMediaFolder,
  deleteMediaAssets,
  deleteMediaFolder,
  registerMediaAsset,
  renameMediaFolder,
  updateMediaAsset,
} from "@/lib/media-library.functions";
import { mediaAssetsQuery, mediaFoldersQuery, type MediaAsset } from "@/lib/media-library-queries";
import { STORAGE_PROVIDER_LABELS, buildSrcSet } from "@/lib/media-storage";

const KIND_FILTERS: { value: "all" | MediaKind; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "image", label: "Görseller" },
  { value: "video", label: "Videolar" },
  { value: "document", label: "Dokümanlar" },
];

export function MediaLibraryPanel({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const { data: folders, isLoading: foldersLoading } = useQuery(mediaFoldersQuery(storeId));
  const { data: assets, isLoading } = useQuery(mediaAssetsQuery(storeId));

  const register = useServerFn(registerMediaAsset);
  const updateAsset = useServerFn(updateMediaAsset);
  const removeAssets = useServerFn(deleteMediaAssets);
  const addFolder = useServerFn(createMediaFolder);
  const renameFolder = useServerFn(renameMediaFolder);
  const removeFolder = useServerFn(deleteMediaFolder);

  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"all" | MediaKind>("all");
  const [onlyMissingAlt, setOnlyMissingAlt] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detail, setDetail] = useState<MediaAsset | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [altDraft, setAltDraft] = useState("");
  const [captionDraft, setCaptionDraft] = useState("");
  const [folderDraft, setFolderDraft] = useState<string>("root");
  const [newFolderName, setNewFolderName] = useState("");
  const [options, setOptions] = useState(DEFAULT_UPLOAD_OPTIONS);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["media-assets", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["media-folders", storeId] }),
    ]);
  };

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (assets ?? []).filter((asset) => {
      if (activeFolder !== null && asset.folder_id !== activeFolder) return false;
      if (kind !== "all" && asset.kind !== kind) return false;
      if (onlyMissingAlt && asset.kind === "image" && asset.alt?.trim()) return false;
      if (onlyMissingAlt && asset.kind !== "image") return false;
      if (!term) return true;
      return (
        asset.file_name.toLowerCase().includes(term) ||
        (asset.alt ?? "").toLowerCase().includes(term) ||
        (asset.tags ?? []).some((tag) => tag.toLowerCase().includes(term))
      );
    });
  }, [assets, activeFolder, kind, onlyMissingAlt, search]);

  const totalBytes = (assets ?? []).reduce((sum, asset) => sum + Number(asset.size_bytes ?? 0), 0);
  const savedBytes = (assets ?? []).reduce(
    (sum, asset) =>
      sum + Math.max(0, Number(asset.original_size_bytes ?? 0) - Number(asset.size_bytes ?? 0)),
    0,
  );
  const missingAlt = (assets ?? []).filter(
    (asset) => asset.kind === "image" && !asset.alt?.trim(),
  ).length;

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    setUploading({ done: 0, total: list.length });
    let ok = 0;
    for (const [index, file] of list.entries()) {
      try {
        const prepared = await uploadMediaFile(storeId, file, options);
        await register({
          data: {
            storeId,
            folderId: activeFolder,
            fileName: prepared.fileName,
            mimeType: prepared.mimeType,
            kind: prepared.kind,
            extension: prepared.extension,
            storagePath: prepared.storagePath,
            bucket: UPLOAD_BUCKET,
            storageProvider: UPLOAD_PROVIDER,
            sizeBytes: prepared.sizeBytes,
            originalSizeBytes: prepared.originalSizeBytes,
            width: prepared.width,
            height: prepared.height,
            optimized: prepared.optimized,
            convertedToWebp: prepared.convertedToWebp,
            variants: prepared.variants,
          },
        });
        ok += 1;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `${file.name} yüklenemedi`);
      }
      setUploading({ done: index + 1, total: list.length });
    }
    setUploading(null);
    if (fileInput.current) fileInput.current.value = "";
    if (ok > 0) toast.success(`${ok} dosya yüklendi`);
    await invalidate();
  }

  const saveDetail = useMutation({
    mutationFn: async (asset: MediaAsset) =>
      updateAsset({
        data: {
          assetId: asset.id,
          fileName: nameDraft.trim() || asset.file_name,
          alt: altDraft.trim(),
          caption: captionDraft.trim(),
          folderId: folderDraft === "root" ? null : folderDraft,
        },
      }),
    onSuccess: async () => {
      toast.success("Dosya güncellendi");
      setDetail(null);
      await invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Güncellenemedi"),
  });

  const deleteMutation = useMutation({
    mutationFn: (assetIds: string[]) => removeAssets({ data: { assetIds } }),
    onSuccess: async (result) => {
      toast.success(`${result.deleted} dosya silindi`);
      setDetail(null);
      setSelectedIds([]);
      await invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Silinemedi"),
  });

  const folderMutation = useMutation({
    mutationFn: (name: string) =>
      addFolder({ data: { storeId, name, parentId: activeFolder ?? null } }),
    onSuccess: async () => {
      toast.success("Klasör oluşturuldu");
      setNewFolderName("");
      await invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Oluşturulamadı"),
  });

  const folderRename = useMutation({
    mutationFn: (input: { folderId: string; name: string }) => renameFolder({ data: input }),
    onSuccess: async () => {
      toast.success("Klasör adı güncellendi");
      await invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Güncellenemedi"),
  });

  const folderDelete = useMutation({
    mutationFn: (folderId: string) => removeFolder({ data: { folderId } }),
    onSuccess: async () => {
      toast.success("Klasör silindi");
      setActiveFolder(null);
      await invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Silinemedi"),
  });

  const countByFolder = useMemo(() => {
    const map = new Map<string, number>();
    for (const asset of assets ?? []) {
      const key = asset.folder_id ?? "root";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [assets]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Dosya" value={String((assets ?? []).length)} />
        <StatCard label="Toplam boyut" value={formatBytes(totalBytes)} />
        <StatCard label="Optimizasyon kazancı" value={formatBytes(savedBytes)} />
        <StatCard label="Alt metni eksik" value={String(missingAlt)} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Dosya yükle</p>
            <p className="text-xs text-muted-foreground">
              JPG, PNG, WEBP, SVG, MP4/WEBM/MOV video ve PDF. Depo:{" "}
              {STORAGE_PROVIDER_LABELS[UPLOAD_PROVIDER]} ({UPLOAD_BUCKET})
            </p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={options.convertToWebp}
                onCheckedChange={(value) =>
                  setOptions((previous) => ({ ...previous, convertToWebp: value }))
                }
              />
              WebP dönüşümü
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={options.responsive}
                onCheckedChange={(value) =>
                  setOptions((previous) => ({ ...previous, responsive: value }))
                }
              />
              Responsive varyantlar
            </label>
            <Button
              size="sm"
              disabled={Boolean(uploading)}
              onClick={() => fileInput.current?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Upload className="mr-2 size-4" />
              )}
              {uploading ? `${uploading.done}/${uploading.total} yükleniyor…` : "Dosya seç"}
            </Button>
          </div>
        </div>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files)}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-3">
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Klasörler
            </p>
            <button
              type="button"
              onClick={() => setActiveFolder(null)}
              className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm ${
                activeFolder === null ? "bg-muted font-medium" : "hover:bg-muted/60"
              }`}
            >
              <span className="flex items-center gap-2">
                <Folder className="size-4" /> Kök
              </span>
              <span className="text-xs text-muted-foreground">
                {countByFolder.get("root") ?? 0}
              </span>
            </button>
            {foldersLoading ? (
              <Skeleton className="mt-2 h-8 w-full" />
            ) : (
              (folders ?? []).map((folder) => (
                <div key={folder.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveFolder(folder.id)}
                    className={`flex flex-1 items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm ${
                      activeFolder === folder.id ? "bg-muted font-medium" : "hover:bg-muted/60"
                    }`}
                  >
                    <span className="truncate">{folder.path}</span>
                    <span className="text-xs text-muted-foreground">
                      {countByFolder.get(folder.id) ?? 0}
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 opacity-0 group-hover:opacity-100"
                    onClick={() => {
                      const next = window.prompt("Yeni klasör adı", folder.name);
                      if (next?.trim()) {
                        folderRename.mutate({ folderId: folder.id, name: next.trim() });
                      }
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 opacity-0 group-hover:opacity-100"
                    onClick={() => folderDelete.mutate(folder.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <Label className="text-xs">Yeni klasör</Label>
            <div className="mt-2 flex gap-2">
              <Input
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                placeholder="Kampanyalar"
              />
              <Button
                size="icon"
                variant="outline"
                disabled={!newFolderName.trim() || folderMutation.isPending}
                onClick={() => folderMutation.mutate(newFolderName.trim())}
              >
                <FolderPlus className="size-4" />
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Seçili klasörün altında oluşturulur.
            </p>
          </div>
        </aside>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Dosya adı, alt metin veya etiket ara…"
              className="max-w-sm"
            />
            <Select value={kind} onValueChange={(value) => setKind(value as "all" | MediaKind)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KIND_FILTERS.map((filter) => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={onlyMissingAlt ? "default" : "outline"}
              size="sm"
              onClick={() => setOnlyMissingAlt((value) => !value)}
            >
              Alt metni eksik
            </Button>
            {selectedIds.length > 0 ? (
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(selectedIds)}
              >
                <Trash2 className="mr-2 size-4" />
                {selectedIds.length} dosyayı sil
              </Button>
            ) : null}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="aspect-square w-full rounded-xl" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <Upload className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                Bu klasörde dosya yok. Yukarıdan yükleyerek başlayın.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {rows.map((asset) => (
                <div
                  key={asset.id}
                  className="group relative overflow-hidden rounded-xl border border-border bg-card"
                >
                  <div className="absolute left-2 top-2 z-10">
                    <Checkbox
                      checked={selectedIds.includes(asset.id)}
                      onCheckedChange={(checked) =>
                        setSelectedIds((previous) =>
                          checked
                            ? [...previous, asset.id]
                            : previous.filter((id) => id !== asset.id),
                        )
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="block w-full text-left"
                    onClick={() => {
                      setDetail(asset);
                      setNameDraft(asset.file_name);
                      setAltDraft(asset.alt ?? "");
                      setCaptionDraft(asset.caption ?? "");
                      setFolderDraft(asset.folder_id ?? "root");
                    }}
                  >
                    <div className="flex aspect-square items-center justify-center bg-muted/40">
                      {asset.kind === "image" && asset.displayUrl ? (
                        <img
                          src={asset.displayUrl}
                          srcSet={buildSrcSet(asset.variants, asset.variantUrls)}
                          sizes="(max-width: 768px) 50vw, 25vw"
                          alt={asset.alt ?? asset.file_name}
                          loading="lazy"
                          className="size-full object-cover transition group-hover:scale-105"
                        />
                      ) : asset.kind === "video" ? (
                        <Video className="size-8 text-muted-foreground" />
                      ) : asset.kind === "document" ? (
                        <FileText className="size-8 text-muted-foreground" />
                      ) : (
                        <ImageOff className="size-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-1 p-3">
                      <p className="truncate text-sm font-medium">{asset.file_name}</p>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[10px]">
                          {MEDIA_KIND_LABELS[asset.kind]}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {formatBytes(Number(asset.size_bytes))}
                        </Badge>
                        {asset.converted_to_webp ? (
                          <Badge variant="outline" className="text-[10px]">
                            WebP
                          </Badge>
                        ) : null}
                        {asset.variants.length > 0 ? (
                          <Badge variant="outline" className="text-[10px]">
                            {asset.variants.length}× responsive
                          </Badge>
                        ) : null}
                        {asset.kind === "image" && !asset.alt?.trim() ? (
                          <Badge variant="destructive" className="text-[10px]">
                            Alt metin yok
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <Sheet open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="truncate">{detail?.file_name ?? "Dosya"}</SheetTitle>
            <SheetDescription>
              {detail
                ? `${MEDIA_KIND_LABELS[detail.kind]} · ${detail.mime_type} · ${formatDateTime(detail.created_at)}`
                : ""}
            </SheetDescription>
          </SheetHeader>

          {detail ? (
            <div className="mt-6 space-y-5">
              <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
                {detail.kind === "image" && detail.displayUrl ? (
                  <img
                    src={detail.displayUrl}
                    alt={detail.alt ?? detail.file_name}
                    className="w-full object-contain"
                  />
                ) : detail.kind === "video" && detail.displayUrl ? (
                  <video src={detail.displayUrl} controls className="w-full" />
                ) : detail.displayUrl ? (
                  <a
                    href={detail.displayUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block p-6 text-center text-sm underline"
                  >
                    Dosyayı yeni sekmede aç
                  </a>
                ) : (
                  <div className="p-6 text-center text-sm text-muted-foreground">Önizleme yok</div>
                )}
              </div>

              <dl className="grid grid-cols-2 gap-2 text-xs">
                <Meta label="Boyut" value={formatBytes(Number(detail.size_bytes))} />
                <Meta
                  label="Orijinal"
                  value={formatBytes(Number(detail.original_size_bytes ?? detail.size_bytes))}
                />
                <Meta
                  label="Çözünürlük"
                  value={detail.width && detail.height ? `${detail.width}×${detail.height}` : "—"}
                />
                <Meta
                  label="Depo"
                  value={`${STORAGE_PROVIDER_LABELS[detail.storage_provider]} · ${detail.bucket}`}
                />
              </dl>

              <div className="space-y-2">
                <Label>Dosya adı</Label>
                <Input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Alt text</Label>
                <Input
                  value={altDraft}
                  onChange={(event) => setAltDraft(event.target.value)}
                  placeholder="Görseli tanımlayan kısa açıklama"
                />
              </div>

              <div className="space-y-2">
                <Label>Açıklama</Label>
                <Textarea
                  value={captionDraft}
                  onChange={(event) => setCaptionDraft(event.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Klasör</Label>
                <Select value={folderDraft} onValueChange={setFolderDraft}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="root">Kök</SelectItem>
                    {(folders ?? []).map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.path}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {detail.variants.length > 0 ? (
                <div className="space-y-1 rounded-lg border border-border p-3">
                  <p className="text-xs font-medium">Responsive varyantlar</p>
                  {detail.variants.map((variant) => (
                    <p key={variant.path} className="text-xs text-muted-foreground">
                      {variant.width}×{variant.height} · {formatBytes(variant.size_bytes)}
                    </p>
                  ))}
                </div>
              ) : null}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={saveDetail.isPending}
                  onClick={() => saveDetail.mutate(detail)}
                >
                  {saveDetail.isPending ? "Kaydediliyor…" : "Kaydet"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate([detail.id])}
                >
                  <Trash2 className="mr-2 size-4" />
                  Sil
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
