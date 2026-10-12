import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { storefrontTokens, type StoreTheme } from "@/components/storefront-chrome";
import { useCart } from "@/lib/cart";
import { formatMoney } from "@/lib/mefti";
import { storefrontUI } from "@/lib/storefront-ui";
import { getFlutProductExtras } from "@/lib/flut-theme.functions";

type Features = Record<string, boolean>;
type Texts = Record<string, string>;

/** Boy/kilo → beden önerisi (BMI ve boy tabanlı genel tablo). */
export function recommendSize(heightCm: number, weightKg: number): string | null {
  if (!(heightCm >= 140 && heightCm <= 200 && weightKg >= 35 && weightKg <= 150)) return null;
  const bmi = weightKg / (heightCm / 100) ** 2;
  const sizes = ["XS", "S", "M", "L", "XL", "XXL"];
  let i = bmi < 18 ? 0 : bmi < 20.5 ? 1 : bmi < 23 ? 2 : bmi < 26 ? 3 : bmi < 29.5 ? 4 : 5;
  if (heightCm >= 178 && i < 5) i += 1;
  const next = sizes[Math.min(5, i + 1)];
  const cur = sizes[i]!;
  const edge = [18, 20.5, 23, 26, 29.5].some((b) => Math.abs(bmi - b) < 0.6);
  return edge && next && next !== cur ? `${cur} veya ${next}` : cur;
}

export function SizeRecommender({ theme, fabric }: { theme: StoreTheme; fabric?: string | undefined }) {
  const { t, border, radius, muted } = storefrontTokens(theme);
  const [h, setH] = useState("");
  const [w, setW] = useState("");
  const rec = recommendSize(Number(h), Number(w));
  const input = { width: 90, minHeight: 44, fontSize: 16, border: `1px solid ${border}`, borderRadius: radius, padding: "0 10px", background: "transparent", color: "inherit" } as const;
  return (
    <div style={{ marginTop: 14, border: `1px solid ${border}`, borderRadius: radius, padding: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Beden / Kilo Önerisi</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ fontSize: 13 }}>Boy <input inputMode="numeric" aria-label="Boy (cm)" placeholder="165" value={h} onChange={(e) => setH(e.target.value.replace(/\D/g, "").slice(0, 3))} style={input} /> cm</label>
        <label style={{ fontSize: 13 }}>Kilo <input inputMode="numeric" aria-label="Kilo (kg)" placeholder="55" value={w} onChange={(e) => setW(e.target.value.replace(/\D/g, "").slice(0, 3))} style={input} /> kg</label>
      </div>
      <div style={{ marginTop: 8, fontSize: 14, color: rec ? t.accent_color : muted }}>
        {rec ? <>→ <strong>{rec}</strong> önerilir</> : "Boy ve kilonuzu girin."}
      </div>
      {fabric ? <div style={{ marginTop: 6, fontSize: 12, color: muted }}>Kumaş esneme: {fabric}</div> : null}
    </div>
  );
}

/** Gerçek zamanlı izleyici sayısı (Realtime presence; sahte sayı üretilmez). */
function LiveViewers({ productId, accent, muted }: { productId: string; accent: string; muted: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const key = crypto.randomUUID();
    const ch = supabase.channel(`pdp-view:${productId}`, { config: { presence: { key } } });
    ch.on("presence", { event: "sync" }, () => setCount(Object.keys(ch.presenceState()).length))
      .subscribe((s) => { if (s === "SUBSCRIBED") void ch.track({ at: Date.now() }); });
    return () => { void supabase.removeChannel(ch); };
  }, [productId]);
  if (count < 2) return null;
  return <div style={{ fontSize: 13, color: muted }}>👁 <strong style={{ color: accent }}>{count} kişi</strong> şu an bakıyor</div>;
}

export function FlutPdpExtras({
  theme, features, texts, storeSlug, storeName, productId, productTitle, selectedLabel, stock, relatedIds, fallbackPhone, onBundleMain,
}: {
  theme: StoreTheme; features: Features; texts: Texts; storeSlug: string; storeName: string; productId: string; productTitle: string;
  selectedLabel: string; stock: number; relatedIds: string[]; fallbackPhone?: string | null | undefined; onBundleMain: () => boolean;
}) {
  const { t, border, radius, muted, fonts } = storefrontTokens(theme);
  const cart = useCart();
  const fetchExtras = useServerFn(getFlutProductExtras);
  const ids = features["theme_bundle_builder"] ? relatedIds.slice(0, 3) : [];
  const { data } = useQuery({
    queryKey: ["flut-extras", storeSlug, productId, ids.join(",")],
    queryFn: () => fetchExtras({ data: { slug: storeSlug, productId, relatedIds: ids } }),
    staleTime: 60_000,
  });
  const phone = (texts["whatsapp_number"] || fallbackPhone || "").replace(/\D/g, "");
  const waText = `Merhaba, ${productTitle}${selectedLabel ? ` ${selectedLabel}` : ""} için sipariş vermek istiyorum.`;
  const bundle = data?.bundle ?? [];
  const bundleTotal = bundle.reduce((s, b) => s + b.price, 0);

  return (
    <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
      {stock > 0 && stock <= 3 ? (
        <span style={{ justifySelf: "start", background: "#B3261E", color: "#fff", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>Son {stock} ürün!</span>
      ) : null}
      {data && data.monthlyBuyers >= 3 ? <div style={{ fontSize: 13, color: muted }}>🔥 Bu ay <strong>{data.monthlyBuyers} kişi</strong> satın aldı</div> : null}
      {features["theme_live_counter"] ? <LiveViewers productId={productId} accent={t.accent_color} muted={muted} /> : null}
      {features["theme_size_recommender"] ? <SizeRecommender theme={theme} fabric={texts["fabric_stretch"]} /> : null}
      {features["theme_whatsapp_order"] && phone.length >= 10 ? (
        <a href={`https://wa.me/${phone}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48, borderRadius: radius, background: "#25D366", color: "#fff", fontWeight: 600, textDecoration: "none" }}>
          💬 WhatsApp ile Sipariş Ver
        </a>
      ) : null}
      {features["theme_bundle_builder"] && bundle.length ? (
        <div style={{ border: `1px solid ${border}`, borderRadius: radius, padding: 14, marginTop: 6 }}>
          <div style={{ fontFamily: fonts.heading, fontSize: 20, marginBottom: 8 }}>Bu Ürünle Tamamla</div>
          {bundle.map((b) => (
            <div key={b.variantId} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "6px 0", borderTop: `1px solid ${border}` }}>
              <Link to="/s/$slug/p/$productSlug" params={{ slug: storeSlug, productSlug: b.slug }} style={{ color: "inherit" }}>{b.title}</Link>
              <span>{formatMoney(b.price, b.currency)}</span>
            </div>
          ))}
          <button type="button" onClick={() => {
            if (!onBundleMain()) return;
            for (const b of bundle) cart.add({ storeSlug, variantId: b.variantId, productSlug: b.slug, title: b.title, variantTitle: b.variantTitle, price: b.price, currency: b.currency, maxStock: b.stock, imageUrl: null }, 1);
            toast.success("Kombin sepete eklendi");
            storefrontUI.openCart();
          }} style={{ marginTop: 10, width: "100%", minHeight: 48, border: 0, borderRadius: radius, background: t.primary_color, color: "#fff", fontWeight: 600, cursor: "pointer" }}>
            Kombini Satın Al (+{formatMoney(bundleTotal, bundle[0]!.currency)})
          </button>
        </div>
      ) : null}
      <span hidden>{storeName}</span>
    </div>
  );
}

/** Sağ alt sabit WhatsApp butonu. */
export function FlutWhatsAppFab({ phone }: { phone?: string | null | undefined }) {
  const n = (phone || "").replace(/\D/g, "");
  if (n.length < 10) return null;
  return (
    <a href={`https://wa.me/${n}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp ile iletişim"
      style={{ position: "fixed", right: 16, bottom: 132, zIndex: 44, width: 52, height: 52, borderRadius: 999, background: "#25D366", color: "#fff", display: "grid", placeItems: "center", fontSize: 24, boxShadow: "0 6px 18px rgba(0,0,0,.2)", textDecoration: "none" }}>
      💬
    </a>
  );
}

/** Kampanya geri sayımı: Gün / Saat / Dk / Sn. */
export function FlutCountdown({ endsAt, label, accent }: { endsAt?: string | undefined; label?: string | undefined; accent: string }) {
  const end = endsAt ? new Date(endsAt.replace(" ", "T")).getTime() : NaN;
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  if (!Number.isFinite(end) || now === null || end <= now) return null;
  const s = Math.floor((end - now) / 1000);
  const parts = [[Math.floor(s / 86400), "Gün"], [Math.floor((s % 86400) / 3600), "Saat"], [Math.floor((s % 3600) / 60), "Dk"], [s % 60, "Sn"]] as const;
  return (
    <div style={{ textAlign: "center", padding: "12px 8px", background: "#1A1A1A", color: "#fff" }} role="timer">
      <div style={{ fontSize: 12, letterSpacing: 4, color: accent, marginBottom: 6 }}>{label || "Kampanya bitiyor"}</div>
      <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
        {parts.map(([v, l]) => <div key={l}><div style={{ fontSize: 22, fontVariantNumeric: "tabular-nums" }}>{String(v).padStart(2, "0")}</div><div style={{ fontSize: 11, opacity: .7 }}>{l}</div></div>)}
      </div>
    </div>
  );
}
