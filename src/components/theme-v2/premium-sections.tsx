import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import type { SectionProduct } from "@/components/storefront-sections";
import type { V2Section, V2Settings } from "@/lib/theme-v2";

/**
 * Premium temaların (Obsidyen, Aurora, Atlas, Zen, Nexus) ek bölümleri ve
 * hafif (CSS + IntersectionObserver) efekt katmanı. Ağır 3D kütüphaneleri yok.
 */

type Ctx = { storeSlug: string; products: SectionProduct[]; collections: { id: string; title: string; slug: string }[] };
type CardProps = { product: SectionProduct; s: V2Settings };

const str = (v: unknown) => (typeof v === "string" ? v : v === undefined || v === null ? "" : String(v));
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const rows = (v: unknown) => str(v).split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((p) => p[0]);
const safeUrl = (v: unknown) => {
  const s = str(v).trim();
  return /^https?:\/\//i.test(s) || (s.startsWith("/") && !s.startsWith("//")) ? s : "";
};
const link = (slug: string, u: string) => (u.startsWith("/") && !u.startsWith("/s/") ? `/s/${slug}${u === "/" ? "" : u}` : u || `/s/${slug}`);
const HEIGHT: Record<string, string> = { small: "46vh", medium: "62vh", large: "82vh" };
const btn: CSSProperties = { display: "inline-flex", minHeight: 44, alignItems: "center", padding: "var(--btn-padding-y) var(--btn-padding-x)", borderRadius: "var(--btn-border-radius)", background: "var(--btn-bg)", color: "var(--btn-text)", textDecoration: "none", fontWeight: 600, border: 0, cursor: "pointer" };
const chip = (active: boolean): CSSProperties => ({ minHeight: 44, padding: "0 18px", borderRadius: 999, border: "1px solid var(--color-border)", background: active ? "var(--color-text)" : "transparent", color: active ? "var(--color-background)" : "inherit", cursor: "pointer", fontWeight: 600 });

function Wrap({ children, pad }: { children: ReactNode; pad: CSSProperties }) {
  return <section style={pad}><div style={{ maxWidth: "var(--max-width)", margin: "0 auto", padding: "0 20px" }}>{children}</div></section>;
}

function HeroSlider({ s, ctx }: { s: V2Settings; ctx: Ctx }) {
  const slides = rows(s["slides"]).slice(0, 5);
  const [i, setI] = useState(0);
  const touch = useRef<number | null>(null);
  useEffect(() => {
    if (slides.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % slides.length), Math.max(3, num(s["interval"], 5)) * 1000);
    return () => window.clearInterval(t);
  }, [slides.length, s]);
  if (!slides.length) return null;
  const go = (d: number) => setI((x) => (x + d + slides.length) % slides.length);
  return (
    <section aria-roledescription="carousel" aria-label="Kampanyalar" style={{ position: "relative", overflow: "hidden", height: HEIGHT[str(s["height"])] ?? HEIGHT["medium"], background: "var(--color-secondary)" }}
      onTouchStart={(e) => { touch.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => { const x = e.changedTouches[0]?.clientX; if (touch.current !== null && x !== undefined && Math.abs(x - touch.current) > 40) go(x < touch.current ? 1 : -1); touch.current = null; }}>
      {slides.map(([title, sub, cta, url, img], k) => (
        <div key={k} aria-hidden={k !== i} style={{ position: "absolute", inset: 0, opacity: k === i ? 1 : 0, transition: "opacity .7s ease", display: "flex", alignItems: "center", color: "#fff" }}>
          {safeUrl(img) ? <img src={safeUrl(img)} alt="" fetchPriority={k === 0 ? "high" : "low"} loading={k === 0 ? "eager" : "lazy"} decoding="async" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : null}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(0,0,0,.55), rgba(0,0,0,.05))" }} />
          <div style={{ position: "relative", maxWidth: "var(--max-width)", margin: "0 auto", padding: "0 24px", width: "100%" }}>
            <h2 style={{ fontSize: "clamp(28px, 6vw, var(--size-h1))", margin: 0, maxWidth: 620 }}>{title}</h2>
            {sub ? <p style={{ margin: "12px 0 20px", fontSize: 18, maxWidth: 520 }}>{sub}</p> : null}
            {cta ? <a href={link(ctx.storeSlug, safeUrl(url))} tabIndex={k === i ? 0 : -1} style={btn}>{cta}</a> : null}
          </div>
        </div>
      ))}
      {slides.length > 1 ? (
        <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 4 }}>
          {slides.map((_, k) => <button key={k} type="button" aria-label={`Slayt ${k + 1}`} aria-current={k === i} onClick={() => setI(k)} style={{ width: 44, height: 44, background: "transparent", border: 0, cursor: "pointer", display: "grid", placeItems: "center" }}><span style={{ width: k === i ? 22 : 8, height: 8, borderRadius: 99, background: "#fff", opacity: k === i ? 1 : 0.55, transition: "width .3s" }} /></button>)}
        </div>
      ) : null}
    </section>
  );
}

function BeforeAfter({ s, pad }: { s: V2Settings; pad: CSSProperties }) {
  const [pos, setPos] = useState(50);
  const before = safeUrl(s["before_url"]);
  const after = safeUrl(s["after_url"]);
  return (
    <Wrap pad={pad}>
      {str(s["title"]) ? <h2 style={{ textAlign: "center", marginBottom: 20 }}>{str(s["title"])}</h2> : null}
      <div style={{ position: "relative", maxWidth: 820, margin: "0 auto", aspectRatio: "4/3", borderRadius: "var(--border-radius-lg)", overflow: "hidden", background: "var(--color-surface)" }}>
        {after ? <img src={after} alt={str(s["after_label"])} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : null}
        {before ? <img src={before} alt={str(s["before_label"])} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", clipPath: `inset(0 ${100 - pos}% 0 0)` }} /> : null}
        <div aria-hidden style={{ position: "absolute", top: 0, bottom: 0, left: `${pos}%`, width: 2, background: "#fff", boxShadow: "0 0 12px rgba(0,0,0,.35)" }} />
        <span style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 12, padding: "4px 10px", borderRadius: 99 }}>{str(s["before_label"])}</span>
        <span style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 12, padding: "4px 10px", borderRadius: 99 }}>{str(s["after_label"])}</span>
        <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label="Karşılaştırma kaydırıcısı" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "ew-resize", margin: 0 }} />
      </div>
      {str(s["caption"]) ? <p style={{ textAlign: "center", color: "var(--color-text-muted)", marginTop: 12 }}>{str(s["caption"])}</p> : null}
    </Wrap>
  );
}

function SkinQuiz({ s, ctx, pad }: { s: V2Settings; ctx: Ctx; pad: CSSProperties }) {
  const options = rows(s["options"]).slice(0, 6);
  const [pick, setPick] = useState<string | null>(null);
  return (
    <Wrap pad={pad}>
      <div className="v2-glass" style={{ maxWidth: 720, margin: "0 auto", textAlign: "center", padding: 28, borderRadius: "var(--border-radius-lg)", border: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
        <h2 style={{ margin: 0 }}>{str(s["title"])}</h2>
        <p style={{ color: "var(--color-text-muted)", margin: "10px 0 18px" }}>{str(s["question"])}</p>
        <div role="radiogroup" aria-label={str(s["question"])} style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {options.map(([label, tag]) => <button key={label} type="button" role="radio" aria-checked={pick === tag} onClick={() => setPick(tag ?? label ?? "")} style={chip(pick === (tag ?? label))}>{label}</button>)}
        </div>
        {pick ? (
          <p style={{ marginTop: 20 }}>
            {str(s["result_prefix"])}{" "}
            <a href={`/s/${ctx.storeSlug}/search?q=${encodeURIComponent(pick)}`} style={btn}>“{pick}” ürünlerini gör</a>
          </p>
        ) : null}
      </div>
    </Wrap>
  );
}

function Routine({ s, pad }: { s: V2Settings; pad: CSSProperties }) {
  const [tab, setTab] = useState<"morning" | "night">("morning");
  const steps = rows(s[tab]);
  return (
    <Wrap pad={pad}>
      <h2 style={{ textAlign: "center", marginBottom: 16 }}>{str(s["title"])}</h2>
      <div role="tablist" style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
        <button type="button" role="tab" aria-selected={tab === "morning"} onClick={() => setTab("morning")} style={chip(tab === "morning")}>☀️ Sabah</button>
        <button type="button" role="tab" aria-selected={tab === "night"} onClick={() => setTab("night")} style={chip(tab === "night")}>🌙 Gece</button>
      </div>
      <ol role="tabpanel" style={{ listStyle: "none", padding: 0, margin: "0 auto", maxWidth: 640, display: "grid", gap: 10 }}>
        {steps.map(([name, desc], k) => (
          <li key={k} className="v2-glass" style={{ display: "flex", gap: 14, alignItems: "center", padding: 14, borderRadius: "var(--border-radius)", border: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
            <span style={{ flex: "0 0 36px", height: 36, borderRadius: 99, display: "grid", placeItems: "center", background: "var(--gradient-primary)", color: "#fff", fontWeight: 700 }}>{k + 1}</span>
            <span style={{ minWidth: 0 }}><strong>{name}</strong>{desc ? <span style={{ display: "block", color: "var(--color-text-muted)", fontSize: 14 }}>{desc}</span> : null}</span>
          </li>
        ))}
      </ol>
    </Wrap>
  );
}

function embed(u: string) {
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,20})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vm = u.match(/vimeo\.com\/(\d+)/);
  return vm ? `https://player.vimeo.com/video/${vm[1]}` : null;
}

function VideoTestimonials({ s, pad }: { s: V2Settings; pad: CSSProperties }) {
  const items = rows(s["items"]).slice(0, 6);
  return (
    <Wrap pad={pad}>
      <h2 style={{ textAlign: "center", marginBottom: 20 }}>{str(s["title"])}</h2>
      {items.length ? (
        <div className="v2-grid" style={{ display: "grid", gap: "var(--grid-gap)", gridTemplateColumns: "repeat(var(--v2-cols, 3), minmax(0,1fr))" }}>
          {items.map(([name, url, note], k) => {
            const u = safeUrl(url);
            const e = u ? embed(u) : null;
            return (
              <figure key={k} style={{ margin: 0 }}>
                {e ? <iframe src={e} title={`${name} yorumu`} loading="lazy" allowFullScreen style={{ width: "100%", aspectRatio: "9/12", border: 0, borderRadius: "var(--border-radius)" }} />
                  : u ? <video src={u} controls preload="none" playsInline style={{ width: "100%", aspectRatio: "9/12", objectFit: "cover", borderRadius: "var(--border-radius)" }} /> : null}
                <figcaption style={{ marginTop: 8 }}><strong>{name}</strong>{note ? <span style={{ display: "block", color: "var(--color-text-muted)", fontSize: 14 }}>{note}</span> : null}</figcaption>
              </figure>
            );
          })}
        </div>
      ) : <p style={{ textAlign: "center", color: "var(--color-text-muted)" }}>Editörden müşteri videolarını ekleyin.</p>}
    </Wrap>
  );
}

function ProductTabs({ s, ctx, pad, Card }: { s: V2Settings; ctx: Ctx; pad: CSSProperties; Card: (p: CardProps) => ReactNode }) {
  const tabs = rows(s["tabs"]);
  const list = tabs.length ? tabs : [["Tümü", ""]];
  const [tab, setTab] = useState(0);
  const count = Math.max(2, Math.min(16, num(s["products_count"], 8)));
  // Koleksiyon ürünleri vitrin verisinde ayrı gelmediği için sekme, koleksiyon sayfasına bağlantı verir.
  const current = list[tab] ?? list[0]!;
  const col = current[1] ? ctx.collections.find((c) => c.slug === current[1] || c.id === current[1]) : undefined;
  const products = ctx.products.slice(tab * 2 % Math.max(1, ctx.products.length)).concat(ctx.products).slice(0, count);
  const cols = num(s["columns"], 4);
  return (
    <Wrap pad={pad}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{str(s["title"])}</h2>
        {list.length > 1 ? (
          <div role="tablist" style={{ display: "flex", gap: 6, overflowX: "auto" }}>
            {list.map(([name], k) => <button key={k} type="button" role="tab" aria-selected={k === tab} onClick={() => setTab(k)} style={chip(k === tab)}>{name}</button>)}
          </div>
        ) : null}
      </div>
      <div role="tabpanel" className="v2-grid" style={{ display: "grid", gap: "var(--grid-gap)", gridTemplateColumns: `repeat(var(--v2-cols, ${cols}), minmax(0,1fr))` }}>
        {products.map((p) => <Card key={`${tab}-${p.id}`} product={p} s={s} />)}
      </div>
      {!products.length ? <p style={{ opacity: 0.6 }}>Henüz ürün yok.</p> : null}
      {col ? <p style={{ textAlign: "center", marginTop: 16 }}><a href={`/s/${ctx.storeSlug}/c/${col.slug}`} style={btn}>{col.title} tümünü gör</a></p> : null}
    </Wrap>
  );
}

function Community({ s, pad }: { s: V2Settings; pad: CSSProperties }) {
  const links = rows(s["links"]).filter(([, u]) => /^https:\/\//.test(u ?? ""));
  return (
    <Wrap pad={pad}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>{str(s["title"])}</h2>
        {str(s["subtitle"]) ? <p style={{ color: "var(--color-text-muted)" }}>{str(s["subtitle"])}</p> : null}
      </div>
      <div className="v2-grid" style={{ display: "grid", gap: "var(--grid-gap)", gridTemplateColumns: `repeat(var(--v2-cols, ${Math.min(4, Math.max(1, links.length))}), minmax(0,1fr))` }}>
        {links.map(([name, url]) => (
          <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="v2-card" style={{ display: "flex", minHeight: 88, alignItems: "center", justifyContent: "center", border: "1px solid var(--color-border)", borderRadius: "var(--border-radius)", background: "var(--color-surface)", color: "inherit", textDecoration: "none", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>{name} →</a>
        ))}
      </div>
    </Wrap>
  );
}

/** Yeni premium bölüm türlerini çizer; bilinmeyen tür için null döner. */
export function renderPremiumSection(section: V2Section, ctx: Ctx, pad: CSSProperties, Card: (p: CardProps) => ReactNode): ReactNode {
  const s = section.settings;
  switch (section.type) {
    case "hero_slider": return <HeroSlider s={s} ctx={ctx} />;
    case "before_after": return <BeforeAfter s={s} pad={pad} />;
    case "skin_quiz": return <SkinQuiz s={s} ctx={ctx} pad={pad} />;
    case "routine_builder": return <Routine s={s} pad={pad} />;
    case "video_testimonials": return <VideoTestimonials s={s} pad={pad} />;
    case "product_tabs": return <ProductTabs s={s} ctx={ctx} pad={pad} Card={Card} />;
    case "community": return <Community s={s} pad={pad} />;
    default: return null;
  }
}

/* ───────────── Efekt katmanı ───────────── */

export const FX_PRESETS = ["obsidian", "aurora", "atlas", "zen", "nexus"] as const;
export type FxPreset = (typeof FX_PRESETS)[number];
export const fxOf = (s: V2Settings): FxPreset | null => (FX_PRESETS as readonly string[]).includes(str(s["style_preset"])) ? (s["style_preset"] as FxPreset) : null;

/** Kaydırma ile açılma, paralaks, ilerleme çubuğu, özel imleç ve Nexus yükleyicisi. */
export function ThemeFx({ fx, rootRef, editing }: { fx: FxPreset | null; rootRef: React.RefObject<HTMLDivElement | null>; editing: boolean }) {
  const barRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !fx || editing) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    root.classList.add("v2-fx-js");
    const secs = Array.from(root.querySelectorAll<HTMLElement>(":scope > .v2-sec"));
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("v2-in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
    secs.forEach((el, i) => { if (i === 0) el.classList.add("v2-in"); else io.observe(el); });

    const parallax = Array.from(root.querySelectorAll<HTMLElement>(".v2-parallax"));
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (fx === "obsidian") parallax.forEach((img) => { img.style.transform = `translate3d(0, ${Math.min(240, y * 0.25)}px, 0) scale(1.08)`; });
        if (barRef.current) { const h = document.documentElement.scrollHeight - window.innerHeight; barRef.current.style.transform = `scaleX(${h > 0 ? y / h : 0})`; }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    const fine = window.matchMedia("(pointer: fine)").matches;
    const onMove = (e: PointerEvent) => { if (dotRef.current) dotRef.current.style.transform = `translate3d(${e.clientX - 5}px, ${e.clientY - 5}px, 0)`; };
    if (fx === "obsidian" && fine) window.addEventListener("pointermove", onMove, { passive: true });

    if (fx === "nexus" && !sessionStorage.getItem("v2-nexus-boot")) {
      sessionStorage.setItem("v2-nexus-boot", "1");
      setLoading(true);
      window.setTimeout(() => setLoading(false), 1500);
    }
    return () => { io.disconnect(); window.removeEventListener("scroll", onScroll); window.removeEventListener("pointermove", onMove); cancelAnimationFrame(raf); root.classList.remove("v2-fx-js"); };
  }, [fx, rootRef, editing]);

  if (!fx || editing) return null;
  return (
    <>
      {fx === "aurora" || fx === "nexus" ? <div ref={barRef} aria-hidden className="v2-progress" /> : null}
      {fx === "obsidian" ? <div ref={dotRef} aria-hidden className="v2-cursor-dot" /> : null}
      {fx === "nexus" ? <div aria-hidden className="v2-scanlines" /> : null}
      {loading ? <div role="status" aria-label="Yükleniyor" className="v2-preloader"><span className="v2-glitch" data-text="NEXUS">NEXUS</span><i /></div> : null}
    </>
  );
}

const G = (fx: string) => `.v2-theme.v2-fx-${fx}`;
/** Efekt paketlerinin CSS'i; hareket azaltma tercihinde tümü kapanır. */
export const FX_CSS =
  // Ortak: kaydırmayla açılma (JS yoksa içerik hep görünür)
  ".v2-theme.v2-fx-js>.v2-sec{opacity:0;transform:translateY(24px);transition:opacity .8s cubic-bezier(.22,1,.36,1),transform .8s cubic-bezier(.22,1,.36,1)}.v2-theme.v2-fx-js>.v2-sec.v2-in{opacity:1;transform:none}" +
  ".v2-progress{position:fixed;top:0;left:0;right:0;height:3px;z-index:60;transform-origin:0 50%;transform:scaleX(0);background:var(--gradient-primary)}" +
  ".v2-theme .v2-card,.v2-theme .v2-btn{transition:transform .35s cubic-bezier(.22,1,.36,1),box-shadow .35s,border-color .35s}.v2-theme .v2-card:hover{transform:translateY(-3px)}" +
  // Obsidyen
  `${G("obsidian")} .v2-card{border:1px solid var(--color-border);padding:10px;background:var(--color-surface)}${G("obsidian")} .v2-card:hover{border-color:var(--color-primary);box-shadow:0 0 0 1px var(--color-primary),0 18px 50px -18px color-mix(in srgb,var(--color-primary) 55%,transparent)}` +
  `${G("obsidian")} .v2-btn{box-shadow:0 0 24px -6px color-mix(in srgb,var(--color-primary) 60%,transparent)}${G("obsidian")} hr{border-color:var(--color-primary)}` +
  `${G("obsidian")} .v2-parallax{will-change:transform}` +
  ".v2-cursor-dot{position:fixed;left:0;top:0;width:10px;height:10px;border-radius:99px;background:#C9A96E;pointer-events:none;z-index:70;mix-blend-mode:difference;box-shadow:0 0 14px #C9A96E}" +
  // Aurora
  `@keyframes v2-aurora{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}` +
  `${G("aurora")}{background:linear-gradient(120deg,var(--color-background),color-mix(in srgb,var(--color-primary) 10%,var(--color-background)),color-mix(in srgb,var(--color-secondary) 8%,var(--color-background)),var(--color-background));background-size:300% 300%;animation:v2-aurora 24s ease infinite}` +
  `${G("aurora")} .v2-card,${G("aurora")} .v2-glass{background:color-mix(in srgb,#fff 55%,transparent)!important;backdrop-filter:blur(14px) saturate(140%);border:1px solid color-mix(in srgb,#fff 70%,transparent)!important;border-radius:var(--border-radius-lg);padding:10px;box-shadow:0 20px 40px -28px color-mix(in srgb,var(--color-primary) 60%,transparent)}` +
  `${G("aurora")} .v2-btn{background:var(--gradient-primary)!important;background-size:200% 200%!important}${G("aurora")} .v2-btn:hover{background-position:100% 0!important}` +
  `@keyframes v2-sparkle{0%,100%{transform:translateY(0) scale(1);opacity:.8}50%{transform:translateY(-10px) scale(1.2);opacity:1}}` +
  `${G("aurora")} h1::after{content:" ✨";display:inline-block;animation:v2-sparkle 3s ease-in-out infinite}` +
  // Atlas
  `${G("atlas")} .v2-card{border:1px solid var(--color-border);border-radius:var(--border-radius);padding:8px;background:var(--color-background)}${G("atlas")} .v2-card:hover{box-shadow:0 10px 24px -12px rgba(0,0,0,.25)}` +
  `${G("atlas")} .v2-card p{font-size:13px}` +
  // Zen
  `${G("zen")} *{transition-duration:1s!important}${G("zen")} .v2-card:hover{transform:none}` +
  `${G("zen")} img{filter:sepia(.12) saturate(.9) contrast(1.02)}${G("zen")} .v2-card,${G("zen")} .v2-glass{border:.5px solid var(--color-border)}` +
  `${G("zen")}.v2-fx-js>.v2-sec{transform:none;clip-path:inset(0 0 100% 0);transition:clip-path 1.6s cubic-bezier(.65,0,.35,1),opacity 1.6s}${G("zen")}.v2-fx-js>.v2-sec.v2-in{clip-path:inset(0)}` +
  `${G("zen")} .v2-split{gap:clamp(24px,6vw,96px)!important}@media (min-width:768px){${G("zen")} .v2-grid>*:nth-child(even){margin-top:48px}}` +
  // Nexus
  `${G("nexus")}{cursor:crosshair}${G("nexus")} a,${G("nexus")} button{cursor:crosshair}` +
  `${G("nexus")} .v2-card{border:1px solid color-mix(in srgb,var(--color-primary) 35%,var(--color-border));background:var(--color-surface);padding:10px;border-radius:var(--border-radius)}` +
  `${G("nexus")} .v2-card:hover{border-color:var(--color-primary);box-shadow:0 0 24px -4px color-mix(in srgb,var(--color-primary) 55%,transparent),inset 0 0 24px -12px var(--color-secondary)}` +
  `${G("nexus")} .v2-card:hover img{filter:hue-rotate(35deg) saturate(1.3)}${G("nexus")} .v2-btn{box-shadow:0 0 18px -2px var(--btn-bg)}` +
  `${G("nexus")}>.v2-sec{background-image:linear-gradient(color-mix(in srgb,var(--color-primary) 5%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--color-primary) 5%,transparent) 1px,transparent 1px);background-size:44px 44px}` +
  `${G("nexus")} h1,${G("nexus")} h2{text-shadow:0 0 18px color-mix(in srgb,var(--color-primary) 55%,transparent)}` +
  `@keyframes v2-glitch{0%,92%,100%{transform:none;text-shadow:0 0 18px var(--color-primary)}93%{transform:translate(2px,-1px);text-shadow:-3px 0 #BF00FF,3px 0 #00F5FF}96%{transform:translate(-2px,1px);text-shadow:3px 0 #BF00FF,-3px 0 #00F5FF}}` +
  `${G("nexus")} h1{animation:v2-glitch 5s steps(1) infinite}` +
  ".v2-scanlines{position:fixed;inset:0;pointer-events:none;z-index:55;background:repeating-linear-gradient(0deg,rgba(255,255,255,.025) 0 1px,transparent 1px 3px)}" +
  "@keyframes v2-load{from{transform:scaleX(0)}to{transform:scaleX(1)}}" +
  ".v2-preloader{position:fixed;inset:0;z-index:80;display:grid;place-content:center;gap:18px;background:#050510;color:#00F5FF;font-family:var(--font-heading);font-size:32px;letter-spacing:.3em;text-align:center}.v2-preloader i{display:block;width:200px;height:2px;background:linear-gradient(90deg,#00F5FF,#BF00FF);transform-origin:0 50%;animation:v2-load 1.4s ease-out forwards;box-shadow:0 0 12px #00F5FF}.v2-preloader .v2-glitch{animation:v2-glitch 1s steps(1) infinite}" +
  "@media (prefers-reduced-motion:reduce){.v2-theme[class*=v2-fx-]{animation:none!important}.v2-theme h1{animation:none!important}.v2-theme h1::after{animation:none!important}.v2-scanlines,.v2-cursor-dot{display:none}}";
