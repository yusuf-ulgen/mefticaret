/**
 * Kargo etiketi / irsaliye çıktısı: yazdırılabilir HTML üretir ve
 * yeni pencerede yazdırma diyaloğunu açar. Code 128 barkod gömülüdür.
 */

import { barcodeBars, barcodeWidth, encodeCode128B, sanitizeBarcodeValue } from "@/lib/barcode";

export type CargoLabelData = {
  orderNumber: string;
  supplierName: string;
  storeName?: string;
  carrier: string;
  trackingNumber: string | null;
  customerName: string;
  customerPhone: string | null;
  addressLines: string[];
  items: { title: string; code: string; quantity: number }[];
  createdAt: string;
};

function barcodeSvg(value: string, height = 64, moduleWidth = 2): string {
  const clean = sanitizeBarcodeValue(value);
  if (!clean) return "";
  const modules = encodeCode128B(clean);
  const width = barcodeWidth(modules, moduleWidth);
  if (!width) return "";
  const bars = barcodeBars(modules, moduleWidth)
    .map((bar) => `<rect x="${bar.x}" y="0" width="${bar.width}" height="${height}" fill="#000"/>`)
    .join("");
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="none"><rect width="${width}" height="${height}" fill="#fff"/>${bars}</svg>`;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) =>
    char === "&" ? "&amp;" : char === "<" ? "&lt;" : char === ">" ? "&gt;" : char === '"' ? "&quot;" : "&#39;",
  );

export function cargoLabelHtml(labels: CargoLabelData[]): string {
  const pages = labels
    .map((label) => {
      const barcodeValue = label.trackingNumber?.trim() || label.orderNumber;
      return `
      <section class="label">
        <div class="row">
          <div>
            <div class="muted">Gönderici</div>
            <div class="strong">${escapeHtml(label.supplierName)}</div>
          </div>
          <div class="right">
            <div class="muted">Kargo</div>
            <div class="strong">${escapeHtml(label.carrier)}</div>
          </div>
        </div>
        <div class="barcode">${barcodeSvg(barcodeValue)}<div class="code">${escapeHtml(barcodeValue)}</div></div>
        <div class="box">
          <div class="muted">Alıcı</div>
          <div class="strong">${escapeHtml(label.customerName)}</div>
          ${label.addressLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}
          ${label.customerPhone ? `<div>Tel: ${escapeHtml(label.customerPhone)}</div>` : ""}
        </div>
        <table>
          <thead><tr><th>Ürün</th><th>Kod</th><th class="right">Adet</th></tr></thead>
          <tbody>
            ${label.items
              .map(
                (item) =>
                  `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.code)}</td><td class="right">${item.quantity}</td></tr>`,
              )
              .join("")}
          </tbody>
        </table>
        <div class="foot">
          <span>Sipariş: ${escapeHtml(label.orderNumber)}</span>
          <span>${new Date(label.createdAt).toLocaleString("tr-TR")}</span>
        </div>
      </section>`;
    })
    .join("");

  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Kargo etiketi</title>
  <style>
    *{box-sizing:border-box;font-family:ui-sans-serif,system-ui,'Segoe UI',Arial,sans-serif}
    body{margin:0;background:#fff;color:#111}
    .label{width:100mm;min-height:150mm;padding:8mm;border:1px solid #111;margin:6mm auto;page-break-after:always}
    .row{display:flex;justify-content:space-between;gap:8px;font-size:11px}
    .right{text-align:right}
    .muted{color:#555;font-size:10px;text-transform:uppercase;letter-spacing:.04em}
    .strong{font-weight:700;font-size:13px}
    .barcode{margin:6mm 0;text-align:center}
    .code{font-family:ui-monospace,monospace;font-size:12px;letter-spacing:.12em;margin-top:2mm}
    .box{border:1px solid #111;padding:4mm;font-size:12px;line-height:1.45}
    table{width:100%;border-collapse:collapse;margin-top:4mm;font-size:11px}
    th,td{border-bottom:1px solid #ddd;padding:2mm 1mm;text-align:left}
    .foot{display:flex;justify-content:space-between;font-size:10px;color:#555;margin-top:4mm}
    @media print{.label{margin:0;border:none}}
  </style></head><body>${pages}<script>window.onload=function(){window.print()}</script></body></html>`;
}

export function printCargoLabels(labels: CargoLabelData[]) {
  const win = window.open("", "_blank", "width=420,height=720");
  if (!win) return false;
  win.document.write(cargoLabelHtml(labels));
  win.document.close();
  return true;
}
