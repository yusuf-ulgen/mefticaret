import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatMoney } from "@/lib/mefti";
import { PO_PAYMENT_LABEL, PO_SUPPLIER_STATUS_LABEL } from "@/lib/supplier-workflow";
import {
  adminGrantSupplierAccess,
  adminProcessSupplierPayout,
  adminSetSupplierPortal,
  adminSupplierOverview,
} from "@/lib/supplier-workflow.functions";

export const Route = createFileRoute("/_authenticated/admin/suppliers")({
  head: () => ({
    meta: [
      { title: "Tedarikçiler — Süper Admin" },
      { name: "description", content: "Tedarikçi portal erişimi, satın alma siparişleri ve ödeme talepleri." },
      { property: "og:title", content: "Tedarikçiler — Süper Admin" },
      { property: "og:description", content: "Tedarikçi portal erişimi, satın alma siparişleri ve ödeme talepleri." },
    ],
  }),
  component: AdminSuppliersPage,
});

const PAYOUT_LABEL: Record<string, string> = {
  requested: "Talep edildi",
  approved: "Onaylandı",
  paid: "Ödendi",
  rejected: "Reddedildi",
};

function AdminSuppliersPage() {
  const client = useQueryClient();
  const load = useServerFn(adminSupplierOverview);
  const grant = useServerFn(adminGrantSupplierAccess);
  const toggle = useServerFn(adminSetSupplierPortal);
  const processPayout = useServerFn(adminProcessSupplierPayout);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-suppliers"], queryFn: () => load() });
  const refresh = () => void client.invalidateQueries({ queryKey: ["admin-suppliers"] });

  const [form, setForm] = useState({ buyerStoreId: "", email: "", supplierName: "" });
  const grantMutation = useMutation({
    mutationFn: () => grant({ data: form }),
    onSuccess: (result) => {
      toast.success(result.created ? "Tedarikçi erişimi açıldı" : "Mevcut tedarikçi erişimi yeniden açıldı");
      setForm({ buyerStoreId: "", email: "", supplierName: "" });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggleMutation = useMutation({
    mutationFn: (input: { supplierId: string; enabled: boolean }) => toggle({ data: input }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const payoutMutation = useMutation({
    mutationFn: (input: { payoutId: string; status: "approved" | "paid" | "rejected" }) => processPayout({ data: input }),
    onSuccess: () => {
      toast.success("Ödeme talebi güncellendi");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell title="Tedarikçiler" description="Mağaza sahiplerine tedarikçi erişimi verin; siparişleri ve ödeme taleplerini yönetin.">
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-lg border bg-muted/40" />
      ) : error ? (
        <p className="text-sm text-destructive">{(error as Error).message}</p>
      ) : data ? (
        <div className="space-y-6">
          <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-5">
            <div>
              <h2 className="font-medium">Tedarikçi erişimi aç</h2>
              <p className="text-sm text-muted-foreground">
                Kullanıcı bir mağaza sahibi olmalıdır. Kendi hesabıyla, ayrı şifre olmadan tedarikçi paneline girer.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="buyer">Alıcı mağaza</Label>
                <select
                  id="buyer"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.buyerStoreId}
                  onChange={(e) => setForm({ ...form, buyerStoreId: e.target.value })}
                >
                  <option value="">Seçin</option>
                  {data.stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="sup-email">Mağaza sahibinin e-postası</Label>
                <Input id="sup-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sup-name">Tedarikçi adı</Label>
                <Input id="sup-name" value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} />
              </div>
            </div>
            <Button
              disabled={grantMutation.isPending || !form.buyerStoreId || !form.email || form.supplierName.length < 2}
              onClick={() => grantMutation.mutate()}
            >
              Erişim ver
            </Button>
          </section>

          <section className="rounded-lg border bg-card">
            <h2 className="border-b p-4 font-medium">Portal erişimi olan tedarikçiler ({data.suppliers.length})</h2>
            {data.suppliers.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Henüz tedarikçi yok.</p>
            ) : (
              <ul className="divide-y">
                {data.suppliers.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-muted-foreground">
                        {s.storeName} · {s.email ?? "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={s.portalEnabled ? "default" : "outline"}>{s.portalEnabled ? "Açık" : "Kapalı"}</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={toggleMutation.isPending}
                        onClick={() => toggleMutation.mutate({ supplierId: s.id, enabled: !s.portalEnabled })}
                      >
                        {s.portalEnabled ? "Kapat" : "Aç"}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border bg-card">
            <h2 className="border-b p-4 font-medium">Ödeme talepleri</h2>
            {data.payouts.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Ödeme talebi yok.</p>
            ) : (
              <ul className="divide-y">
                {data.payouts.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {p.supplierName} · {formatMoney(p.amount, p.currency)}
                      </p>
                      <p className="break-all text-muted-foreground">
                        {p.storeName} · {p.iban} {p.accountName ? `· ${p.accountName}` : ""} · {formatDate(p.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{PAYOUT_LABEL[p.status] ?? p.status}</Badge>
                      {p.status === "requested" ? (
                        <Button size="sm" variant="outline" disabled={payoutMutation.isPending} onClick={() => payoutMutation.mutate({ payoutId: p.id, status: "approved" })}>
                          Onayla
                        </Button>
                      ) : null}
                      {p.status === "requested" || p.status === "approved" ? (
                        <>
                          <Button size="sm" disabled={payoutMutation.isPending} onClick={() => payoutMutation.mutate({ payoutId: p.id, status: "paid" })}>
                            Ödendi
                          </Button>
                          <Button size="sm" variant="ghost" disabled={payoutMutation.isPending} onClick={() => payoutMutation.mutate({ payoutId: p.id, status: "rejected" })}>
                            Reddet
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border bg-card">
            <h2 className="border-b p-4 font-medium">Satın alma siparişleri</h2>
            {data.orders.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Sipariş yok.</p>
            ) : (
              <ul className="divide-y">
                {data.orders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {o.code} · {formatMoney(o.total, o.currency)}
                      </p>
                      <p className="text-muted-foreground">
                        {o.storeName} → {o.supplierName} · {formatDate(o.createdAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">{PO_SUPPLIER_STATUS_LABEL[o.supplierStatus] ?? o.supplierStatus}</Badge>
                      <Badge variant={o.paymentStatus === "paid" ? "default" : "outline"}>{PO_PAYMENT_LABEL[o.paymentStatus] ?? o.paymentStatus}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </AdminShell>
  );
}
