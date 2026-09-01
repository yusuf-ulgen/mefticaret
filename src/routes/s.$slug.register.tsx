import { useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { Breadcrumb, StorefrontFallback } from "@/components/storefront-parts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { storefrontQuery } from "@/lib/storefront-queries";

export const Route = createFileRoute("/s/$slug/register")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(storefrontQuery(params.slug));
    if (!data) throw notFound();
    return { storeName: data.store.name };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Mağaza bulunamadı" }, { name: "robots", content: "noindex" }] };
    }
    const title = `Kayıt ol — ${loaderData.storeName}`;
    const description = `${loaderData.storeName} üyeliği oluştur: sipariş takibi, hızlı ödeme, adres defteri ve favori listeleri.`;
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
  errorComponent: () => <StorefrontFallback text="Kayıt sayfası şu anda yüklenemedi." />,
  notFoundComponent: () => <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />,
  component: RegisterPage,
});

function RegisterPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!data) return <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />;
  const { store, theme, footerPages } = data;
  const { fonts, muted, cardBg, border, radius, t } = storefrontTokens(theme);

  const inputStyle = {
    width: "100%",
    background: "transparent",
    color: "inherit",
    border: `1px solid ${border}`,
    borderRadius: radius,
    padding: "10px 12px",
    fontSize: 14,
    fontFamily: "inherit",
  } as const;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("Şifre en az 8 karakter olmalı");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim() || null },
        emailRedirectTo: `${window.location.origin}/s/${slug}/account`,
      },
    });
    setBusy(false);
    if (error) {
      toast.error("Kayıt tamamlanamadı", { description: error.message });
      return;
    }
    toast.success("Kayıt alındı", { description: "E-postana gelen doğrulama bağlantısını onayla." });
    void navigate({ to: "/s/$slug/account", params: { slug } });
  }

  return (
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug} footerPages={footerPages}>
      <Breadcrumb theme={theme} slug={slug} storeName={store.name} current="Kayıt" />
      <section style={{ padding: "24px 0 64px", maxWidth: 420 }}>
        <h1 style={{ fontFamily: fonts.heading, fontSize: 30, fontWeight: 700, margin: 0 }}>Kayıt ol</h1>
        <p style={{ color: muted, marginTop: 10, fontSize: 14 }}>
          Üyelik oluşturduğunda ödeme adımı otomatik dolar, siparişlerini ve iade taleplerini takip edebilirsin.
        </p>

        {user ? (
          <div
            style={{
              marginTop: 20,
              background: cardBg,
              border: `1px solid ${border}`,
              borderRadius: radius,
              padding: 16,
              fontSize: 14,
            }}
          >
            Zaten bir hesapla giriş yaptın.{" "}
            <Link to="/s/$slug/account" params={{ slug }} style={{ color: "inherit", fontWeight: 600 }}>
              Hesabıma git
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: "grid", gap: 12, marginTop: 22 }}>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: muted }}>
              Ad soyad
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} style={inputStyle} />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: muted }}>
              E-posta
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: muted }}>
              Şifre (en az 8 karakter)
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                style={inputStyle}
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              style={{
                background: t.accent_color,
                color: "#111",
                border: "none",
                borderRadius: radius,
                padding: "11px 16px",
                fontWeight: 700,
                fontSize: 14,
                cursor: busy ? "wait" : "pointer",
              }}
            >
              {busy ? "Kaydediliyor…" : "Hesap oluştur"}
            </button>
            <p style={{ color: muted, fontSize: 12, lineHeight: 1.6, margin: 0 }}>
              Kayıt olarak{" "}
              <Link to="/s/$slug/terms" params={{ slug }} style={{ color: "inherit" }}>
                kullanım şartlarını
              </Link>{" "}
              ve{" "}
              <Link to="/s/$slug/privacy" params={{ slug }} style={{ color: "inherit" }}>
                gizlilik politikasını
              </Link>{" "}
              kabul etmiş olursun.
            </p>
          </form>
        )}

        <p style={{ color: muted, fontSize: 13, marginTop: 18 }}>
          Hesabın var mı?{" "}
          <Link to="/s/$slug/login" params={{ slug }} style={{ color: "inherit", fontWeight: 600 }}>
            Giriş yap
          </Link>
        </p>
      </section>
    </StorefrontChrome>
  );
}
