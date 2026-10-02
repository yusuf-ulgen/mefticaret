/** Mefticaret platform sayfaları için Google Analytics (GA4). Mağaza vitrinleri ve paneller hariç. */

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const EXCLUDED = /^\/(s|store|admin|api|preview|demo|magaza|supplier\/panel|ev-hanimlari\/panel|mesajlar|kolay)(\/|$)/;
let ready = false;

export function trackGaPageView(path: string) {
  if (typeof window === "undefined" || EXCLUDED.test(path)) return;
  const id = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY"] as string | undefined;
  if (!id) return;
  if (!ready) {
    ready = true;
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
    document.head.appendChild(script);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", id, { send_page_view: false });
  }
  window.gtag?.("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}
