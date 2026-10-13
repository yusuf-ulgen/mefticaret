import { expect, it, vi } from "vitest";
import { rateLimitResponse } from "./rate-limit.server";
it("returns actionable uncached 429 without weakening the rate limit", async () => {
  vi.spyOn(Date, "now").mockReturnValue(0);
  const response = rateLimitResponse({
    allowed: false,
    hits: 101,
    remaining: 0,
    limit: 100,
    resetAt: new Date(60_000).toISOString(),
  });
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("60");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect((await response.json()).retry_after_seconds).toBe(60);
  expect(
    rateLimitResponse({
      allowed: false,
      hits: 101,
      remaining: 0,
      limit: 100,
      resetAt: "invalid",
    }).headers.get("retry-after"),
  ).toBe("60");
  vi.restoreAllMocks();
});
