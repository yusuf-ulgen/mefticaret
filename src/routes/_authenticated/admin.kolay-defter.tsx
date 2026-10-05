import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadCsv, toCsv } from "@/lib/csv";
import { kolayLedgerOverview, kolayLedgerStore } from "@/lib/kolay-ledger.functions";
import { formatDateTime, formatMoney } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/admin/kolay-defter")({
  head: () => ({
    meta: [
      { title: "Kolay Panel Defteri — Süper Admin" },
      { name: "description", content: "Her Kolay Panel mağazasının sipariş, satış, komisyon ve aktarılacak tutar defteri." },
      { property: "og:title", content: "Kolay Panel Defteri — Süper Admin" },
      { property: "og:description", content: "Mağaza bazında ayrı satış ve hakediş defteri." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KolayLedgerPage,
});

const STATUS: Record<string, string> = { pending: "Bekliyor", approved: "Onaylandı", paid: "Aktarıldı", rejected: "Reddedildi" };

function KolayLedgerPage() {
  const overviewFn = useServerFn(kolayLedgerOverview);
  const storeFn = useServerFn(kolayLedgerStore);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const period = { ...(from ? { from } : {}), ...(to ? { to } : {}) };

  const q = useQuery({ queryKey: ["kolay-ledger", from, to], queryFn: () => overviewFn({ data: period }) });
  const detail = useQuery({
    queryKey: ["kolay-ledger-store", open, from, to],
    queryFn: () => storeFn({ data: { storeId: open!, ...period } }),
    enabled: !!open,
  });

  const rows = (q.data?.rows ?? []).filter((r) => r.name.toLocaleLowerCase("tr").includes(search.toLocaleLowerCase("tr")));
  const sum = (k: "sales" | "commission" | "net" | "transferred") => rows.reduce((a, r) => a + r[k], 0);

  return (
    <AdminShell title="Kolay Panel Defteri" description="Her Kolay Panel mağazasının siparişleri ayrı defterde: satış, komisyon ve bankaya aktarılacak tutar.">
      <div className="space-y-4">
        <div className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap">
          <label className="min-w-0 text-xs">Başlangıç<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-full" /></label>
          <label className="min-w-0 text-xs">Bitiş<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-full" /></label>
          <Input placeholder="Mağaza ara" value={search} onChange={(e) => setSearch(e.target.value)} className="col-span-2 h-9 w-full sm:w-56" aria-label="Mağaza ara" />
          <Button size="sm" variant="outline" className="col-span-2 sm:col-span-1" disabled={!rows.length} onClick={() => downloadCsv("kolay-defter.csv", toCsv(["Mağaza","Sipariş","Ödenen","İptal/İade","Satış","Komisyon","Net","Aktarılan","Bekleyen talep","Aktarılacak","IBAN","Hesap sahibi"], rows.map((r) => [r.name, r.orderCount, r.paidCount, r.cancelled, r.sales, r.commission, r.net, r.transferred, r.pending, r.toTransfer ?? "", r.iban ?? "", r.holder ?? ""])))}>CSV indir</Button>
        </div>
        {(from || to) && <p className="text-xs text-muted-foreground">Seçili tarih aralığında "Aktarılacak" gösterilmez; aktarılacak tutar tüm dönemin bakiyesidir.</p>}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {([["Toplam satış", sum("sales")], ["Komisyon geliri", sum("commission")], ["Satıcılara net", sum("net")], ["Aktarılan", sum("transferred")]] as const).map(([l, v]) => (
            <div key={l} className="surface-card min-w-0 p-3 sm:p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="truncate text-base font-semibold tabular-nums sm:text-lg">{formatMoney(v, "TRY")}</p></div>
          ))}
        </div>

        {q.isLoading ? <p className="text-sm text-muted-foreground">Yükleniyor…</p>
        : q.error ? <p className="text-sm text-destructive">{(q.error as Error).message}</p>
        : rows.length === 0 ? <p className="surface-card p-6 text-center text-sm text-muted-foreground">Kolay Panel mağazası yok.</p>
        : (
          <div className="space-y-3">
            {rows.map((r) => (
              <section key={r.storeId} className="surface-card">
                <button type="button" className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left" onClick={() => setOpen(open === r.storeId ? null : r.storeId)} aria-expanded={open === r.storeId}>
                  <div className="min-w-0">
                    <p className="font-semibold">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.orderCount} sipariş · {r.paidCount} ödenen · {r.cancelled} iptal/iade · komisyon %{(r.commissionRate * 100).toFixed(1)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm tabular-nums sm:grid-cols-4">
                    <span>Satış <b>{formatMoney(r.sales, r.currency)}</b></span>
                    <span>Komisyon <b>{formatMoney(r.commission, r.currency)}</b></span>
                    <span>Aktarılan <b>{formatMoney(r.transferred, r.currency)}</b></span>
                    <span>Aktarılacak <b className="text-primary">{r.toTransfer == null ? "—" : formatMoney(r.toTransfer, r.currency)}</b></span>
                  </div>
                </button>
                {open === r.storeId && (
                  <div className="space-y-3 border-t p-4 text-sm">
                    <p className="break-all text-xs text-muted-foreground">Banka: {r.iban ? `${r.holder ?? ""} · ${r.iban}` : "IBAN girilmemiş"}{r.pending ? ` · Bekleyen talep ${formatMoney(r.pending, r.currency)}` : ""}</p>
                    {detail.isLoading ? <p className="text-muted-foreground">Yükleniyor…</p> : detail.data ? (
                      <>
                        <ul className="space-y-2 sm:hidden">
                          {detail.data.lines.map((l) => (
                            <li key={l.id} className={`rounded-lg border p-3 text-xs ${l.counted ? "" : "text-muted-foreground"}`}>
                              <div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate font-medium">{l.number ?? "—"} · {l.customer ?? "—"}</span><Badge variant="outline" className="shrink-0">{l.counted ? "Hesaba katıldı" : l.paymentStatus !== "paid" ? "Ödenmedi" : "İptal/iade"}</Badge></div>
                              <p className="mt-1 text-muted-foreground">{l.placedAt ? formatDateTime(l.placedAt) : "—"}</p>
                              <div className="mt-2 grid grid-cols-3 gap-2 tabular-nums"><span>Tutar<br /><b>{formatMoney(l.total, l.currency)}</b></span><span>Komisyon<br /><b>{formatMoney(l.commission, l.currency)}</b></span><span>Net<br /><b>{formatMoney(l.net, l.currency)}</b></span></div>
                            </li>
                          ))}
                          {detail.data.lines.length === 0 && <li className="py-3 text-center text-muted-foreground">Bu dönemde sipariş yok.</li>}
                        </ul>
                        <div className="hidden overflow-x-auto sm:block">
                          <table className="w-full text-xs">
                            <thead className="text-left text-muted-foreground"><tr><th className="py-1 pr-3">Tarih</th><th className="pr-3">Sipariş</th><th className="pr-3">Müşteri</th><th className="pr-3 text-right">Tutar</th><th className="pr-3 text-right">Komisyon</th><th className="pr-3 text-right">Net</th><th>Durum</th></tr></thead>
                            <tbody className="divide-y divide-border">
                              {detail.data.lines.map((l) => (
                                <tr key={l.id} className={l.counted ? "" : "text-muted-foreground"}>
                                  <td className="py-1 pr-3 whitespace-nowrap">{l.placedAt ? formatDateTime(l.placedAt) : "—"}</td>
                                  <td className="pr-3">{l.number ?? "—"}</td>
                                  <td className="pr-3">{l.customer ?? "—"}</td>
                                  <td className="pr-3 text-right tabular-nums">{formatMoney(l.total, l.currency)}</td>
                                  <td className="pr-3 text-right tabular-nums">{formatMoney(l.commission, l.currency)}</td>
                                  <td className="pr-3 text-right tabular-nums">{formatMoney(l.net, l.currency)}</td>
                                  <td><Badge variant="outline">{l.counted ? "Hesaba katıldı" : l.paymentStatus !== "paid" ? "Ödenmedi" : "İptal/iade"}</Badge></td>
                                </tr>
                              ))}
                              {detail.data.lines.length === 0 && <tr><td colSpan={7} className="py-3 text-center text-muted-foreground">Bu dönemde sipariş yok.</td></tr>}
                            </tbody>
                          </table>
                        </div>
                        {detail.data.payouts.length > 0 && (
                          <div>
                            <p className="mb-1 font-medium">Aktarım talepleri</p>
                            <ul className="divide-y divide-border text-xs">
                              {detail.data.payouts.map((p) => (
                                <li key={p.id} className="flex justify-between py-1"><span>{formatDateTime(p.created_at)}</span><span className="tabular-nums">{formatMoney(Number(p.amount), p.currency)} · {STATUS[p.status] ?? p.status}</span></li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
