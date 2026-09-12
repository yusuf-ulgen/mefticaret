import { useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { FavoriteButton } from "@/components/favorite-button";
import { QuickAddButton } from "@/components/quick-add-button";
import { SmartImage } from "@/components/smart-image";
import { StorefrontAdminLink } from "@/components/storefront-admin-link";
import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { formatMoney } from "@/lib/mefti";
import { storefrontQuery } from "@/lib/storefront-queries";
import { getRequestOrigin } from "@/lib/origin.functions";
import { getStoreSeoContext } from "@/lib/seo-public.functions";
import { missingHead, storefrontHead } from "@/lib/storefront-seo";
import { WokieeProductCard, productSwatches } from "@/components/wokiee/product-card";

export const Route = createFileRoute("/s/$slug/products")({
  loader: async ({ context, params }) => {
    const [data, ctx, origin] = await Promise.all([
      context.queryClient.ensureQueryData(storefrontQuery(params.slug)),
      getStoreSeoContext({ data: { slug: params.slug } }),
      getRequestOrigin(),
    ]);
    if (!data) throw notFound();
    return { storeName: data.store.name, ctx, origin };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return missingHead("Mağaza bulunamadı");
    const base = `/s/${params.slug}`;
    return storefrontHead({
      ctx: loaderData.ctx,
      origin: loaderData.origin,
      slug: params.slug,
      path: `${base}/products`,
      fallbackTitle: "Tüm ürünler",
      fallbackDescription: `${loaderData.storeName} mağazasındaki tüm ürünleri filtreleyerek keşfedin; fiyat ve türe göre sıralayın.`,
      breadcrumbs: [
        { name: "Ana sayfa", path: base },
        { name: "Ürünler", path: `${base}/products` },
      ],
    });
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Bu mağaza bulunamadı.</h1>
    </div>
  ),
  component: StorefrontProductsPage,
});

type SortKey = "newest" | "price_asc" | "price_desc" | "title";

const normalize = (value: string) =>
  value
    .toLocaleLowerCase("tr")
    .replaceAll("ı", "i")
    .replaceAll("ş", "s")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c");

function StorefrontProductsPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(storefrontQuery(slug));

  const [term, setTerm] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [type, setType] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStock, setInStock] = useState(false);
  const [color, setColor] = useState("all");
  const [columns, setColumns] = useState<2 | 3 | 4>(4);
  const [page, setPage] = useState(1);
  const pageSize = 24;

  const products = useMemo(() => data?.products ?? [], [data]);

  const types = useMemo(
    () => [...new Set(products.map((p) => p.product_type).filter((v): v is string => Boolean(v)))].sort(),
    [products],
  );
  const colors = useMemo(() => [...new Set(products.flatMap((product) => productSwatches(product.tags).map((item) => item.tag)))], [products]);

  const visible = useMemo(() => {
    const q = normalize(term.trim());
    const min = minPrice.trim() ? Number(minPrice) : null;
    const max = maxPrice.trim() ? Number(maxPrice) : null;
    const list = products.filter((product) => {
      if (type !== "all" && product.product_type !== type) return false;
      const price = Number(product.base_price);
      if (min !== null && Number.isFinite(min) && price < min) return false;
      if (max !== null && Number.isFinite(max) && price > max) return false;
      if (inStock && (product.stockTotal ?? 0) <= 0) return false;
      if (color !== "all" && !productSwatches(product.tags).some((item) => item.tag === color)) return false;
      if (q && !normalize(`${product.title} ${product.product_type ?? ""} ${(product.tags ?? []).join(" ")}`).includes(q))
        return false;
      return true;
    });
    const sorted = [...list];
    if (sort === "price_asc") sorted.sort((a, b) => Number(a.base_price) - Number(b.base_price));
    else if (sort === "price_desc") sorted.sort((a, b) => Number(b.base_price) - Number(a.base_price));
    else if (sort === "title") sorted.sort((a, b) => a.title.localeCompare(b.title, "tr"));
    return sorted;
  }, [products, term, type, minPrice, maxPrice, sort, inStock, color]);

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = useMemo(
    () => visible.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [visible, currentPage, pageSize],
  );

  if (!data) return null;
  const { store, theme } = data;
  const { t, fonts, muted, cardBg, border, radius } = storefrontTokens(theme);

  const controlStyle = {
    background: "transparent",
    color: "inherit",
    border: `1px solid ${border}`,
    borderRadius: radius,
    padding: "8px 10px",
    fontSize: 13,
    fontFamily: "inherit",
  } as const;

  return (
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug}>
      <nav style={{ marginTop: 28, fontSize: 13, color: muted }}>
        <Link to="/s/$slug" params={{ slug }} style={{ color: "inherit" }}>
          {store.name}
        </Link>
        {" / "}
        <span>Tüm ürünler</span>
      </nav>

      <header style={{ padding: "20px 0 24px", maxWidth: 640 }}>
        <h1 className="sf-page-title" style={{ fontFamily: fonts.heading, fontSize: 34, fontWeight: 700, margin: 0 }}>
          Tüm ürünler
        </h1>
        <p style={{ color: muted, marginTop: 10, fontSize: 15 }}>
          {store.name} kataloğundaki ürünleri arayabilir, tür ve fiyata göre filtreleyebilirsin.
        </p>
        <div style={{ marginTop: 12 }}>
          <StorefrontAdminLink storeId={store.id} border={border} muted={muted} />
        </div>
      </header>

      <div className="sf-filters" style={{ marginBottom: 20 }}>
        <input
          value={term}
          onChange={(event) => { setTerm(event.target.value); setPage(1); }}
          placeholder="Ürün ara"
          style={{ ...controlStyle, minWidth: 220 }}
        />
        {colors.length ? (
          <select value={color} onChange={(event) => { setColor(event.target.value); setPage(1); }} style={controlStyle}>
            <option value="all">Tüm renkler</option>
            {colors.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        ) : null}
        <label style={{ ...controlStyle, display: "flex", gap: 7, alignItems: "center", cursor: "pointer" }}>
          <input type="checkbox" checked={inStock} onChange={(event) => { setInStock(event.target.checked); setPage(1); }} />
          Stoktakiler
        </label>
        <select value={sort} onChange={(event) => { setSort(event.target.value as SortKey); setPage(1); }} style={controlStyle}>
          <option value="newest">Yeni eklenenler</option>
          <option value="price_asc">Fiyat: artan</option>
          <option value="price_desc">Fiyat: azalan</option>
          <option value="title">İsim: A-Z</option>
        </select>
        {types.length > 0 ? (
          <select value={type} onChange={(event) => { setType(event.target.value); setPage(1); }} style={controlStyle}>
            <option value="all">Tüm türler</option>
            {types.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        ) : null}
        <input
          value={minPrice}
          onChange={(event) => { setMinPrice(event.target.value); setPage(1); }}
          placeholder="Min ₺"
          inputMode="numeric"
          style={{ ...controlStyle, width: 90 }}
        />
        <input
          value={maxPrice}
          onChange={(event) => { setMaxPrice(event.target.value); setPage(1); }}
          placeholder="Maks ₺"
          inputMode="numeric"
          style={{ ...controlStyle, width: 100 }}
        />
        <span className="sf-filters-count" style={{ color: muted, fontSize: 13 }}>
          {visible.length} ürün
        </span>
        <span className="sf-grid-switch" style={{ display: "flex", gap: 4 }}>
          {([2, 3, 4] as const).map((value) => <button key={value} type="button" onClick={() => setColumns(value)} aria-label={`${value} sütun`} style={{ ...controlStyle, paddingInline: 8, background: columns === value ? t.accent_color : "transparent", color: columns === value ? "#fff" : "inherit" }}>{value}</button>)}
        </span>
        {term || type !== "all" || minPrice || maxPrice || inStock || color !== "all" ? (
          <button
            type="button"
            onClick={() => {
              setTerm("");
              setType("all");
              setMinPrice("");
              setMaxPrice("");
              setInStock(false);
              setColor("all");
              setPage(1);
            }}
            style={{ ...controlStyle, cursor: "pointer" }}
          >
            Temizle
          </button>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <p style={{ color: muted, paddingBottom: 60 }}>Aramanla eşleşen ürün bulunamadı.</p>
      ) : (
        <div className="sf-product-grid" style={{ paddingBottom: 64, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {paged.map((product) => (
            <WokieeProductCard key={product.id} theme={theme} storeSlug={store.slug} product={{ ...product, currency: product.currency ?? store.currency }} />
          ))}
        </div>
      )}

      {pageCount > 1 ? (
        <nav
          aria-label="Sayfalar"
          style={{ display: "flex", gap: 8, alignItems: "center", paddingBottom: 64, flexWrap: "wrap" }}
        >
          <button
            type="button"
            onClick={() => setPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            style={{ ...controlStyle, cursor: currentPage === 1 ? "default" : "pointer", opacity: currentPage === 1 ? 0.5 : 1 }}
          >
            Önceki
          </button>
          {Array.from({ length: pageCount }, (_, index) => index + 1)
            .filter((value) => value === 1 || value === pageCount || Math.abs(value - currentPage) <= 2)
            .map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPage(value)}
                aria-current={value === currentPage ? "page" : undefined}
                style={{
                  ...controlStyle,
                  cursor: "pointer",
                  background: value === currentPage ? t.accent_color : "transparent",
                  color: value === currentPage ? "#fff" : "inherit",
                }}
              >
                {value}
              </button>
            ))}
          <button
            type="button"
            onClick={() => setPage(Math.min(pageCount, currentPage + 1))}
            disabled={currentPage === pageCount}
            style={{
              ...controlStyle,
              cursor: currentPage === pageCount ? "default" : "pointer",
              opacity: currentPage === pageCount ? 0.5 : 1,
            }}
          >
            Sonraki
          </button>
          <span style={{ color: muted, fontSize: 13 }}>
            {currentPage} / {pageCount}
          </span>
        </nav>
      ) : null}
    </StorefrontChrome>
  );
}
