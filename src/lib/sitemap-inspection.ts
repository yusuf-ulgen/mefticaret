import { XMLParser, XMLValidator } from "fast-xml-parser";
export function inspectSitemap(xml: string) {
  if (XMLValidator.validate(xml) !== true) throw new Error("Geçersiz sitemap XML");
  const parsed = new XMLParser().parse(xml) as {
    urlset?: { url?: Array<{ loc: string }> | { loc: string } };
  };
  if (!parsed.urlset) throw new Error("Sitemap URL envanteri bulunamadı");
  const entries = parsed.urlset.url
    ? Array.isArray(parsed.urlset.url)
      ? parsed.urlset.url
      : [parsed.urlset.url]
    : [];
  const urls = entries.map((entry) => String(entry.loc));
  for (const value of urls) {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Geçersiz sitemap adresi");
  }
  const unique = [...new Set(urls)];
  return {
    total: urls.length,
    unique: unique.length,
    duplicates: urls.length - unique.length,
    products: unique.filter((url) => new URL(url).pathname.includes("/p/")).length,
    pages: unique.filter((url) => new URL(url).pathname.includes("/page/")).length,
    policies: unique.filter((url) => new URL(url).pathname.includes("/politika/")).length,
  };
}
