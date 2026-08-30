import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Plus, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { customersQuery } from "@/lib/sales-queries";
import { deleteCustomer, upsertCustomer } from "@/lib/sales.functions";
import { formatDate, formatMoney } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/customers")({
  head: () => ({
    meta: [
      { title: "Müşteriler — Mefticaret" },
      {
        name: "description",
        content:
          "Müşteri kayıtlarını, iletişim bilgilerini, harcama ve sipariş geçmişini yönet.",
      },
      { property: "og:title", content: "Müşteriler — Mefticaret" },
      {
        property: "og:description",
        content: "Müşteri listesi, pazarlama izinleri ve harcama özetleri.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: customers, isLoading } = useQuery(customersQuery(storeId));
  const save = useServerFn(upsertCustomer);
  const remove = useServerFn(deleteCustomer);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [search, setSearch] = useState("");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["customers", storeId] });

  const createMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          storeId,
          fullName,
          email: email || undefined,
          phone: phone || undefined,
          notes: notes || undefined,
          acceptsMarketing: marketing,
        },
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Müşteri kaydedildi");
      setFullName("");
      setEmail("");
      setPhone("");
      setNotes("");
      setMarketing(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (customerId: string) => remove({ data: { customerId } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Müşteri silindi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers ?? [];
    return (customers ?? []).filter(
      (customer) =>
        customer.full_name.toLowerCase().includes(term) ||
        (customer.email ?? "").toLowerCase().includes(term) ||
        (customer.phone ?? "").toLowerCase().includes(term),
    );
  }, [customers, search]);

  return (
    <AppShell
      storeId={storeId}
      title="Müşteriler"
      description="Müşteri kayıtları, iletişim bilgileri ve harcama özetleri."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <form
          className="surface-card space-y-4 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate();
          }}
        >
          <h2 className="text-lg font-semibold">Yeni müşteri</h2>
          <div className="space-y-2">
            <Label htmlFor="cu-name">Ad Soyad</Label>
            <Input
              id="cu-name"
              required
              minLength={2}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cu-mail">E-posta</Label>
            <Input
              id="cu-mail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cu-phone">Telefon</Label>
            <Input
              id="cu-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+90 5xx xxx xx xx"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cu-notes">Not</Label>
            <Textarea
              id="cu-notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <span className="text-sm">Pazarlama izni</span>
            <Switch checked={marketing} onCheckedChange={setMarketing} />
          </div>
          <Button type="submit" className="w-full gap-2" disabled={createMutation.isPending}>
            <Plus className="size-4" />
            {createMutation.isPending ? "Kaydediliyor…" : "Ekle"}
          </Button>
        </form>

        <div className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="flex-1 min-w-[200px]"
              placeholder="Müşteri ara"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={rows.length === 0}
              onClick={() => {
                const csv = toCsv(
                  ["ad_soyad", "eposta", "telefon", "siparis_adedi", "toplam_harcama", "etiketler", "kayit_tarihi"],
                  rows.map((customer) => [
                    customer.full_name,
                    customer.email ?? "",
                    customer.phone ?? "",
                    customer.orders_count,
                    customer.total_spent,
                    (customer.tags ?? []).join("|"),
                    customer.created_at,
                  ]),
                );
                downloadCsv(`musteriler-${new Date().toISOString().slice(0, 10)}.csv`, csv);
                toast.success(`${rows.length} müşteri CSV olarak indirildi.`);
              }}
            >
              <Download className="size-4" /> CSV indir
            </Button>
          </div>
          {isLoading ? (
            <p className="text-muted-foreground">Yükleniyor…</p>
          ) : rows.length === 0 ? (
            <div className="surface-card p-10 text-center">
              <Users className="mx-auto mb-3 size-6 text-muted-foreground" />
              <p className="font-medium">Müşteri bulunamadı</p>
              <p className="text-sm text-muted-foreground">
                Soldaki formla ilk müşterini ekleyebilirsin.
              </p>
            </div>
          ) : (
            <div className="surface-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Müşteri</th>
                    <th className="px-4 py-3">İletişim</th>
                    <th className="px-4 py-3 text-right">Sipariş</th>
                    <th className="px-4 py-3 text-right">Harcama</th>
                    <th className="px-4 py-3">Kayıt</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((customer) => (
                    <tr key={customer.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3">
                        <Link
                          className="block font-medium underline-offset-4 hover:underline"
                          to="/store/$storeId/customers/$customerId"
                          params={{ storeId, customerId: customer.id }}
                        >
                          {customer.full_name}
                        </Link>

                        <span className="flex flex-wrap gap-1 pt-1">
                          {(customer.tags ?? []).map((tag: string) => (
                            <Badge key={tag} variant="secondary" className="text-[0.65rem]">
                              {tag}
                            </Badge>
                          ))}
                          {customer.accepts_marketing ? (
                            <Badge variant="outline" className="text-[0.65rem]">
                              e-posta izni
                            </Badge>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="block">{customer.email ?? "—"}</span>
                        <span className="block text-xs">{customer.phone ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-right">{customer.orders_count}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatMoney(Number(customer.total_spent))}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(customer.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`${customer.full_name} kaydını sil`}
                          onClick={() => deleteMutation.mutate(customer.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
