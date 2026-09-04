/**
 * Blog etkileşim izleme köprüsü. Okunma, okuma tamamlama ve paylaşım olaylarını
 * mağazanın Site Kit üzerinden bağladığı GA4, Google Ads, GTM, Meta Pixel,
 * TikTok ve Pinterest hesaplarına gönderir. Hatalar sessizce yutulur; analitik
 * asla vitrin deneyimini bozmaz.
 */

import { pushSiteKitEvent } from "@/lib/site-kit-client";

export type BlogTrackPayload = {
  postId: string;
  title: string;
  path?: string;
  /** Paylaşım kanalı: whatsapp, x, facebook, linkedin, kopyala. */
  method?: string;
  /** Okuma yüzdesi (25 / 50 / 75 / 100). */
  percent?: number;
};

const sent = new Set<string>();

function once(key: string) {
  if (sent.has(key)) return false;
  sent.add(key);
  return true;
}

function base(payload: BlogTrackPayload) {
  return {
    path: payload.path ?? (typeof window !== "undefined" ? window.location.pathname : undefined),
    itemId: payload.postId,
    itemName: payload.title,
    eventId: `blog-${payload.postId}`,
  };
}

/** Yazı görüntülenmesi (yazı başına bir kez). */
export function trackBlogView(payload: BlogTrackPayload) {
  if (typeof window === "undefined") return;
  if (!once(`view:${payload.postId}`)) return;
  pushSiteKitEvent("blog_view", base(payload));
}

/** Okuma derinliği kilometre taşları — yazı başına her yüzde bir kez. */
export function trackBlogReadProgress(payload: BlogTrackPayload) {
  if (typeof window === "undefined" || !payload.percent) return;
  if (!once(`read:${payload.postId}:${payload.percent}`)) return;
  pushSiteKitEvent("blog_read_complete", { ...base(payload), percent: payload.percent });
}

/** Paylaşım olayı — kanal bilgisiyle. */
export function trackBlogShare(payload: BlogTrackPayload) {
  if (typeof window === "undefined") return;
  pushSiteKitEvent("share", { ...base(payload), method: payload.method ?? "unknown" });
}
