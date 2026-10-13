import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Phone, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BigButton, Field, SoftCard, inputClass } from "@/components/homemaker/kolay-parts";
import { kolayCustomersQuery } from "@/lib/kolay-crm-queries";
import {
  deleteKolayCustomer,
  saveKolayCustomer,
  type KolayCustomer,
} from "@/lib/kolay-customers.functions";
import { formatMoney } from "@/lib/mefti";

/** "Müşterilerim" sekmesi: müşteri defteri, hızlı ekleme ve WhatsApp erişimi. */

type Form = {
  customerId?: string;
  fullName: string;
  phone: string;
  email: string;
  notes: string;
};

const emptyForm: Form = { fullName: "", phone: "", email: "", notes: "" };

function waLink(phone: string | null, name: string | null) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const number = digits.startsWith("90") ? digits : `90${digits.slice(-10)}`;
  const text = encodeURIComponent(`Merhaba ${name ?? ""}, `.trim());
  return `https://wa.me/${number}?text=${text}`;
}

export function CustomersTab({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const { data, isPending, isFetching, error, refetch } = useQuery(
    kolayCustomersQuery(storeId, search, page),
  );
  const save = useServerFn(saveKolayCustomer);
  const remove = useServerFn(deleteKolayCustomer);

  const [form, setForm] = useState<Form | null>(null);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["kolay-customers", storeId] });
  };

  const saveMutation = useMutation({
    mutationFn: (input: Form) =>
      save({
        data: {
          storeId,
          customerId: input.customerId,
          fullName: input.fullName,
          phone: input.phone || null,
          email: input.email || null,
          notes: input.notes || null,
        },
      }),
    onSuccess: async () => {
      setForm(null);
      await refresh();
      toast.success("Müşteri kaydedildi");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Müşteri kaydedilemedi"),
  });

  const deleteMutation = useMutation({
    mutationFn: (customerId: string) => remove({ data: { storeId, customerId } }),
    onSuccess: async () => {
      await refresh();
      toast.success("Müşteri silindi");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Silinemedi"),
  });

  const list = data?.items ?? [];
  const filtered = list;

  const repeat = list.filter((customer) => customer.ordersCount > 1).length;
  const currency = data?.currency ?? "TRY";
  const spent = list.reduce((sum, customer) => sum + customer.totalSpent, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["Müşteri", data ? String(data.total) : "—", "bg-hm-rose-soft text-hm-rose"],
            ["Sayfada tekrar alan", data ? String(repeat) : "—", "bg-hm-teal-soft text-hm-teal"],
            [
              "Sayfadaki tahsilat",
              data ? formatMoney(spent, currency) : "—",
              "bg-hm-emerald-soft text-hm-emerald",
            ],
          ] as const
        ).map(([label, value, tone]) => (
          <div key={label} className={`rounded-3xl px-3 py-3 ${tone}`}>
            <p className="text-xs font-semibold opacity-80">{label}</p>
            <p className="mt-0.5 truncate text-base font-bold">{value}</p>
          </div>
        ))}
      </div>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(term);
          setPage(0);
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-hm-ink-soft" />
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Ad, telefon veya not ara"
            aria-label="Müşteri ara"
            className={`${inputClass} pl-9`}
          />
        </div>
        <BigButton type="submit" disabled={isFetching}>
          Ara
        </BigButton>
        <BigButton type="button" onClick={() => setForm({ ...emptyForm })}>
          <UserPlus className="size-5" />
          Ekle
        </BigButton>
      </form>

      {form ? (
        <SoftCard className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold">
              {form.customerId ? "Müşteriyi düzenle" : "Yeni müşteri"}
            </p>
            <button
              type="button"
              onClick={() => setForm(null)}
              aria-label="Kapat"
              className="grid size-9 place-items-center rounded-2xl bg-hm-sand text-hm-ink-soft"
            >
              <X className="size-4" />
            </button>
          </div>
          <Field label="Adı">
            <input
              value={form.fullName}
              onChange={(event) => setForm({ ...form, fullName: event.target.value })}
              placeholder="Ayşe Yılmaz"
              className={inputClass}
            />
          </Field>
          <Field label="WhatsApp / telefon" hint="Sipariş haberleşmesi için">
            <input
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              inputMode="tel"
              placeholder="05xx xxx xx xx"
              className={inputClass}
            />
          </Field>
          <Field label="E-posta (isteğe bağlı)">
            <input
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              inputMode="email"
              placeholder="ornek@eposta.com"
              className={inputClass}
            />
          </Field>
          <Field label="Notum" hint="Alerji, adres tarifi, özel gün…">
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              rows={3}
              className={inputClass}
            />
          </Field>
          <BigButton
            onClick={() => saveMutation.mutate(form)}
            disabled={form.fullName.trim().length < 2 || saveMutation.isPending}
            className="w-full"
          >
            <Plus className="size-5" />
            {saveMutation.isPending ? "Kaydediliyor…" : "Kaydet"}
          </BigButton>
        </SoftCard>
      ) : null}

      {error ? (
        <SoftCard>
          <p role="alert">{error.message}</p>
          <BigButton onClick={() => void refetch()}>Tekrar dene</BigButton>
        </SoftCard>
      ) : null}
      {isPending ? (
        <div className="grid min-h-32 place-items-center rounded-3xl border border-hm-line bg-white text-sm text-hm-ink-soft">
          Müşterileriniz yükleniyor…
        </div>
      ) : null}

      {!isPending && !error && filtered.length === 0 ? (
        <SoftCard className="text-center">
          <p className="text-sm text-hm-ink-soft">
            {list.length === 0
              ? "Henüz müşteri kaydınız yok. Sipariş verenler otomatik eklenir, dilerseniz elle de ekleyebilirsiniz."
              : "Aramanıza uygun müşteri bulunamadı."}
          </p>
        </SoftCard>
      ) : null}

      <div className="space-y-3">
        {filtered.map((customer) => (
          <CustomerCard
            key={customer.id}
            customer={customer}
            onEdit={() =>
              setForm({
                customerId: customer.id,
                fullName: customer.fullName,
                phone: customer.phone ?? "",
                email: customer.email ?? "",
                notes: customer.notes ?? "",
              })
            }
            onDelete={() => {
              if (window.confirm(`${customer.fullName} kaydı silinsin mi?`)) {
                deleteMutation.mutate(customer.id);
              }
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BigButton disabled={page === 0 || isFetching} onClick={() => setPage((p) => p - 1)}>
          ?nceki
        </BigButton>
        <span className="text-sm">
          Sayfa {page + 1} / {Math.max(1, Math.ceil((data?.total ?? 0) / 25))}
        </span>
        <BigButton
          disabled={isFetching || !data || (page + 1) * data.pageSize >= data.total}
          onClick={() => setPage((p) => p + 1)}
        >
          Sonraki
        </BigButton>
      </div>
    </div>
  );
}

function CustomerCard({
  customer,
  onEdit,
  onDelete,
}: {
  customer: KolayCustomer;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const wa = waLink(customer.phone, customer.fullName);
  return (
    <SoftCard className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-hm-rose-soft text-base font-bold text-hm-rose">
          {customer.fullName.slice(0, 1).toLocaleUpperCase("tr")}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{customer.fullName}</p>
          <p className="truncate text-xs text-hm-ink-soft">
            {customer.phone || customer.email || "İletişim bilgisi yok"}
          </p>
          <p className="mt-1 text-xs text-hm-ink-soft">
            {customer.ordersCount} sipariş ·{" "}
            <span className="font-semibold text-hm-emerald">
              {formatMoney(customer.totalSpent, customer.currency)}
            </span>
            {customer.lastOrderAt
              ? ` · son ${new Date(customer.lastOrderAt).toLocaleDateString("tr-TR")}`
              : ""}
          </p>
        </div>
        {customer.ordersCount > 1 ? (
          <span className="rounded-full bg-hm-teal-soft px-2 py-0.5 text-xs font-semibold text-hm-teal">
            Sadık
          </span>
        ) : null}
      </div>
      {customer.notes ? (
        <p className="rounded-2xl bg-hm-sand px-3 py-2 text-xs text-hm-ink-soft">
          {customer.notes}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-hm-emerald px-4 text-sm font-semibold text-white"
          >
            <MessageCircle className="size-4" />
            WhatsApp
          </a>
        ) : null}
        {customer.phone ? (
          <a
            href={`tel:${customer.phone}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-hm-line bg-white px-4 text-sm font-semibold"
          >
            <Phone className="size-4" />
            Ara
          </a>
        ) : null}
        <BigButton tone="ghost" onClick={onEdit} className="text-sm">
          Düzenle
        </BigButton>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Müşteriyi sil"
          className="grid size-11 place-items-center rounded-2xl border border-hm-line bg-white text-hm-rose"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </SoftCard>
  );
}
