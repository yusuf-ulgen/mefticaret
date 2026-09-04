/**
 * Site Kit istemci olay köprüsü. Vitrindeki tek bir analitik olayı (page_view,
 * add_to_cart, purchase ...) bağlı tüm servislere standart event adlarıyla
 * gönderilir. Servis yüklü değilse çağrı sessizce yutulur.
 */

type ProviderEntry = { provider: string; config: Record<string, string> };

let activeProviders: ProviderEntry[] = [];

export function setSiteKitProviders(providers: ProviderEntry[]) {
  activeProviders = providers;
}

function has(provider: string) {
  return activeProviders.some((entry) => entry.provider === provider);
}

function configOf(provider: string) {
  return activeProviders.find((entry) => entry.provider === provider)?.config ?? {};
}

export type SiteKitEventName =
  | "page_view"
  | "view_item"
  | "add_to_cart"
  | "begin_checkout"
  | "purchase"
  | "search"
  /** Blog: yazı görüntüleme, okuma tamamlama ve paylaşım. */
  | "blog_view"
  | "blog_read_complete"
  | "share";


export type SiteKitEventPayload = {
  path?: string | undefined;
  value?: number | undefined;
  currency?: string | undefined;
  quantity?: number | undefined;
  itemId?: string | undefined;
  itemName?: string | undefined;
  orderId?: string | undefined;
  searchTerm?: string | undefined;
  /** Paylaşım kanalı (whatsapp, x, facebook, kopyala). */
  method?: string | undefined;
  /** Blog okuma yüzdesi. */
  percent?: number | undefined;
  eventId?: string | undefined;

};

const META_EVENTS: Record<SiteKitEventName, string | null> = {
  page_view: "PageView",
  view_item: "ViewContent",
  add_to_cart: "AddToCart",
  begin_checkout: "InitiateCheckout",
  purchase: "Purchase",
  search: "Search",
  blog_view: "ViewContent",
  blog_read_complete: null,
  share: null,
};

/** Meta'da standart karşılığı olmayan olaylar özel olay olarak gönderilir. */
const META_CUSTOM_EVENTS: Partial<Record<SiteKitEventName, string>> = {
  blog_read_complete: "BlogReadComplete",
  share: "Share",
};

const TIKTOK_EVENTS: Record<SiteKitEventName, string | null> = {
  page_view: null,
  view_item: "ViewContent",
  add_to_cart: "AddToCart",
  begin_checkout: "InitiateCheckout",
  purchase: "CompletePayment",
  search: "Search",
  blog_view: "ViewContent",
  blog_read_complete: null,
  share: null,
};


/** Tek olayı bağlı tüm servislere yayınlar. */
export function pushSiteKitEvent(name: SiteKitEventName, payload: SiteKitEventPayload = {}) {
  if (typeof window === "undefined" || !activeProviders.length) return;
  const w = window as unknown as {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    ttq?: { track: (event: string, data?: unknown) => void; page?: () => void };
    pintrk?: (...args: unknown[]) => void;
  };

  const items = payload.itemId
    ? [
        {
          item_id: payload.itemId,
          item_name: payload.itemName ?? payload.itemId,
          price: payload.value,
          quantity: payload.quantity ?? 1,
        },
      ]
    : undefined;

  try {
    // Otomatik dataLayer — GTM ve özel etiketler için tüm parametreler hazır.
    w.dataLayer?.push({
      event: name,
      page_path: payload.path,
      value: payload.value,
      currency: payload.currency,
      transaction_id: payload.orderId,
      search_term: payload.searchTerm,
      method: payload.method,
      percent_scrolled: payload.percent,
      content_id: payload.itemId,
      content_name: payload.itemName,
      ...(items ? { ecommerce: { items } } : {}),
    });

    if (w.gtag && (has("google_analytics_4") || has("google_ads"))) {
      w.gtag("event", name, {
        ...(payload.path ? { page_path: payload.path } : {}),
        ...(payload.value !== undefined ? { value: payload.value } : {}),
        ...(payload.currency ? { currency: payload.currency } : {}),
        ...(payload.orderId ? { transaction_id: payload.orderId } : {}),
        ...(payload.searchTerm ? { search_term: payload.searchTerm } : {}),
        ...(payload.method ? { method: payload.method } : {}),
        ...(payload.percent !== undefined ? { percent_scrolled: payload.percent } : {}),
        ...(payload.itemId && (name === "blog_view" || name === "blog_read_complete" || name === "share")
          ? { content_id: payload.itemId, content_type: "article" }
          : {}),

        ...(payload.itemName ? { content_name: payload.itemName, item_name: payload.itemName } : {}),
        ...(items ? { items } : {}),

      });

      const ads = configOf("google_ads");
      if (name === "purchase" && ads["conversionId"]) {
        w.gtag("event", "conversion", {
          send_to: ads["conversionLabel"] ? `${ads["conversionId"]}/${ads["conversionLabel"]}` : ads["conversionId"],
          ...(payload.value !== undefined ? { value: payload.value } : {}),
          ...(payload.currency ? { currency: payload.currency } : {}),
          ...(payload.orderId ? { transaction_id: payload.orderId } : {}),
        });
      }
    }

    const metaEvent = META_EVENTS[name];
    const metaCustom = META_CUSTOM_EVENTS[name];
    if (w.fbq && (metaEvent || metaCustom) && has("meta_pixel")) {
      const isBlog = name === "blog_view" || name === "blog_read_complete" || name === "share";
      w.fbq(
        metaEvent ? "track" : "trackCustom",
        metaEvent ?? metaCustom!,
        {
          ...(payload.value !== undefined ? { value: payload.value } : {}),
          ...(payload.currency ? { currency: payload.currency } : {}),
          ...(payload.itemId
            ? { content_ids: [payload.itemId], content_type: isBlog ? "article" : "product" }
            : {}),
          ...(payload.itemName ? { content_name: payload.itemName } : {}),
          ...(payload.method ? { method: payload.method } : {}),
          ...(payload.searchTerm ? { search_string: payload.searchTerm } : {}),
        },
        // Sunucu (CAPI) olayıyla aynı kimlik → Meta tekrarları tekilleştirir.
        payload.eventId ? { eventID: payload.eventId } : undefined,
      );
    }


    const tiktokEvent = TIKTOK_EVENTS[name];
    if (w.ttq && has("tiktok_pixel")) {
      if (name === "page_view") w.ttq.page?.();
      else if (tiktokEvent)
        w.ttq.track(tiktokEvent, {
          ...(payload.value !== undefined ? { value: payload.value } : {}),
          ...(payload.currency ? { currency: payload.currency } : {}),
          ...(payload.itemId ? { content_id: payload.itemId, content_type: "product" } : {}),
        });
    }

    if (w.pintrk && has("pinterest_tag")) {
      const pinEvent =
        name === "purchase" ? "checkout" : name === "add_to_cart" ? "addtocart" : name === "search" ? "search" : "pagevisit";
      w.pintrk("track", pinEvent, {
        ...(payload.value !== undefined ? { value: payload.value } : {}),
        ...(payload.currency ? { currency: payload.currency } : {}),
      });
    }
  } catch {
    /* etiket hatası deneyimi bozmaz */
  }
}

export function siteKitProviderCount() {
  return activeProviders.length;
}
