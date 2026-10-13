/** Hız sınırı doğrulaması: genel API 100/dk, telemetri formu penceresi. */
import { BASE_URL, summarize, timed, writeReport, type Sample } from "./lib";

async function burst(label: string, path: string, count: number, init?: RequestInit) {
  const samples: Sample[] = [];
  for (let index = 0; index < count; index++) {
    samples.push(await timed(() => fetch(`${BASE_URL}${path}`, init)));
  }
  return { label, summary: summarize(label, samples) };
}

const apiBurst = await burst("api-burst-130", "/api/v1/ping", 130);
const telemetryBurst = await burst("telemetry-burst-30", "/api/public/telemetry/error", 30, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ message: "loadtest rate limit probe", severity: "INFO", source: "loadtest" }),
});

const passed = apiBurst.summary.rateLimited > 0 && telemetryBurst.summary.rateLimited > 0;
console.log(passed ? "SONUÇ: hız sınırı devreye girdi" : "SONUÇ: hız sınırı tetiklenmedi (kontrol edin)");
await writeReport("rate-limit-check", { apiBurst, telemetryBurst, passed });
if (!passed) process.exitCode = 1;
