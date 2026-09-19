import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EXPORT_DOC_LABELS } from "@/lib/global-commerce";
import type { ExportDocumentRow } from "@/lib/global-export-queries";

/**
 * İngilizce ihracat belgesi çıktısı (Commercial Invoice / Packing List / ETGB).
 * Tarayıcının yazdır penceresinden PDF olarak kaydedilir.
 */

type Line = {
  description: string;
  hsCode: string | null;
  originCountry: string;
  quantity: number;
  unitPrice: number;
  total: number;
  weightGrams: number | null;
  material: string | null;
};

type Payload = {
  incoterm?: string;
  issuedAt?: string;
  order?: { number?: string; placedAt?: string; currency?: string; shipping?: number; total?: number };
  exporter?: Record<string, string | null>;
  consignee?: { name?: string | null; email?: string | null; address?: unknown };
  lines?: Line[];
  totals?: { pieces?: number; weightGrams?: number; goodsValue?: number };
  declaration?: string;
};

function addressText(address: unknown): string {
  if (!address || typeof address !== "object") return "-";
  const row = address as Record<string, unknown>;
  return [row["line1"], row["address"], row["district"], row["city"], row["postal_code"], row["country"]]
    .filter((value) => typeof value === "string" && value.trim().length)
    .join(", ");
}

export function ExportDocumentPrint({ document: doc }: { document: ExportDocumentRow }) {
  const payload = (doc.payload ?? {}) as Payload;
  const lines = payload.lines ?? [];
  const currency = doc.currency;

  return (
    <div className="space-y-4">
      <div className="flex justify-end print:hidden">
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="mr-2 size-4" /> Yazdır / PDF kaydet
        </Button>
      </div>

      <div id="export-doc-print" className="space-y-5 rounded-xl border bg-card p-6 text-sm">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
          <div>
            <h2 className="text-lg font-semibold uppercase tracking-wide">
              {doc.kind === "commercial_invoice"
                ? "Commercial Invoice"
                : doc.kind === "packing_list"
                  ? "Packing List"
                  : "Customs Declaration (ETGB)"}
            </h2>
            <p className="text-xs text-muted-foreground">{EXPORT_DOC_LABELS[doc.kind]}</p>
          </div>
          <dl className="text-right text-xs">
            <dt className="text-muted-foreground">Document No</dt>
            <dd className="font-medium">{doc.document_number}</dd>
            <dt className="mt-1 text-muted-foreground">Order No</dt>
            <dd className="font-medium">{payload.order?.number ?? "-"}</dd>
            <dt className="mt-1 text-muted-foreground">Incoterm</dt>
            <dd className="font-medium">{doc.incoterm}</dd>
          </dl>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Exporter / Shipper
            </h3>
            <p className="font-medium">{payload.exporter?.["name"] ?? "-"}</p>
            <p>{payload.exporter?.["address"] ?? "-"}</p>
            <p>
              {[payload.exporter?.["city"], payload.exporter?.["country"]].filter(Boolean).join(" / ")}
            </p>
            <p>Tax ID: {payload.exporter?.["taxId"] ?? "-"}</p>
            {payload.exporter?.["iossNumber"] ? <p>IOSS: {payload.exporter["iossNumber"]}</p> : null}
            <p>
              {payload.exporter?.["phone"] ?? "-"} · {payload.exporter?.["email"] ?? "-"}
            </p>
          </section>
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Consignee / Buyer
            </h3>
            <p className="font-medium">{payload.consignee?.name ?? "-"}</p>
            <p>{addressText(payload.consignee?.address)}</p>
            <p>{payload.consignee?.email ?? "-"}</p>
          </section>
        </div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-y bg-muted/40 text-left">
              <th className="px-2 py-2 font-medium">Description of goods</th>
              <th className="px-2 py-2 font-medium">HS code</th>
              <th className="px-2 py-2 font-medium">Origin</th>
              <th className="px-2 py-2 text-right font-medium">Qty</th>
              <th className="px-2 py-2 text-right font-medium">Unit ({currency})</th>
              <th className="px-2 py-2 text-right font-medium">Amount ({currency})</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lines.map((line, index) => (
              <tr key={`${line.description}-${index}`}>
                <td className="px-2 py-2">
                  {line.description}
                  {line.material ? <span className="text-muted-foreground"> · {line.material}</span> : null}
                </td>
                <td className="px-2 py-2">{line.hsCode ?? "-"}</td>
                <td className="px-2 py-2">{line.originCountry}</td>
                <td className="px-2 py-2 text-right">{line.quantity}</td>
                <td className="px-2 py-2 text-right">{line.unitPrice.toFixed(2)}</td>
                <td className="px-2 py-2 text-right">{line.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-medium">
              <td className="px-2 py-2" colSpan={3}>
                Total pieces: {payload.totals?.pieces ?? 0} · Gross weight:{" "}
                {((payload.totals?.weightGrams ?? 0) / 1000).toFixed(2)} kg
              </td>
              <td className="px-2 py-2" />
              <td className="px-2 py-2 text-right">Goods value</td>
              <td className="px-2 py-2 text-right">{Number(doc.total_value).toFixed(2)}</td>
            </tr>
            <tr>
              <td className="px-2 py-1" colSpan={5}>
                Freight
              </td>
              <td className="px-2 py-1 text-right">{(payload.order?.shipping ?? 0).toFixed(2)}</td>
            </tr>
            <tr className="font-semibold">
              <td className="px-2 py-1" colSpan={5}>
                Total invoice value ({currency})
              </td>
              <td className="px-2 py-1 text-right">
                {(Number(doc.total_value) + (payload.order?.shipping ?? 0)).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>

        <p className="text-xs text-muted-foreground">{payload.declaration}</p>
        <div className="flex justify-between pt-6 text-xs">
          <span>Date: {new Date(payload.issuedAt ?? doc.created_at).toLocaleDateString("en-GB")}</span>
          <span>Signature / Stamp: ______________________</span>
        </div>
      </div>
    </div>
  );
}
