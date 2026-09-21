/** Vitrin ve genel sayfa yük profili: eşzamanlı kullanıcı + süre. */
import { BASE_URL, arg, summarize, timed, writeReport, type Sample } from "./lib";

const users = Number(arg("users", "25"));
const seconds = Number(arg("seconds", "30"));
const paths = arg("paths", "/,/e-ticaret-paketleri,/blog,/tedarikci-giris").split(",");

const deadline = Date.now() + seconds * 1000;
const samples: Sample[] = [];

async function worker(index: number) {
  let cursor = index;
  while (Date.now() < deadline) {
    const path = paths[cursor % paths.length] ?? "/";
    cursor += 1;
    samples.push(await timed(() => fetch(`${BASE_URL}${path}`, { redirect: "manual" })));
  }
}

console.log(`${users} eşzamanlı kullanıcı · ${seconds} saniye · ${BASE_URL}`);
await Promise.all(Array.from({ length: users }, (_, index) => worker(index)));

const summary = summarize("storefront-load", samples);
const thresholds = { p95Ms: 800, errorRate: 0.01 };
const passed = summary.p95 <= thresholds.p95Ms && summary.errorRate <= thresholds.errorRate;
console.log(passed ? "SONUÇ: eşikler karşılandı" : "SONUÇ: eşikler AŞILDI");
await writeReport("storefront-load", { summary, thresholds, passed });
if (!passed) process.exitCode = 1;
