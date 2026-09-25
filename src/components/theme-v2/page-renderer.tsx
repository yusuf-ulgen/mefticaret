import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import type { SectionProduct } from "@/components/storefront-sections";
import { formatMoney } from "@/lib/mefti";
import { v2CssVars, type V2Block, type V2Section, type V2Settings } from "@/lib/theme-v2";

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
  const end = Date.parse(`${str(s.end_date)}T${str(s.end_time) || "23:59"}:00`);
  if (!Number.isFinite(end)) return <p style={{ opacity: 0.6 }}>Geri sayım için bitiş tarihi girin.</p>;
  if (now === null) return <div style={{ height: 56 }} />;
  const left = Math.max(0, end - now);
  if (left === 0) return s.show_after_zero === "hide" ? null : <p style={{ fontWeight: 600 }}>{str(s.zero_message)}</p>;
  const parts: [number, string][] = [
    [Math.floor(left / 86400000), str(s.label_days)],
    [Math.floor(left / 3600000) % 24, str(s.label_hours)],
    [Math.floor(left / 60000) % 60, str(s.label_minutes)],
    [Math.floor(left / 1000) % 60, str(s.label_seconds)],
  ];
  const box = s.style === "box";
  const banner = s.style === "banner";
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

function ProductCard({ product, ctx, s, showPrice = true, showCart = false }: { product: SectionProduct; ctx: V2RenderContext; s: V2Settings; showPrice?: boolean; showCart?: boolean }) {
  const price = Number(product.base_price);
  const compare = Number(product.compare_at_price ?? 0);
  const discount = compare > price ? Math.round((1 - price / compare) * 100) : 0;
  return (
    <a href={`/s/${ctx.storeSlug}/p/${product.slug}`} style={{ display: "block", color: "inherit", textDecoration: "none", position: "relative" }}>
      <div style={{ aspectRatio: s.image_ratio === "portrait" ? "3/4" : "1/1", borderRadius: 12, overflow: "hidden", background: "color-mix(in srgb, var(--color-text) 6%, transparent)" }}>
        {product.coverUrl ? <img src={product.coverUrl} alt={product.title} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
      </div>
      {s.show_badge !== false && discount > 0 ? (
        <span style={{ position: "absolute", top: 8, left: 8, background: "var(--color-error)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>%{discount}</span>
      ) : null}
      <p style={{ margin: "10px 0 2px", fontWeight: 600, fontSize: 14 }}>{product.title}</p>
      {s.show_rating === true ? <p style={{ margin: 0, fontSize: 12, color: "#f59e0b" }}>★★★★★</p> : null}
      {showPrice ? (
        <p style={{ margin: 0, fontSize: 14 }}>
          {formatMoney(price, product.currency ?? ctx.currency)}
          {s.show_compare_price !== false && compare > price ? <s style={{ marginLeft: 6, opacity: 0.5, fontSize: 12 }}>{formatMoney(compare, product.currency ?? ctx.currency)}</s> : null}
        </p>
      ) : null}
      {showCart ? <span className="v2-btn" style={{ display: "inline-block", marginTop: 8, fontSize: 12, padding: "6px 12px", borderRadius: "var(--border-radius)", border: "1px solid var(--color-text)" }}>Sepete ekle</span> : null}
    </a>
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
  const align = s.alignment && s.alignment !== "inherit" ? (str(s.alignment) as CSSProperties["textAlign"]) : undefined;
  let node: ReactNode = null;
  switch (block.type) {
    case "heading": {
      const Tag = (["h1", "h2", "h3", "h4"].includes(str(s.tag)) ? str(s.tag) : "h2") as "h2";
      node = <Tag style={{ textAlign: align, color: color(s.color), fontWeight: num(s.font_weight, 700), marginTop: num(s.margin_top), marginBottom: num(s.margin_bottom, 12), ...(num(s.font_size) > 0 ? { fontSize: num(s.font_size) } : {}) }}>{str(s.text)}</Tag>;
      break;
    }
    case "paragraph":
      node = <div className="v2-rich" style={{ textAlign: align, color: color(s.color), fontSize: num(s.font_size, 16), maxWidth: num(s.max_width) > 0 ? num(s.max_width) : undefined, margin: align === "center" ? "0 auto 12px" : "0 0 12px", lineHeight: 1.6 }}><SafeHtml html={str(s.richtext)} /></div>;
      break;
    case "button": {
      const size = s.size === "small" ? { padding: "6px 14px", fontSize: 13 } : s.size === "large" ? { padding: "14px 28px", fontSize: 16 } : { padding: "var(--button-padding) 22px", fontSize: 14 };
      const style = str(s.style);
      const look: CSSProperties = style === "secondary" ? { background: "var(--color-secondary)", color: "var(--color-background)" }
        : style === "outline" ? { border: "1.5px solid currentColor", background: "transparent", color: "inherit" }
        : style === "ghost" ? { background: "transparent", color: "inherit", textDecoration: "underline" }
        : { background: "var(--color-primary)", color: "var(--color-background)" };
      node = <a className="v2-btn" href={href(ctx, s.link_url)} style={{ display: s.full_width ? "flex" : "inline-flex", justifyContent: "center", alignItems: "center", gap: 6, minHeight: 44, borderRadius: "var(--border-radius)", fontWeight: 600, textDecoration: "none", margin: "4px 4px 4px 0", ...size, ...look }}>{str(s.icon) ? <span aria-hidden>{str(s.icon)}</span> : null}{str(s.text)}</a>;
      break;
    }
    case "image": {
      const src = safeUrl(s.src_url);
      const width = s.width === "fixed" ? num(s.fixed_width, 320) : s.width === "auto" ? "auto" : "100%";
      const img = src ? <img src={src} alt={str(s.alt_text)} loading={s.lazy_load === false ? "eager" : "lazy"} decoding="async" style={{ width, maxWidth: "100%", borderRadius: num(s.border_radius), display: "block" }} /> : <div style={{ width: "100%", aspectRatio: "4/3", borderRadius: num(s.border_radius), background: "color-mix(in srgb, var(--color-text) 8%, transparent)" }} />;
      node = safeUrl(s.link_url) ? <a href={href(ctx, s.link_url)}>{img}</a> : img;
      break;
    }
    case "video":
      node = <VideoEmbed url={str(s.video_url)} />;
      break;
    case "product_card": {
      const chosen = str(s.product_id);
      const product = chosen ? ctx.products.find((p) => matches(chosen, p)) : parentProducts[index] ?? ctx.products[index];
      node = product ? <ProductCard product={product} ctx={ctx} s={s} /> : <div style={{ aspectRatio: "1/1", borderRadius: 12, background: "color-mix(in srgb, var(--color-text) 6%, transparent)" }} />;
      break;
    }
    case "collection_card": {
      const c = ctx.collections.find((x) => matches(str(s.collection_id), x)) ?? ctx.collections[index];
      node = c ? (
        <a href={`/s/${ctx.storeSlug}/c/${c.slug}`} style={{ display: "block", color: "inherit", textDecoration: "none" }}>
          <div style={{ aspectRatio: "1/1", borderRadius: 12, overflow: "hidden", background: "color-mix(in srgb, var(--color-primary) 12%, transparent)" }}>
            {safeUrl(s.image_url) ? <img src={safeUrl(s.image_url)} alt={c.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
          </div>
          <p style={{ marginTop: 8, fontWeight: 600 }}>{c.title}</p>
        </a>
      ) : null;
      break;
    }
    case "icon":
      node = <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "inherit" }}><span style={{ fontSize: num(s.size, 32) }} aria-hidden>{str(s.icon)}</span><span style={{ fontWeight: 600 }}>{str(s.text)}</span></div>;
      break;
    case "divider":
      node = <hr style={{ border: 0, borderTop: `${num(s.thickness, 1)}px solid ${color(s.color) ?? "color-mix(in srgb, var(--color-text) 15%, transparent)"}`, margin: "16px 0" }} />;
      break;
    case "spacer":
      node = <div style={{ height: num(s.height, 32) }} />;
      break;
    case "custom_html":
      node = <SafeHtml html={str(s.html)} />;
      break;
    case "countdown":
      node = <Countdown s={s} />;
      break;
    case "badge": {
      const radius = s.style === "square" ? 2 : s.style === "rounded" ? 6 : 999;
      node = <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: ".06em", padding: "4px 10px", borderRadius: radius, color: color(s.text_color) ?? "var(--color-background)", background: color(s.bg_color) ?? "var(--color-primary)", marginBottom: 12 }}>{str(s.text)}</span>;
      break;
    }
    case "review_stars": {
      const r = Math.max(0, Math.min(5, Math.round(num(s.rating, 5))));
      node = <p style={{ margin: "4px 0 12px" }}><span style={{ color: "#f59e0b", letterSpacing: 2 }}>{"★".repeat(r)}{"☆".repeat(5 - r)}</span> <span style={{ fontSize: 13, opacity: 0.7 }}>{str(s.count_text)}</span></p>;
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
      const bgUrl = safeUrl(s.background_url ?? s.image_url);
      const isVideo = section.type === "hero" && s.background_type === "video" && bgUrl;
      const isImage = (section.type === "banner" || s.background_type === "image") && bgUrl;
      const h = HEIGHTS[str(s.height)] ?? HEIGHTS.medium;
      node = (
        <section style={{ position: "relative", minHeight: section.type === "banner" ? `calc(${h} * .7)` : h, display: "flex", alignItems: "center", overflow: "hidden", color: color(s.text_color) ?? (isImage || isVideo ? "#fff" : undefined), background: color(s.bg_color) ?? "color-mix(in srgb, var(--color-primary) 8%, var(--color-background))" }}>
          {isImage ? <img src={bgUrl} alt="" loading="lazy" decoding="async" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : null}
          {isVideo ? <video src={bgUrl} autoPlay muted loop playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : null}
          {isImage || isVideo ? <div style={{ position: "absolute", inset: 0, background: "#000", opacity: num(s.overlay_opacity, 30) / 100 }} /> : null}
          <Container style={{ position: "relative", width: "100%", padding: `${num(s.padding, 48)}px 20px`, display: "flex", justifyContent: justify(s.content_position) }}>
            <div style={{ maxWidth: 680, textAlign: (str(s.content_position) || "center") as CSSProperties["textAlign"], justifyContent: justify(s.content_position) }}>{blocks()}</div>
          </Container>
        </section>
      );
      break;
    }
    case "featured_products": {
      const count = Math.max(2, Math.min(12, num(s.products_count, 4)));
      const col = str(s.collection_id);
      const products = ctx.products.slice(0, count);
      void col;
      const cols = num(s.columns, 4);
      const cards = section.blocks.filter((b) => b.type === "product_card");
      node = (
        <section style={pad}>
          <Container>
            {str(s.title) ? <h2 style={{ marginBottom: 20 }}>{str(s.title)}</h2> : null}
            {section.blocks.filter((b) => b.type === "heading").map((b) => <BlockRenderer key={b.id} block={b} ctx={ctx} />)}
            <div className="v2-grid" style={{ display: "grid", gap: "var(--grid-gap)", gridTemplateColumns: `repeat(var(--v2-cols, ${cols}), minmax(0, 1fr))`, ["--v2-cols-d" as string]: cols }}>
              {cards.length
                ? cards.map((b, i) => <BlockRenderer key={b.id} block={b} ctx={ctx} index={i} parentProducts={products} />)
                : products.map((p) => <ProductCard key={p.id} product={p} ctx={ctx} s={s} showPrice={s.show_price !== false} showCart={s.show_add_to_cart === true} />)}
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
      const items = str(s.items).split("\n").map((l) => l.split("|")).filter((p) => p[0]?.trim());
      node = (
        <section style={{ ...pad, background: color(s.bg_color) }}>
          <Container>
            {str(s.title) ? <h2 style={{ marginBottom: 20, textAlign: "center" }}>{str(s.title)}</h2> : null}
            <div style={s.layout === "carousel" ? { display: "flex", gap: "var(--grid-gap)", overflowX: "auto", scrollSnapType: "x mandatory" } : { display: "grid", gap: "var(--grid-gap)", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              {items.map(([text, name], i) => (
                <figure key={i} style={{ margin: 0, padding: 20, borderRadius: 16, border: "1px solid color-mix(in srgb, var(--color-text) 12%, transparent)", minWidth: s.layout === "carousel" ? 260 : undefined, scrollSnapAlign: "start" }}>
                  {s.show_stars !== false ? <div style={{ color: "#f59e0b", marginBottom: 8 }}>★★★★★</div> : null}
                  <blockquote style={{ margin: 0 }}>{text?.trim()}</blockquote>
                  <figcaption style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 14 }}>
                    {s.show_avatar !== false ? <span style={{ width: 32, height: 32, borderRadius: 999, background: "var(--color-primary)", color: "var(--color-background)", display: "grid", placeItems: "center", fontSize: 13 }}>{(name ?? "?").trim().charAt(0)}</span> : null}
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
      const posts = (ctx.blogPages ?? []).slice(0, num(s.count, 3));
      node = (
        <section style={pad}>
          <Container>
            {str(s.title) ? <h2 style={{ marginBottom: 20 }}>{str(s.title)}</h2> : null}
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
      const img = safeUrl(s.image_url);
      const ratio = s.image_ratio === "portrait" ? "3/4" : s.image_ratio === "landscape" ? "4/3" : "1/1";
      const width = s.content_width === "narrow" ? "40%" : s.content_width === "wide" ? "60%" : "50%";
      node = (
        <section style={pad}>
          <Container>
            <div className="v2-split" style={{ display: "flex", gap: 32, alignItems: "center", flexDirection: s.image_position === "right" ? "row-reverse" : "row", ["--v2-content" as string]: width }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {img ? <img src={img} alt="" loading="lazy" decoding="async" style={{ width: "100%", aspectRatio: ratio, objectFit: "cover", borderRadius: 16 }} /> : <div style={{ aspectRatio: ratio, borderRadius: 16, background: "color-mix(in srgb, var(--color-primary) 10%, transparent)" }} />}
              </div>
              <div style={{ flex: `0 0 ${width}`, minWidth: 0 }}>{blocks()}</div>
            </div>
          </Container>
        </section>
      );
      break;
    }
    case "video":
      node = <section style={pad}><Container>{str(s.title) ? <h2 style={{ marginBottom: 16 }}>{str(s.title)}</h2> : null}<VideoEmbed url={str(s.video_url)} autoplay={s.autoplay === true} /></Container></section>;
      break;
    case "custom_html":
      node = <section style={pad}><Container><SafeHtml html={str(s.html)} /></Container></section>;
      break;
    case "newsletter":
      node = (
        <section style={{ ...pad, background: color(s.bg_color) ?? "color-mix(in srgb, var(--color-primary) 6%, var(--color-background))" }}>
          <Container style={{ textAlign: "center", maxWidth: 640 }}>
            <h2>{str(s.title)}</h2>
            <p style={{ opacity: 0.75, margin: "8px 0 16px" }}>{str(s.description)}</p>
            <form onSubmit={(e) => e.preventDefault()} style={{ display: "flex", gap: 8, flexDirection: s.layout === "stacked" ? "column" : "row", flexWrap: "wrap" }}>
              <input type="email" required aria-label={str(s.placeholder_text)} placeholder={str(s.placeholder_text)} style={{ flex: 1, minWidth: 200, minHeight: 44, padding: "0 14px", borderRadius: "var(--border-radius)", border: "1px solid color-mix(in srgb, var(--color-text) 25%, transparent)", background: "var(--color-background)", color: "var(--color-text)" }} />
              <button type="submit" className="v2-btn" style={{ minHeight: 44, padding: "0 22px", borderRadius: "var(--border-radius)", background: "var(--color-primary)", color: "var(--color-background)", border: 0, fontWeight: 600 }}>{str(s.button_text)}</button>
            </form>
          </Container>
        </section>
      );
      break;
    case "collection_list": {
      const chosen = splitList(s.collections);
      const list = chosen.length ? ctx.collections.filter((c) => chosen.some((v) => matches(v, c))) : ctx.collections.slice(0, 8);
      const cards = section.blocks.filter((b) => b.type === "collection_card");
      node = (
        <section style={pad}>
          <Container>
            {str(s.title) ? <h2 style={{ marginBottom: 20 }}>{str(s.title)}</h2> : null}
            <div className="v2-grid" style={{ display: "grid", gap: "var(--grid-gap)", gridTemplateColumns: `repeat(var(--v2-cols, ${num(s.columns, 3)}), minmax(0, 1fr))` }}>
              {cards.length ? cards.map((b, i) => <BlockRenderer key={b.id} block={b} ctx={ctx} index={i} />) : list.map((c) => (
                <a key={c.id} href={`/s/${ctx.storeSlug}/c/${c.slug}`} style={{ display: "grid", placeItems: "center", aspectRatio: s.image_ratio === "portrait" ? "3/4" : s.image_ratio === "landscape" ? "4/3" : "1/1", borderRadius: 14, background: "color-mix(in srgb, var(--color-primary) 10%, transparent)", color: "inherit", textDecoration: "none", fontWeight: 600, padding: 12, textAlign: "center" }}>{c.title}</a>
              ))}
            </div>
          </Container>
        </section>
      );
      break;
    }
    case "rich_text":
      node = (
        <section style={{ ...pad, background: color(s.bg_color) }}>
          <Container style={{ maxWidth: num(s.max_width, 720), textAlign: (str(s.content_position) || "center") as CSSProperties["textAlign"] }}>{blocks()}</Container>
        </section>
      );
      break;
  }
  return <div {...pickable(ctx, "section", section.id)}>{node}</div>;
}

function AnnouncementBar({ s, ctx }: { s: V2Settings; ctx: V2RenderContext }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const visibility = s.show_on === "mobile" ? "v2-only-mobile" : s.show_on === "desktop" ? "v2-only-desktop" : "";
  const text = safeUrl(s.link_url) ? <a href={href(ctx, s.link_url)} style={{ color: "inherit" }}>{str(s.text)}</a> : str(s.text);
  return (
    <div className={visibility} style={{ background: color(s.bg_color) ?? "var(--color-primary)", color: color(s.text_color) ?? "var(--color-background)", fontSize: 13, textAlign: "center", padding: "8px 40px", position: "relative" }}>
      {text}
      {s.is_dismissible !== false ? <button type="button" aria-label="Kapat" onClick={() => setHidden(true)} style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, background: "transparent", border: 0, color: "inherit", cursor: "pointer" }}>×</button> : null}
    </div>
  );
}

const RESPONSIVE_CSS =
  ".v2-theme .v2-rich p{margin:0 0 .6em}" +
  "@media (max-width:767px){.v2-theme .v2-grid{--v2-cols:2 !important}.v2-theme .v2-split{flex-direction:column !important}.v2-theme .v2-split>div{flex:1 1 auto !important;width:100%}.v2-theme .v2-only-desktop{display:none}}" +
  "@media (min-width:768px){.v2-theme .v2-only-mobile{display:none}}" +
  ".v2-theme [data-v2-section],.v2-theme [data-v2-block]{position:relative}";

const EDIT_CSS =
  ".v2-edit [data-v2-section]{cursor:pointer}.v2-edit [data-v2-section]:hover{outline:2px dashed color-mix(in srgb,var(--color-primary) 60%,transparent);outline-offset:-2px}" +
  ".v2-edit [data-v2-block]:hover{outline:1px dashed color-mix(in srgb,var(--color-primary) 80%,transparent)}" +
  ".v2-edit [data-v2-selected]{outline:2px solid var(--color-primary) !important;outline-offset:-2px}";

/** Sayfa → bölümler → bloklar. Global ayarlar CSS değişkenlerine dönüşür. */
export function PageRenderer({ sections, settings, ctx, className }: { sections: V2Section[]; settings: V2Settings; ctx: V2RenderContext; className?: string }) {
  const fonts = [str(settings.font_heading), str(settings.font_body)].filter((font) => font && font !== "Inter" && /^[a-zA-Z0-9 ]+$/.test(font));
  return (
    <div className={`v2-theme${ctx.editing ? " v2-edit" : ""}${className ? ` ${className}` : ""}`}>
      {fonts.length ? <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?${[...new Set(fonts)].map((font) => `family=${encodeURIComponent(font)}:wght@400;600;700`).join("&")}&display=swap`} /> : null}
      <style dangerouslySetInnerHTML={{ __html: v2CssVars(settings) + RESPONSIVE_CSS + (ctx.editing ? EDIT_CSS : "") }} />
      {sections.filter((s) => s.visible).map((section) => <SectionRenderer key={section.id} section={section} ctx={ctx} />)}
      {sections.length === 0 ? <div style={{ padding: 64, textAlign: "center", opacity: 0.6 }}>Bu sayfada henüz bölüm yok.</div> : null}
    </div>
  );
}
