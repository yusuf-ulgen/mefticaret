import { useFavorites, type FavoriteItem } from "@/lib/favorites";

/**
 * Vitrin ürün kartlarında kullanılan kalp butonu. Kart bir Link içinde
 * olduğu için tıklama olayı yayılmadan durdurulur.
 */
export function FavoriteButton({
  item,
  border,
  cardBg,
  accent,
  muted,
}: {
  item: FavoriteItem;
  border: string;
  cardBg: string;
  accent: string;
  muted: string;
}) {
  const favorites = useFavorites();
  const active = favorites.isFavorite(item.storeSlug, item.productSlug);

  return (
    <button
      type="button"
      aria-label={active ? "Favorilerden çıkar" : "Favorilere ekle"}
      aria-pressed={active}
      title={active ? "Favorilerden çıkar" : "Favorilere ekle"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        favorites.toggle(item);
      }}
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        width: 34,
        height: 34,
        display: "grid",
        placeItems: "center",
        borderRadius: 999,
        border: `1px solid ${border}`,
        background: cardBg,
        color: active ? accent : muted,
        cursor: "pointer",
        lineHeight: 1,
        fontSize: 15,
      }}
    >
      {active ? "♥" : "♡"}
    </button>
  );
}
