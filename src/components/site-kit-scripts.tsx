import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { storefrontSiteKitQuery } from "@/lib/site-kit-queries";
import { setSiteKitProviders } from "@/lib/site-kit-client";

/**
 * Site Kit etiket yerleştirici: mağaza sahibinin panelden bağladığı analitik ve
 * reklam servislerinin script'lerini vitrine otomatik ekler. Mağaza sahibi tek
 * satır kod yazmaz; yalnızca kimlik girer.
 */
function injectScript(id: string, src: string, attrs: Record<string, string> = {}) {
  if (document.getElementById(id)) return;
  const element = document.createElement("script");
  element.id = id;
  element.async = true;
  element.src = src;
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  document.head.appendChild(element);
}

function injectInline(id: string, code: string) {
  if (document.getElementById(id)) return;
  const element = document.createElement("script");
  element.id = id;
  element.text = code;
  document.head.appendChild(element);
}

function injectMeta(id: string, name: string, content: string) {
  if (document.getElementById(id)) return;
  const element = document.createElement("meta");
  element.id = id;
  element.setAttribute("name", name);
  element.setAttribute("content", content);
  document.head.appendChild(element);
}

export function SiteKitScripts({ storeSlug }: { storeSlug: string }) {
  const { data } = useQuery(storefrontSiteKitQuery(storeSlug));

  useEffect(() => {
    if (typeof window === "undefined" || !data?.length) return;
    setSiteKitProviders(data);

    const w = window as unknown as Record<string, unknown> & { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer ?? [];

    for (const entry of data) {
      const cfg = entry.config;
      try {
        switch (entry.provider) {
          case "google_analytics_4": {
            const id = cfg["measurementId"];
            if (!id) break;
            injectScript("sk-ga4", `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
            injectInline(
              "sk-ga4-init",
              `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=window.gtag||gtag;gtag('js',new Date());gtag('config','${id}',{send_page_view:false});`,
            );
            break;
          }
          case "google_ads": {
            const id = cfg["conversionId"];
            if (!id) break;
            injectScript("sk-ads", `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
            injectInline(
              "sk-ads-init",
              `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=window.gtag||gtag;gtag('js',new Date());gtag('config','${id}');`,
            );
            break;
          }
          case "google_tag_manager": {
            const id = cfg["containerId"];
            if (!id) break;
            injectInline("sk-gtm-init", `window.dataLayer=window.dataLayer||[];dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});`);
            injectScript("sk-gtm", `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`);
            break;
          }
          case "google_search_console": {
            const code = cfg["verification"];
            if (code) injectMeta("sk-gsc", "google-site-verification", code);
            break;
          }
          case "meta_pixel": {
            const id = cfg["pixelId"];
            if (!id) break;
            injectInline(
              "sk-meta-init",
              `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');`,
            );
            break;
          }
          case "tiktok_pixel": {
            const id = cfg["pixelId"];
            if (!id) break;
            injectInline(
              "sk-tiktok-init",
              `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(e,n){e[n]=function(){e.push([n].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e){var n="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=n;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};var o=d.createElement("script");o.type="text/javascript";o.async=!0;o.src=n+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${id}');}(window,document,'ttq');`,
            );
            break;
          }
          case "pinterest_tag": {
            const id = cfg["tagId"];
            if (!id) break;
            injectInline(
              "sk-pinterest-init",
              `!function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var n=window.pintrk;n.queue=[],n.version="3.0";var t=document.createElement("script");t.async=!0,t.src=e;var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");pintrk('load','${id}');`,
            );
            break;
          }
          default:
            break;
        }
      } catch {
        /* etiket hatası vitrini bozmaz */
      }
    }
  }, [data]);

  return null;
}
