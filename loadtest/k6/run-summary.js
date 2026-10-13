export function durationMs(value) {
  let total = 0;
  for (const match of value.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h)/g)) total += Number(match[1]) * ({ ms: 1, s: 1000, m: 60000, h: 3600000 }[match[2]]);
  return total;
}
export function buildK6Summary(data, input) {
  const metric = (name, value) => {
    const result = data.metrics?.[name]?.values?.[value];
    return typeof result === "number" && Number.isFinite(result) ? result : null;
  };
  const measuredDurationMs = typeof data.state?.testRunDurationMs === "number" ? data.state.testRunDurationMs : null;
  const iterations = metric("iterations", "count");
  const complete = input.expectedIterations ? iterations !== null && iterations >= input.expectedIterations : measuredDurationMs !== null && input.expectedDurationMs > 0 && measuredDurationMs >= input.expectedDurationMs * 0.95;
  const thresholds = Object.values(data.metrics ?? {}).flatMap((m) => Object.values(m.thresholds ?? {}));
  return { generatedAt: new Date().toISOString(), testKind: input.kind, target: input.target, targetVus: input.targetVus, measuredPeakVus: metric("vus", "max"), measuredDurationMs, iterations, requests: metric("http_reqs", "count"), requestsPerSecond: metric("http_reqs", "rate"), p95Ms: metric("http_req_duration", "p(95)"), errorRate: metric("http_req_failed", "rate"), rateLimited: metric("rate_limited", "count"), runStatus: complete ? "completed" : "partial_or_unverified", thresholdsPassed: complete && thresholds.length ? thresholds.every((t) => t.ok === true) : null, infrastructure: null, scope: "HTTP requests only. CPU/RAM/DB, real payments and browser Core Web Vitals require separately recorded measurements." };
}
