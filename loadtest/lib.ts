/** Yük testi yardımcıları: argüman ayrıştırma, ölçüm ve rapor yazımı. */

export const BASE_URL = process.env["BASE_URL"] ?? "http://localhost:8080";

export function arg(name: string, fallback?: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (value === undefined) {
    if (fallback === undefined) throw new Error(`--${name} parametresi gerekli`);
    return fallback;
  }
  return value;
}

export type Sample = { ok: boolean; status: number; ms: number };

export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0);
}

export async function timed(request: () => Promise<Response>): Promise<Sample> {
  const started = Date.now();
  try {
    const response = await request();
    return { ok: response.status >= 200 && response.status < 400, status: response.status, ms: Date.now() - started };
  } catch {
    return { ok: false, status: 0, ms: Date.now() - started };
  }
}

export function summarize(label: string, samples: Sample[], elapsedMs?: number) {
  const durations = samples.map((sample) => sample.ms);
  const errors = samples.filter((sample) => !sample.ok).length;
  const rateLimited = samples.filter((sample) => sample.status === 429).length;
  const summary = {
    label,
    requests: samples.length,
    errors,
    errorRate: samples.length ? errors / samples.length : null,
    requestsPerSecond: elapsedMs && elapsedMs > 0 ? samples.length / (elapsedMs / 1000) : null,
    rateLimited,
    p50: samples.length ? percentile(durations, 50) : null,
    p95: samples.length ? percentile(durations, 95) : null,
    max: samples.length ? durations.reduce((max, value) => Math.max(max, value), 0) : null,
  };
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

export async function writeReport(name: string, payload: unknown) {
  const fs = await import("node:fs/promises");
  await fs.mkdir("loadtest/results", { recursive: true });
  const file = `loadtest/results/${name}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  await fs.writeFile(file, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Rapor: ${file}`);
}
