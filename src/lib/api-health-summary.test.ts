import { expect, it } from "vitest";
import { apiHealthSummary } from "./api-health-summary";

it("T05: an empty sample cannot claim zero errors or zero latency", () => {
  expect(apiHealthSummary([])).toEqual({
    totalRequests: 0,
    errorRequests: 0,
    errorRate: null,
    avgDuration: null,
    durationSamples: 0,
  });
});
it("T05: missing durations do not lower the measured average", () => {
  expect(
    apiHealthSummary([
      { status_code: 200, duration_ms: 100 },
      { status_code: 500, duration_ms: null },
      { status_code: 429, duration_ms: 300 },
    ]),
  ).toMatchObject({
    totalRequests: 3,
    errorRequests: 2,
    errorRate: 2 / 3,
    avgDuration: 200,
    durationSamples: 2,
  });
});
it("T05: real zero measurements remain zero, invalid durations remain unknown", () => {
  expect(apiHealthSummary([{ status_code: 200, duration_ms: 0 }])).toMatchObject({
    errorRate: 0,
    avgDuration: 0,
  });
  expect(
    apiHealthSummary([
      { status_code: 200, duration_ms: null },
      { status_code: 200, duration_ms: NaN },
      { status_code: 200, duration_ms: -1 },
    ]),
  ).toMatchObject({ errorRate: 0, avgDuration: null });
});
