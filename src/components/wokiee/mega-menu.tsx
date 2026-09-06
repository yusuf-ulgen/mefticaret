import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { storefrontTokens, type StoreTheme } from "@/components/storefront-chrome";
import { formatMoney } from "@/lib/mefti";
import { storefrontQuery } from "@/lib/storefront-queries";

/** Görselli mega menü: koleksiyon sütunları, öne çıkan ürün kartları ve rozetler. */
export function MegaMenu({ theme, storeSlug }: { theme: StoreTheme; storeSlug: string }) {
  const { t, fonts, muted, border, radius } = storefrontTokens(theme);
  const [open, setOpen] = useState(false);
  const { data } = useQuery(storefrontQuery(storeSlug));

  const collections = (data?.collections ?? []).slice(0, 8);
  const featured = (data?.products ?? []).slice(0, 3);
  if (!collections.length && !featured.length) return null;

  return (
    <div
      className="sf-mega"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{ position: "relative" }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{ background: "none", border: "none", color: muted, fontSize: 13, cursor: "pointer", padding: 0 }}
      >
        Mağaza ▾
      </button>

      {open ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 12px)",
            left: 0,
            width: "min(720px, 88vw)",
            background: t.background_color,
            border: `1px solid ${border}`,
            borderRadius: radius,
            boxShadow: "0 30px 60px -30px rgba(15,23,42,.55)",
            padding: 18,
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) minmax(0,1.1fr)",
            gap: 20,
            zIndex: 70,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: muted,
                marginBottom: 10,
              }}
            >
              Koleksiyonlar
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {collections.map((collection, index) => (
                <Link
                  key={collection.id}
                  to="/s/$slug/c/$collectionSlug"
                  params={{ slug: storeSlug, collectionSlug: collection.slug }}
                  onClick={() => setOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  {collection.title}
                  {index === 0 ? (
                    <span
                      style={{
                        background: t.accent_color,
                        color: "#101418",
                        borderRadius: 999,
                        padding: "1px 7px",
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      HOT
                    </span>
                  ) : null}
                </Link>
              ))}
              <Link
                to="/s/$slug/products"
                params={{ slug: storeSlug }}
                onClick={() => setOpen(false)}
                style={{ fontSize: 13, color: t.accent_color, textDecoration: "none", fontWeight: 600 }}
              >
                Tüm ürünler →
              </Link>
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: muted,
                marginBottom: 10,
              }}
            >
              Öne çıkanlar
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {featured.map((product) => (
                <Link
                  key={product.id}
                  to="/s/$slug/p/$productSlug"
                  params={{ slug: storeSlug, productSlug: product.slug }}
                  onClick={() => setOpen(false)}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <span
                    style={{
                      width: 52,
                      height: 52,
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
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontFamily: fonts.heading, fontSize: 13, fontWeight: 600 }}>
                      {product.title}
                    </span>
                    <span style={{ display: "block", fontSize: 12, color: muted }}>
                      {formatMoney(Number(product.livePrice ?? product.base_price), product.currency)}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
