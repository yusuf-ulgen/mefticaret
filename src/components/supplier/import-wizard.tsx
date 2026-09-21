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
import { supplierDeskFetchRemote, supplierDeskImport } from "@/lib/supplier-desk.functions";
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

  const fetchRemote = useServerFn(supplierDeskFetchRemote);
  const runImport = useServerFn(supplierDeskImport);

  const validated: ImportRow[] = useMemo(
    () => (loaded ? validateRows(loaded.rows, mapping) : []),
    [loaded, mapping],
  );
  const summary = useMemo(() => importSummary(validated), [validated]);

  const remoteMutation = useMutation({
    mutationFn: () =>
      fetchRemote({ data: { supplierId, url: remoteUrl.trim(), itemPath: itemPath.trim() || undefined } }),
    onSuccess: (result) => {
      setLoaded({
        format: result.format,
        columns: result.columns,
        rows: result.rows,
        fileName: null,
        sourceUrl: remoteUrl.trim(),
        source: "url",
      });
      setMapping(result.mapping as FieldMapping);
      setMapOpen(true);
      toast.success(`${result.totalRows} satır okundu`);
    },
    onError: (error: Error) => toast.error(error.message),
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
      const format = detectFormat(file.name);
      if (format === "xlsx") {
        const buffer = await file.arrayBuffer();
        const parsed = parseWorkbook(buffer);
        applyParsed(parsed.columns, parsed.rows, "xlsx", file.name);
      } else {
        const text = await file.text();
        const realFormat = detectFormat(file.name, text);
        const parsed = parseTextFeed(text, realFormat, itemPath.trim() || undefined);
        applyParsed(parsed.columns, parsed.rows, realFormat, file.name);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dosya okunamadı");
    }
  }

  function applyParsed(
    columns: string[],
    rows: Array<Record<string, string>>,
    format: ImportFormat,
    fileName: string,
  ) {
    if (!rows.length) {
      toast.error("Dosyada okunabilir satır bulunamadı");
      return;
    }
    setLoaded({ format, columns, rows, fileName, sourceUrl: null, source: "file" });
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
        className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <span className="font-medium">{loaded.fileName ?? loaded.sourceUrl}</span>
              <span className="text-muted-foreground"> · {loaded.format.toUpperCase()}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{summary.total} satır</Badge>
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{summary.valid} geçerli</Badge>
              {summary.invalid ? <Badge variant="destructive">{summary.invalid} hatalı</Badge> : null}
              <Button size="sm" variant="outline" onClick={() => setMapOpen(true)}>
                Alan eşleştirme
              </Button>
              <Button
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

          <div className="overflow-x-auto">
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
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Alan eşleştirme</DialogTitle>
            <DialogDescription>
              Dosyanızdaki sütunları Mefticaret alanlarıyla eşleştirin. Zorunlu alanlar işaretlidir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {MEFTI_FIELDS.map((field) => (
              <div key={field.key} className="grid grid-cols-1 gap-1 sm:grid-cols-[180px_1fr] sm:items-center">
                <Label className="text-xs" htmlFor={`map-${field.key}`}>
                  {field.label}
                  {field.required ? <span className="ml-1 text-destructive">*</span> : null}
                </Label>
                <select
                  id={`map-${field.key}`}
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={mapping[field.key] ?? ""}
                  onChange={(event) =>
                    setMapping((previous) => {
                      const next = { ...previous };
                      const value = event.target.value;
                      if (!value) delete next[field.key as MeftiField];
                      else next[field.key as MeftiField] = value;
                      return next;
                    })
                  }
                >
                  <option value="">— eşleştirilmedi —</option>
                  {(loaded?.columns ?? []).map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMapping(suggestMapping(loaded?.columns ?? []))}>
              Otomatik eşleştir
            </Button>
            <Button onClick={() => setMapOpen(false)}>Tamam</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
