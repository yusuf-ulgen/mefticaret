import { expect, it } from "vitest";
import { supplierSalesBucket } from "./supplier-sales-bucket";
it("groups sales in the store timezone across UTC day and month boundaries", () => {
  expect(supplierSalesBucket("2026-09-30T22:30:00Z", "daily")).toBe("2026-10-01");
  expect(supplierSalesBucket("2026-09-30T22:30:00Z", "monthly")).toBe("2026-10");
  expect(supplierSalesBucket("2026-09-30T22:30:00Z", "hourly")).toBe("2026-10-01 01:00");
  expect(supplierSalesBucket("invalid", "daily")).toBeNull();
});
