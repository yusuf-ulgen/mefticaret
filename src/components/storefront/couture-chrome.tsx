import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Heart, Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { storefrontQuery } from "@/lib/storefront-queries";
import { storefrontMenuQuery } from "@/lib/menus-queries";
import { useCart } from "@/lib/cart";
import { useFavorites } from "@/lib/favorites";
import { storefrontUI } from "@/lib/storefront-ui";
import { formatMoney } from "@/lib/mefti";
import type { StorefrontCommerce } from "@/lib/storefront-commerce";
import { menuHref } from "@/components/storefront-chrome";

/** Couture moda teması için üç katlı üst menü, mega menü, anlık arama, mobil menü ve dört sütunlu alt bilgi. */
export function CoutureHeader({ storeSlug, storeName, logoUrl, announcement, flags }: { storeSlug: string; storeName: string; logoUrl?: string | null; announcement?: string; flags: Record<string, boolean> }) {
  const [scrolled, setScrolled] = useState(false);
  const [barOpen, setBarOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mega, setMega] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const cart = useCart();
  const fav = useFavorites();
  const { data } = useQuery(storefrontQuery(storeSlug));
  const { data: menu } = useQuery(storefrontMenuQuery(storeSlug));
  const cartCount = cart.countFor(storeSlug);
  const favCount = fav.countFor(storeSlug);
  const collections = data?.collections ?? [];
  const headerItems = (menu ?? []).filter((m) => m.location === "header");
  const promo = (data?.products ?? []).filter((p) => p.coverUrl).slice(0, 2);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 50);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => { setMenuOpen(false); setMega(false); setSearchOpen(false); }, [pathname]);
  useEffect(() => { try { if (sessionStorage.getItem(`ct-bar-${storeSlug}`) === "0") setBarOpen(false); } catch { /* yok */ } }, [storeSlug]);

  const closeBar = () => { setBarOpen(false); try { sessionStorage.setItem(`ct-bar-${storeSlug}`, "0"); } catch { /* yok */ } };
  const home = { to: "/s/$slug" as const, params: { slug: storeSlug } };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: COUTURE_CSS }} />
      <header className={`ct-header${scrolled ? " ct-scrolled" : ""}`}>
        {announcement && barOpen ? (
          <div className="ct-bar" role="region" aria-label="Duyuru">
            <span>{announcement}</span>
            <button type="button" aria-label="Duyuruyu kapat" onClick={closeBar}><X size={14} /></button>
          </div>
        ) : null}
        <div className="ct-main">
          <button type="button" className="ct-icon ct-mobile" aria-label="Menüyü aç" onClick={() => setMenuOpen(true)}><Menu size={22} /></button>
          <Link {...home} className="ct-logo" aria-label={`${storeName} ana sayfa`}>
            {logoUrl ? <img src={logoUrl} alt={storeName} /> : storeName}
          </Link>
          <div className="ct-search-wrap ct-desktop"><CoutureSearch storeSlug={storeSlug} /></div>
          <nav className="ct-actions" aria-label="Hesap ve sepet">
            <button type="button" className="ct-icon ct-mobile" aria-label="Ara" onClick={() => setSearchOpen(true)}><Search size={21} /></button>
            {flags["wishlist"] !== false ? (
              <Link to="/s/$slug/favorites" params={{ slug: storeSlug }} className="ct-icon ct-desktop" aria-label={`İstek listem${favCount ? `, ${favCount}` : ""}`}>
                <Heart size={21} />{favCount ? <i className="ct-badge">{favCount}</i> : null}
              </Link>
            ) : null}
            <Link to="/s/$slug/account" params={{ slug: storeSlug }} className="ct-icon ct-desktop" aria-label="Hesabım"><UserRound size={21} /></Link>
            <button type="button" className="ct-icon" aria-label={`Sepetim${cartCount ? `, ${cartCount} ürün` : ""}`} onClick={() => storefrontUI.openCart()}>
              <ShoppingBag size={21} />{cartCount ? <i key={cartCount} className="ct-badge ct-bounce">{cartCount}</i> : null}
            </button>
          </nav>
        </div>
        <nav className="ct-nav ct-desktop" aria-label="Kategoriler" onMouseLeave={() => setMega(false)}>
          <button type="button" className="ct-nav-link" aria-expanded={mega} onMouseEnter={() => setMega(true)} onFocus={() => setMega(true)} onClick={() => setMega((v) => !v)}>Kategoriler</button>
          {headerItems.length
            ? headerItems.slice(0, 6).map((m) => <a key={m.id} className="ct-nav-link" href={menuHref(storeSlug, m)} onMouseEnter={() => setMega(false)}>{m.label}</a>)
            : collections.slice(0, 5).map((c) => <Link key={c.id} className="ct-nav-link" to="/s/$slug/c/$collectionSlug" params={{ slug: storeSlug, collectionSlug: c.slug }} onMouseEnter={() => setMega(false)}>{c.title}</Link>)}
          <Link className="ct-nav-link" to="/s/$slug/products" params={{ slug: storeSlug }} onMouseEnter={() => setMega(false)}>Tüm ürünler</Link>
          {mega && collections.length ? (
            <div className="ct-mega" role="region" aria-label="Kategori menüsü">
              <div className="ct-mega-cols">
                {chunk(collections, Math.ceil(collections.length / 3) || 1).slice(0, 3).map((col, i) => (
                  <ul key={i}>{col.map((c) => <li key={c.id}><Link to="/s/$slug/c/$collectionSlug" params={{ slug: storeSlug, collectionSlug: c.slug }}>{c.title}</Link></li>)}</ul>
                ))}
              </div>
              <div className="ct-mega-promo">
                {promo.map((p) => (
                  <Link key={p.id} to="/s/$slug/p/$productSlug" params={{ slug: storeSlug, productSlug: p.slug }} className="ct-mega-card">
                    <img src={p.coverUrl ?? ""} alt="" loading="lazy" /><span>{p.title}</span>
                  </Link>
                ))}
                <Link to="/s/$slug/products" params={{ slug: storeSlug }} className="ct-mega-all">Yeni gelenler →</Link>
              </div>
            </div>
          ) : null}
        </nav>
      </header>

      {searchOpen ? (
        <div className="ct-overlay" role="dialog" aria-modal="true" aria-label="Arama">
          <div className="ct-sheet">
            <div className="ct-sheet-head"><span>Ara</span><button type="button" className="ct-icon" aria-label="Kapat" onClick={() => setSearchOpen(false)}><X size={20} /></button></div>
            <CoutureSearch storeSlug={storeSlug} autoFocus />
          </div>
        </div>
      ) : null}

      {menuOpen ? (
        <div className="ct-overlay" role="dialog" aria-modal="true" aria-label="Menü">
          <CoutureMobileMenu storeSlug={storeSlug} collections={collections} favCount={favCount} flags={flags} onClose={() => setMenuOpen(false)} />
        </div>
      ) : null}
    </>
  );
}

function CoutureMobileMenu({ storeSlug, collections, favCount, flags, onClose }: { storeSlug: string; collections: { id: string; title: string; slug: string }[]; favCount: number; flags: Record<string, boolean>; onClose: () => void }) {
  const [sub, setSub] = useState(false);
  return (
    <div className="ct-sheet ct-full">
      <div className="ct-sheet-head">
        {sub ? <button type="button" className="ct-back" onClick={() => setSub(false)}><ChevronLeft size={18} /> Geri</button> : <span>Menü</span>}
        <button type="button" className="ct-icon" aria-label="Menüyü kapat" onClick={onClose}><X size={20} /></button>
      </div>
      {sub ? (
        <ul className="ct-list">{collections.map((c) => <li key={c.id}><Link to="/s/$slug/c/$collectionSlug" params={{ slug: storeSlug, collectionSlug: c.slug }}>{c.title}</Link></li>)}</ul>
      ) : (
        <>
          <ul className="ct-list">
            {collections.length ? <li><button type="button" onClick={() => setSub(true)}>Kategoriler <ChevronRight size={18} /></button></li> : null}
            <li><Link to="/s/$slug/products" params={{ slug: storeSlug }}>Tüm ürünler <ChevronRight size={18} /></Link></li>
            <li><Link to="/s/$slug/collections" params={{ slug: storeSlug }}>Koleksiyonlar <ChevronRight size={18} /></Link></li>
          </ul>
          <ul className="ct-list ct-list-sm">
            <li><Link to="/s/$slug/account" params={{ slug: storeSlug }}>Hesabım</Link></li>
            <li><Link to="/s/$slug/orders" params={{ slug: storeSlug }}>Siparişlerim</Link></li>
            {flags["wishlist"] !== false ? <li><Link to="/s/$slug/favorites" params={{ slug: storeSlug }}>İstek listem ♡{favCount ? ` (${favCount})` : ""}</Link></li> : null}
          </ul>
          <p className="ct-locale">TR 🇹🇷 · ₺</p>
        </>
      )}
    </div>
  );
}

const RECENT_KEY = (s: string) => `ct-recent-${s}`;
function CoutureSearch({ storeSlug, autoFocus }: { storeSlug: string; autoFocus?: boolean }) {
  const navigate = useNavigate();
  const { data } = useQuery(storefrontQuery(storeSlug));
  const [term, setTerm] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { try { setRecent(JSON.parse(localStorage.getItem(RECENT_KEY(storeSlug)) ?? "[]").slice(0, 5)); } catch { setRecent([]); } }, [storeSlug]);
  useEffect(() => { const id = window.setTimeout(() => setQ(term.trim().toLocaleLowerCase("tr")), 300); return () => window.clearTimeout(id); }, [term]);
  useEffect(() => {
    const on = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", on);
    return () => document.removeEventListener("mousedown", on);
  }, []);
  const products = data?.products ?? [];
  const results = useMemo(() => (q.length < 2 ? [] : products.filter((p) => `${p.title} ${(p.tags ?? []).join(" ")}`.toLocaleLowerCase("tr").includes(q))), [q, products]);
  // Popüler aramalar: mağazanın gerçek ürün etiketlerinden en sık geçenler.
  const popular = useMemo(() => {
    const count = new Map<string, number>();
    products.forEach((p) => (p.tags ?? []).forEach((t) => count.set(t, (count.get(t) ?? 0) + 1)));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t);
  }, [products]);
  const submit = (value: string) => {
    const v = value.trim().slice(0, 80);
    if (!v) return;
    const next = [v, ...recent.filter((r) => r !== v)].slice(0, 5);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY(storeSlug), JSON.stringify(next)); } catch { /* yok */ }
    setOpen(false);
    void navigate({ to: "/s/$slug/search", params: { slug: storeSlug }, search: { q: v } as never });
  };
  return (
    <div className="ct-search" ref={box}>
      <form role="search" onSubmit={(e) => { e.preventDefault(); submit(term); }}>
        <Search size={17} aria-hidden />
        <input autoFocus={autoFocus} value={term} maxLength={80} onChange={(e) => { setTerm(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Ürün, kategori ara" aria-label="Ürün ara" />
      </form>
      {open ? (
        <div className="ct-results">
          {q.length >= 2 ? (
            <>
              <p className="ct-muted">{results.length} sonuç “{term.trim()}” için</p>
              {results.slice(0, 6).map((p) => (
                <Link key={p.id} to="/s/$slug/p/$productSlug" params={{ slug: storeSlug, productSlug: p.slug }} className="ct-result" onClick={() => submit(term)}>
                  {p.coverUrl ? <img src={p.coverUrl} alt="" loading="lazy" /> : <span className="ct-ph" />}
                  <span>{p.title}</span>
                  <b>{formatMoney(Number(p.livePrice ?? p.base_price), p.currency ?? "TRY")}</b>
                </Link>
              ))}
            </>
          ) : (
            <>
              {recent.length ? <><p className="ct-muted">Son aramalar</p><div className="ct-chips">{recent.map((r) => <button type="button" key={r} onClick={() => submit(r)}>{r}</button>)}</div></> : null}
              {popular.length ? <><p className="ct-muted">Popüler aramalar</p><div className="ct-chips">{popular.map((r) => <button type="button" key={r} onClick={() => submit(r)}>{r}</button>)}</div></> : null}
              {!recent.length && !popular.length ? <p className="ct-muted">Aramak için en az 2 harf yazın.</p> : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function CoutureFooter({ storeSlug, storeName, about, commerce, social, children }: { storeSlug: string; storeName: string; about?: string; commerce?: StorefrontCommerce | undefined; social: { label: string; url: string }[]; children?: ReactNode }) {
  const L = (to: string, label: string) => <li key={label}><Link to={to as "/s/$slug/about"} params={{ slug: storeSlug }}>{label}</Link></li>;
  return (
    <footer className="ct-footer">
      {children}
      <div className="ct-foot-grid">
        <div><p className="ct-foot-brand">{storeName}</p><p className="ct-muted">{about || "Kaliteli moda, özenli hizmet."}</p></div>
        <div><p className="ct-foot-h">Yardım</p><ul>{[L("/s/$slug/orders", "Siparişim"), L("/s/$slug/returns", "İade"), L("/s/$slug/faq", "SSS"), L("/s/$slug/contact", "İletişim")]}</ul></div>
        <div><p className="ct-foot-h">Kurumsal</p><ul>{[L("/s/$slug/about", "Hakkımızda"), L("/s/$slug/blog", "Blog"), L("/s/$slug/privacy", "KVKK ve gizlilik"), L("/s/$slug/terms", "Kullanım şartları")]}</ul></div>
        {social.length ? <div><p className="ct-foot-h">Takip et</p><ul>{social.map((s) => <li key={s.label}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a></li>)}</ul></div> : null}
      </div>
      {commerce?.payments.length ? (
        <div className="ct-pay"><span className="ct-muted">Ödeme:</span>{commerce.payments.map((p) => <span key={p.displayName} className="ct-pay-chip">{p.displayName}</span>)}</div>
      ) : null}
      <p className="ct-copy">© {new Date().getFullYear()} {storeName}. Tüm hakları saklıdır. · TR 🇹🇷 · ₺ Türk Lirası</p>
    </footer>
  );
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

const COUTURE_CSS = `
.ct-header{position:sticky;top:0;z-index:40;background:#FAFAF8;transition:all 300ms cubic-bezier(.4,0,.2,1);border-bottom:1px solid #E8E4DC;font-family:'Jost',sans-serif}
.ct-scrolled{background:rgba(255,255,255,.95);backdrop-filter:blur(12px);box-shadow:0 1px 3px rgba(0,0,0,.06)}
.ct-bar{background:#C41E3A;color:#fff;font-size:12px;letter-spacing:.08em;text-align:center;padding:9px 40px;position:relative;transition:margin 300ms}
.ct-bar button{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:0;color:#fff;min-width:32px;min-height:32px;cursor:pointer}
.ct-scrolled .ct-bar{display:none}
.ct-main{max-width:1400px;margin:0 auto;display:flex;align-items:center;gap:24px;padding:18px 24px;transition:padding 300ms}
.ct-scrolled .ct-main{padding:10px 24px}
.ct-logo{font-family:'Cormorant Garamond',serif;font-size:30px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;color:#1A1A1A;text-decoration:none;transition:font-size 300ms;white-space:nowrap}
.ct-logo img{height:40px;transition:height 300ms}.ct-scrolled .ct-logo{font-size:24px}.ct-scrolled .ct-logo img{height:30px}
.ct-search-wrap{flex:1;max-width:560px;margin:0 auto}
.ct-actions{display:flex;gap:4px;margin-left:auto}
.ct-icon{position:relative;display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;background:none;border:0;color:#1A1A1A;cursor:pointer;text-decoration:none}
.ct-badge{position:absolute;top:4px;right:2px;min-width:18px;height:18px;border-radius:999px;background:#1A1A1A;color:#fff;font-size:11px;font-style:normal;display:grid;place-items:center;padding:0 4px}
@keyframes ct-bounce{0%{transform:scale(1)}40%{transform:scale(1.2)}100%{transform:scale(1)}}.ct-bounce{animation:ct-bounce .4s cubic-bezier(.4,0,.2,1)}
.ct-nav{position:relative;max-width:1400px;margin:0 auto;display:flex;justify-content:center;gap:32px;padding:0 24px 12px}
.ct-scrolled .ct-nav{padding-bottom:8px}
.ct-nav-link{background:none;border:0;font:inherit;font-size:13px;letter-spacing:.15em;text-transform:uppercase;color:#1A1A1A;text-decoration:none;padding:6px 0;cursor:pointer;background-image:linear-gradient(#1A1A1A,#1A1A1A);background-size:0 1px;background-repeat:no-repeat;background-position:0 100%;transition:background-size 300ms}
.ct-nav-link:hover,.ct-nav-link[aria-expanded=true]{background-size:100% 1px}
.ct-mega{position:absolute;left:24px;right:24px;top:100%;background:#fff;border:1px solid #E8E4DC;box-shadow:0 8px 32px rgba(0,0,0,.12);padding:28px 32px;display:grid;grid-template-columns:1.2fr 1fr;gap:32px;animation:ct-fade .3s cubic-bezier(.4,0,.2,1)}
@keyframes ct-fade{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.ct-mega-cols{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.ct-mega ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.ct-mega a{color:#1A1A1A;text-decoration:none;font-size:14px}.ct-mega a:hover{color:#C41E3A}
.ct-mega-promo{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:end}
.ct-mega-card{display:grid;gap:8px}.ct-mega-card img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:4px}.ct-mega-card span{font-family:'Cormorant Garamond',serif;font-size:16px}
.ct-mega-all{grid-column:1/-1;font-size:12px!important;letter-spacing:.15em;text-transform:uppercase;border-bottom:1px solid #1A1A1A;justify-self:start}
.ct-search{position:relative}.ct-search form{display:flex;align-items:center;gap:8px;border:1px solid #C8C0B0;border-radius:4px;padding:0 12px;background:#fff}
.ct-search input{flex:1;border:0;outline:0;background:transparent;font:inherit;font-size:14px;min-height:42px;color:#1A1A1A}
.ct-search form:focus-within{border-color:#1A1A1A}
.ct-results{position:absolute;left:0;right:0;top:calc(100% + 6px);background:#fff;border:1px solid #E8E4DC;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.12);padding:14px;z-index:50;max-height:70vh;overflow:auto}
.ct-muted{color:#6B6B6B;font-size:13px;margin:4px 0 8px}
.ct-result{display:grid;grid-template-columns:48px 1fr auto;gap:12px;align-items:center;padding:8px 4px;color:#1A1A1A;text-decoration:none;border-radius:4px}.ct-result:hover{background:#F5F3EE}
.ct-result img,.ct-ph{width:48px;height:60px;object-fit:cover;border-radius:2px;background:#F5F3EE}.ct-result b{font-weight:500;font-size:14px}
.ct-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}.ct-chips button{border:1px solid #E8E4DC;background:#FAFAF8;border-radius:999px;padding:8px 14px;font:inherit;font-size:13px;cursor:pointer;min-height:36px}
.ct-overlay{position:fixed;inset:0;z-index:70;background:rgba(0,0,0,.35);animation:ct-fade .3s}
.ct-sheet{background:#FAFAF8;padding:12px 16px 24px;font-family:'Jost',sans-serif}
.ct-full{position:absolute;inset:0;overflow:auto;animation:ct-slide .3s cubic-bezier(.4,0,.2,1)}@keyframes ct-slide{from{transform:translateX(-100%)}to{transform:none}}
.ct-sheet-head{display:flex;justify-content:space-between;align-items:center;min-height:52px;font-size:13px;letter-spacing:.15em;text-transform:uppercase;border-bottom:1px solid #E8E4DC;margin-bottom:10px}
.ct-back{display:inline-flex;align-items:center;gap:4px;background:none;border:0;font:inherit;letter-spacing:.15em;text-transform:uppercase;min-height:44px;cursor:pointer;color:#1A1A1A}
.ct-list{list-style:none;margin:0 0 16px;padding:0;border-bottom:1px solid #E8E4DC}
.ct-list a,.ct-list button{display:flex;justify-content:space-between;align-items:center;width:100%;min-height:52px;background:none;border:0;font:inherit;font-family:'Cormorant Garamond',serif;font-size:22px;color:#1A1A1A;text-decoration:none;cursor:pointer;text-align:left}
.ct-list-sm a{font-family:'Jost',sans-serif;font-size:15px;min-height:46px}
.ct-locale{color:#6B6B6B;font-size:13px}
.ct-footer{background:#F5F3EE;color:#1A1A1A;margin-top:64px;padding:48px 24px 110px;font-family:'Jost',sans-serif}
.ct-foot-grid{max-width:1400px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:32px}
.ct-foot-brand{font-family:'Cormorant Garamond',serif;font-size:28px;letter-spacing:.15em;text-transform:uppercase;margin:0 0 10px}
.ct-foot-h{font-size:12px;letter-spacing:.15em;text-transform:uppercase;margin:6px 0 14px;font-weight:500}
.ct-footer ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}.ct-footer a{color:#1A1A1A;text-decoration:none;font-size:14px}.ct-footer a:hover{color:#C41E3A}
.ct-pay{max-width:1400px;margin:32px auto 0;padding-top:20px;border-top:1px solid #C8C0B0;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.ct-pay-chip{border:1px solid #C8C0B0;background:#fff;border-radius:2px;padding:4px 10px;font-size:12px}
.ct-copy{max-width:1400px;margin:18px auto 0;color:#6B6B6B;font-size:12px}
.ct-mobile{display:none}
@media (max-width:767px){.ct-desktop{display:none!important}.ct-mobile{display:inline-flex}.ct-main{padding:6px 8px;gap:4px}.ct-scrolled .ct-main{padding:4px 8px}.ct-logo{position:absolute;left:50%;transform:translateX(-50%);font-size:22px}.ct-main{position:relative}.ct-foot-grid{grid-template-columns:1fr 1fr;gap:24px}.ct-footer{padding:36px 16px 110px}.ct-sheet:not(.ct-full){position:absolute;left:0;right:0;top:0}}
@media (min-width:768px) and (max-width:1024px){.ct-nav{gap:20px}}
@media (prefers-reduced-motion:reduce){.ct-header,.ct-header *,.ct-overlay,.ct-full,.ct-mega{transition:none!important;animation:none!important}}
`;
