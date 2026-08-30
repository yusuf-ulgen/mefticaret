import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardList, Download, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { downloadCsv, parseCsvObjects, toCsv } from "@/lib/csv";
import { inventoryQuery } from "@/lib/inventory-queries";
import { applyStockCountRows } from "@/lib/stock-count.functions";
import type { StockCountResult } from "@/lib/stock-count.server";

export const Route = createFileRoute("/_authenticated/store/$storeId/stock-count")({
  head: () => ({
    meta: [
      { title: "Fiziksel Stok Sayımı — Mefticaret" },
      {
        name: "description",
        content:
          "Depo sayım listesini CSV olarak indir, sayılan adetleri yükle ve farkları tek adımda stok hareketi olarak işle.",
      },
      { property: "og:title", content: "Fiziksel Stok Sayımı — Mefticaret" },
      {
        property: "og:description",
        content: "CSV tabanlı depo sayımı: fark raporu ve denetim izli stok düzeltme.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StockCountPage,
});

type ParsedRow = { key: string; counted: number; label: string; current: number | null };

function StockCountPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: variants } = useQuery(inventoryQuery(storeId));
  const apply = useServerFn(applyStockCountRows);
  const fileRef = useRef<HTMLInputElement>(null);

  const [raw, setRaw] = useState("");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<StockCountResult | null>(null);

  const index = useMemo(() => {
    const map = new Map<string, { title: string; stock: number }>();
    for (const variant of variants ?? []) {
      const entry = { title: variant.title, stock: variant.stock ?? 0 };
      map.set(variant.id.toLowerCase(), entry);
      if (variant.sku) map.set(variant.sku.toLowerCase(), entry);
    }
    return map;
  }, [variants]);

  const parsed = useMemo<{ rows: ParsedRow[]; errors: string[] }>(() => {
    if (!raw.trim()) return { rows: [], errors: [] };
    const records = parseCsvObjects(raw);
    const rows: ParsedRow[] = [];
    const errors: string[] = [];
    records.forEach((record, position) => {
      const key = (record["sku"] ?? record["key"] ?? record["varyant"] ?? "").trim();
      const countedRaw = (record["counted"] ?? record["sayim"] ?? record["adet"] ?? "").trim();
      if (!key) {
        errors.push(`${position + 2}. satır: sku kolonu boş`);
        return;
      }
      const counted = Number.parseInt(countedRaw.replace(/[^\d-]/g, ""), 10);
      if (!Number.isFinite(counted) || counted < 0) {
        errors.push(`${position + 2}. satır: geçersiz sayım adedi`);
        return;
      }
      const match = index.get(key.toLowerCase());
      rows.push({
        key,
        counted,
        label: match?.title ?? "Eşleşme yok",
        current: match ? match.stock : null,
      });
    });
    return { rows, errors };
  }, [raw, index]);

  const diffCount = parsed.rows.filter(
    (row) => row.current !== null && row.current !== row.counted,
  ).length;

  const downloadTemplate = () => {
    const rows: unknown[][] = (variants ?? []).map((variant) => {
      const product = (variant as { products: { title: string } | null }).products;
      return [
        variant.sku ?? variant.id,
        product?.title ?? "",
        variant.title,
        variant.stock ?? 0,
        variant.stock ?? 0,
      ];
    });
    downloadCsv(
      `stok-sayim-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(["sku", "urun", "varyant", "sistem_stok", "counted"], rows),
    );
  };

  const onFile = async (file: File) => {
    const text = await file.text();
    setRaw(text);
    setResult(null);
  };

  const mutation = useMutation({
    mutationFn: () =>
      apply({
        data: {
          storeId,
          reason: reason.trim() || undefined,
          rows: parsed.rows.map((row) => ({ key: row.key, counted: row.counted })),
        },
      }),
    onSuccess: async (data) => {
      setResult(data);
      toast.success(`${data.applied.length} varyant güncellendi`);
      await queryClient.invalidateQueries({ queryKey: ["inventory", storeId] });
      await queryClient.invalidateQueries({ queryKey: ["inventory-movements", storeId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Sayım işlenemedi"),
  });

  return (
    <AppShell storeId={storeId} title="Stok Sayımı">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fiziksel stok sayımı</h1>
          <p className="text-sm text-muted-foreground">
            Sayım listesini indirin, depoda saydığınız adetleri <code>counted</code> kolonuna
            yazın ve yükleyin. Yalnızca farklı olan satırlar güncellenir; her düzeltme stok
            hareketi olarak kaydedilir.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="mr-2 size-4" />
            Sayım listesini indir
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-2 size-4" />
            CSV yükle
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
              event.target.value = "";
            }}
          />
          <Badge variant="secondary">{parsed.rows.length} satır</Badge>
          <Badge variant={diffCount > 0 ? "default" : "secondary"}>{diffCount} fark</Badge>
        </div>

        <div className="space-y-2">
          <Label>CSV içeriği</Label>
          <Textarea
            value={raw}
            onChange={(event) => {
              setRaw(event.target.value);
              setResult(null);
            }}
            rows={8}
            placeholder="sku,counted&#10;TSH-001,42"
            className="font-mono text-xs"
          />
        </div>

        <div className="space-y-2">
          <Label>Sayım notu (isteğe bağlı)</Label>
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ağustos ayı depo sayımı"
            className="max-w-sm"
          />
        </div>

        {parsed.errors.length > 0 ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <p className="font-medium">Atlanan satırlar</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              {parsed.errors.slice(0, 10).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {parsed.rows.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Varyant</th>
                  <th className="px-4 py-3 text-right">Sistem</th>
                  <th className="px-4 py-3 text-right">Sayılan</th>
                  <th className="px-4 py-3 text-right">Fark</th>
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 200).map((row) => {
                  const diff = row.current === null ? null : row.counted - row.current;
                  return (
                    <tr key={`${row.key}-${row.counted}`} className="border-t border-border">
                      <td className="px-4 py-2 font-mono text-xs">{row.key}</td>
                      <td className="px-4 py-2">{row.label}</td>
                      <td className="px-4 py-2 text-right">{row.current ?? "—"}</td>
                      <td className="px-4 py-2 text-right">{row.counted}</td>
                      <td className="px-4 py-2 text-right">
                        {diff === null ? (
                          <Badge variant="secondary">eşleşme yok</Badge>
                        ) : diff === 0 ? (
                          "0"
                        ) : (
                          <span className={diff > 0 ? "text-emerald-600" : "text-destructive"}>
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <ClipboardList className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Henüz sayım verisi yok. Listeyi indirip doldurduktan sonra yükleyin.
            </p>
          </div>
        )}

        <Button
          disabled={parsed.rows.length === 0 || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "İşleniyor…" : "Sayımı uygula"}
        </Button>

        {result ? (
          <div className="rounded-xl border border-border bg-card p-4 text-sm">
            <p className="font-medium">Sonuç</p>
            <p className="mt-1 text-muted-foreground">
              {result.applied.length} güncelleme · {result.unchanged} değişmedi ·{" "}
              {result.skipped.length} atlandı
            </p>
            {result.skipped.length > 0 ? (
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {result.skipped.slice(0, 10).map((item) => (
                  <li key={`${item.key}-${item.reason}`}>
                    {item.key}: {item.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
