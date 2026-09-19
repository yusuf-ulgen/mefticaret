import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { Breadcrumb, ProductGrid, StorefrontFallback } from "@/components/storefront-parts";
import { storefrontQuery } from "@/lib/storefront-queries";
import { trackEvent } from "@/lib/track";

type Search = { q?: string | undefined };

const normalize = (value: string) => value.toLocaleLowerCase("tr");

export const Route = createFileRoute("/s/$slug/search")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    q: typeof search["q"] === "string" && search["q"].trim() ? String(search["q"]).slice(0, 120) : undefined,
  }),
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(storefrontQuery(params.slug));
    if (!data) throw notFound();
    return { storeName: data.store.name };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Mağaza bulunamadı" }, { name: "robots", content: "noindex" }] };
    }
    const title = `Arama — ${loaderData.storeName}`;
    const description = `${loaderData.storeName} kataloğunda ürün adı, marka, tür ve etiketlere göre anlık arama yap.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  errorComponent: () => <StorefrontFallback text="Arama şu anda yapılamıyor." />,
  notFoundComponent: () => <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />,
  component: SearchPage,
});

function SearchPage() {
  const { slug } = Route.useParams();
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  const [term, setTerm] = useState(q ?? "");

  useEffect(() => {
    setTerm(q ?? "");
  }, [q]);

  const products = useMemo(() => data?.products ?? [], [data]);
  const results = useMemo(() => {
    const needle = normalize((q ?? "").trim());
    if (!needle) return [];
    const tokens = needle.split(/\s+/).filter(Boolean);
    return products.filter((product) => {
      const haystack = normalize(
        `${product.title} ${product.product_type ?? ""} ${product.description ?? ""} ${(product.tags ?? []).join(" ")}`,
      );
      return tokens.every((token) => haystack.includes(token));
    });
  }, [products, q]);

  useEffect(() => {
    const needle = (q ?? "").trim();
    if (!needle) return;
    trackEvent(slug, "search", {
      path: "/search",
      searchTerm: needle,
      searchResults: results.length,
    });
  }, [slug, q, results.length]);

  const suggestions = useMemo(
    () => [...new Set(products.map((p) => p.product_type).filter((v): v is string => Boolean(v)))].slice(0, 8),
    [products],
  );

  if (!data) return <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />;
  const { store, theme, footerPages } = data;
  const { fonts, muted, cardBg, border, radius, t } = storefrontTokens(theme);

  return (
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug} footerPages={footerPages}>
      <Breadcrumb theme={theme} slug={slug} storeName={store.name} current="Arama" />
      <header style={{ padding: "20px 0 18px", maxWidth: 680 }}>
        <h1 style={{ fontFamily: fonts.heading, fontSize: 34, fontWeight: 700, margin: 0 }}>Arama</h1>
        <p style={{ color: muted, marginTop: 10, fontSize: 15 }}>
          Ürün adı, tür veya etiketle ara. Aramalar tüm katalogda çalışır.
        </p>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void navigate({
            to: "/s/$slug/search",
            params: { slug },
            search: term.trim() ? { q: term.trim() } : {},
          });
        }}
        style={{ display: "flex", gap: 10, marginBottom: 18, maxWidth: 560 }}
      >
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Ne arıyorsun?"
          autoFocus
          style={{
            flex: 1,
            background: "transparent",
            color: "inherit",
            border: `1px solid ${border}`,
            borderRadius: radius,
            padding: "10px 12px",
            fontSize: 14,
            fontFamily: "inherit",
          }}
        />
        <VoiceSearchButton
          onResult={(result) => {
            setTerm(result.term);
            void navigate({
              to: "/s/$slug/search",
              params: { slug },
              search: result.term.trim() ? { q: result.term.trim() } : {},
            });
          }}
        />
        <button
          type="submit"
          style={{
            background: t.accent_color,
            color: "#111",
            border: "none",
            borderRadius: radius,
            padding: "10px 18px",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Ara
        </button>
      </form>


      {suggestions.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
          <span style={{ color: muted, fontSize: 13 }}>Popüler:</span>
          {suggestions.map((value) => (
            <Link
              key={value}
              to="/s/$slug/search"
              params={{ slug }}
              search={{ q: value }}
              style={{
                background: cardBg,
                border: `1px solid ${border}`,
                borderRadius: radius,
                padding: "4px 10px",
                fontSize: 12,
                color: "inherit",
                textDecoration: "none",
              }}
            >
              {value}
            </Link>
          ))}
        </div>
      ) : null}

      {!q ? (
        <p style={{ color: muted, paddingBottom: 60 }}>Aramaya başlamak için bir kelime yaz.</p>
      ) : (
        <>
          <p style={{ color: muted, fontSize: 13, marginBottom: 14 }}>
            “{q}” için {results.length} sonuç
          </p>
          <ProductGrid
            theme={theme}
            slug={slug}
            storeCurrency={store.currency}
            products={results}
            empty="Aramanla eşleşen ürün bulunamadı. Farklı bir kelime deneyebilirsin."
          />
        </>
      )}
    </StorefrontChrome>
  );
}
