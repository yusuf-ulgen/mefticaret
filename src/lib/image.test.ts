import { expect, it } from "vitest";
import { imageSrcSet, optimizedImageUrl } from "./image";
it("preserves private signatures and external providers instead of pretending to resize", () => {
  for (const url of [
    "https://example.com/image.jpg",
    "https://example.com/image.jpg?next=/storage/v1/object/public/a.jpg",
    "https://test.supabase.co/storage/v1/object/sign/a.jpg?token=private",
    "https://test.supabase.co/storage/v1/render/image/sign/a.jpg?token=locked",
  ]) {
    expect(optimizedImageUrl(url, { width: 240 })).toBe(url);
    expect(imageSrcSet(url)).toBeNull();
  }
});
it("maintains image proportions across responsive public sizes", () => {
  const url = "https://test.supabase.co/storage/v1/object/public/media/a.jpg";
  const variants = imageSrcSet(url, [240, 480], { height: 360, baseWidth: 720 });
  expect(variants).toContain("width=240&height=120");
  expect(variants).toContain("width=480&height=240");
});
