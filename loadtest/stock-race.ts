/**
 * Yarış durumu testi: tek adet stoklu bir varyanta eşzamanlı sipariş denemesi.
 * Satır kilidi (reserve_variant_stock) doğru çalışıyorsa yalnızca bir sipariş
 * başarılı olur, diğerleri "yeterli stok kalmadı" hatası alır.
 */
import { BASE_URL, arg, writeReport } from "./lib";

const slug = arg("slug");
const variantId = arg("variant");
const concurrency = Number(arg("concurrency", "50"));
const endpoint = arg("endpoint", "/api/v1/checkout/orders");

async function attempt(index: number) {
  const started = Date.now();
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug,
        items: [{ variantId, quantity: 1 }],
        customer: { name: `Yuk Testi ${index}`, email: `loadtest+${index}@example.com`, phone: "5000000000" },
      }),
    });
    const text = await response.text();
    return { index, status: response.status, ms: Date.now() - started, body: text.slice(0, 300) };
  } catch (cause) {
    return {
      index,
      status: 0,
      ms: Date.now() - started,
      body: cause instanceof Error ? cause.message : "network_error",
    };
  }
}

console.log(`${concurrency} eşzamanlı sipariş denemesi · varyant ${variantId} · ${BASE_URL}`);
const results = await Promise.all(Array.from({ length: concurrency }, (_, index) => attempt(index)));
const succeeded = results.filter((result) => result.status >= 200 && result.status < 300);
const stockErrors = results.filter((result) => /stok/i.test(result.body));

console.log(
  JSON.stringify(
    { attempts: results.length, succeeded: succeeded.length, stockErrors: stockErrors.length },
    null,
    2,
  ),
);
const passed = succeeded.length <= 1;
console.log(passed ? "SONUÇ: aşırı satış yok" : "SONUÇ: AŞIRI SATIŞ tespit edildi");
await writeReport("stock-race", { results, passed });
if (!passed) process.exitCode = 1;
