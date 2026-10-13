import { expect, it } from "vitest";
import { readAllPages } from "./read-all-pages";
it("API sayfayı kısaltsa da tüm kayıtları alır", async () => {
  const source = Array.from({ length: 251 }, (_, i) => i);
  const result = await readAllPages(async (from) => ({
    data: source.slice(from, from + 75),
    error: null,
  }));
  expect(result.data).toEqual(source);
});
it("alt sayfa hatasını boş başarılı veri saymaz", async () => {
  await expect(
    readAllPages(async () => ({ data: null, error: { message: "DB hatası" } })),
  ).rejects.toThrow("DB hatası");
});
