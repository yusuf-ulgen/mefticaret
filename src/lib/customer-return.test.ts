import { expect, it } from "vitest";
import { customerReturnTarget } from "./customer-return";
it("returns customer auth to checkout while rejecting arbitrary redirect targets", () => {
  expect(customerReturnTarget("checkout")).toBe("checkout");
  for (const target of [undefined, "/auth", "https://evil.test", "//evil.test"])
    expect(customerReturnTarget(target)).toBe("account");
});
