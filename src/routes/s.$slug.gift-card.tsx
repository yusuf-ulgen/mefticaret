import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { checkGiftCardBalance } from "@/lib/gift-cards-public.functions";
import { formatDateTime, formatMoney } from "@/lib/mefti";
import { storefrontQuery } from "@/lib/storefront-queries";

export const Route = createFileRoute("/s/$slug/gift-card")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(storefrontQuery(params.slug));
    if (!data) throw notFound();
    return { name: data.store.name };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Mağaza bulunamadı" }, { name: "robots", content: "noindex" }] };
    }
    const title = `Hediye Kartı Bakiyesi — ${loaderData.name}`;
    const description = `${loaderData.name} hediye kartınızın güncel bakiyesini, geçerlilik durumunu ve son kullanma tarihini kart kodunuzla anında sorgulayın.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: () => <Fallback text="Bakiye sorgulama şu anda yüklenemedi." />,
  notFoundComponent: () => <Fallback text="Bu adreste yayınlanmış bir mağaza yok." />,
  component: GiftCardBalancePage,
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

function GiftCardBalancePage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  const check = useServerFn(checkGiftCardBalance);
  const [code, setCode] = useState("");

  if (!data) return <Fallback text="Bu adreste yayınlanmış bir mağaza yok." />;
  const { store, theme } = data;
  const { t, fonts, muted, cardBg, border, radius } = storefrontTokens(theme);

  const lookup = useMutation({
    mutationFn: () => check({ data: { slug, code } }),
  });
  const result = lookup.data;

  return (
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug}>
      <div style={{ padding: "28px 0 12px" }}>
        <h1 style={{ fontFamily: fonts.heading, fontSize: 28, margin: 0, fontWeight: 700 }}>
          Hediye kartı bakiyesi
        </h1>
        <p style={{ color: muted, fontSize: 14, marginTop: 8, maxWidth: 560 }}>
          Kart kodunu gir, kalan bakiyeyi ve geçerlilik durumunu gör. Kodunu ödeme adımında girerek
          sipariş toplamından düşebilirsin.
        </p>
      </div>

      <div
        style={{
          border: `1px solid ${border}`,
          background: cardBg,
          borderRadius: radius,
          padding: 20,
          maxWidth: 560,
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (code.trim().length >= 4) lookup.mutate();
          }}
          style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
        >
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="MEF-XXXX-XXXX-XXXX"
            aria-label="Hediye kartı kodu"
            style={{
              flex: "1 1 240px",
              padding: "10px 12px",
              borderRadius: radius,
              border: `1px solid ${border}`,
              background: "transparent",
              color: "inherit",
              fontFamily: "ui-monospace, monospace",
              letterSpacing: 1,
            }}
          />
          <button
            type="submit"
            disabled={lookup.isPending || code.trim().length < 4}
            style={{
              background: t.accent_color,
              color: "#12181f",
              border: "none",
              borderRadius: radius,
              padding: "10px 18px",
              fontWeight: 600,
              cursor: "pointer",
              opacity: lookup.isPending || code.trim().length < 4 ? 0.6 : 1,
            }}
          >
            {lookup.isPending ? "Sorgulanıyor…" : "Bakiyeyi sorgula"}
          </button>
        </form>

        {lookup.isError ? (
          <p style={{ color: "#dc2626", fontSize: 13, marginTop: 14 }}>
            Sorgu tamamlanamadı, lütfen tekrar dene.
          </p>
        ) : null}

        {result && !result.found ? (
          <p style={{ color: muted, fontSize: 14, marginTop: 16 }}>
            {result.reason ?? "Bu koda ait bir hediye kartı bulunamadı."}
          </p>
        ) : null}

        {result?.found ? (
          <div style={{ marginTop: 18, borderTop: `1px solid ${border}`, paddingTop: 16 }}>
            <p style={{ fontSize: 12, color: muted, margin: 0, letterSpacing: 1 }}>
              {result.code}
            </p>
            <p style={{ fontFamily: fonts.heading, fontSize: 30, fontWeight: 700, margin: "6px 0 0" }}>
              {formatMoney(result.balance ?? 0, result.currency ?? store.currency)}
            </p>
            <p style={{ fontSize: 13, color: result.usable ? muted : "#dc2626", marginTop: 8 }}>
              {result.usable
                ? result.expiresAt
                  ? `Kullanıma açık · Son kullanma ${formatDateTime(result.expiresAt)}`
                  : "Kullanıma açık · Son kullanma tarihi yok"
                : result.reason}
            </p>
            {result.usable ? (
              <Link
                to="/s/$slug/products"
                params={{ slug: store.slug }}
                style={{
                  display: "inline-block",
                  marginTop: 16,
                  border: `1px solid ${border}`,
                  borderRadius: radius,
                  padding: "9px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                Alışverişe başla
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </StorefrontChrome>
  );
}
