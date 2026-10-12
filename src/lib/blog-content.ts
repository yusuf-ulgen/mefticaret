/**
 * Blog içeriği yardımcıları (tarayıcı + sunucu): düz metin/HTML ayrımı,
 * kelime sayısı, okunma süresi, içindekiler ve SEO skoru.
 */

export const BLOG_POST_TYPES = {
  article: "Makale",
  news: "Haber",
  tutorial: "Eğitim",
  product: "Ürün yazısı",
  guide: "Rehber",
} as const;
export type BlogPostType = keyof typeof BLOG_POST_TYPES;

export const BLOG_SCHEMA_TYPES = ["BlogPosting", "Article", "NewsArticle", "HowTo"] as const;
export type BlogSchemaType = (typeof BLOG_SCHEMA_TYPES)[number];

export const BLOG_STATUSES = {
  draft: "Taslak",
  review: "İncelemede",
  scheduled: "Zamanlanmış",
  published: "Yayında",
  archived: "Arşiv",
} as const;
export type BlogStatus = keyof typeof BLOG_STATUSES;

/** İçerik HTML mi (zengin düzenleyici) yoksa eski düz metin mi? */
export function isHtmlBody(body: string | null | undefined) {
  return /<(p|h[1-6]|ul|ol|div|blockquote|figure|table|img|pre)[\s>]/i.test(body ?? "");
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Eski düz metin/markdown benzeri yazıyı düzenleyicinin açabileceği HTML'e çevirir. */
export function plainToHtml(text: string) {
  if (!text.trim()) return "";
  return text
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
      if (heading) return `<h${heading[1]!.length}>${escapeHtml(heading[2]!)}</h${heading[1]!.length}>`;
      if (/^[-*]\s/m.test(trimmed) && trimmed.split("\n").every((l) => /^[-*]\s/.test(l.trim()))) {
        return `<ul>${trimmed
          .split("\n")
          .map((l) => `<li><p>${escapeHtml(l.trim().replace(/^[-*]\s+/, ""))}</p></li>`)
          .join("")}</ul>`;
      }
      return `<p>${escapeHtml(trimmed).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

export function htmlToText(html: string) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function contentStats(body: string | null | undefined) {
  const text = isHtmlBody(body) ? htmlToText(body ?? "") : (body ?? "");
  const words = text.split(/\s+/).filter(Boolean).length;
  return { words, minutes: Math.max(1, Math.round(words / 200)), text };
}

export function autoExcerpt(body: string, max = 180) {
  const { text } = contentStats(body);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 80 ? cut.lastIndexOf(" ") : max)}…`;
}

export const headingSlug = (text: string) =>
  text
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "baslik";

/** H2/H3 başlıklarından içindekiler listesi. */
export function extractToc(html: string) {
  const out: Array<{ level: 2 | 3; text: string; id: string }> = [];
  const used = new Set<string>();
  for (const m of html.matchAll(/<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const text = htmlToText(m[2] ?? "");
    if (!text) continue;
    let id = headingSlug(text);
    while (used.has(id)) id = `${id}-2`;
    used.add(id);
    out.push({ level: Number(m[1]) as 2 | 3, text, id });
  }
  return out;
}

/** Başlıklara içindekiler için id ekler. */
export function addHeadingIds(html: string) {
  const used = new Set<string>();
  return html.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi, (_all, level, attrs: string, inner: string) => {
    let id = headingSlug(htmlToText(inner));
    while (used.has(id)) id = `${id}-2`;
    used.add(id);
    const clean = attrs.replace(/\sid="[^"]*"/i, "");
    return `<h${level}${clean} id="${id}">${inner}</h${level}>`;
  });
}

export type SeoCheck = { ok: boolean; label: string; weight: number };

/** 0-100 SEO skoru ve kontrol listesi. */
export function seoScore(input: {
  title: string;
  seoTitle?: string;
  seoDescription?: string;
  coverUrl?: string;
  coverAlt?: string;
  body: string;
  keywords?: string;
  slug?: string;
}) {
  const html = isHtmlBody(input.body) ? input.body : plainToHtml(input.body);
  const title = (input.seoTitle || input.title).trim();
  const desc = (input.seoDescription ?? "").trim();
  const { words, text } = contentStats(html);
  const h2 = (html.match(/<h2[\s>]/gi) ?? []).length;
  const links = [...html.matchAll(/<a[^>]+href="([^"]+)"/gi)].map((m) => m[1] ?? "");
  const internal = links.filter((href) => href.startsWith("/") || href.includes("mefticaret.com")).length;
  const imgs = [...html.matchAll(/<img[^>]*>/gi)].map((m) => m[0]);
  const imgsWithAlt = imgs.filter((tag) => /alt="[^"]+"/i.test(tag)).length;
  const keyword = (input.keywords ?? "").split(",")[0]?.trim().toLocaleLowerCase("tr") ?? "";

  const checks: SeoCheck[] = [
    { ok: title.length >= 30 && title.length <= 60, label: `Başlık uzunluğu ${title.length} karakter (30-60 önerilir)`, weight: 15 },
    { ok: desc.length >= 70 && desc.length <= 160, label: desc ? `Meta açıklama ${desc.length} karakter (70-160 önerilir)` : "Meta açıklama yok", weight: 15 },
    { ok: Boolean(input.coverUrl), label: input.coverUrl ? "Kapak görseli mevcut" : "Kapak görseli yok", weight: 10 },
    { ok: !input.coverUrl || Boolean(input.coverAlt?.trim()), label: "Kapak görseli alt metni", weight: 5 },
    { ok: h2 >= 3, label: `H2 başlık sayısı: ${h2} (en az 3 önerilir)`, weight: 10 },
    { ok: internal >= 1, label: internal ? `${internal} iç bağlantı var` : "İç bağlantı eksik", weight: 10 },
    { ok: imgs.length === 0 || imgsWithAlt === imgs.length, label: imgs.length ? `${imgsWithAlt}/${imgs.length} görselde alt metin` : "İçerikte görsel alt metinleri", weight: 5 },
    { ok: words >= 600, label: `Kelime sayısı: ${words} (en az 600 önerilir)`, weight: 15 },
    {
      ok: Boolean(keyword) && title.toLocaleLowerCase("tr").includes(keyword) && text.toLocaleLowerCase("tr").includes(keyword),
      label: keyword ? `Anahtar kelime "${keyword}" başlıkta ve metinde` : "Anahtar kelime girilmedi",
      weight: 10,
    },
    { ok: Boolean(input.slug) && (input.slug?.length ?? 0) <= 75, label: "Kısa ve okunur adres", weight: 5 },
  ];
  const score = checks.reduce((sum, c) => sum + (c.ok ? c.weight : 0), 0);
  return { score, checks };
}
