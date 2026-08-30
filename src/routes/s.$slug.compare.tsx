import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { useCompare } from "@/lib/compare";
import { formatMoney } from "@/lib/mefti";
import { storefrontQuery } from "@/lib/storefront-queries";

export const Route = createFileRoute("/s/$slug/compare")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(storefrontQuery(params.slug));
    if (!data) throw notFound();
    return { name: data.store.name };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Mağaza bulunamadı" }, { name: "robots", content: "noindex" }] };
    }
    const title = `Ürün karşılaştırma — ${loaderData.name}`;
    const description = `${loaderData.name} vitrininde seçtiğin ürünleri fiyat, indirim ve özellik bazında yan yana karşılaştır.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  errorComponent: () => <Fallback text="Karşılaştırma şu anda yüklenemedi." />,
  notFoundComponent: () => <Fallback text="Bu adreste yayınlanmış bir mağaza yok." />,
  component: ComparePage,
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

function ComparePage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  const compare = useCompare();

  if (!data) return <Fallback text="Bu adreste yayınlanmış bir mağaza yok." />;
  const { store, theme, products } = data;
  const { t, fonts, muted, cardBg, border, radius } = storefrontTokens(theme);

  const selectedSlugs = compare.slugsFor(store.slug);
  const rows = useMemo(
    () => selectedSlugs.map((productSlug) => products.find((product) => product.slug === productSlug)).filter(Boolean),
    [selectedSlugs, products],
  ) as (typeof products)[number][];

  return (
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug}>
      <section style={{ fontFamily: fonts.body, padding: "40px 0 64px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontFamily: fonts.heading, fontSize: 28, margin: 0 }}>Ürün karşılaştırma</h1>
            <p style={{ color: muted, fontSize: 14, marginTop: 6 }}>
              En fazla {compare.limit} ürünü yan yana inceleyebilirsin.
            </p>
          </div>
          {rows.length > 0 ? (
            <button
              type="button"
              onClick={() => compare.clear(store.slug)}
              style={{
                background: "transparent",
                color: t.primary_color,
                border: `1px solid ${border}`,
                borderRadius: radius,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Listeyi temizle
            </button>
          ) : null}
        </div>

        {rows.length === 0 ? (
          <div
            style={{
              marginTop: 28,
              background: cardBg,
              border: `1px solid ${border}`,
              borderRadius: radius,
              padding: 32,
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: 15 }}>Karşılaştırma listen boş.</p>
            <p style={{ color: muted, fontSize: 14, marginTop: 8 }}>
              Ürün sayfalarındaki “Karşılaştır” butonuyla ürün ekleyebilirsin.
            </p>
            <Link
              to="/s/$slug/products"
              params={{ slug: store.slug }}
              style={{
                display: "inline-block",
                marginTop: 18,
                background: t.primary_color,
                color: t.background_color,
                borderRadius: radius,
                padding: "10px 18px",
                fontWeight: 600,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Ürünlere göz at
            </Link>
          </div>
        ) : (
          <div style={{ marginTop: 28, overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", minWidth: 520, width: "100%", fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ ...cellStyle(border), color: muted, textAlign: "left", width: 150 }}>Özellik</th>
                  {rows.map((product) => (
                    <th key={product.id} style={{ ...cellStyle(border), textAlign: "left", minWidth: 180 }}>
                      {product.coverUrl ? (
                        <img
                          src={product.coverUrl}
                          alt={product.title}
                          loading="lazy"
                          style={{
                            width: "100%",
                            aspectRatio: "1 / 1",
                            objectFit: "cover",
                            borderRadius: radius,
                            marginBottom: 10,
                          }}
                        />
                      ) : null}
                      <Link
                        to="/s/$slug/p/$productSlug"
                        params={{ slug: store.slug, productSlug: product.slug }}
                        style={{ color: "inherit", fontWeight: 700, textDecoration: "none" }}
                      >
                        {product.title}
                      </Link>
                      <button
                        type="button"
                        onClick={() => compare.remove(store.slug, product.slug)}
                        style={{
                          display: "block",
                          marginTop: 8,
                          background: "transparent",
                          color: muted,
                          border: "none",
                          padding: 0,
                          fontSize: 12,
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                      >
                        Listeden çıkar
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <CompareRow border={border} muted={muted} label="Fiyat">
                  {rows.map((product) => (
                    <td key={product.id} style={{ ...cellStyle(border), fontWeight: 700 }}>
                      {formatMoney(Number(product.base_price ?? 0), product.currency ?? store.currency)}
                    </td>
                  ))}
                </CompareRow>
                <CompareRow border={border} muted={muted} label="Liste fiyatı">
                  {rows.map((product) => (
                    <td key={product.id} style={{ ...cellStyle(border), color: muted }}>
                      {product.compare_at_price
                        ? formatMoney(Number(product.compare_at_price), product.currency ?? store.currency)
                        : "—"}
                    </td>
                  ))}
                </CompareRow>
                <CompareRow border={border} muted={muted} label="İndirim">
                  {rows.map((product) => {
                    const base = Number(product.base_price ?? 0);
                    const list = Number(product.compare_at_price ?? 0);
                    const discount = list > base && list > 0 ? Math.round(((list - base) / list) * 100) : 0;
                    return (
                      <td key={product.id} style={cellStyle(border)}>
                        {discount > 0 ? (
                          <span style={{ color: t.accent_color, fontWeight: 700 }}>%{discount}</span>
                        ) : (
                          <span style={{ color: muted }}>—</span>
                        )}
                      </td>
                    );
                  })}
                </CompareRow>
                <CompareRow border={border} muted={muted} label="Kategori">
                  {rows.map((product) => (
                    <td key={product.id} style={cellStyle(border)}>
                      {product.product_type || <span style={{ color: muted }}>—</span>}
                    </td>
                  ))}
                </CompareRow>
                <CompareRow border={border} muted={muted} label="Etiketler">
                  {rows.map((product) => (
                    <td key={product.id} style={cellStyle(border)}>
                      {(product.tags ?? []).length > 0 ? (
                        (product.tags ?? []).join(", ")
                      ) : (
                        <span style={{ color: muted }}>—</span>
                      )}
                    </td>
                  ))}
                </CompareRow>
                <CompareRow border={border} muted={muted} label="Açıklama">
                  {rows.map((product) => (
                    <td key={product.id} style={{ ...cellStyle(border), color: muted, lineHeight: 1.6 }}>
                      {product.description ? `${product.description.slice(0, 180)}${product.description.length > 180 ? "…" : ""}` : "—"}
                    </td>
                  ))}
                </CompareRow>
                <CompareRow border={border} muted={muted} label="">
                  {rows.map((product) => (
                    <td key={product.id} style={cellStyle(border)}>
                      <Link
                        to="/s/$slug/p/$productSlug"
                        params={{ slug: store.slug, productSlug: product.slug }}
                        style={{
                          display: "inline-block",
                          background: t.primary_color,
                          color: t.background_color,
                          borderRadius: radius,
                          padding: "8px 14px",
                          fontWeight: 600,
                          fontSize: 13,
                          textDecoration: "none",
                        }}
                      >
                        Ürüne git
                      </Link>
                    </td>
                  ))}
                </CompareRow>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </StorefrontChrome>
  );
}

function cellStyle(border: string) {
  return { borderBottom: `1px solid ${border}`, padding: "12px 14px", verticalAlign: "top" as const };
}

function CompareRow({
  label,
  border,
  muted,
  children,
}: {
  label: string;
  border: string;
  muted: string;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td style={{ ...cellStyle(border), color: muted, fontWeight: 600 }}>{label}</td>
      {children}
    </tr>
  );
}
