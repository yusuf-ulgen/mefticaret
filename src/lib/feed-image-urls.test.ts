import { expect, it } from "vitest";
import { feedImageUrls } from "./feed-image-urls";
import { collectImages } from "./supplier-workflow.server";
import { productImageSources } from "./product-image-sources";

it("B03: preserves spaces, Turkish letters and punctuation in XML image paths", () => {
  const raw = "https://cdn.test/SİTE RESİMLERİ/Çardak, 3x3;420D.jpg?x=1&amp;y=2";
  const expected = new URL(raw.replace("&amp;", "&")).href;
  expect(collectImages({ Resim1: raw }, undefined)).toEqual([expected]);
  expect(productImageSources(["https://cdn.test/SİTE"], { Resim1: raw })).toContain(expected);
});

it("B03: separates multiple image URLs without splitting their paths or queries", () => {
  expect(
    feedImageUrls("https://cdn.test/a b.jpg|https://cdn.test/c.jpg;x=1,2; //cdn.test/d.jpg"),
  ).toEqual([
    "https://cdn.test/a%20b.jpg",
    "https://cdn.test/c.jpg;x=1,2",
    "https://cdn.test/d.jpg",
  ]);
  expect(feedImageUrls("javascript:alert(1)")).toEqual([]);
  expect(
    collectImages({ description: "https://site.test/page", Image: "//cdn.test/a.jpg" }, undefined),
  ).toEqual(["https://cdn.test/a.jpg"]);
});
