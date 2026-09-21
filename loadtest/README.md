# Mefticaret yük testi ve dayanıklılık senaryoları

Senaryolar gerçek uçlara istek atar; hiçbir sahte veri üretilmez. Hedef adres
`BASE_URL` ortam değişkeni ile verilir (varsayılan `http://localhost:8080`).

## Eşikler (kabul kriterleri)

| Metrik | Hedef |
| --- | --- |
| Vitrin p95 yanıt süresi | ≤ 800 ms |
| API hata oranı (5xx) | ≤ %1 |
| Hız sınırı | genel API 100 istek/dk, içe aktarma 10 istek/dk |
| Tek adet stokta eşzamanlı kasa | yalnızca 1 sipariş başarılı olmalı |
| Kuyruk birikimi | ≤ 250 iş |

## Çalıştırma

```bash
# 1) Vitrin ve API yük profili (eşzamanlı kullanıcı + süre)
BASE_URL=https://mefticaret.com bun loadtest/storefront-load.ts --users 50 --seconds 60

# 2) Hız sınırı doğrulaması (100/dk ve 10/dk kurallarının devreye girmesi)
bun loadtest/rate-limit-check.ts

# 3) Yarış durumu: tek adet stoklu ürüne 50 eşzamanlı sipariş
#    Ürün varyant kimliği ve mağaza bilgisi parametre olarak verilir.
bun loadtest/stock-race.ts --slug <magaza-slug> --variant <varyant-id> --concurrency 50
```

Sonuçlar konsola ve `loadtest/results/` altına JSON olarak yazılır.
Test sonrası `/admin/system` panelinde gecikme, kuyruk ve hata metrikleri izlenir.
