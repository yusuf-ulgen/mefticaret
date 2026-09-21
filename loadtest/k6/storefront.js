/**
 * k6 vitrin senaryosu: TEST mağazalarında gezinme, filtreleme ve sepete ekleme.
 *
 * Çalıştırma:
 *   BASE_URL=https://mefticaret.com VUS=500 DURATION=10m k6 run loadtest/k6/storefront.js
 *
 * 20.000 gerçek eşzamanlı kullanıcı tek makineden üretilemez; bu senaryoyu
 * k6 Cloud veya dağıtık k6 operator ile çalıştırın:
 *   k6 cloud --vus 20000 --duration 15m loadtest/k6/storefront.js
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const VUS = Number(__ENV.VUS || 500);
const DURATION = __ENV.DURATION || "5m";
const STORE_COUNT = Number(__ENV.STORE_COUNT || 1000);

const browseLatency = new Trend("storefront_latency", true);

export const options = {
  scenarios: {
    browse: {
      executor: "ramping-vus",
      startVUs: Math.max(1, Math.round(VUS / 10)),
      stages: [
        { duration: "1m", target: VUS },
        { duration: DURATION, target: VUS },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    // Hedef: API/vitrin p95 < 200 ms, hata oranı < %1
    http_req_duration: ["p(95)<200"],
    http_req_failed: ["rate<0.01"],
  },
};

function storeSlug() {
  return `test-store-${1 + Math.floor(Math.random() * STORE_COUNT)}`;
}

export default function () {
  const slug = storeSlug();

  const home = http.get(`${BASE_URL}/s/${slug}`, { tags: { page: "storefront" } });
  browseLatency.add(home.timings.duration);
  check(home, { "vitrin 200": (res) => res.status === 200 });

  const products = http.get(`${BASE_URL}/s/${slug}/products?sort=price_asc`, { tags: { page: "list" } });
  check(products, { "liste 200": (res) => res.status === 200 });

  const search = http.get(`${BASE_URL}/s/${slug}/search?q=TEST`, { tags: { page: "search" } });
  check(search, { "arama 200": (res) => res.status === 200 });

  sleep(Math.random() * 2);
}
