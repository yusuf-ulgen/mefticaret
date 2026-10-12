import { expect, it } from "vitest";
import { formatDate, formatDateTime } from "./mefti";
it("sunucu ve tarayıcı saat dilimi aynı tarih çıktısını üretir", () => {
  const original = process.env["TZ"];
  try {
    process.env["TZ"] = "UTC";
    const server = formatDateTime("2026-10-11T23:30:00Z");
    process.env["TZ"] = "America/New_York";
    expect(formatDateTime("2026-10-11T23:30:00Z")).toBe(server);
    expect(formatDate("2026-10-11T23:30:00Z")).toContain("12");
  } finally {
    if (original === undefined) delete process.env["TZ"];
    else process.env["TZ"] = original;
  }
});
it("boş ve bozuk tarih ekranı çökertmez", () => {
  expect(formatDateTime("bad-date")).toBe("—");
  expect(formatDate(null)).toBe("—");
});
