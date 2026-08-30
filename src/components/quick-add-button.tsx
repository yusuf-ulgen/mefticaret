import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { isDark } from "@/components/storefront-chrome";
import { useCart } from "@/lib/cart";
import { getQuickAddVariant } from "@/lib/storefront.functions";

/**
 * Vitrin ürün kartlarında "Sepete ekle" kısayolu. Tek varyantlı ürünler
 * doğrudan sepete eklenir; çoklu varyantta ürün sayfasına yönlendirilir.
 */
export function QuickAddButton({
  storeSlug,
  productSlug,
  accent,
}: {
  storeSlug: string;
  productSlug: string;
  accent: string;
}) {
  const cart = useCart();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const accentContrast = isDark(accent) ? "#ffffff" : "#101418";

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (busy) return;
        setBusy(true);
        try {
          const variant = await getQuickAddVariant({ data: { slug: storeSlug, productSlug } });
          if (!variant) {
            toast.error("Ürün şu anda satın alınamıyor");
            return;
          }
          if (variant.variantCount > 1) {
            toast.info("Seçenekleri belirlemek için ürüne göz at");
            void navigate({ to: "/s/$slug/p/$productSlug", params: { slug: storeSlug, productSlug } });
            return;
          }
          if (variant.stock <= 0) {
            toast.error("Bu ürün tükendi");
            return;
          }
          cart.add({
            storeSlug,
            variantId: variant.variantId,
            productSlug: variant.productSlug,
            title: variant.title,
            variantTitle: variant.variantTitle,
            price: variant.price,
            currency: variant.currency,
            maxStock: variant.stock,
          });
          toast.success("Ürün sepete eklendi");
        } catch {
          toast.error("Sepete eklenemedi, tekrar dene");
        } finally {
          setBusy(false);
        }
      }}
      style={{
        marginTop: 12,
        width: "100%",
        padding: "9px 12px",
        borderRadius: 10,
        border: "none",
        background: accent,
        color: accentContrast,
        fontWeight: 600,
        fontSize: 13,
        cursor: busy ? "wait" : "pointer",
        opacity: busy ? 0.7 : 1,
      }}
    >
      {busy ? "Ekleniyor…" : "Sepete ekle"}
    </button>
  );
}
