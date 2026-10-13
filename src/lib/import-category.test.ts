import { expect, it } from "vitest";
import { categoryLeaf } from "./import-category";
it("uses one leaf rule for XML preview and import across supported separators", () => {
  for (const value of ["Giyim > Kadın > Elbise", "Giyim/Kadın/Elbise", "Giyim | Kadın | Elbise | "])
    expect(categoryLeaf(value)).toBe("Elbise");
  expect(categoryLeaf(null)).toBeNull();
});
