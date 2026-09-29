/**
 * Blog HTML temizleyici (izin listesi). Zengin düzenleyicinin ürettiği
 * etiketler, veri nitelikleri, görev listesi ve yalnız YouTube/Vimeo
 * gömmeleri korunur; betik, olay nitelikleri ve tehlikeli adresler atılır.
 */

const ALLOWED_TAGS = new Set([
  "a", "b", "blockquote", "br", "code", "div", "em", "figcaption", "figure",
  "h1", "h2", "h3", "h4", "hr", "i", "img", "li", "ol", "p", "pre", "s", "small",
  "span", "strong", "sub", "sup", "table", "tbody", "td", "th", "thead", "tr",
  "u", "ul", "label", "input", "iframe", "colgroup", "col", "mark",
]);

const GLOBAL_ATTRS = new Set(["class", "id", "title", "dir", "lang", "style"]);
const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target"]),
  img: new Set(["src", "alt", "width", "height", "loading"]),
  td: new Set(["colspan", "rowspan", "colwidth"]),
  th: new Set(["colspan", "rowspan", "colwidth", "scope"]),
  input: new Set(["type", "checked", "disabled"]),
  iframe: new Set(["src", "width", "height", "allowfullscreen", "allow", "frameborder"]),
  col: new Set(["style", "span"]),
};

const SAFE_URL = /^(https?:|mailto:|tel:|\/|#)/i;
const SAFE_EMBED = /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com)\//i;

function cleanValue(tag: string, name: string, value: string): string | null {
  const v = value.replace(/[\u0000-\u001f]/g, "").trim();
  if (tag === "iframe" && name === "src") return SAFE_EMBED.test(v) ? v : null;
  if (name === "href" || name === "src") return SAFE_URL.test(v) ? v : null;
  if (name === "style" && /(expression|javascript:|url\s*\()/i.test(v)) return null;
  if (tag === "input" && name === "type") return v === "checkbox" ? v : null;
  return v.slice(0, 500);
}

export function sanitizeBlogHtml(html: string): string {
  const stripped = html.replace(
    /<\s*(script|style|object|embed|template|noscript|svg|math|form)[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi,
    "",
  );
  return stripped.replace(/<[^>]*>?/g, (tag) => {
    const m = /^<\s*(\/?)([a-zA-Z][a-zA-Z0-9-]*)([\s\S]*?)\/?\s*>?$/.exec(tag);
    if (!m) return "";
    const name = (m[2] ?? "").toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return "";
    if (m[1] === "/") return `</${name}>`;
    const attrs: string[] = [];
    const pattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*("[^"]*"|'[^']*'|[^\s"'`=<>]+))?/g;
    let a: RegExpExecArray | null;
    let hasSrc = false;
    while ((a = pattern.exec(m[3] ?? "")) !== null) {
      const attr = (a[1] ?? "").toLowerCase();
      if (attr.startsWith("on") || attr === "formaction") continue;
      if (!attr.startsWith("data-") && !GLOBAL_ATTRS.has(attr) && !TAG_ATTRS[name]?.has(attr)) continue;
      const raw = (a[2] ?? "").replace(/^['"]|['"]$/g, "");
      const value = cleanValue(name, attr, raw);
      if (value === null) continue;
      if (attr === "src") hasSrc = true;
      attrs.push(`${attr}="${value.replace(/"/g, "&quot;")}"`);
    }
    if (name === "iframe" && !hasSrc) return "";
    if (name === "input") attrs.push('disabled="disabled"');
    if (name === "a") attrs.push('rel="noopener noreferrer"');
    if (name === "img") attrs.push('loading="lazy"');
    const self = ["br", "hr", "img", "input", "col"].includes(name);
    return `<${name}${attrs.length ? ` ${attrs.join(" ")}` : ""}${self ? " /" : ""}>`;
  });
}
