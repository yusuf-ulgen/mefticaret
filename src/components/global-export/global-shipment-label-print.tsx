import { Printer } from "lucide-react";

import { BarcodeSvg } from "@/components/barcode-svg";
import { Button } from "@/components/ui/button";
import type { GlobalShipmentRow } from "@/lib/global-export-queries";

type LabelPayload = {
  orderNumber?: string;
  exporter?: { name?: string | null; address?: string | null; city?: string | null; country?: string | null; phone?: string | null };
  consignee?: { name?: string | null; email?: string | null; phone?: string | null; address?: unknown };
  pieces?: number;
  documentNumber?: string | null;
};

function addressText(address: unknown) {
  if (!address || typeof address !== "object") return "-";
  const row = address as Record<string, unknown>;
  return [row["line1"], row["address"], row["district"], row["city"], row["postal_code"], row["country"]]
    .filter((value) => typeof value === "string" && value.trim())
    .join(", ");
}

export function GlobalShipmentLabelPrint({ shipment }: { shipment: GlobalShipmentRow }) {
  const payload = (shipment.label_payload ?? {}) as LabelPayload;
  const barcode = shipment.tracking_number || payload.orderNumber || shipment.id;
  return (
    <div className="space-y-4">
      <div className="flex justify-end print:hidden">
        <Button size="sm" onClick={() => window.print()}><Printer className="mr-2 size-4" /> Etiketi yazdır / PDF kaydet</Button>
      </div>
      <div id="global-shipment-label-print" className="mx-auto max-w-2xl space-y-4 rounded-lg border bg-card p-6 text-sm">
        <header className="flex items-start justify-between gap-4 border-b pb-4">
          <div><p className="text-xs uppercase text-muted-foreground">Micro export shipment</p><h2 className="text-xl font-semibold">{shipment.carrier_code.toUpperCase()}</h2><p>{shipment.service || "International service"}</p></div>
          <div className="text-right"><p className="text-xs text-muted-foreground">Order</p><p className="font-semibold">{payload.orderNumber ?? "-"}</p><p className="text-xs">{shipment.incoterm}</p></div>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
          <section><p className="text-xs font-semibold uppercase text-muted-foreground">From</p><p className="font-medium">{payload.exporter?.name ?? "-"}</p><p>{payload.exporter?.address ?? "-"}</p><p>{[payload.exporter?.city, payload.exporter?.country].filter(Boolean).join(" / ")}</p><p>{payload.exporter?.phone ?? "-"}</p></section>
          <section><p className="text-xs font-semibold uppercase text-muted-foreground">Ship to</p><p className="font-medium">{payload.consignee?.name ?? "-"}</p><p>{addressText(payload.consignee?.address)}</p><p>{payload.consignee?.phone ?? "-"}</p><p>{payload.consignee?.email ?? "-"}</p></section>
        </div>
        <div className="grid gap-2 border-y py-3 text-xs sm:grid-cols-4">
          <p><span className="text-muted-foreground">Destination</span><br />{shipment.destination_country ?? "-"}</p><p><span className="text-muted-foreground">Weight</span><br />{shipment.weight_grams ? `${(shipment.weight_grams / 1000).toFixed(2)} kg` : "-"}</p><p><span className="text-muted-foreground">Pieces</span><br />{payload.pieces ?? "-"}</p><p><span className="text-muted-foreground">Declaration</span><br />{payload.documentNumber ?? "-"}</p>
        </div>
        <BarcodeSvg value={barcode} height={64} />
        <p className="text-center font-mono text-base">{shipment.tracking_number ?? `DRAFT · ${payload.orderNumber ?? shipment.id}`}</p>
        {!shipment.tracking_number ? <p className="text-center text-xs text-muted-foreground">Taşıyıcı takip numarası gelene kadar taslak etikettir.</p> : null}
      </div>
    </div>
  );
}