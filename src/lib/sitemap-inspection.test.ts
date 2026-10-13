import { expect, it } from "vitest";
import { inspectSitemap } from "./sitemap-inspection";
it("güncel URL kapsamını ve tekrarları sayar", () => {
  const xml =
    "<urlset><url><loc>https://example.test/s/a/p/one</loc></url><url><loc>https://example.test/s/a/p/one</loc></url><url><loc>https://example.test/s/a/politika/gizlilik</loc></url></urlset>";
  expect(inspectSitemap(xml)).toEqual({
    total: 3,
    unique: 2,
    duplicates: 1,
    products: 1,
    pages: 0,
    policies: 1,
  });
});
it("bozuk XML ve geçersiz protokolü reddeder", () => {
  expect(() => inspectSitemap("<urlset><url>")).toThrow();
  expect(() =>
    inspectSitemap("<urlset><url><loc>javascript:alert(1)</loc></url></urlset>"),
  ).toThrow();
});
