/** Vitrin ve genel sayfa yük profili: eşzamanlı kullanıcı + süre. */
import { BASE_URL, arg, summarize, timed, writeReport, type Sample } from "./lib";

const users = Number(arg("users", "25"));
const seconds = Number(arg("seconds", "30"));
const paths = arg("paths", "/,/e-ticaret-paketleri,/blog,/tedarikci-giris").split(",");
if (!Number.isInteger(users) || users < 1 || !Number.isFinite(seconds) || seconds <= 0) throw new Error("users must be a positive integer and seconds must be positive");

const deadline = Date.now() + seconds * 1000;
const samples: Sample[] = [];
const startedAt = Date.now();
let stopped = false;
let active = 0;
let peak = 0;
process.once("SIGINT", () => { stopped = true; });

async function worker(index: number) {
  let cursor = index;
  while (!stopped && Date.now() < deadline) {
    const path = paths[cursor % paths.length] ?? "/";
    cursor += 1;
    active += 1;
    peak = Math.max(peak, active);
    samples.push(await timed(() => fetch(`${BASE_URL}${path}`, { redirect: "manual", signal: AbortSignal.timeout(10000) })));
    active -= 1;
  }
}

console.log(`${users} eşzamanlı kullanıcı · ${seconds} saniye · ${BASE_URL}`);
await Promise.all(Array.from({ length: users }, (_, index) => worker(index)));

const summary = summarize("storefront-load", samples, Date.now() - startedAt);
const thresholds = { p95Ms: 800, errorRate: 0.01 };
const passed = !stopped && summary.requests > 0 && summary.p95 !== null && summary.errorRate !== null && summary.p95 <= thresholds.p95Ms && summary.errorRate <= thresholds.errorRate;
console.log(passed ? "SONUÇ: eşikler karşılandı" : "SONUÇ: eşikler AŞILDI");
await writeReport("storefront-load", { testKind: "concurrent_http_requests", targetWorkers: users, measuredPeakRequests: peak, runStatus: stopped ? "partial" : "completed", measuredDurationMs: Date.now() - startedAt, summary, thresholds, passed, infrastructure: null, browserMetrics: null });
if (!passed) process.exitCode = 1;
