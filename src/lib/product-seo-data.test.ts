import { describe, expect, it } from "vitest";
import { hasProductImage, productSeoData } from "./product-seo-data";

describe("shared product SEO source", () => {
  it("uses the same legacy OG field and plain description fallback", () => {
    expect(
      productSeoData({
        title: "Ürün",
        description: "<p>Doğal&nbsp;ürün</p>",
        seo: { og_image: " https://example.com/a.jpg " },
      }),
    ).toMatchObject({
      title: "Ürün",
      description: "Doğal ürün",
      ogImage: "https://example.com/a.jpg",
    });
    expect(
      productSeoData({
        title: "Ürün",
        description: "Kaynak",
        seo: { title: "Özel", description: "Meta" },
      }),
    ).toMatchObject({ title: "Özel", description: "Meta" });
  });
  it("counts signed storage media but excludes empty source records", () => {
    expect(hasProductImage({ url: " ", storage_path: "store/a.webp" })).toBe(true);
    expect(hasProductImage({ url: "https://example.com/a.jpg" })).toBe(true);
    expect(hasProductImage({ url: null, storage_path: " " })).toBe(false);
  });
});
