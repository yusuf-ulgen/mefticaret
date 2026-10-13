/**
 * k6 checkout endpoint sözleşmesi; sağlayıcı ödeme kanıtı değildir.
 *
 * Çalıştırma:
 *   BASE_URL=https://staging.example.test VUS=1000 ORDERS=10000 k6 run loadtest/k6/checkout.js
 *
 * ÖNEMLİ: Yalnızca TEST mağazalarına ve sandbox ödeme moduna karşı çalıştırın.
 * Gerçek kart/gerçek ödeme bilgisi kullanılmaz.
 */
import http from "k6/http";
import { check, sleep, fail } from "k6";
import { Counter } from "k6/metrics";
import { buildK6Summary } from "./run-summary.js";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const VUS = Number(__ENV.VUS || 200);
const ORDERS = Number(__ENV.ORDERS || 2000);
const STORE_COUNT = Number(__ENV.STORE_COUNT || 1000);
const PROJECT_ID = Number(__ENV.K6_CLOUD_PROJECT_ID || 0);

const placedOrders = new Counter("simulated_orders");
const stockBlocked = new Counter("stock_blocked");
const limited = new Counter("rate_limited");

export function setup() {
  const probe = http.options(`${BASE_URL}/api/public/loadtest/cart`);
  if (probe.status === 404) fail("Checkout contract endpoints are absent. This scenario cannot prove checkout or payment capacity.");
}

export const options = {
  // k6 Cloud ayarları — yerel `k6 run` bunları yok sayar.
  ext: {
    loadimpact: {
      projectID: PROJECT_ID,
      name: "mefticaret-checkout",
      distribution: {
        [__ENV.K6_LOAD_ZONE || "amazon:de:frankfurt"]: { loadZone: 1, percent: 100 },
      },
    },
  },
  scenarios: {
    checkout: {
      executor: "shared-iterations",
      vus: VUS,
      iterations: ORDERS,
      maxDuration: __ENV.DURATION || "15m",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<400"],
    http_req_failed: ["rate<0.02"],
  },
};

export default function () {
  const slug = `test-store-${1 + Math.floor(Math.random() * STORE_COUNT)}`;
  const jar = http.cookieJar();
  jar.set(BASE_URL, "mefti_loadtest", "1");

  const cart = http.post(
    `${BASE_URL}/api/public/loadtest/cart`,
    JSON.stringify({ store: slug, quantity: 1 + Math.floor(Math.random() * 3) }),
    { headers: { "Content-Type": "application/json" }, tags: { step: "cart" } },
  );

  if (cart.status === 409) {
    // Aşırı satış koruması devrede: stok tükendi, sipariş oluşturulmadı.
    stockBlocked.add(1);
    return;
  }

  if (cart.status === 429) limited.add(1);
  if (!check(cart, { "sepet hazır": (res) => res.status === 200 || res.status === 201 })) return;

  const checkout = http.post(
    `${BASE_URL}/api/public/loadtest/checkout`,
    JSON.stringify({ store: slug, gateway: "mefpay", mode: "sandbox" }),
    { headers: { "Content-Type": "application/json" }, tags: { step: "checkout" } },
  );

  if (checkout.status === 200 || checkout.status === 201) placedOrders.add(1);
  if (checkout.status === 429) limited.add(1);
  check(checkout, { "checkout sözleşmesi başarılı": (res) => res.status === 200 || res.status === 201 });

  sleep(0.5);
}

export function handleSummary(data) {
  return { "loadtest-checkout-summary.json": JSON.stringify(buildK6Summary(data, { kind: "checkout_endpoint_contract", target: BASE_URL, targetVus: VUS, expectedIterations: ORDERS }), null, 2) };
}
