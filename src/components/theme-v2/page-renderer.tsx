import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import type { SectionProduct } from "@/components/storefront-sections";
import { useOptionalFavorites } from "@/lib/favorites";
import { formatMoney } from "@/lib/mefti";
import { storefrontUI } from "@/lib/storefront-ui";
import { FX_CSS, ThemeFx, fxOf, renderPremiumSection } from "@/components/theme-v2/premium-sections";
import { darkModeOf, v2CssVars, type V2Block, type V2Section, type V2Settings } from "@/lib/theme-v2";

export type V2RenderContext = {
  storeSlug: string;
  currency: string;
  products: SectionProduct[];
  collections: { id: string; title: string; slug: string; description?: string | null }[];
  blogPages?: { id?: string; title: string; slug: string }[];
  /** Editör: tıklanabilir seçim işaretleri + seçili öğe vurgusu. */
  editing?: { selectedId: string | null } | undefined;
};

const str = (v: unknown) => (typeof v === "string" ? v : v === undefined || v === null ? "" : String(v));
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const color = (v: unknown) => (typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v) ? v : undefined);
const safeUrl = (v: unknown) => {
  const s = str(v).trim();
  if (!s) return "";
  if (/^(https?:)?\/\//i.test(s) || s.startsWith("/") || s.startsWith("#") || s.startsWith("mailto:") || s.startsWith("tel:")) return s;
  return "";
};

function href(ctx: V2RenderContext, url: unknown) {
  const u = safeUrl(url);
  if (!u) return `/s/${ctx.storeSlug}`;
  if (u.startsWith("/") && !u.startsWith("/s/") && !u.startsWith("//")) return `/s/${ctx.storeSlug}${u === "/" ? "" : u}`;
  return u;
}

const matches = (value: string, entry: { id: string; slug: string }) => value === entry.id || value === entry.slug;
const splitList = (v: unknown) => str(v).split(/[,\n]/).map((s) => s.trim()).filter(Boolean);

function embedUrl(url: string, autoplay = false) {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,20})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}${autoplay ? "?autoplay=1&mute=1" : ""}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}${autoplay ? "?autoplay=1&muted=1" : ""}`;
  return null;
}

function VideoEmbed({ url, autoplay = false }: { url: string; autoplay?: boolean }) {
  const u = safeUrl(url);
  if (!u) return <div style={{ aspectRatio: "16/9", background: "color-mix(in srgb, var(--color-text) 8%, transparent)", borderRadius: 12 }} />;
  const embed = embedUrl(u, autoplay);
  if (embed) return <iframe src={embed} title="Video" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen style={{ width: "100%", aspectRatio: "16/9", border: 0, borderRadius: 12 }} />;
  return <video src={u} controls muted={autoplay} autoPlay={autoplay} playsInline preload="metadata" style={{ width: "100%", borderRadius: 12 }} />;
}

/** Özel HTML: tarayıcıda DOMPurify ile temizlenip yerleştirilir (SSR'da boş). */
function SafeHtml({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    void import("dompurify").then(({ default: DOMPurify }) => {
      if (!alive || !ref.current) return;
      ref.current.innerHTML = DOMPurify.sanitize(html, { FORBID_TAGS: ["script", "style", "iframe", "form", "object", "embed"], FORBID_ATTR: ["style"] });
    });
    return () => {
      alive = false;
    };
  }, [html]);
  return <div ref={ref} />;
}

function Countdown({ s }: { s: V2Settings }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const end = Date.parse(`${str(s["end_date"])}T${str(s["end_time"]) || "23:59"}:00`);
  if (!Number.isFinite(end)) return <p style={{ opacity: 0.6 }}>Geri sayım için bitiş tarihi girin.</p>;
  if (now === null) return <div style={{ height: 56 }} />;
  const left = Math.max(0, end - now);
  if (left === 0) return s["show_after_zero"] === "hide" ? null : <p style={{ fontWeight: 600 }}>{str(s["zero_message"])}</p>;
  const parts: [number, string][] = [
    [Math.floor(left / 86400000), str(s["label_days"])],
    [Math.floor(left / 3600000) % 24, str(s["label_hours"])],
    [Math.floor(left / 60000) % 60, str(s["label_minutes"])],
    [Math.floor(left / 1000) % 60, str(s["label_seconds"])],
  ];
  const box = s["style"] === "box";
  const banner = s["style"] === "banner";
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "inherit", flexWrap: "wrap", ...(banner ? { background: "var(--color-primary)", color: "var(--color-background)", padding: "10px 16px", borderRadius: 8 } : {}) }}>
      {parts.map(([v, label]) => (
        <div key={label} style={{ textAlign: "center", minWidth: 56, ...(box ? { border: "1px solid color-mix(in srgb, var(--color-text) 20%, transparent)", borderRadius: 10, padding: "8px 10px" } : {}) }}>
          <div style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{String(v).padStart(2, "0")}</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

const SWATCH: Record<string, string> = { siyah: "#111111", beyaz: "#ffffff", kırmızı: "#dc2626", mavi: "#2563eb", yeşil: "#16a34a", sarı: "#facc15", bej: "#e8d5b7", gri: "#9ca3af", lacivert: "#1e3a8a", pembe: "#f472b6", kahve: "#7c4a2d", mor: "#7c3aed", turuncu: "#f97316" };
const tagValues = (tags: string[] | null | undefined, key: string) =>
  (tags ?? []).flatMap((t) => { const m = t.match(/^([^:]+):(.+)$/); return m && m[1]!.trim().toLocaleLowerCase("tr") === key ? [m[2]!.trim()] : []; });
const hasTag = (tags: string[] | null | undefined, ...names: string[]) => (tags ?? []).some((t) => names.includes(t.trim().toLocaleLowerCase("tr")));

function ProductCard({ product, ctx, s, showPrice = true, showCart = false }: { product: SectionProduct; ctx: V2RenderContext; s: V2Settings; showPrice?: boolean; showCart?: boolean }) {
  const favorites = useOptionalFavorites();
  const price = Number(product.base_price);
  const compare = Number(product.compare_at_price ?? 0);
  const discount = compare > price ? Math.round((1 - price / compare) * 100) : 0;
  const style = str(s["card_style"]) || "minimal";
  const stock = typeof product.stockTotal === "number" ? product.stockTotal : null;
  const low = stock !== null && stock > 0 && stock <= 5;
  const tags = product.tags;
  const second = s["hover_image"] !== false ? safeUrl(product.secondUrl) : "";
  const card: CSSProperties = style === "bold" ? { background: "var(--color-surface)", borderRadius: "var(--border-radius)", padding: 10, border: "1px solid var(--color-border)" }
    : style === "organic" ? { background: "var(--color-surface)", borderRadius: "var(--border-radius-lg)", padding: 12, border: "1px solid var(--color-border)" }
    : style === "tech" ? { background: "var(--color-background)", borderRadius: "var(--border-radius)", padding: 12, border: "1px solid var(--color-border)", boxShadow: "0 12px 30px -20px color-mix(in srgb, var(--color-primary) 45%, transparent)" }
    : {};
  const badges: { text: string; bg: string; fg: string }[] = [];
  if (s["badges"] !== false && s["show_badge"] !== false) {
    if (discount > 0) badges.push({ text: style === "tech" ? "İndirimli" : `%${discount}`, bg: style === "bold" ? "var(--color-primary)" : "var(--color-error)", fg: "#fff" });
    if (hasTag(tags, "yeni", "new")) badges.push({ text: "Yeni", bg: "var(--color-accent)", fg: "var(--color-text)" });
    if (hasTag(tags, "çok satan", "cok-satan", "bestseller")) badges.push({ text: "Çok Satan", bg: "var(--color-primary)", fg: "var(--color-background)" });
    if (style === "bold" && low) badges.push({ text: "Sınırlı stok", bg: "var(--color-accent)", fg: "#0a0a0a" });
  }
  const fav = favorites?.isFavorite(ctx.storeSlug, product.slug) ?? false;
  const iconBtn: CSSProperties = { width: 44, height: 44, borderRadius: 999, border: 0, display: "grid", placeItems: "center", background: "color-mix(in srgb, var(--color-background) 88%, transparent)", color: "var(--color-text)", cursor: "pointer", fontSize: 18 };
  const swatches = s["swatches"] === true ? tagValues(tags, "renk").slice(0, 5) : [];
  const origin = s["origin_tag"] === true ? tagValues(tags, "köken")[0] ?? tagValues(tags, "koken")[0] : undefined;
  const ingredients = s["ingredients"] === true ? tagValues(tags, "malzeme") : [];
  const certs = s["ingredients"] === true ? tagValues(tags, "sertifika") : [];
  return (
    <div className={`v2-card v2-card-${style}`} style={{ position: "relative", minWidth: 0, ...card }}>
      <a href={`/s/${ctx.storeSlug}/p/${product.slug}`} style={{ display: "block", color: "inherit", textDecoration: "none" }}>
        <div className="v2-card-media" style={{ position: "relative", aspectRatio: s["image_ratio"] === "portrait" || style === "boutique" ? "3/4" : "1/1", borderRadius: style === "boutique" || style === "minimal" ? "var(--border-radius-sm)" : "var(--border-radius)", overflow: "hidden", background: "color-mix(in srgb, var(--color-text) 6%, transparent)" }}>
          {product.coverUrl ? <img src={product.coverUrl} alt={product.title} loading="lazy" decoding="async" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : null}
          {second ? <img className="v2-card-alt" src={second} alt="" aria-hidden loading="lazy" decoding="async" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : null}
          {origin ? <span style={{ position: "absolute", bottom: 8, left: 8, background: "var(--color-primary)", color: "var(--color-background)", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999 }}>📍 {origin}'den</span> : null}
        </div>
        {badges.length ? <div style={{ position: "absolute", top: 8 + (card.padding ? 10 : 0), left: 8 + (card.padding ? 10 : 0), display: "flex", gap: 4, flexWrap: "wrap" }}>{badges.map((b) => <span key={b.text} style={{ background: b.bg, color: b.fg, fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: style === "boutique" ? 0 : 999 }}>{b.text}</span>)}</div> : null}
        <p style={{ margin: "10px 0 2px", fontWeight: style === "boutique" ? 400 : 600, fontSize: 14, textTransform: style === "boutique" ? "uppercase" : undefined, letterSpacing: style === "boutique" ? ".08em" : undefined }}>{product.title}</p>
        {s["show_rating"] === true ? <p style={{ margin: 0, fontSize: 12, color: "#f59e0b" }}>★★★★★</p> : null}
        {showPrice ? (
          <p style={{ margin: 0, fontSize: style === "bold" ? 16 : 14, fontWeight: style === "bold" || style === "tech" ? 700 : 400, color: style === "bold" ? "var(--color-accent)" : style === "tech" ? "var(--color-primary)" : undefined }}>
            {formatMoney(price, product.currency ?? ctx.currency)}
            {s["show_compare_price"] !== false && compare > price ? <s style={{ marginLeft: 6, opacity: 0.5, fontSize: 12, color: "var(--color-text)" }}>{formatMoney(compare, product.currency ?? ctx.currency)}</s> : null}
          </p>
        ) : null}
        {ingredients.length ? <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--color-text-muted)" }}>{ingredients.join(", ")}</p> : null}
        {certs.length ? <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>{certs.map((c) => <span key={c} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, border: "1px solid var(--color-primary)", color: "var(--color-primary)", textTransform: "uppercase" }}>{c}</span>)}</div> : null}
      </a>
      {s["stock_bar"] === true && low ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ height: 6, borderRadius: 999, background: "color-mix(in srgb, var(--color-text) 12%, transparent)", overflow: "hidden" }}><div style={{ width: `${Math.max(12, (stock! / 5) * 100)}%`, height: "100%", background: "var(--color-primary)" }} /></div>
          <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 700, color: "var(--color-primary)" }}>Son {stock} ürün kaldı!</p>
        </div>
      ) : null}
      {swatches.length ? <div style={{ display: "flex", gap: 6, marginTop: 8 }}>{swatches.map((c) => { const hex = /^#[0-9a-f]{3,6}$/i.test(c) ? c : SWATCH[c.toLocaleLowerCase("tr")]; return <span key={c} title={c} style={{ width: 16, height: 16, borderRadius: 999, border: "1px solid var(--color-border)", background: hex ?? "var(--color-surface)" }} />; })}</div> : null}
      <div style={{ position: "absolute", top: 8 + (card.padding ? 10 : 0), right: 8 + (card.padding ? 10 : 0), display: "grid", gap: 6 }}>
        {s["wishlist"] === true ? (
          <button type="button" aria-label={fav ? "Favorilerden çıkar" : "Favorilere ekle"} aria-pressed={fav} style={{ ...iconBtn, color: fav ? "var(--color-error)" : "var(--color-text)" }}
            onClick={() => favorites?.toggle({ storeSlug: ctx.storeSlug, productSlug: product.slug, title: product.title, price, currency: product.currency ?? ctx.currency, image: product.coverUrl ?? null })}>{fav ? "♥" : "♡"}</button>
        ) : null}
        {s["quick_view"] === true ? <button type="button" aria-label="Hızlı bakış" style={iconBtn} onClick={() => storefrontUI.openQuickView(product.slug)}>👁</button> : null}
      </div>
      {showCart ? <button type="button" className="v2-btn" onClick={() => storefrontUI.openQuickView(product.slug)} style={{ display: "flex", width: "100%", justifyContent: "center", marginTop: 10, minHeight: 44, alignItems: "center", fontSize: 13, fontWeight: 600, borderRadius: "var(--btn-border-radius)", border: style === "bold" || style === "tech" ? 0 : "1px solid var(--color-text)", background: style === "bold" || style === "tech" ? "var(--btn-bg)" : "transparent", color: style === "bold" || style === "tech" ? "var(--btn-text)" : "inherit", cursor: "pointer" }}>Sepete ekle</button> : null}
    </div>
  );
}

function pickable(ctx: V2RenderContext, kind: "section" | "block", id: string): Record<string, string> & { style?: CSSProperties } {
  if (!ctx.editing) return {};
  const selected = ctx.editing.selectedId === id;
  return {
    [`data-v2-${kind}`]: id,
    ...(selected ? { "data-v2-selected": "true" } : {}),
  };
}

export function BlockRenderer({ block, ctx, index = 0, parentProducts = [] }: { block: V2Block; ctx: V2RenderContext; index?: number; parentProducts?: SectionProduct[] }) {
  if (!block.visible) return null;
  const s = block.settings;
  const align = s["alignment"] && s["alignment"] !== "inherit" ? (str(s["alignment"]) as CSSProperties["textAlign"]) : undefined;
  let node: ReactNode = null;
  switch (block.type) {
    case "heading": {
      const Tag = (["h1", "h2", "h3", "h4"].includes(str(s["tag"])) ? str(s["tag"]) : "h2") as "h2";
      node = <Tag style={{ textAlign: align, color: color(s["color"]), ...(s["font"] === "accent" ? { fontFamily: "var(--font-accent)", fontWeight: 600, letterSpacing: 0 } : {}), fontWeight: num(s["font_weight"], 700), marginTop: num(s["margin_top"]), marginBottom: num(s["margin_bottom"], 12), ...(num(s["font_size"]) > 0 ? { fontSize: num(s["font_size"]) } : {}) }}>{str(s["text"])}</Tag>;
      break;
    }
    case "paragraph":
      node = <div className="v2-rich" style={{ textAlign: align, color: color(s["color"]), fontSize: num(s["font_size"], 16), maxWidth: num(s["max_width"]) > 0 ? num(s["max_width"]) : undefined, margin: align === "center" ? "0 auto 12px" : "0 0 12px", lineHeight: 1.6 }}><SafeHtml html={str(s["richtext"])} /></div>;
      break;
    case "button": {
      const size = s["size"] === "small" ? { padding: "6px 14px", fontSize: 13 } : s["size"] === "large" ? { padding: "14px 28px", fontSize: 16 } : { padding: "var(--btn-padding-y) var(--btn-padding-x)", fontSize: 14 };
      const style = str(s["style"]);
      const look: CSSProperties = style === "secondary" ? { background: "var(--color-secondary)", color: "var(--color-background)" }
        : style === "outline" ? { border: "1.5px solid currentColor", background: "transparent", color: "inherit" }
        : style === "ghost" ? { background: "transparent", color: "inherit", textDecoration: "underline" }
        : { background: "var(--btn-bg)", color: "var(--btn-text)" };
      node = <a className="v2-btn" href={href(ctx, s["link_url"])} style={{ display: s["full_width"] ? "flex" : "inline-flex", justifyContent: "center", alignItems: "center", gap: 6, minHeight: 44, borderRadius: "var(--btn-border-radius)", fontWeight: 600, textDecoration: "none", margin: "4px 4px 4px 0", ...size, ...look }}>{str(s["icon"]) ? <span aria-hidden>{str(s["icon"])}</span> : null}{str(s["text"])}</a>;
      break;
    }
    case "image": {
      const src = safeUrl(s["src_url"]);
      const width = s["width"] === "fixed" ? num(s["fixed_width"], 320) : s["width"] === "auto" ? "auto" : "100%";
      const img = src ? <img src={src} alt={str(s["alt_text"])} loading={s["lazy_load"] === false ? "eager" : "lazy"} decoding="async" style={{ width, maxWidth: "100%", borderRadius: num(s["border_radius"]), display: "block" }} /> : <div style={{ width: "100%", aspectRatio: "4/3", borderRadius: num(s["border_radius"]), background: "color-mix(in srgb, var(--color-text) 8%, transparent)" }} />;
      node = safeUrl(s["link_url"]) ? <a href={href(ctx, s["link_url"])}>{img}</a> : img;
      break;
    }
    case "video":
      node = <VideoEmbed url={str(s["video_url"])} />;
      break;
    case "product_card": {
      const chosen = str(s["product_id"]);
      const product = chosen ? ctx.products.find((p) => matches(chosen, p)) : parentProducts[index] ?? ctx.products[index];
      node = product ? <ProductCard product={product} ctx={ctx} s={s} /> : <div style={{ aspectRatio: "1/1", borderRadius: 12, background: "color-mix(in srgb, var(--color-text) 6%, transparent)" }} />;
      break;
    }
    case "collection_card": {
      const c = ctx.collections.find((x) => matches(str(s["collection_id"]), x)) ?? ctx.collections[index];
      node = c ? (
        <a href={`/s/${ctx.storeSlug}/c/${c.slug}`} style={{ display: "block", color: "inherit", textDecoration: "none" }}>
          <div style={{ aspectRatio: "1/1", borderRadius: 12, overflow: "hidden", background: "color-mix(in srgb, var(--color-primary) 12%, transparent)" }}>
            {safeUrl(s["image_url"]) ? <img src={safeUrl(s["image_url"])} alt={c.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
          </div>
          <p style={{ marginTop: 8, fontWeight: 600 }}>{c.title}</p>
        </a>
      ) : null;
      break;
    }
    case "icon":
      node = <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "inherit" }}><span style={{ fontSize: num(s["size"], 32) }} aria-hidden>{str(s["icon"])}</span><span style={{ fontWeight: 600 }}>{str(s["text"])}</span></div>;
      break;
    case "divider":
      node = <hr style={{ border: 0, borderTop: `${num(s["thickness"], 1)}px solid ${color(s["color"]) ?? "color-mix(in srgb, var(--color-text) 15%, transparent)"}`, margin: "16px 0" }} />;
      break;
    case "spacer":
      node = <div style={{ height: num(s["height"], 32) }} />;
      break;
    case "custom_html":
      node = <SafeHtml html={str(s["html"])} />;
      break;
    case "countdown":
      node = <Countdown s={s} />;
      break;
    case "badge": {
      const radius = s["style"] === "square" ? 2 : s["style"] === "rounded" ? 6 : 999;
      node = <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: ".06em", padding: "4px 10px", borderRadius: radius, color: color(s["text_color"]) ?? "var(--color-background)", background: color(s["bg_color"]) ?? "var(--color-primary)", marginBottom: 12 }}>{str(s["text"])}</span>;
      break;
    }
    case "review_stars": {
      const r = Math.max(0, Math.min(5, Math.round(num(s["rating"], 5))));
      node = <p style={{ margin: "4px 0 12px" }}><span style={{ color: "#f59e0b", letterSpacing: 2 }}>{"★".repeat(r)}{"☆".repeat(5 - r)}</span> <span style={{ fontSize: 13, opacity: 0.7 }}>{str(s["count_text"])}</span></p>;
      break;
    }
  }
  return <div {...pickable(ctx, "block", block.id)}>{node}</div>;
}

const HEIGHTS: Record<string, string> = { small: "280px", medium: "420px", large: "600px", full: "100vh" };
const justify = (pos: unknown) => (pos === "left" ? "flex-start" : pos === "right" ? "flex-end" : "center");

function Container({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ maxWidth: "var(--max-width)", margin: "0 auto", padding: "0 20px", ...style }}>{children}</div>;
}

export function SectionRenderer({ section, ctx, children }: { section: V2Section; ctx: V2RenderContext; children?: ReactNode }) {
  const s = section.settings;
  const pad: CSSProperties = { paddingTop: "var(--section-padding)", paddingBottom: "var(--section-padding)" };
  const blocks = (products: SectionProduct[] = []) => children ?? section.blocks.map((b, i) => <BlockRenderer key={b.id} block={b} ctx={ctx} index={i} parentProducts={products} />);
  let node: ReactNode = null;

  switch (section.type) {
    case "hero":
    case "banner": {
      const bgUrl = safeUrl(s["background_url"] ?? s["image_url"]);
      const isVideo = section.type === "hero" && s["background_type"] === "video" && bgUrl;
      const isImage = (section.type === "banner" || s["background_type"] === "image") && bgUrl && s["layout"] !== "split";
      const gradient = s["bg_style"] === "gradient";
      const h = HEIGHTS[str(s["height"])] ?? HEIGHTS["medium"];
      const split = section.type === "hero" && s["layout"] === "split";
      const side = safeUrl(s["side_image_url"]);
      const organic = s["organic_shape"] === true;
      const bg = gradient ? "var(--gradient-primary)" : color(s["bg_color"]) ?? "color-mix(in srgb, var(--color-primary) 8%, var(--color-background))";
      node = (
        <section style={{ position: "relative", minHeight: section.type === "banner" ? `calc(${h} * .7)` : split ? undefined : h, display: "flex", alignItems: "center", overflow: "hidden", color: color(s["text_color"]) ?? (isImage || isVideo || gradient ? "#fff" : undefined), background: bg }}>
          {isImage ? <img className={section.type === "hero" ? "v2-parallax" : undefined} src={bgUrl} alt="" fetchPriority="high" decoding="async" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : null}
          {isVideo ? <video className="v2-parallax" src={bgUrl} autoPlay muted loop playsInline preload="metadata" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : null}
          {isImage || isVideo ? <div style={{ position: "absolute", inset: 0, background: "#000", opacity: num(s["overlay_opacity"], 30) / 100 }} /> : null}
          {organic ? <svg aria-hidden viewBox="0 0 200 200" style={{ position: "absolute", right: "-8%", top: "-12%", width: "45%", opacity: 0.18, fill: "var(--color-secondary)" }}><path d="M45.6,-58.1C58.2,-47.5,67.1,-32.4,70.7,-16.1C74.3,0.2,72.6,17.8,64.4,31.4C56.2,45,41.5,54.7,25.6,61.3C9.7,67.9,-7.4,71.5,-23.6,67.2C-39.8,62.9,-55.1,50.7,-64.3,34.9C-73.5,19.1,-76.6,-0.3,-70.9,-16.6C-65.2,-32.9,-50.7,-46.1,-35.5,-56C-20.3,-65.9,-4.4,-72.4,10.4,-72.6C25.2,-72.8,33,-68.7,45.6,-58.1Z" transform="translate(100 100)" /></svg> : null}
          <Container style={{ position: "relative", width: "100%", padding: `${num(s["padding"], 48)}px 20px`, display: "flex", justifyContent: justify(s["content_position"]) }}>
            {split ? (
              <div className="v2-split" style={{ display: "flex", gap: 40, alignItems: "center", width: "100%" }}>
                <div style={{ flex: 1, minWidth: 0 }}>{blocks()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {side ? <img src={side} alt="" fetchPriority="high" decoding="async" style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: organic ? "58% 42% 38% 62% / 45% 55% 45% 55%" : "var(--border-radius-lg)", boxShadow: gradient ? "0 30px 60px -30px rgba(0,0,0,.5)" : undefined }} />
                    : <div style={{ aspectRatio: "4/3", borderRadius: organic ? "58% 42% 38% 62% / 45% 55% 45% 55%" : "var(--border-radius-lg)", background: "color-mix(in srgb, var(--color-secondary) 35%, transparent)" }} />}
                </div>
              </div>
            ) : (
              <div style={{ maxWidth: 680, textAlign: (str(s["content_position"]) || "center") as CSSProperties["textAlign"], justifyContent: justify(s["content_position"]) }}>{blocks()}</div>
            )}
          </Container>
        </section>
      );
      break;
    }
    case "featured_products": {
      const count = Math.max(2, Math.min(12, num(s["products_count"], 4)));
      const col = str(s["collection_id"]);
      const products = ctx.products.slice(0, count);
      void col;
      const cols = num(s["columns"], 4);
      const cards = section.blocks.filter((b) => b.type === "product_card");
      node = (
        <section style={pad}>
          <Container>
            {str(s["title"]) ? <h2 style={{ marginBottom: 20 }}>{str(s["title"])}</h2> : null}
            {section.blocks.filter((b) => b.type === "heading").map((b) => <BlockRenderer key={b.id} block={b} ctx={ctx} />)}
            <div className={s["layout"] === "scroll" ? "v2-scroll" : "v2-grid"} style={s["layout"] === "scroll" ? { display: "grid", gap: "var(--grid-gap)", gridAutoFlow: "column", gridAutoColumns: `calc((100% - var(--grid-gap) * ${cols - 1}) / ${cols})`, overflowX: "auto", scrollSnapType: "x mandatory", paddingBottom: 8 } : { display: "grid", gap: "var(--grid-gap)", gridTemplateColumns: `repeat(var(--v2-cols, ${cols}), minmax(0, 1fr))`, ["--v2-cols-d" as string]: cols }}>
              {cards.length
                ? cards.map((b, i) => <BlockRenderer key={b.id} block={b} ctx={ctx} index={i} parentProducts={products} />)
                : products.map((p) => <ProductCard key={p.id} product={p} ctx={ctx} s={s} showPrice={s["show_price"] !== false} showCart={s["show_add_to_cart"] === true} />)}
              {!cards.length && !products.length ? <p style={{ opacity: 0.6 }}>Henüz ürün yok.</p> : null}
            </div>
          </Container>
        </section>
      );
      break;
    }
    case "announcement": {
      node = <AnnouncementBar s={s} ctx={ctx} />;
      break;
    }
    case "testimonials": {
      const items = str(s["items"]).split("\n").map((l) => l.split("|")).filter((p) => p[0]?.trim());
      node = (
        <section style={{ ...pad, background: color(s["bg_color"]) }}>
          <Container>
            {str(s["title"]) ? <h2 style={{ marginBottom: 20, textAlign: "center" }}>{str(s["title"])}</h2> : null}
            <div style={s["layout"] === "carousel" ? { display: "flex", gap: "var(--grid-gap)", overflowX: "auto", scrollSnapType: "x mandatory" } : { display: "grid", gap: "var(--grid-gap)", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              {items.map(([text, name], i) => (
                <figure key={i} style={{ margin: 0, padding: 20, borderRadius: 16, border: "1px solid color-mix(in srgb, var(--color-text) 12%, transparent)", minWidth: s["layout"] === "carousel" ? 260 : undefined, scrollSnapAlign: "start" }}>
                  {s["show_stars"] !== false ? <div style={{ color: "#f59e0b", marginBottom: 8 }}>★★★★★</div> : null}
                  <blockquote style={{ margin: 0 }}>{text?.trim()}</blockquote>
                  <figcaption style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 14 }}>
                    {s["show_avatar"] !== false ? <span style={{ width: 32, height: 32, borderRadius: 999, background: "var(--color-primary)", color: "var(--color-background)", display: "grid", placeItems: "center", fontSize: 13 }}>{(name ?? "?").trim().charAt(0)}</span> : null}
                    {name?.trim()}
                  </figcaption>
                </figure>
              ))}
            </div>
          </Container>
        </section>
      );
      break;
    }
    case "blog_posts": {
      const posts = (ctx.blogPages ?? []).slice(0, num(s["count"], 3));
      node = (
        <section style={pad}>
          <Container>
            {str(s["title"]) ? <h2 style={{ marginBottom: 20 }}>{str(s["title"])}</h2> : null}
            {posts.length ? (
              <div style={{ display: "grid", gap: "var(--grid-gap)", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                {posts.map((p) => <a key={p.slug} href={`/s/${ctx.storeSlug}/page/${p.slug}`} style={{ padding: 20, borderRadius: 14, border: "1px solid color-mix(in srgb, var(--color-text) 12%, transparent)", color: "inherit", textDecoration: "none", fontWeight: 600 }}>{p.title}</a>)}
              </div>
            ) : <p style={{ opacity: 0.6 }}>Henüz yazı yok.</p>}
          </Container>
        </section>
      );
      break;
    }
    case "image_with_text": {
      const img = safeUrl(s["image_url"]);
      const ratio = s["image_ratio"] === "portrait" ? "3/4" : s["image_ratio"] === "landscape" ? "4/3" : "1/1";
      const width = s["content_width"] === "narrow" ? "40%" : s["content_width"] === "wide" ? "60%" : "50%";
      node = (
        <section style={pad}>
          <Container>
            <div className="v2-split" style={{ display: "flex", gap: 32, alignItems: "center", flexDirection: s["image_position"] === "right" ? "row-reverse" : "row", ["--v2-content" as string]: width }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {img ? <img src={img} alt="" loading="lazy" decoding="async" style={{ width: "100%", aspectRatio: ratio, objectFit: "cover", borderRadius: "var(--border-radius-lg)", filter: s["image_filter"] === "grayscale" ? "grayscale(1) contrast(1.05)" : s["image_filter"] === "sepia" ? "sepia(.45) saturate(.8) contrast(1.05)" : undefined }} /> : <div style={{ aspectRatio: ratio, borderRadius: 16, background: "color-mix(in srgb, var(--color-primary) 10%, transparent)" }} />}
              </div>
              <div style={{ flex: `0 0 ${width}`, minWidth: 0 }}>{blocks()}</div>
            </div>
          </Container>
        </section>
      );
      break;
    }
    case "video":
      node = <section style={pad}><Container>{str(s["title"]) ? <h2 style={{ marginBottom: 16 }}>{str(s["title"])}</h2> : null}<VideoEmbed url={str(s["video_url"])} autoplay={s["autoplay"] === true} /></Container></section>;
      break;
    case "custom_html":
      node = <section style={pad}><Container><SafeHtml html={str(s["html"])} /></Container></section>;
      break;
    case "newsletter":
      node = (
        <section style={{ ...pad, background: color(s["bg_color"]) ?? "color-mix(in srgb, var(--color-primary) 6%, var(--color-background))" }}>
          <Container style={{ textAlign: "center", maxWidth: 640 }}>
            <h2>{str(s["title"])}</h2>
            <p style={{ opacity: 0.75, margin: "8px 0 16px" }}>{str(s["description"])}</p>
            <form onSubmit={(e) => e.preventDefault()} style={{ display: "flex", gap: 8, flexDirection: s["layout"] === "stacked" ? "column" : "row", flexWrap: "wrap" }}>
              <input type="email" required aria-label={str(s["placeholder_text"])} placeholder={str(s["placeholder_text"])} style={{ flex: 1, minWidth: 200, minHeight: 44, padding: "0 14px", borderRadius: "var(--border-radius)", border: "1px solid color-mix(in srgb, var(--color-text) 25%, transparent)", background: "var(--color-background)", color: "var(--color-text)" }} />
              <button type="submit" className="v2-btn" style={{ minHeight: 44, padding: "0 22px", borderRadius: "var(--btn-border-radius)", background: "var(--btn-bg)", color: "var(--btn-text)", border: 0, fontWeight: 600 }}>{str(s["button_text"])}</button>
            </form>
          </Container>
        </section>
      );
      break;
    case "collection_list": {
      const chosen = splitList(s["collections"]);
      const list = chosen.length ? ctx.collections.filter((c) => chosen.some((v) => matches(v, c))) : ctx.collections.slice(0, 8);
      const cards = section.blocks.filter((b) => b.type === "collection_card");
      node = (
        <section style={pad}>
          <Container>
            {str(s["title"]) ? <h2 style={{ marginBottom: 20 }}>{str(s["title"])}</h2> : null}
            <div className="v2-grid" style={{ display: "grid", gap: "var(--grid-gap)", gridTemplateColumns: `repeat(var(--v2-cols, ${num(s["columns"], 3)}), minmax(0, 1fr))` }}>
              {cards.length ? cards.map((b, i) => <BlockRenderer key={b.id} block={b} ctx={ctx} index={i} />) : list.map((c, i) => {
                const img = ctx.products[i]?.coverUrl ?? null;
                const shape = str(s["shape"]);
                const ratio = shape === "circle" ? "1/1" : s["image_ratio"] === "portrait" ? "3/4" : s["image_ratio"] === "landscape" ? "4/3" : "1/1";
                return (
                  <a key={c.id} href={`/s/${ctx.storeSlug}/c/${c.slug}`} className={s["hover_zoom"] !== false ? "v2-zoom" : undefined} style={{ display: "block", color: "inherit", textDecoration: "none", textAlign: "center", minWidth: 0 }}>
                    <div style={{ position: "relative", aspectRatio: ratio, borderRadius: shape === "circle" ? 999 : "var(--border-radius)", overflow: "hidden", background: "color-mix(in srgb, var(--color-primary) 10%, transparent)" }}>
                      {img ? <img src={img} alt="" loading="lazy" decoding="async" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                      {shape === "tile" ? <span style={{ position: "absolute", inset: "auto 0 0 0", padding: "40px 16px 16px", background: "linear-gradient(transparent, rgba(0,0,0,.6))", color: "#fff", fontFamily: "var(--font-heading)", fontSize: 22, textAlign: "left" }}>{c.title}</span> : null}
                    </div>
                    {shape !== "tile" ? <p style={{ marginTop: 10, fontWeight: 600 }}>{c.title}</p> : null}
                  </a>
                );
              })}
            </div>
          </Container>
        </section>
      );
      break;
    }
    case "rich_text":
      node = (
        <section style={{ ...pad, background: color(s["bg_color"]) }}>
          <Container style={{ maxWidth: num(s["max_width"], 720), textAlign: (str(s["content_position"]) || "center") as CSSProperties["textAlign"] }}>{blocks()}</Container>
        </section>
      );
      break;
    case "marquee": {
      const items = str(s["items"]).split("\n").map((x) => x.trim()).filter(Boolean);
      const row = items.flatMap((x, i) => [<span key={`t${i}`}>{x}</span>, <span key={`s${i}`} aria-hidden style={{ opacity: 0.6 }}>{str(s["separator"]) || "✦"}</span>]);
      node = (
        <div style={{ overflow: "hidden", background: color(s["bg_color"]) ?? "var(--color-primary)", color: color(s["text_color"]) ?? "var(--color-background)", padding: "14px 0", fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 18, letterSpacing: ".04em" }}>
          <div className="v2-marquee" style={{ display: "flex", gap: 28, width: "max-content", animationDuration: `${Math.max(5, num(s["speed"], 25))}s` }}>{row}{row.map((n, i) => <span key={`d${i}`} aria-hidden>{n}</span>)}</div>
        </div>
      );
      break;
    }
    case "flash_sale": {
      const today = new Date().toISOString().slice(0, 10);
      const cd = { end_date: str(s["end_date"]) || today, end_time: str(s["end_time"]) || "23:59", style: "box", label_days: "Gün", label_hours: "Saat", label_minutes: "Dk", label_seconds: "Sn", zero_message: "Kampanya sona erdi", show_after_zero: "message" } as V2Settings;
      const sale = ctx.products.filter((p) => Number(p.compare_at_price ?? 0) > Number(p.base_price));
      const list = (sale.length ? sale : ctx.products).slice(0, Math.max(2, num(s["products_count"], 4)));
      node = (
        <section style={{ ...pad, background: color(s["bg_color"]) }}>
          <Container>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
              <div style={{ minWidth: 0 }}><h2 style={{ color: "var(--color-primary)" }}>{str(s["title"])}</h2><p style={{ margin: "4px 0 0", color: "var(--color-text-muted)" }}>{str(s["subtitle"])}</p></div>
              <Countdown s={cd} />
            </div>
            <div className="v2-grid" style={{ display: "grid", gap: "var(--grid-gap)", gridTemplateColumns: "repeat(var(--v2-cols, 4), minmax(0, 1fr))" }}>
              {list.map((p) => <div key={p.id} style={{ border: "2px solid var(--color-primary)", borderRadius: "var(--border-radius)", padding: 8 }}><ProductCard product={p} ctx={ctx} s={{ card_style: "bold", badges: true, stock_bar: true, quick_view: true } as V2Settings} /></div>)}
              {!list.length ? <p style={{ opacity: 0.6 }}>Henüz ürün yok.</p> : null}
            </div>
          </Container>
        </section>
      );
      break;
    }
    case "trust_badges":
    case "icon_features": {
      const items = str(s["items"]).split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((p) => p[1]);
      const cardish = section.type === "icon_features" && s["style"] === "card";
      node = (
        <section style={{ ...(section.type === "trust_badges" ? { paddingTop: 32, paddingBottom: 32 } : pad), background: color(s["bg_color"]) }}>
          <Container>
            {str(s["title"]) ? <h2 style={{ marginBottom: 24, textAlign: "center" }}>{str(s["title"])}</h2> : null}
            <div style={{ display: "grid", gap: "var(--grid-gap)", gridTemplateColumns: `repeat(auto-fit, minmax(${section.type === "trust_badges" ? 200 : 220}px, 1fr))` }}>
              {items.map(([icon, title, text], i) => (
                <div key={i} style={{ display: "flex", flexDirection: section.type === "trust_badges" ? "row" : "column", alignItems: section.type === "trust_badges" ? "center" : "flex-start", gap: 12, textAlign: "left", ...(cardish ? { padding: 24, borderRadius: "var(--border-radius)", border: "1px solid var(--color-border)", background: "var(--color-surface)" } : {}) }}>
                  <span aria-hidden style={{ fontSize: 28, width: 52, height: 52, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: cardish ? "var(--border-radius)" : 999, background: cardish ? "var(--gradient-primary)" : "color-mix(in srgb, var(--color-primary) 12%, transparent)" }}>{icon}</span>
                  <div style={{ minWidth: 0 }}><p style={{ margin: 0, fontWeight: 700 }}>{title}</p><p style={{ margin: "2px 0 0", fontSize: 14, color: "var(--color-text-muted)" }}>{text}</p></div>
                </div>
              ))}
            </div>
          </Container>
        </section>
      );
      break;
    }
    case "stats_counter": {
      const items = str(s["items"]).split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((p) => p[0]);
      node = (
        <section style={{ ...pad, background: color(s["bg_color"]) }}>
          <Container>
            {str(s["title"]) ? <h2 style={{ marginBottom: 24, textAlign: "center" }}>{str(s["title"])}</h2> : null}
            <div style={{ display: "grid", gap: "var(--grid-gap)", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", textAlign: "center" }}>
              {items.map(([value, label], i) => <div key={i}><CountUp value={value ?? ""} /><p style={{ margin: "4px 0 0", color: "var(--color-text-muted)" }}>{label}</p></div>)}
            </div>
          </Container>
        </section>
      );
      break;
    }
    case "faq": {
      const items = str(s["items"]).split("\n").map((l) => l.split("|")).filter((p) => p[0]?.trim() && p[1]);
      node = (
        <section style={pad}>
          <Container style={{ maxWidth: 800 }}>
            {str(s["title"]) ? <h2 style={{ marginBottom: 20, textAlign: "center" }}>{str(s["title"])}</h2> : null}
            {items.map(([q, a], i) => (
              <details key={i} className="v2-faq" style={{ borderBottom: "1px solid var(--color-border)" }}>
                <summary style={{ minHeight: 56, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, cursor: "pointer", fontWeight: 600, listStyle: "none" }}>{q?.trim()}<span aria-hidden className="v2-faq-icon">+</span></summary>
                <p style={{ margin: "0 0 16px", color: "var(--color-text-muted)" }}>{a?.trim()}</p>
              </details>
            ))}
          </Container>
        </section>
      );
      break;
    }
    case "comparison_table": {
      const cols = str(s["items"]).split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((p) => p[0]);
      node = (
        <section style={pad}>
          <Container>
            {str(s["title"]) ? <h2 style={{ marginBottom: 24, textAlign: "center" }}>{str(s["title"])}</h2> : null}
            <div style={{ display: "grid", gap: "var(--grid-gap)", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", alignItems: "stretch" }}>
              {cols.map(([name, price, feats, hl, link], i) => {
                const hot = Boolean(hl);
                return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", padding: 24, borderRadius: "var(--border-radius)", border: hot ? "2px solid var(--color-primary)" : "1px solid var(--color-border)", background: hot ? "color-mix(in srgb, var(--color-primary) 5%, var(--color-background))" : "var(--color-background)", position: "relative" }}>
                    {hot ? <span style={{ position: "absolute", top: -12, left: 24, background: "var(--gradient-primary)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>Önerilen</span> : null}
                    <p style={{ margin: 0, fontWeight: 700 }}>{name}</p>
                    <p style={{ margin: "8px 0 16px", fontFamily: "var(--font-heading)", fontSize: 32, fontWeight: 800 }}>{price}</p>
                    <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", display: "grid", gap: 8, flex: 1 }}>{(feats ?? "").split(";").filter(Boolean).map((f) => <li key={f} style={{ fontSize: 14 }}><span style={{ color: "var(--color-success)", marginRight: 6 }}>✓</span>{f}</li>)}</ul>
                    <a className="v2-btn" href={href(ctx, link || "/products")} style={{ minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--btn-border-radius)", fontWeight: 600, textDecoration: "none", ...(hot ? { background: "var(--btn-bg)", color: "var(--btn-text)" } : { border: "1.5px solid currentColor", color: "inherit" }) }}>Seç</a>
                  </div>
                );
              })}
            </div>
          </Container>
        </section>
      );
      break;
    }
    case "logo_strip": {
      const items = str(s["items"]).split("\n").map((x) => x.trim()).filter(Boolean);
      node = (
        <section style={{ paddingTop: 40, paddingBottom: 40, borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" }}>
          <Container>
            {str(s["title"]) ? <p style={{ textAlign: "center", fontSize: 12, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 20 }}>{str(s["title"])}</p> : null}
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: "24px 48px", filter: s["grayscale"] !== false ? "grayscale(1)" : undefined, opacity: 0.8 }}>
              {items.map((x) => safeUrl(x) && /^(https?:)?\/\//.test(x) ? <img key={x} src={safeUrl(x)} alt="" loading="lazy" style={{ height: 32, width: "auto" }} /> : <span key={x} style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontStyle: "italic" }}>{x}</span>)}
            </div>
          </Container>
        </section>
      );
      break;
    }
    case "instagram_grid": {
      const urls = splitList(s["images"]).map(safeUrl).filter(Boolean);
      const imgs = (urls.length ? urls : ctx.products.map((p) => p.coverUrl ?? "").filter(Boolean)).slice(0, 9);
      const link = safeUrl(s["profile_url"]);
      node = (
        <section style={pad}>
          <Container>
            <div style={{ textAlign: "center", marginBottom: 20 }}>{str(s["title"]) ? <h2>{str(s["title"])}</h2> : null}{str(s["handle"]) ? (link ? <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-primary)", fontWeight: 600 }}>{str(s["handle"])}</a> : <p style={{ margin: "4px 0 0", color: "var(--color-primary)", fontWeight: 600 }}>{str(s["handle"])}</p>) : null}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
              {Array.from({ length: 9 }, (_, i) => imgs[i] ? <img key={i} src={imgs[i]} alt="" loading="lazy" decoding="async" style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", borderRadius: "var(--border-radius-sm)" }} /> : <div key={i} style={{ aspectRatio: "1/1", borderRadius: "var(--border-radius-sm)", background: "color-mix(in srgb, var(--color-primary) 10%, transparent)" }} />)}
            </div>
          </Container>
        </section>
      );
      break;
    }
    case "lookbook":
      node = <Lookbook s={s} ctx={ctx} pad={pad} />;
      break;
    case "featured_product": {
      const chosen = str(s["product_id"]);
      const p = (chosen ? ctx.products.find((x) => matches(chosen, x)) : null) ?? ctx.products[0];
      node = (
        <section style={pad}>
          <Container>
            {p ? (
              <div className="v2-split" style={{ display: "flex", gap: 40, alignItems: "center", flexDirection: s["image_position"] === "right" ? "row-reverse" : "row" }}>
                <div style={{ flex: 1, minWidth: 0 }}>{p.coverUrl ? <img src={p.coverUrl} alt={p.title} loading="lazy" decoding="async" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: "var(--border-radius)" }} /> : <div style={{ aspectRatio: "3/4", background: "var(--color-surface)" }} />}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {str(s["eyebrow"]) ? <p style={{ margin: 0, fontSize: 12, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--color-secondary)" }}>{str(s["eyebrow"])}</p> : null}
                  <h2 style={{ margin: "8px 0 12px" }}>{p.title}</h2>
                  <p style={{ fontSize: 20, margin: "0 0 16px" }}>{formatMoney(Number(p.base_price), p.currency ?? ctx.currency)}</p>
                  {p.description ? <p style={{ color: "var(--color-text-muted)", margin: "0 0 16px" }}>{str(p.description).replace(/<[^>]+>/g, "").slice(0, 280)}</p> : null}
                  {str(s["model_info"]) ? <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "0 0 20px" }}>📏 {str(s["model_info"])}</p> : null}
                  <a className="v2-btn" href={`/s/${ctx.storeSlug}/p/${p.slug}`} style={{ display: "inline-flex", minHeight: 44, alignItems: "center", padding: "var(--btn-padding-y) var(--btn-padding-x)", borderRadius: "var(--btn-border-radius)", background: "var(--btn-bg)", color: "var(--btn-text)", textDecoration: "none", fontWeight: 600 }}>{str(s["button_text"]) || "Ürünü incele"}</a>
                </div>
              </div>
            ) : <p style={{ opacity: 0.6 }}>Henüz ürün yok.</p>}
          </Container>
        </section>
      );
      break;
    }
    default:
      node = renderPremiumSection(section, ctx, pad, ({ product, s: cs }) => <ProductCard product={product} ctx={ctx} s={cs} showPrice />);
  }
  return <div className="v2-sec" {...pickable(ctx, "section", section.id)}>{node}</div>;
}

/** Görünür olunca hedef sayıya kadar sayar; hareket azaltma tercihine saygı gösterir. */
function CountUp({ value }: { value: string }) {
  const m = value.match(/^([^\d]*)([\d.,]+)(.*)$/);
  const target = m ? Number(m[2]!.replace(/\./g, "").replace(",", ".")) : NaN;
  const decimals = m && /[.,]\d+$/.test(m[2]!) && !/^\d{1,3}(\.\d{3})+$/.test(m[2]!) ? (m[2]!.split(/[.,]/)[1] ?? "").length : 0;
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!Number.isFinite(target) || !ref.current) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setShown(target); return; }
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (t: number) => { const k = Math.min(1, (t - start) / 1400); setShown(target * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    });
    io.observe(ref.current);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [target]);
  const text = !m || !Number.isFinite(target) ? value : `${m[1]}${(shown ?? target).toLocaleString("tr-TR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${m[3]}`;
  return <div ref={ref} style={{ fontFamily: "var(--font-heading)", fontSize: 40, fontWeight: 800, color: "var(--color-primary)", fontVariantNumeric: "tabular-nums" }}>{text}</div>;
}

function Lookbook({ s, ctx, pad }: { s: V2Settings; ctx: V2RenderContext; pad: CSSProperties }) {
  const [open, setOpen] = useState<number | null>(null);
  const parsed = str(s["items"]).split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((p) => safeUrl(p[0]));
  const tiles = (parsed.length ? parsed.map(([img, slug, x, y]) => ({ img: safeUrl(img), product: ctx.products.find((p) => p.slug === slug), x: num(x, 50), y: num(y, 60) }))
    : ctx.products.filter((p) => p.coverUrl).slice(0, 6).map((p) => ({ img: p.coverUrl!, product: p, x: 50, y: 62 })));
  return (
    <section style={pad}>
      <Container>
        {str(s["title"]) ? <h2 style={{ marginBottom: 20, textAlign: "center" }}>{str(s["title"])}</h2> : null}
        <div className="v2-masonry" style={{ columnGap: "var(--grid-gap)" }}>
          {tiles.map((t, i) => (
            <div key={i} style={{ position: "relative", breakInside: "avoid", marginBottom: "var(--grid-gap)" }}>
              <img src={t.img} alt="" loading="lazy" decoding="async" style={{ width: "100%", display: "block", aspectRatio: i % 3 === 1 ? "3/4" : i % 3 === 2 ? "1/1" : "4/5", objectFit: "cover", borderRadius: "var(--border-radius-sm)" }} />
              {t.product ? (
                <>
                  <button type="button" aria-label={`${t.product.title} ürününü göster`} aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} style={{ position: "absolute", left: `${t.x}%`, top: `${t.y}%`, transform: "translate(-50%,-50%)", width: 44, height: 44, borderRadius: 999, border: "2px solid #fff", background: "rgba(0,0,0,.35)", color: "#fff", fontSize: 20, cursor: "pointer" }}>+</button>
                  {open === i ? (
                    <a href={`/s/${ctx.storeSlug}/p/${t.product.slug}`} style={{ position: "absolute", left: 12, right: 12, bottom: 12, display: "flex", gap: 10, alignItems: "center", padding: 10, background: "var(--color-background)", color: "var(--color-text)", textDecoration: "none", borderRadius: "var(--border-radius-sm)", boxShadow: "0 10px 30px rgba(0,0,0,.2)" }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.product.title}</span>
                      <strong style={{ fontSize: 13 }}>{formatMoney(Number(t.product.base_price), t.product.currency ?? ctx.currency)}</strong>
                    </a>
                  ) : null}
                </>
              ) : null}
            </div>
          ))}
        </div>
        {!tiles.length ? <p style={{ opacity: 0.6, textAlign: "center" }}>Lookbook için görsel ekleyin.</p> : null}
      </Container>
    </section>
  );
}

function AnnouncementBar({ s, ctx }: { s: V2Settings; ctx: V2RenderContext }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const visibility = s["show_on"] === "mobile" ? "v2-only-mobile" : s["show_on"] === "desktop" ? "v2-only-desktop" : "";
  const text = safeUrl(s["link_url"]) ? <a href={href(ctx, s["link_url"])} style={{ color: "inherit" }}>{str(s["text"])}</a> : str(s["text"]);
  return (
    <div className={visibility} style={{ background: color(s["bg_color"]) ?? "var(--color-primary)", color: color(s["text_color"]) ?? "var(--color-background)", fontSize: 13, textAlign: "center", padding: "8px 40px", position: "relative" }}>
      {text}
      {s["is_dismissible"] !== false ? <button type="button" aria-label="Kapat" onClick={() => setHidden(true)} style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, background: "transparent", border: 0, color: "inherit", cursor: "pointer" }}>×</button> : null}
    </div>
  );
}

const RESPONSIVE_CSS =
  ".v2-theme .v2-rich p{margin:0 0 .6em}" +
  ".v2-theme .v2-card-alt{opacity:0;transition:opacity .35s ease}.v2-theme .v2-card:hover .v2-card-alt{opacity:1}" +
  ".v2-theme .v2-zoom img{transition:transform .5s ease}.v2-theme .v2-zoom:hover img{transform:scale(1.06)}" +
  "@keyframes v2-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}.v2-theme .v2-marquee{animation:v2-marquee linear infinite}" +
  ".v2-theme .v2-faq summary::-webkit-details-marker{display:none}.v2-theme .v2-faq[open] .v2-faq-icon{transform:rotate(45deg)}.v2-theme .v2-faq-icon{transition:transform .2s;font-size:22px}" +
  ".v2-theme .v2-masonry{columns:3}.v2-theme .v2-scroll>*{scroll-snap-align:start}" +
  "@media (prefers-reduced-motion:reduce){.v2-theme .v2-marquee{animation:none}.v2-theme *{transition:none !important}}" +
  "@media (max-width:767px){.v2-theme .v2-masonry{columns:2}.v2-theme .v2-scroll{grid-auto-columns:72% !important}}" +
  "@media (max-width:767px){.v2-theme .v2-grid{--v2-cols:2 !important}.v2-theme .v2-split{flex-direction:column !important}.v2-theme .v2-split>div{flex:1 1 auto !important;width:100%}.v2-theme .v2-only-desktop{display:none}}" +
  "@media (min-width:768px){.v2-theme .v2-only-mobile{display:none}}" +
  ".v2-theme [data-v2-section],.v2-theme [data-v2-block]{position:relative}";

const EDIT_CSS =
  ".v2-edit [data-v2-section]{cursor:pointer}.v2-edit [data-v2-section]:hover{outline:2px dashed color-mix(in srgb,var(--color-primary) 60%,transparent);outline-offset:-2px}" +
  ".v2-edit [data-v2-block]:hover{outline:1px dashed color-mix(in srgb,var(--color-primary) 80%,transparent)}" +
  ".v2-edit [data-v2-selected]{outline:2px solid var(--color-primary) !important;outline-offset:-2px}";

/** Google Fonts yalnız desteklenen ağırlıkları kabul eder; desteklenmeyen istek tüm dosyayı düşürür. */
const HEAVY_FONTS = new Set(["Nunito", "Noto Serif", "Noto Sans", "Orbitron", "Exo 2", "Roboto Condensed", "Shippori Mincho", "Inter", "Plus Jakarta Sans", "Playfair Display", "Jost", "DM Sans", "Source Sans 3", "Manrope", "Outfit", "Sora", "Work Sans", "Poppins"]);
const fontWeights = (font: string) => (font === "Bebas Neue" || font === "Share Tech Mono" ? "400" : font === "Cormorant Garamond" ? "300;400;500;600;700" : font === "Libre Baskerville" ? "400;700" : HEAVY_FONTS.has(font) ? "400;500;600;700;800" : "400;500;600;700");

/** Sayfa → bölümler → bloklar. Global ayarlar CSS değişkenlerine dönüşür. */
export function PageRenderer({ sections, settings, ctx, className }: { sections: V2Section[]; settings: V2Settings; ctx: V2RenderContext; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fx = fxOf(settings);
  const usesAccent = sections.some((sec) => sec.blocks.some((b) => b.settings["font"] === "accent"));
  const usesMono = sections.some((sec) => sec.type === "comparison_table") || fx === "nexus";
  const fonts = [str(settings["font_heading"]), str(settings["font_body"]), ...(usesAccent ? [str(settings["font_accent"]) || "Caveat"] : []), ...(usesMono ? [str(settings["font_mono"])] : [])].filter((font) => font && font !== "Inter" && /^[a-zA-Z0-9 ]+$/.test(font));
  return (
    <div ref={rootRef} className={`v2-theme${fx ? ` v2-fx-${fx}` : ""}${ctx.editing ? " v2-edit" : ""}${className ? ` ${className}` : ""}`} data-theme={darkModeOf(settings) === "on" ? "dark" : undefined}>
      {fonts.length ? <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?${[...new Set(fonts)].map((font) => `family=${encodeURIComponent(font)}:wght@${fontWeights(font)}`).join("&")}&display=swap`} /> : null}
      <style dangerouslySetInnerHTML={{ __html: v2CssVars(settings) + RESPONSIVE_CSS + (fx ? FX_CSS : "") + (ctx.editing ? EDIT_CSS : "") }} />
      <ThemeFx fx={fx} rootRef={rootRef} editing={Boolean(ctx.editing)} />
      {sections.filter((s) => s.visible).map((section) => <SectionRenderer key={section.id} section={section} ctx={ctx} />)}
      {sections.length === 0 ? <div style={{ padding: 64, textAlign: "center", opacity: 0.6 }}>Bu sayfada henüz bölüm yok.</div> : null}
    </div>
  );
}
