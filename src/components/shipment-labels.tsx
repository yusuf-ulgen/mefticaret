import { Printer } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/mefti";

export type ShipmentLabelRow = {
  id: string;
  carrier: string;
  tracking_number: string | null;
  status: string;
  created_at: string;
  orderNumber: string;
  customerName: string;
  storeName: string;
  statusLabel: string;
};

export function ShipmentLabels({ rows }: { rows: ShipmentLabelRow[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={rows.length === 0}>
          <Printer className="mr-2 size-4" />
          Kargo etiketi ({rows.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kargo etiketleri</DialogTitle>
          <DialogDescription>
            Filtrelenmiş sevkiyatlar için yazdırmaya hazır etiket listesi.
          </DialogDescription>
        </DialogHeader>

        <div id="shipment-print-area" className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.id}
              className="break-inside-avoid rounded-lg border border-border p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {row.storeName}
                  </p>
                  <p className="text-lg font-semibold">{row.orderNumber}</p>
                  <p className="text-sm">{row.customerName}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium">{row.carrier}</p>
                  <p className="font-mono text-base tracking-wider">
                    {row.tracking_number ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">{row.statusLabel}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Oluşturma: {formatDateTime(row.created_at)}
              </p>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Kapat
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 size-4" />
            Yazdır
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
