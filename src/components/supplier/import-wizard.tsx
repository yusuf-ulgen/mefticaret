import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Link2, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MappingStudio } from "@/components/supplier/mapping-studio";
import { supabase } from "@/integrations/supabase/client";
import { supplierDeskImport } from "@/lib/supplier-desk.functions";
import {
  MEFTI_FIELDS,
  detectFormat,
  importSummary,
  parseTextFeed,
  parseWorkbook,
  suggestMapping,
  validateRows,
  type FieldMapping,
  type ImportFormat,
  type ImportRow,
  type MeftiField,
} from "@/lib/supplier-import";

type Loaded = {
  format: ImportFormat;
  columns: string[];
  rows: Array<Record<string, string>>;
  fileName: string | null;
  sourceUrl: string | null;
  source: "file" | "url";
  selectedRoot: string | null;
  rootCandidates: Array<{ path: string; label: string; count: number; score: number }>;
};

type ParserDiagnostic = {
  message: string;
  code?: string;
  rootCandidates: Array<{ path: string; label: string; count: number; score: number }>;
};

export function SupplierImportWizard({
  supplierId,
  onImported,
}: {
  supplierId: string;
  onImported: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [mapOpen, setMapOpen] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState("");
  const [itemPath, setItemPath] = useState("");
  const [diagnostic, setDiagnostic] = useState<ParserDiagnostic | null>(null);

  const runImport = useServerFn(supplierDeskImport);

  const validated: ImportRow[] = useMemo(
    () => (loaded ? validateRows(loaded.rows, mapping, loaded.sourceUrl) : []),
    [loaded, mapping],
  );
  const summary = useMemo(() => importSummary(validated), [validated]);

  const remoteMutation = useMutation({
    mutationFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Oturumunuz sona erdi. Yeniden giriş yapın.");
      const response = await fetch("/api/xml-parser", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ supplierId, url: remoteUrl.trim(), itemPath: itemPath.trim() || undefined }),
      });
      const result = (await response.json()) as {
        error?: string;
        code?: string;
        format?: ImportFormat;
        columns?: string[];
        rows?: Array<Record<string, string>>;
        totalRows?: number;
        mapping?: Record<string, string>;
        selectedRoot?: string | null;
        rootCandidates?: Array<{ path: string; label: string; count: number; score: number }>;
      };
      if (!response.ok || !result.format || !result.columns || !result.rows) {
        const error = new Error(result.error ?? "Besleme çözümlenemedi") as Error & { diagnostic?: ParserDiagnostic };
        error.diagnostic = { message: error.message, code: result.code, rootCandidates: result.rootCandidates ?? [] };
        throw error;
      }
      return {
        format: result.format,
        columns: result.columns,
        rows: result.rows,
        totalRows: result.totalRows ?? result.rows.length,
        mapping: result.mapping ?? {},
        selectedRoot: result.selectedRoot ?? null,
        rootCandidates: result.rootCandidates ?? [],
      };
    },
    onSuccess: (result) => {
      setDiagnostic(null);
      setLoaded({
        format: result.format,
        columns: result.columns,
        rows: result.rows,
        fileName: null,
        sourceUrl: remoteUrl.trim(),
        source: "url",
        selectedRoot: result.selectedRoot,
        rootCandidates: result.rootCandidates,
      });
      setMapping(result.mapping as FieldMapping);
      setMapOpen(true);
      toast.success(`${result.totalRows} satır okundu`);
    },
    onError: (error: Error & { diagnostic?: ParserDiagnostic }) => {
      setDiagnostic(error.diagnostic ?? { message: error.message, rootCandidates: [] });
      setMapOpen(true);
      toast.error(error.message);
    },
  });

  const importMutation = useMutation({
    mutationFn: () =>
      runImport({
        data: {
          supplierId,
          source: loaded!.source,
          format: loaded!.format,
          fileName: loaded!.fileName ?? undefined,
          sourceUrl: loaded!.sourceUrl ?? undefined,
          fieldMap: mapping as Record<string, string>,
          rows: validated.filter((row) => row.errors.length === 0).slice(0, 5000),
          invalidCount: summary.invalid,
          errorRows: summary.errorRows,
        },
      }),
    onSuccess: (result) => {
      toast.success(
        `${result.total} satır arka planda işlenmek üzere sıraya alındı${result.invalid ? ` (${result.invalid} hatalı satır atlandı)` : ""}`,
      );
      setLoaded(null);
      setMapping({});
      onImported();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function handleFile(file: File) {
    try {
      if (file.size > 25_000_000) throw new Error("Dosya çok büyük (25 MB üstü)");
      const format = detectFormat(file.name);
      if (format === "xlsx") {
        const buffer = await file.arrayBuffer();
        const parsed = parseWorkbook(buffer);
        applyParsed(parsed.columns, parsed.rows, "xlsx", file.name, parsed.selectedRoot, parsed.rootCandidates);
      } else {
        const text = await file.text();
        const realFormat = detectFormat(file.name, text);
        const parsed = parseTextFeed(text, realFormat, itemPath.trim() || undefined);
        applyParsed(parsed.columns, parsed.rows, realFormat, file.name, parsed.selectedRoot, parsed.rootCandidates);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Dosya okunamadı";
      setDiagnostic({ message, rootCandidates: [] });
      setMapOpen(true);
      toast.error(message);
    }
  }

  function applyParsed(
    columns: string[],
    rows: Array<Record<string, string>>,
    format: ImportFormat,
    fileName: string,
    selectedRoot: string | null = null,
    rootCandidates: Array<{ path: string; label: string; count: number; score: number }> = [],
  ) {
    if (!rows.length) {
      setDiagnostic({ message: "Dosyada okunabilir ürün satırı bulunamadı", code: "no_rows", rootCandidates });
      setMapOpen(true);
      toast.error("Dosyada okunabilir ürün satırı bulunamadı");
      return;
    }
    setDiagnostic(null);
    setLoaded({ format, columns, rows, fileName, sourceUrl: null, source: "file", selectedRoot, rootCandidates });
    setMapping(suggestMapping(columns));
    setMapOpen(true);
    toast.success(`${rows.length} satır okundu`);
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        className={`rounded-xl border-2 border-dashed p-4 text-center transition-colors sm:p-6 ${
          dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 bg-muted/20"
        }`}
      >
        <FileSpreadsheet className="mx-auto size-8 text-muted-foreground" aria-hidden />
        <p className="mt-2 text-sm font-medium">Dosyayı buraya sürükleyin</p>
        <p className="text-xs text-muted-foreground">CSV, Excel (XLSX), XML veya JSON · en fazla 5.000 satır</p>
        <Button className="mt-3" size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
          <Upload className="mr-1 size-4" aria-hidden />
          Dosya seç
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt,.xml,.json,.xlsx,.xls"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = "";
          }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="supplier-remote-url">
            Uzak XML / CSV bağlantısı
          </Label>
          <Input
            id="supplier-remote-url"
            value={remoteUrl}
            onChange={(event) => setRemoteUrl(event.target.value)}
            placeholder="https://tedarikci.com/urunler.xml"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="supplier-item-path">
            XML kayıt etiketi (opsiyonel)
          </Label>
          <Input
            id="supplier-item-path"
            value={itemPath}
            onChange={(event) => setItemPath(event.target.value)}
            placeholder="Urun"
          />
        </div>
        <Button
          variant="outline"
          disabled={!remoteUrl.trim() || remoteMutation.isPending}
          onClick={() => remoteMutation.mutate()}
        >
          <Link2 className="mr-1 size-4" aria-hidden />
          Bağlantıyı oku
        </Button>
      </div>

      {loaded ? (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <div className="min-w-0 text-sm">
              <span className="block truncate font-medium">{loaded.fileName ?? loaded.sourceUrl}</span>
              <span className="text-muted-foreground"> · {loaded.format.toUpperCase()}</span>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge variant="secondary">{summary.total} satır</Badge>
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{summary.valid} geçerli</Badge>
              {summary.invalid ? <Badge variant="destructive">{summary.invalid} hatalı</Badge> : null}
              {summary.images ? <Badge variant="outline">{summary.images} görsel</Badge> : null}
              {summary.videos ? <Badge variant="outline">{summary.videos} video</Badge> : null}
              {summary.variants ? <Badge variant="outline">{summary.variants} varyant</Badge> : null}
              {summary.missingSku ? <Badge variant="destructive">{summary.missingSku} SKU eksik</Badge> : null}
              {summary.zeroStock ? <Badge variant="outline">{summary.zeroStock} stoksuz</Badge> : null}
              <Button className="flex-1 sm:flex-none" size="sm" variant="outline" onClick={() => setMapOpen(true)}>
                Alan eşleştirme
              </Button>
              <Button
                className="flex-1 sm:flex-none"
                size="sm"
                disabled={summary.valid === 0 || importMutation.isPending}
                onClick={() => importMutation.mutate()}
              >
                {summary.valid} ürünü aktar
              </Button>
            </div>
          </div>

          {summary.errorRows.length ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertTriangle className="size-4" aria-hidden />
                Hatalı satırlar aktarılmaz
              </p>
              <ul className="mt-2 space-y-1 text-xs text-destructive/90">
                {summary.errorRows.slice(0, 12).map((row) => (
                  <li key={`${row.line}-${row.sku}`}>
                    Satır {row.line} {row.sku ? `(${row.sku})` : ""}: {row.errors.join(", ")}
                  </li>
                ))}
              </ul>
              {summary.errorRows.length > 12 ? (
                <p className="mt-2 text-xs text-destructive/80">
                  ve {summary.errorRows.length - 12} satır daha…
                </p>
              ) : null}
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="size-4" aria-hidden />
              Tüm satırlar doğrulandı.
            </p>
          )}

          {summary.warningRows.length ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-amber-700">
                <AlertTriangle className="size-4" aria-hidden />
                {summary.warningRows.length} satırda uyarı var — satırlar aktarılır
              </p>
              <ul className="mt-2 space-y-1 text-xs text-amber-700/90">
                {summary.warningRows.slice(0, 10).map((row) => (
                  <li key={`w-${row.line}`}>
                    Satır {row.line} {row.sku ? `(${row.sku})` : ""}: {row.warnings.join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {importMutation.isPending ? (
            <div className="space-y-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-1/3 animate-[loading_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
              </div>
              <p className="text-xs text-muted-foreground">Aktarım kuyruğa alınıyor…</p>
            </div>
          ) : null}

          <div className="space-y-2 sm:hidden">
            {validated.slice(0, 20).map((row) => (
              <article key={row.index} className="rounded-lg border bg-muted/20 p-3 text-xs">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.title || `Satır ${row.index + 2}`}</p>
                    <p className="mt-1 truncate text-muted-foreground">{row.sku || "SKU yok"}</p>
                  </div>
                  <span className={row.errors.length ? "text-destructive" : "text-success"}>
                    {row.errors[0] ?? "Geçerli"}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-center">
                  <div><dt className="text-muted-foreground">Alış</dt><dd className="font-semibold">{row.costPrice || "—"}</dd></div>
                  <div><dt className="text-muted-foreground">Satış</dt><dd className="font-semibold">{row.retailPrice ?? "—"}</dd></div>
                  <div><dt className="text-muted-foreground">Stok</dt><dd className="font-semibold">{row.stock}</dd></div>
                </dl>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-xs">
              <thead className="text-left uppercase text-muted-foreground">
                <tr>
                  <th className="py-1">Satır</th>
                  <th className="py-1">SKU</th>
                  <th className="py-1">Ürün</th>
                  <th className="py-1">Alış</th>
                  <th className="py-1">Satış</th>
                  <th className="py-1">Stok</th>
                  <th className="py-1">Durum</th>
                </tr>
              </thead>
              <tbody>
                {validated.slice(0, 20).map((row) => (
                  <tr key={row.index} className="border-t">
                    <td className="py-1">{row.index + 2}</td>
                    <td className="py-1">{row.sku || "—"}</td>
                    <td className="max-w-[240px] truncate py-1">{row.title || "—"}</td>
                    <td className="py-1">{row.costPrice || "—"}</td>
                    <td className="py-1">{row.retailPrice ?? "—"}</td>
                    <td className="py-1">{row.stock}</td>
                    <td className="py-1">
                      {row.errors.length ? (
                        <span className="text-destructive">{row.errors[0]}</span>
                      ) : (
                        <span className="text-emerald-600">Geçerli</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="h-[100dvh] w-screen max-w-none gap-3 overflow-y-auto rounded-none p-4 sm:h-auto sm:max-h-[90vh] sm:max-w-5xl sm:rounded-lg sm:p-6">
          <DialogHeader>
            <DialogTitle>Mapping Studio</DialogTitle>
            <DialogDescription>
              Soldaki besleme düğümlerini sağdaki Mefticaret alanlarına sürükleyin veya düğümü seçip alana dokunun.
              Hazır tedarikçi şablonlarıyla eşleştirme tek tıkla dolar.
            </DialogDescription>
          </DialogHeader>
          <MappingStudio
            columns={loaded?.columns ?? []}
            rows={loaded?.rows ?? []}
            mapping={mapping}
            onChange={setMapping}
            onPreset={(preset) => {
              setItemPath(preset.itemPath);
              toast.success(`${preset.label} şablonu uygulandı`);
            }}
            selectedRoot={loaded?.selectedRoot ?? null}
            rootCandidates={loaded?.rootCandidates ?? diagnostic?.rootCandidates ?? []}
            diagnostic={diagnostic?.message ?? null}
            onSelectRoot={(path) => {
              setItemPath(path);
              if (loaded?.source === "url" || remoteUrl.trim()) remoteMutation.mutate();
            }}
            onReload={() => remoteMutation.mutate()}
          />
          <DialogFooter className="sticky bottom-0 -mx-4 grid gap-2 border-t bg-background px-4 py-3 sm:static sm:mx-0 sm:flex sm:border-0 sm:bg-transparent sm:p-0">
            <Button className="w-full" variant="outline" onClick={() => setMapping(suggestMapping(loaded?.columns ?? []))}>
              Otomatik eşleştir
            </Button>
            <Button
              className="w-full"
              disabled={!loaded || summary.valid === 0 || importMutation.isPending}
              onClick={() => importMutation.mutate()}
            >
              Eşleştirmeyi Uygula ve Toplu Aktarımı Başlat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
