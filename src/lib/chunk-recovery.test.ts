import { expect, it } from "vitest";
import { isChunkLoadError } from "./chunk-recovery";
it("recognizes browser release failures without classifying business errors as stale assets", () => {
  expect(
    isChunkLoadError(new Error("Failed to fetch dynamically imported module: /assets/auth-old.js")),
  ).toBe(true);
  expect(isChunkLoadError("Loading chunk 4 failed")).toBe(true);
  expect(isChunkLoadError(new Error("Stok yetersiz"))).toBe(false);
  expect(isChunkLoadError(null)).toBe(false);
});
