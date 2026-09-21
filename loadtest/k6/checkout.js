/**
 * k6 ödeme senaryosu: sepet → ödeme (Mefpay/iyzico sandbox) akışı.
 *
 * Çalıştırma:
 *   BASE_URL=https://mefticaret.com VUS=1000 ORDERS=10000 k6 run loadtest/k6/checkout.js
 *
 * ÖNEMLİ: Yalnızca TEST mağazalarına ve sandbox ödeme moduna karşı çalıştırın.
 * Gerçek kart/gerçek ödeme bilgisi kullanılmaz.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const VUS = Number(__ENV.VUS || 200);
const ORDERS = Number(__ENV.ORDERS || 2000);
const STORE_COUNT = Number(__ENV.STORE_COUNT || 1000);
const PROJECT_ID = Number(__ENV.K6_CLOUD_PROJECT_ID || 0);

const placedOrders = new Counter("simulated_orders");
const stockBlocked = new Counter("stock_blocked");

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

  check(cart, { "sepet hazır": (res) => res.status === 200 || res.status === 201 });

  const checkout = http.post(
    `${BASE_URL}/api/public/loadtest/checkout`,
    JSON.stringify({ store: slug, gateway: "mefpay", mode: "sandbox" }),
    { headers: { "Content-Type": "application/json" }, tags: { step: "checkout" } },
  );

  if (checkout.status === 200 || checkout.status === 201) placedOrders.add(1);
  check(checkout, { "ödeme yanıtı": (res) => res.status < 500 });

  sleep(0.5);
}
