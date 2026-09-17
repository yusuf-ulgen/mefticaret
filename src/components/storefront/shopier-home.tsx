import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, ArrowUpDown, SlidersHorizontal } from "lucide-react";

import type { WokieeProduct } from "@/components/wokiee/product-card";
import { formatMoney } from "@/lib/mefti";

type Collection = { id: string; title: string; slug: string };
type FooterPage = { title: string; slug: string };

type Sort = "default" | "price-asc" | "price-desc" | "title";

const SORTS: { key: Sort; label: string }[] = [
  { key: "default", label: "Önerilen sıralama" },
  { key: "price-asc", label: "Fiyat: artan" },
  { key: "price-desc", label: "Fiyat: azalan" },
  { key: "title", label: "İsme göre (A-Z)" },
];

function priceOf(product: WokieeProduct) {
  return product.livePrice ?? Number(product.base_price ?? 0);
}

/**
 * Shopier mağaza sayfası düzeni: mağaza kimliği, kategori sekmeleri,
 * ürün sayısı + sıralama/filtre ve iki kolonlu ürün ızgarası.
 */
export function ShopierHome({
  storeName,
  storeSlug,
  logoUrl,
  tagline,
  currency,
  products,
  collections,
  contactEmail,
  salesPaused = false,
  footerPages = [],
  tokens,
}: {
  storeName: string;
  storeSlug: string;
  logoUrl?: string | null;
  tagline?: string | null;
  currency: string;
  products: WokieeProduct[];
  collections: Collection[];
  contactEmail?: string | null;
  salesPaused?: boolean;
  footerPages?: FooterPage[];
  tokens: { muted: string; border: string; cardBg: string; accent: string };
}) {
  const [sort, setSort] = useState<Sort>("default");
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);

  const visible = useMemo(() => {
    const min = Number(minPrice.replace(",", ".")) || 0;
    const max = Number(maxPrice.replace(",", ".")) || 0;
    let rows = products.filter((product) => {
      const price = priceOf(product);
      if (min > 0 && price < min) return false;
      if (max > 0 && price > max) return false;
      if (inStockOnly && (product.stockTotal ?? 0) <= 0) return false;
      return true;
    });
    if (sort === "price-asc") rows = [...rows].sort((a, b) => priceOf(a) - priceOf(b));
    if (sort === "price-desc") rows = [...rows].sort((a, b) => priceOf(b) - priceOf(a));
    if (sort === "title") rows = [...rows].sort((a, b) => a.title.localeCompare(b.title, "tr"));
    return rows;
  }, [products, sort, minPrice, maxPrice, inStockOnly]);

  const initial = storeName.trim().charAt(0).toLocaleUpperCase("tr") || "M";

  return (
    <div
      className="sp-home"
      style={
        {
          "--sp-muted": tokens.muted,
          "--sp-border": tokens.border,
          "--sp-card": tokens.cardBg,
          "--sp-accent": tokens.accent,
        } as React.CSSProperties
      }
    >
      {salesPaused ? (
        <div className="sp-paused" role="status">
          <AlertCircle className="size-6 shrink-0" />
          <p>Bu mağaza, satışlarına geçici bir süre ara vermiştir. Lütfen daha sonra tekrar deneyin.</p>
        </div>
      ) : null}
      <header className="sp-id">
        <div className="sp-avatar" aria-hidden={logoUrl ? undefined : true}>
          {logoUrl ? <img src={logoUrl} alt={storeName} /> : <span>{initial}</span>}
        </div>
        <h1 className="sp-name">{storeName}</h1>
        {tagline ? <p className="sp-tagline">{tagline}</p> : null}
        <Link to="/s/$slug/contact" params={{ slug: storeSlug }} className="sp-contact">
          İletişim
        </Link>
      </header>

      <nav className="sp-tabs" aria-label="Kategoriler">
        <span className="sp-tab sp-tab-active">Tüm ürünler</span>
        {collections.map((collection) => (
          <Link
            key={collection.id}
            to="/s/$slug/c/$collectionSlug"
            params={{ slug: storeSlug, collectionSlug: collection.slug }}
            className="sp-tab"
          >
            {collection.title}
          </Link>
        ))}
      </nav>

      <div className="sp-toolbar">
        <span className="sp-count">{visible.length} ürün</span>
        <div className="sp-tools">
          <button
            type="button"
            aria-label="Sırala"
            aria-expanded={sortOpen}
            onClick={() => {
              setSortOpen((v) => !v);
              setFilterOpen(false);
            }}
            className="sp-tool"
          >
            <ArrowUpDown className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Filtrele"
            aria-expanded={filterOpen}
            onClick={() => {
              setFilterOpen((v) => !v);
              setSortOpen(false);
            }}
            className="sp-tool"
          >
            <SlidersHorizontal className="size-5" />
          </button>
        </div>
      </div>

      {sortOpen ? (
        <div className="sp-panel">
          {SORTS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                setSort(option.key);
                setSortOpen(false);
              }}
              className={`sp-option${sort === option.key ? " sp-option-active" : ""}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {filterOpen ? (
        <div className="sp-panel sp-panel-filter">
          <label className="sp-field">
            <span>En az fiyat</span>
            <input
              inputMode="decimal"
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
              placeholder="0"
            />
          </label>
          <label className="sp-field">
            <span>En çok fiyat</span>
            <input
              inputMode="decimal"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              placeholder="1000"
            />
          </label>
          <label className="sp-check">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(event) => setInStockOnly(event.target.checked)}
            />
            <span>Sadece stokta olanlar</span>
          </label>
          <button
            type="button"
            className="sp-clear"
            onClick={() => {
              setMinPrice("");
              setMaxPrice("");
              setInStockOnly(false);
            }}
          >
            Filtreleri temizle
          </button>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="sp-empty">Bu mağazada gösterilecek ürün bulunamadı.</p>
      ) : (
        <div className="sp-grid">
          {visible.map((product) => (
            <Link
              key={product.id}
              to="/s/$slug/p/$productSlug"
              params={{ slug: storeSlug, productSlug: product.slug }}
              className="sp-card"
            >
              <div className="sp-card-media">
                {product.coverUrl ? (
                  <img src={product.coverUrl} alt={product.title} loading="lazy" />
                ) : (
                  <span className="sp-card-initial">{product.title.charAt(0)}</span>
                )}
              </div>
              <p className="sp-card-title">{product.title}</p>
              <p className="sp-card-price">
                {formatMoney(priceOf(product), product.currency || currency)}
              </p>
            </Link>
          ))}
        </div>
      )}

      <div className="sp-track">
        <Link to="/s/$slug/orders" params={{ slug: storeSlug }}>
          Sipariş takibi
        </Link>
      </div>

      <section className="sp-about" id="iletisim">
        <p className="sp-about-name">{storeName}</p>
        {tagline ? <p className="sp-about-line">{tagline}</p> : null}
        {contactEmail ? (
          <a className="sp-about-line sp-about-mail" href={`mailto:${contactEmail}`}>
            {contactEmail}
          </a>
        ) : null}
        <div className="sp-legal">
          <p>Koşullar</p>
          {footerPages.map((page) => (
            <Link
              key={page.slug}
              to="/s/$slug/page/$pageSlug"
              params={{ slug: storeSlug, pageSlug: page.slug }}
            >
              {page.title}
            </Link>
          ))}
          <Link to="/s/$slug/terms" params={{ slug: storeSlug }}>Mesafeli Satış Sözleşmesi</Link>
          <Link to="/s/$slug/privacy" params={{ slug: storeSlug }}>Kişisel Verilerin Korunması</Link>
        </div>
      </section>
    </div>
  );
}
