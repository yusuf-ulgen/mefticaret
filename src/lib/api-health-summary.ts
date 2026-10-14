type ApiSample = { status_code: number; duration_ms: number | null };

/** An empty sample is unknown; a measured zero error rate is a valid result. */
export function apiHealthSummary(samples: ApiSample[]) {
  const totalRequests = samples.length;
  const errorRequests = samples.filter(
    (row) => row.status_code >= 500 || row.status_code === 429,
  ).length;
  const durations = samples
    .map((row) => row.duration_ms)
    .filter((value): value is number => value !== null && Number.isFinite(value) && value >= 0);
  return {
    totalRequests,
    errorRequests,
    errorRate: totalRequests ? errorRequests / totalRequests : null,
    avgDuration: durations.length
      ? durations.reduce((sum, value) => sum + value, 0) / durations.length
      : null,
    durationSamples: durations.length,
  };
}
