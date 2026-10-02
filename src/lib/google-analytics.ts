/** Mefticaret platform sayfaları için Google Analytics (GA4). Mağaza vitrinleri ve paneller hariç. */

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export const GA_ID = "G-5MYE8WYZHZ";
export const GA_EXCLUDED = /^\/(s|store|admin|api|preview|demo|magaza|supplier\/panel|ev-hanimlari\/panel|mesajlar|kolay)(\/|$)/;
/** Sayfa HTML'ine doğrudan yazılan etiket (Google etiket testi bunu arar). */
export const GA_INLINE = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${GA_ID}',{send_page_view:false});`;

let first = true;

export function trackGaPageView(path: string) {
  if (typeof window === "undefined" || GA_EXCLUDED.test(path)) return;
  if (!window.gtag) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);
    // eslint-disable-next-line no-new-func
    new Function(GA_INLINE)();
  }
  first = false;
  window.gtag?.("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}
void first;
