import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { supabase } from "@/integrations/supabase/client";
import {
  claimMyStoreAccount,
  deleteMyStoreAddress,
  saveMyStoreAddress,
  updateMyStoreProfile,
} from "@/lib/account.functions";
import { myAddressesQuery, myOrdersQuery } from "@/lib/account-queries";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime, formatMoney, FULFILLMENT_STATUS_LABELS, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/mefti";
import { storefrontQuery } from "@/lib/storefront-queries";

export const Route = createFileRoute("/s/$slug/account")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(storefrontQuery(params.slug));
    if (!data) throw notFound();
    return { name: data.store.name };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Mağaza bulunamadı" }, { name: "robots", content: "noindex" }] };
    }
    const title = `Hesabım — ${loaderData.name}`;
    const description = `${loaderData.name} müşteri hesabı: sipariş geçmişi, adres defteri ve üyelik bilgileri.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  errorComponent: () => <Fallback text="Hesap sayfası şu anda yüklenemedi." />,
  notFoundComponent: () => <Fallback text="Bu adreste yayınlanmış bir mağaza yok." />,
  component: AccountPage,
});

function Fallback({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">{text}</h1>
      <Link to="/" className="text-sm underline">
        Mefticaret ana sayfası
      </Link>
    </div>
  );
}

function AccountPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  const { user, loading } = useAuth();

  if (!data) return <Fallback text="Bu adreste yayınlanmış bir mağaza yok." />;
  const { store, theme } = data;

  return (
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug}>
      <section style={{ padding: "40px 0", maxWidth: 760 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Hesabım</h1>
        {loading ? (
          <p style={{ marginTop: 16, opacity: 0.7 }}>Yükleniyor…</p>
        ) : user ? (
          <AccountDashboard storeId={store.id} />
        ) : (
          <AccountAuth />
        )}
      </section>
    </StorefrontChrome>
  );
}

/* ---------------------------------- Giriş ---------------------------------- */

function AccountAuth() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        toast.success("Hesabınız oluşturuldu. Giriş yapılıyor…");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Giriş yapıldı.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "İşlem başarısız oldu.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ marginTop: 20, display: "grid", gap: 12, maxWidth: 380 }}>
      <p style={{ opacity: 0.75, margin: 0, fontSize: 14 }}>
        Siparişlerinizi takip etmek ve adreslerinizi kaydetmek için giriş yapın veya üye olun.
      </p>
      {mode === "signup" ? (
        <input
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Ad soyad"
          style={inputStyle}
        />
      ) : null}
      <input
        required
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="E-posta"
        style={inputStyle}
      />
      <input
        required
        type="password"
        minLength={6}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Şifre (en az 6 karakter)"
        style={inputStyle}
      />
      <button type="submit" disabled={busy} style={buttonStyle}>
        {busy ? "İşleniyor…" : mode === "signin" ? "Giriş yap" : "Üye ol"}
      </button>
      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, opacity: 0.7, textAlign: "left" }}
      >
        {mode === "signin" ? "Hesabınız yok mu? Üye olun" : "Zaten üye misiniz? Giriş yapın"}
      </button>
    </form>
  );
}

/* --------------------------------- Panel ---------------------------------- */

type Tab = "orders" | "addresses" | "profile";

function AccountDashboard({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("orders");

  const claimFn = useServerFn(claimMyStoreAccount);
  const claim = useMutation({
    mutationFn: () => claimFn({ data: { storeId } }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["storefront", storeId] });
      if (result.linked) toast.success("Önceki siparişleriniz hesabınıza bağlandı.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Hesap bağlanamadı"),
  });

  // Oturum açıldığında misafir kaydını bir kez sahiplen
  useEffect(() => {
    if (user && claim.isIdle) claim.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const claimed = claim.isSuccess;
  const { data: ordersData } = useQuery(myOrdersQuery(storeId, claimed));
  const { data: addressesData } = useQuery(myAddressesQuery(storeId, claimed));

  const customer = ordersData?.customer ?? addressesData?.customer ?? null;
  const orders = useMemo(() => ordersData?.orders ?? [], [ordersData]);
  const addresses = useMemo(() => addressesData?.addresses ?? [], [addressesData]);

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {(
          [
            ["orders", `Siparişlerim (${orders.length})`],
            ["addresses", `Adreslerim (${addresses.length})`],
            ["profile", "Üyelik Bilgilerim"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              ...pillStyle,
              fontWeight: tab === key ? 700 : 500,
              opacity: tab === key ? 1 : 0.6,
            }}
          >
            {label}
          </button>
        ))}
        <button onClick={() => void signOut()} style={{ ...pillStyle, marginLeft: "auto", opacity: 0.6 }}>
          Çıkış yap
        </button>
      </div>

      {claim.isPending ? <p style={{ opacity: 0.7, fontSize: 14 }}>Hesabınız hazırlanıyor…</p> : null}

      {tab === "orders" ? <OrdersList orders={orders} /> : null}
      {tab === "addresses" && customer ? <AddressBook storeId={storeId} addresses={addresses} /> : null}
      {tab === "profile" && customer ? <ProfileForm storeId={storeId} customer={customer} /> : null}
    </div>
  );
}

function OrdersList({ orders }: { orders: import("@/lib/account.server").MyOrder[] }) {
  if (!orders.length) {
    return <p style={{ opacity: 0.7, fontSize: 14 }}>Henüz siparişiniz yok.</p>;
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {orders.map((order) => (
        <div key={order.id} style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <strong>{order.order_number}</strong>
              <span style={{ fontSize: 13, opacity: 0.65, marginLeft: 10 }}>{formatDateTime(order.placed_at)}</span>
            </div>
            <strong>{formatMoney(Number(order.grand_total), order.currency)}</strong>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, fontSize: 12 }}>
            <span style={tagStyle}>{ORDER_STATUS_LABELS[order.status] ?? order.status}</span>
            <span style={tagStyle}>{PAYMENT_STATUS_LABELS[order.payment_status] ?? order.payment_status}</span>
            <span style={tagStyle}>{FULFILLMENT_STATUS_LABELS[order.fulfillment_status] ?? order.fulfillment_status}</span>
            {order.tracking_number ? (
              <span style={tagStyle}>
                Kargo: {order.shipping_carrier ?? ""} {order.tracking_number}
              </span>
            ) : null}
          </div>
          <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none", fontSize: 13, opacity: 0.8 }}>
            {order.order_items.map((item) => (
              <li key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                <span>
                  {item.title}
                  {item.variant_title ? ` — ${item.variant_title}` : ""} × {item.quantity}
                </span>
                <span>{formatMoney(Number(item.line_total), order.currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------- Adresler --------------------------------- */

const emptyAddress = {
  id: undefined as string | undefined,
  label: "",
  recipient: "",
  phone: "",
  country: "Türkiye",
  city: "",
  district: "",
  line1: "",
  postalCode: "",
  isDefault: false,
};

function AddressBook({ storeId, addresses }: { storeId: string; addresses: import("@/lib/account.server").MyAddress[] }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<typeof emptyAddress | null>(null);

  const saveFn = useServerFn(saveMyStoreAddress);
  const deleteFn = useServerFn(deleteMyStoreAddress);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["storefront", storeId, "my-addresses"] });

  const save = useMutation({
    mutationFn: () => {
      if (!form) throw new Error("Form boş");
      return saveFn({
        data: {
          storeId,
          id: form.id,
          label: form.label || undefined,
          recipient: form.recipient,
          phone: form.phone || undefined,
          country: form.country,
          city: form.city,
          district: form.district || undefined,
          line1: form.line1,
          postalCode: form.postalCode || undefined,
          isDefault: form.isDefault,
        },
      });
    },
    onSuccess: () => {
      toast.success("Adres kaydedildi");
      setForm(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Adres kaydedilemedi"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { storeId, id } }),
    onSuccess: () => {
      toast.success("Adres silindi");
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Adres silinemedi"),
  });

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {addresses.map((address) => (
        <div key={address.id} style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <strong>
                {address.label ?? "Adres"}
                {address.is_default ? " (Varsayılan)" : ""}
              </strong>
              <p style={{ margin: "6px 0 0", fontSize: 13, opacity: 0.75, lineHeight: 1.6 }}>
                {address.recipient}
                {address.phone ? ` — ${address.phone}` : ""}
                <br />
                {address.line1}
                <br />
                {address.district ? `${address.district} / ` : ""}
                {address.city} {address.postal_code ?? ""}
                <br />
                {address.country}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <button
                style={smallButtonStyle}
                onClick={() =>
                  setForm({
                    id: address.id,
                    label: address.label ?? "",
                    recipient: address.recipient,
                    phone: address.phone ?? "",
                    country: address.country,
                    city: address.city ?? "",
                    district: address.district ?? "",
                    line1: address.line1,
                    postalCode: address.postal_code ?? "",
                    isDefault: address.is_default,
                  })
                }
              >
                Düzenle
              </button>
              <button style={smallButtonStyle} onClick={() => remove.mutate(address.id)} disabled={remove.isPending}>
                Sil
              </button>
            </div>
          </div>
        </div>
      ))}

      {form ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
          style={{ ...cardStyle, display: "grid", gap: 10 }}
        >
          <strong>{form.id ? "Adresi düzenle" : "Yeni adres"}</strong>
          <input style={inputStyle} placeholder="Adres adı (Ev, İş…)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <input required style={inputStyle} placeholder="Alıcı adı soyadı" value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} />
          <input style={inputStyle} placeholder="Telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input required style={inputStyle} placeholder="Şehir" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <input style={inputStyle} placeholder="İlçe" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
          </div>
          <textarea
            required
            style={{ ...inputStyle, minHeight: 70 }}
            placeholder="Açık adres"
            value={form.line1}
            onChange={(e) => setForm({ ...form, line1: e.target.value })}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input required style={inputStyle} placeholder="Ülke" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            <input style={inputStyle} placeholder="Posta kodu" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
            Varsayılan adresim yap
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" style={buttonStyle} disabled={save.isPending}>
              {save.isPending ? "Kaydediliyor…" : "Kaydet"}
            </button>
            <button type="button" style={smallButtonStyle} onClick={() => setForm(null)}>
              Vazgeç
            </button>
          </div>
        </form>
      ) : (
        <button style={{ ...buttonStyle, justifySelf: "start" }} onClick={() => setForm(emptyAddress)}>
          + Yeni adres ekle
        </button>
      )}
    </div>
  );
}

/* ---------------------------------- Profil ---------------------------------- */

function ProfileForm({ storeId, customer }: { storeId: string; customer: import("@/lib/account.server").MyCustomer }) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(customer.full_name);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [marketing, setMarketing] = useState(customer.accepts_marketing);

  const updateFn = useServerFn(updateMyStoreProfile);
  const save = useMutation({
    mutationFn: () => updateFn({ data: { storeId, fullName, phone: phone || undefined, acceptsMarketing: marketing } }),
    onSuccess: () => {
      toast.success("Bilgileriniz güncellendi");
      void queryClient.invalidateQueries({ queryKey: ["storefront", storeId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Güncellenemedi"),
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
      style={{ ...cardStyle, display: "grid", gap: 10, maxWidth: 420 }}
    >
      <div style={{ fontSize: 13, opacity: 0.7 }}>
        {customer.email} — {customer.orders_count} sipariş, toplam {formatMoney(Number(customer.total_spent), "TRY")}
      </div>
      <input required style={inputStyle} placeholder="Ad soyad" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      <input style={inputStyle} placeholder="Telefon" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
        <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
        Kampanya ve fırsat e-postaları almak istiyorum
      </label>
      <button type="submit" style={{ ...buttonStyle, justifySelf: "start" }} disabled={save.isPending}>
        {save.isPending ? "Kaydediliyor…" : "Bilgilerimi kaydet"}
      </button>
    </form>
  );
}

/* --------------------------------- Stiller ---------------------------------- */

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(128,128,128,.35)",
  background: "transparent",
  color: "inherit",
  fontSize: 14,
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 10,
  border: "1px solid rgba(128,128,128,.4)",
  background: "rgba(128,128,128,.12)",
  color: "inherit",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const smallButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  padding: "6px 12px",
  fontSize: 12,
};

const pillStyle: React.CSSProperties = {
  ...smallButtonStyle,
  borderRadius: 999,
};

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,.25)",
  borderRadius: 14,
  padding: 16,
  background: "rgba(128,128,128,.05)",
};

const tagStyle: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,.3)",
  borderRadius: 999,
  padding: "3px 10px",
};
