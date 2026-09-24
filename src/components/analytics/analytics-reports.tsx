import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileSpreadsheet, FileText, Mail, Sheet as SheetIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Panel } from "@/components/analytics/analytics-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { REPORT_KEYS, REPORTS, type PeriodInput, type ReportKey } from "@/lib/analytics-v2";
import { getAnalyticsReport, listReportSchedules, saveReportSchedule } from "@/lib/analytics-v2.functions";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatDateTime } from "@/lib/mefti";

type Table = { title: string; headers: string[]; rows: (string | number)[][] };

/** Rapor verisini tablo listesine çevirir (CSV/Excel/PDF ortak). */
export function reportTables(data: Record<string, any>): Table[] {
  const t: Table[] = [];
  const ov = data["overview"];
  if (ov) t.push({ title: "Özet", headers: ["Metrik", "Bu dönem", "Önceki dönem"], rows: [
    ["Satış", ov.current.revenue, ov.previous.revenue], ["Sipariş", ov.current.orders, ov.previous.orders],
    ["Ortalama sipariş", ov.current.aov, ov.previous.aov], ["Ziyaretçi", ov.current.visitors, ov.previous.visitors],
    ["Oturum", ov.current.sessions, ov.previous.sessions], ["Dönüşüm %", +(ov.current.conversion_rate * 100).toFixed(2), +(ov.previous.conversion_rate * 100).toFixed(2)],
  ] });
  if (data["series"]) t.push({ title: "Zaman serisi", headers: ["Zaman", "Satış", "Sipariş", "Ziyaretçi", "Oturum"], rows: data["series"].map((p: any) => [p.t, p.revenue, p.orders, p.visitors, p.sessions]) });
  const s = data["sales"];
  if (s) {
    t.push({ title: "Satış dökümü", headers: ["Kalem", "Tutar"], rows: [["Brüt", s.breakdown.gross], ["İndirim", s.breakdown.discount], ["Kargo", s.breakdown.shipping], ["Vergi", s.breakdown.tax], ["Toplam", s.breakdown.total], ["İade", s.refunds]] });
    t.push({ title: "Ödeme yöntemleri", headers: ["Yöntem", "Tutar", "Adet"], rows: s.payment_methods.map((p: any) => [p.method, p.amount, p.count]) });
  }
  const p = data["products"];
  if (p) {
    t.push({ title: "En çok satanlar", headers: ["Ürün", "Adet", "Ciro"], rows: p.top.map((x: any) => [x.title, x.quantity, x.revenue]) });
    t.push({ title: "En çok görüntülenenler", headers: ["Ürün", "Görüntüleme", "Oturum"], rows: p.viewed.map((x: any) => [x.title, x.views, x.sessions]) });
    t.push({ title: "Sepette kalanlar", headers: ["Ürün", "Sepete ekleyen oturum", "Satın alan oturum"], rows: p.abandoned.map((x: any) => [x.title, x.carted_sessions, x.purchased_sessions]) });
    t.push({ title: "Düşük stok", headers: ["Ürün", "Varyant", "Stok"], rows: p.low_stock.map((x: any) => [x.title, x.variant_title, x.stock]) });
  }
  const c = data["customers"];
  if (c) {
    t.push({ title: "Müşteri segmentleri", headers: ["Segment", "Adet"], rows: [["Yeni", c.new], ["Geri dönen", c.returning], ["Misafir sipariş", c.guest_orders], ["Ortalama yaşam değeri", c.ltv]] });
    t.push({ title: "En değerli müşteriler", headers: ["Müşteri", "E-posta", "Sipariş", "Harcama"], rows: c.top.map((x: any) => [x.name ?? "", x.email ?? "", x.orders, x.spent]) });
    t.push({ title: "İller", headers: ["İl", "Sipariş", "Ciro"], rows: c.provinces.map((x: any) => [x.province, x.orders, x.revenue]) });
  }
  const tr = data["traffic"];
  if (tr) {
    t.push({ title: "Kanallar", headers: ["Kanal", "Oturum", "Satış"], rows: tr.channels.map((x: any) => [x.channel, x.sessions, x.purchases]) });
    t.push({ title: "Kampanyalar", headers: ["Kampanya", "Kaynak", "Ortam", "Oturum", "Satış", "Ciro"], rows: tr.campaigns.map((x: any) => [x.campaign, x.source ?? "", x.medium ?? "", x.sessions, x.purchases, x.revenue]) });
  }
  const f = data["funnel"];
  if (f) t.push({ title: "Dönüşüm hunisi", headers: ["Adım", "Oturum"], rows: [["Ziyaretçi", f.visitors], ["Ürün görüntüleme", f.product_view], ["Sepete ekleme", f.add_to_cart], ["Ödemeye geçiş", f.checkout], ["Satın alma", f.purchase]] });
  return t;
}

async function exportReport(kind: "csv" | "xlsx" | "pdf", label: string, range: { fromDay: string; toDay: string }, tables: Table[]) {
  const base = `${label.toLowerCase().replace(/[^a-z0-9ğüşıöç]+/gi, "-")}-${range.fromDay}_${range.toDay}`;
  if (kind === "csv") {
    const parts = tables.map((t) => `${t.title}\n${toCsv(t.headers, t.rows)}`);
    downloadCsv(`${base}.csv`, parts.join("\n\n"));
    return;
  }
  if (kind === "xlsx") {
    const XLSX = await import("@e965/xlsx");
    const wb = XLSX.utils.book_new();
    tables.forEach((t, i) => {
      const ws = XLSX.utils.aoa_to_sheet([t.headers, ...t.rows]);
      XLSX.utils.book_append_sheet(wb, ws, `${i + 1}-${t.title}`.slice(0, 31).replace(/[\\/?*[\]:]/g, ""));
    });
    XLSX.writeFile(wb, `${base}.xlsx`);
    return;
  }
  // PDF: yazdırılabilir rapor sayfası (tarayıcının "PDF olarak kaydet" özelliği Türkçe karakterleri korur).
  const esc = (v: unknown) => String(v).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${esc(label)}</title>
<style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}h1{font-size:20px}h2{font-size:14px;margin-top:20px}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #ddd;padding:4px 6px;text-align:left}th{background:#f4f4f5}</style></head>
<body><h1>${esc(label)}</h1><p>${esc(range.fromDay)} – ${esc(range.toDay)}</p>${tables.map((t) => `<h2>${esc(t.title)}</h2><table><thead><tr>${t.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${t.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${t.headers.length}">Veri yok</td></tr>`}</tbody></table>`).join("")}
<script>window.onload=()=>{window.print()}</script></body></html>`;
  const w = window.open("", "_blank");
  if (!w) { toast.error("Açılır pencere engellendi; PDF için izin verin."); return; }
  w.document.write(html);
  w.document.close();
}

export function ReportsSection({ storeId, period }: { storeId: string; period: PeriodInput }) {
  const fetchReport = useServerFn(getAnalyticsReport);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: ReportKey, kind: "csv" | "xlsx" | "pdf") => {
    setBusy(`${key}-${kind}`);
    try {
      const r = await fetchReport({ data: { storeId, report: key, ...period } });
      await exportReport(kind, r.label, r.range, reportTables(r.data));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Raporlar üstte seçtiğiniz tarih aralığına göre hazırlanır.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {REPORT_KEYS.map((key) => (
          <div key={key} className="surface-card space-y-3 p-4">
            <div>
              <p className="font-medium">{REPORTS[key].label}</p>
              <p className="text-sm text-muted-foreground">{REPORTS[key].description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="h-11" disabled={!!busy} onClick={() => run(key, "csv")}><SheetIcon className="mr-1 size-4" /> CSV</Button>
              <Button variant="outline" className="h-11" disabled={!!busy} onClick={() => run(key, "xlsx")}><FileSpreadsheet className="mr-1 size-4" /> Excel</Button>
              <Button variant="outline" className="h-11" disabled={!!busy} onClick={() => run(key, "pdf")}><FileText className="mr-1 size-4" /> PDF</Button>
            </div>
          </div>
        ))}
      </div>
      <Schedules storeId={storeId} />
    </div>
  );
}

function Schedules({ storeId }: { storeId: string }) {
  const list = useServerFn(listReportSchedules);
  const { data = [] } = useQuery({ queryKey: ["analytics-schedules", storeId], queryFn: () => list({ data: { storeId } }) });
  return (
    <Panel title="Zamanlanmış e-posta raporları">
      <p className="mb-3 text-xs text-muted-foreground">
        Günlük raporlar her sabah 08:00'de, haftalık raporlar pazartesi, aylık raporlar ayın 1'inde gönderilir.
      </p>
      <div className="grid gap-3">
        {REPORT_KEYS.map((key) => <ScheduleRow key={key} storeId={storeId} reportKey={key} row={data.find((d) => d.report_key === key)} />)}
      </div>
    </Panel>
  );
}

function ScheduleRow({ storeId, reportKey, row }: { storeId: string; reportKey: ReportKey; row?: { frequency: string; recipients: string[]; is_active: boolean; last_sent_at: string | null; last_error: string | null } | undefined }) {
  const qc = useQueryClient();
  const save = useServerFn(saveReportSchedule);
  const [active, setActive] = useState(row?.is_active ?? false);
  const [emails, setEmails] = useState((row?.recipients ?? []).join(", "));
  const frequency = REPORTS[reportKey].frequency;
  const m = useMutation({
    mutationFn: () => save({ data: { storeId, reportKey, frequency, isActive: active, recipients: emails.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean) } }),
    onSuccess: () => { toast.success("Zamanlama kaydedildi"); void qc.invalidateQueries({ queryKey: ["analytics-schedules", storeId] }); },
    onError: (e: Error) => toast.error(e.message.includes("email") ? "Geçerli e-posta adresleri girin" : e.message),
  });
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium"><Mail className="size-4" /> {REPORTS[reportKey].label}
          <Badge variant="outline">{frequency === "daily" ? "Günlük" : frequency === "weekly" ? "Haftalık" : "Aylık"}</Badge></p>
        {row?.last_sent_at ? <p className="text-xs text-muted-foreground">Son gönderim: {formatDateTime(row.last_sent_at)}</p> : null}
        {row?.last_error ? <p className="text-xs text-destructive">{row.last_error}</p> : null}
      </div>
      <Input className="h-11 sm:max-w-xs" placeholder="ornek@magaza.com, ..." value={emails} onChange={(e) => setEmails(e.target.value)} />
      <div className="flex items-center gap-3">
        <Switch checked={active} onCheckedChange={setActive} aria-label="Aktif" />
        <Button className="h-11" disabled={m.isPending} onClick={() => m.mutate()}>Kaydet</Button>
      </div>
    </div>
  );
}
