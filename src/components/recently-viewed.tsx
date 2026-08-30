import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { formatMoney } from "@/lib/mefti";
import { getRecentProducts, type RecentProduct } from "@/lib/recently-viewed";

/** "Son görüntülediklerin" şeridi. İçerik yalnızca istemcide okunur. */
export function RecentlyViewed({
  storeSlug,
  excludeSlug,
  tokens,
}: {
  storeSlug: string;
  excludeSlug?: string;
  tokens: { muted: string; border: string; cardBg: string; radius: string; headingFont: string };
}) {
  const [items, setItems] = useState<RecentProduct[]>([]);

  useEffect(() => {
    setItems(getRecentProducts(storeSlug, excludeSlug).slice(0, 6));
  }, [storeSlug, excludeSlug]);

  if (items.length === 0) return null;

  return (
    <section style={{ padding: "40px 0 8px" }}>
      <h2 style={{ fontFamily: tokens.headingFont, fontSize: 22, marginBottom: 16 }}>Son görüntülediklerin</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
        {items.map((item) => (
          <Link
            key={item.productSlug}
            to="/s/$slug/p/$productSlug"
            params={{ slug: storeSlug, productSlug: item.productSlug }}
            style={{
              background: tokens.cardBg,
              border: `1px solid ${tokens.border}`,
              borderRadius: tokens.radius,
              overflow: "hidden",
              textDecoration: "none",
              color: "inherit",
              display: "block",
            }}
          >
            <div style={{ aspectRatio: "1 / 1", background: tokens.border, overflow: "hidden" }}>
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.title}
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : null}
            </div>
            <div style={{ padding: 12 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{item.title}</p>
              <p style={{ margin: "4px 0 0", color: tokens.muted, fontSize: 13 }}>
                {formatMoney(item.price, item.currency)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
