import { expect, it } from "vitest";
import { buildK6Summary } from "./run-summary.js";
it("keeps requested VUs separate and does not report missing metrics as zero", () => {
  const report = buildK6Summary({}, { kind: "http", targetVus: 500, expectedDurationMs: 60000 });
  expect(report.targetVus).toBe(500);
  expect(report.measuredPeakVus).toBeNull();
  expect(report.errorRate).toBeNull();
  expect(report.runStatus).toBe("partial_or_unverified");
  expect(report.thresholdsPassed).toBeNull();
});
it("marks interrupted iteration tests partial even when requests were fast", () => {
  const report = buildK6Summary({ metrics: { iterations: { values: { count: 10 } }, vus: { values: { max: 4 } }, http_req_duration: { values: { "p(95)": 20 }, thresholds: { "p(95)<400": { ok: true } } } } }, { kind: "contract", targetVus: 10, expectedIterations: 100 });
  expect(report.measuredPeakVus).toBe(4);
  expect(report.runStatus).toBe("partial_or_unverified");
});
