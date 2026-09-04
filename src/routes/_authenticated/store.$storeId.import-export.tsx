import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { productsQuery } from "@/lib/catalog-queries";
import { ordersQuery } from "@/lib/sales-queries";
import {
  PRODUCT_CSV_HEADERS,
  PRODUCT_CSV_TEMPLATE,
  downloadCsv,
  parseCsvObjects,
  parseDecimal,
  toCsv,
} from "@/lib/csv";
import { importProducts } from "@/lib/bulk.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/import-export")({
  head: () => ({
    meta: [
      { title: "İçe / Dışa Aktarma — Mefticaret" },
      {
        name: "description",
        content: "Ürün kataloğunu CSV ile toplu yükle, ürün ve sipariş verilerini dışa aktar.",
      },
      { property: "og:title", content: "İçe / Dışa Aktarma — Mefticaret" },
      {
        property: "og:description",
        content: "Mefticaret CSV toplu ürün içe aktarma ve veri dışa aktarma araçları.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImportExportPage,
});

type ParsedRow = {
  title: string;
  description?: string;
  sku?: string;
  vendor?: string;
  productType?: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  status: "draft" | "active" | "archived";
  tags: string[];
};

function toRows(csv: string): { rows: ParsedRow[]; errors: string[] } {
  const records = parseCsvObjects(csv);
  const rows: ParsedRow[] = [];
  const errors: string[] = [];

  records.forEach((record, index) => {
    const title = record["title"] ?? record["başlık"] ?? "";
    if (title.trim().length < 2) {
      errors.push(`${index + 2}. satır: başlık eksik`);
      return;
    }
    const statusRaw = (record["status"] ?? "draft").toLowerCase();
    const status = (["draft", "active", "archived"] as const).includes(statusRaw as never)
      ? (statusRaw as ParsedRow["status"])
      : "draft";
    const compare = parseDecimal(record["compare_at_price"]);
    rows.push({
      title: title.trim(),
      ...(record["description"] ? { description: record["description"] } : {}),
      ...(record["sku"] ? { sku: record["sku"] } : {}),
      ...(record["vendor"] ? { vendor: record["vendor"] } : {}),
      ...(record["product_type"] ? { productType: record["product_type"] } : {}),
      price: parseDecimal(record["price"]),
      ...(compare > 0 ? { compareAtPrice: compare } : {}),
      stock: Math.max(0, Math.round(parseDecimal(record["stock"]))),
      status,
      tags: (record["tags"] ?? "")
        .split(/[,|]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 20),
    });
  });

  return { rows, errors };
}

function ImportExportPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState("");
  const { data: products } = useQuery(productsQuery(storeId));
  const { data: orders } = useQuery(ordersQuery(storeId));
  const runImport = useServerFn(importProducts);

  const parsed = csv.trim() ? toRows(csv) : { rows: [], errors: [] };

  const mutation = useMutation({
    mutationFn: () => runImport({ data: { storeId, rows: parsed.rows } }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["products", storeId] });
      toast.success(
        `${result.created} ürün eklendi, ${result.updated} ürün güncellendi${
          result.skipped.length ? `, ${result.skipped.length} satır atlandı` : ""
        }`,
      );
      if (result.skipped.length) {
        toast.warning(result.skipped.slice(0, 3).map((s) => `#${s.row}: ${s.reason}`).join(" · "));
      }
      setCsv("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function exportProducts() {
    const list = products ?? [];
    if (list.length === 0) {
      toast.info("Dışa aktarılacak ürün yok");
      return;
    }
    const rows = list.map((product) => {
      const variants = (product.product_variants ?? []) as { stock: number }[];
      const stock = variants.reduce((sum, variant) => sum + (variant.stock ?? 0), 0);
      return [
        product.title,
        product.description ?? "",
        "",
        product.vendor ?? "",
        product.product_type ?? "",
        product.base_price,
        product.compare_at_price ?? "",
        stock,
        product.status,
        (product.tags ?? []).join(","),
      ];
    });
    downloadCsv(`urunler-${storeId.slice(0, 8)}.csv`, toCsv([...PRODUCT_CSV_HEADERS], rows));
  }

  function exportOrders() {
    const list = orders ?? [];
    if (list.length === 0) {
      toast.info("Dışa aktarılacak sipariş yok");
      return;
    }
    const rows = list.map((order) => [
      order.order_number,
      order.placed_at,
      order.customer_name ?? "",
      order.customer_email ?? "",
      order.status,
      order.payment_status,
      order.fulfillment_status,
      order.subtotal,
      order.discount_total,
      order.shipping_total,
      order.grand_total,
      order.currency,
    ]);
    downloadCsv(
      `siparisler-${storeId.slice(0, 8)}.csv`,
      toCsv(
        [
          "order_number",
          "placed_at",
          "customer_name",
          "customer_email",
          "status",
          "payment_status",
          "fulfillment_status",
          "subtotal",
          "discount_total",
          "shipping_total",
          "grand_total",
          "currency",
        ],
        rows,
      ),
    );
  }

  return (
    <AppShell
      storeId={storeId}
      title="İçe / Dışa Aktarma"
      description="Kataloğunu CSV ile toplu yükle, ürün ve sipariş verilerini yedekle."
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="surface-card space-y-4 p-6 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Upload className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Ürün içe aktarma (CSV)</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Kolonlar: {PRODUCT_CSV_HEADERS.join(", ")}. Aynı başlığa sahip ürünler güncellenir, yeni
            olanlar eklenir. Tek seferde en fazla 500 satır.
          </p>

          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setCsv(await file.text());
                event.target.value = "";
              }}
            />
            <Button variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
              <FileSpreadsheet className="size-4" />
              Dosya seç
            </Button>
            <Button
              variant="ghost"
              className="gap-2"
              onClick={() => downloadCsv("mefticaret-urun-sablonu.csv", PRODUCT_CSV_TEMPLATE)}
            >
              <Download className="size-4" />
              Şablonu indir
            </Button>
          </div>

          <Textarea
            rows={10}
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
            placeholder={PRODUCT_CSV_TEMPLATE}
            className="font-mono text-xs"
          />

          {csv.trim() ? (
            <div className="rounded-lg border border-border/60 bg-muted/40 p-4 text-sm">
              <p className="font-medium">
                {parsed.rows.length} geçerli satır bulundu
                {parsed.errors.length ? ` · ${parsed.errors.length} hatalı satır` : ""}
              </p>
              {parsed.errors.length ? (
                <ul className="mt-2 space-y-1 text-xs text-destructive">
                  {parsed.errors.slice(0, 5).map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              ) : null}
              {parsed.rows.length ? (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {parsed.rows.slice(0, 5).map((row, index) => (
                    <li key={`${row.title}-${index}`}>
                      {row.title} · {row.price} · stok {row.stock} · {row.status}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <Button
            className="gap-2"
            disabled={parsed.rows.length === 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            <Upload className="size-4" />
            {mutation.isPending ? "Yükleniyor…" : `${parsed.rows.length} satırı içe aktar`}
          </Button>
        </section>

        <section className="surface-card space-y-4 p-6">
          <div className="flex items-center gap-2">
            <Download className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Dışa aktarma</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Verilerini Excel uyumlu CSV olarak indir; muhasebe ve pazaryeri aktarımlarında kullan.
          </p>
          <Button variant="outline" className="w-full justify-between" onClick={exportProducts}>
            Ürünler
            <span className="text-xs text-muted-foreground">{(products ?? []).length} kayıt</span>
          </Button>
          <Button variant="outline" className="w-full justify-between" onClick={exportOrders}>
            Siparişler
            <span className="text-xs text-muted-foreground">{(orders ?? []).length} kayıt</span>
          </Button>
        </section>
      </div>
    </AppShell>
  );
}
