import { expect, it } from "vitest";
import { storeNavGroups, storeTaskNavGroups } from "./store-nav";
it("keeps every destination when regrouping and deduplicates repeated menu routes", () => {
  const original = new Set(storeNavGroups("own").flatMap((g) => g.items.map((i) => i.to)));
  const grouped = storeTaskNavGroups("own");
  const routes = grouped.flatMap((g) => g.items.map((i) => i.to));
  expect(new Set(routes)).toEqual(original);
  expect(routes.length).toBe(original.size);
  expect(grouped.map((g) => g.group)).toEqual([
    "Satış",
    "Katalog",
    "Finans",
    "Pazarlama",
    "Ayarlar",
  ]);
  const quick = grouped
    .flatMap((g) => g.items)
    .filter((i) => i.to.endsWith("/quick-update") || i.to.endsWith("/pricing"));
  expect(new Set(quick.map((i) => i.label)).size).toBe(2);
});
