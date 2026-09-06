import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { storefrontTokens, type StoreTheme } from "@/components/storefront-chrome";
import { formatMoney } from "@/lib/mefti";
import { storefrontQuery } from "@/lib/storefront-queries";

const normalize = (value: string) => value.toLocaleLowerCase("tr");

/** Yazdıkça görsel, fiyat ve kategori gösteren canlı arama açılır kutusu. */
export function PredictiveSearch({ theme, storeSlug }: { theme: StoreTheme; storeSlug: string }) {
  const { t, muted, border, radius, cardBg } = storefrontTokens(theme);
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data } = useQuery(storefrontQuery(storeSlug));

  const results = useMemo(() => {
    const needle = normalize(term.trim());
    if (needle.length < 2) return [];
    const tokens = needle.split(/\s+/).filter(Boolean);
    return (data?.products ?? [])
      .filter((product) => {
        const haystack = normalize(
          `${product.title} ${product.product_type ?? ""} ${(product.tags ?? []).join(" ")}`,
        );
        return tokens.every((token) => haystack.includes(token));
      })
      .slice(0, 6);
  }, [data, term]);

  return (
    <div className="sf-search" style={{ position: "relative", minWidth: 200 }}>
      <input
        type="search"
        value={term}
        placeholder="Ürün ara…"
        aria-label="Mağazada ara"
        onChange={(event) => {
          setTerm(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 160);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && term.trim()) {
            setOpen(false);
            void navigate({ to: "/s/$slug/search", params: { slug: storeSlug }, search: { q: term.trim() } });
          }
        }}
        style={{
          width: "100%",
          background: cardBg,
          color: "inherit",
          border: `1px solid ${border}`,
          borderRadius: 999,
          padding: "8px 14px",
          fontSize: 13,
          fontFamily: "inherit",
        }}
      />

      {open && term.trim().length >= 2 ? (
        <div
          onMouseDown={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
          }}
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            width: "min(380px, 86vw)",
            background: t.background_color,
            border: `1px solid ${border}`,
            borderRadius: radius,
            boxShadow: "0 24px 50px -28px rgba(15,23,42,.55)",
            zIndex: 60,
            overflow: "hidden",
          }}
        >
          {results.length === 0 ? (
            <div style={{ padding: 14, fontSize: 13, color: muted }}>Sonuç bulunamadı.</div>
          ) : (
            results.map((product) => (
              <Link
                key={product.id}
                to="/s/$slug/p/$productSlug"
                params={{ slug: storeSlug, productSlug: product.slug }}
                onClick={() => setOpen(false)}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  padding: 10,
                  textDecoration: "none",
                  color: "inherit",
                  borderBottom: `1px solid ${border}`,
                }}
              >
                <span
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    overflow: "hidden",
                    flexShrink: 0,
                    background: `${t.accent_color}22`,
                    display: "block",
                  }}
                >
                  {product.coverUrl ? (
                    <img
                      src={product.coverUrl}
                      alt={product.title}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  ) : null}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{product.title}</span>
                  <span style={{ display: "block", fontSize: 11, color: muted }}>
                    {product.product_type ?? "Ürün"}
                  </span>
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
                  {formatMoney(Number(product.livePrice ?? product.base_price), product.currency)}
                </span>
              </Link>
            ))
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void navigate({ to: "/s/$slug/search", params: { slug: storeSlug }, search: { q: term.trim() } });
            }}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "transparent",
              border: "none",
              color: t.accent_color,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tüm sonuçları gör
          </button>
        </div>
      ) : null}
    </div>
  );
}
