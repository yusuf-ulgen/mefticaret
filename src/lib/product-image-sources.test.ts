import { expect, it } from "vitest";
import { imageFallbackState, productImageSources } from "./product-image-sources";

it("B03: recovers the same product's XML images and decodes URL separators", () => {
  expect(
    productImageSources([" https://img.test/a?id=1&amp;size=2 "], {
      "Resimler.Resim[0]": "//img.test/b.jpg",
      "Resimler.Resim[1]": "https://img.test/a?id=1&size=2",
      description: "https://other.test/not-an-image",
      Resim2: "javascript:alert(1)",
    }),
  ).toEqual(["https://img.test/a?id=1&size=2", "https://img.test/b.jpg"]);
});
it("B03: tries the next real image before a placeholder and resets on source changes", () => {
  const first = imageFallbackState("broken", ["working"], null);
  expect(imageFallbackState("broken", ["working"], { ...first, index: 1 }).source).toBe("working");
  expect(imageFallbackState("broken", ["working"], { ...first, index: 2 }).source).toBeNull();
  expect(imageFallbackState("fixed", ["working"], { ...first, index: 2 }).source).toBe("fixed");
  expect(imageFallbackState("broken", ["new"], { ...first, index: 2 }).source).toBe("broken");
});
