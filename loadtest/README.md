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

## Otomatik 3 saatlik stres testi turu (orkestratör)

Süper admin `/admin/load-test` ekranından yönetilir. Her tur şu fazlardan geçer:

| Faz | İş |
| --- | --- |
| Sıfırlama | TEST işaretli mağazalardaki tüm test verisi silinir |
| Veri tohumlama | Hedef sayıda TEST mağazası + Beden/Renk varyant matrisli ürün |
| Yük & trafik | Vitrin ölçümü, stok rezervasyonlu sipariş simülasyonu, kargo yaşam döngüsü, iade talepleri |
| Doğrulama | Aşırı satış kontrolü, komisyon mutabakatı (%0,1 platform · %0,70 Mefpay · %0,50 tedarikçi), gecikme/hata eşikleri |
| Raporlama | Tur özeti, bulgular ve kritik uyarı webhook'u |

Tur adımlarını `pg_cron` beş dakikada bir `/api/public/cron/loadtest` uç noktasını
çağırarak ilerletir; tur bitince config'teki süreye (varsayılan 180 dakika) göre
sonraki tur planlanır. Admin "TEST SÜİTİNİ DURDUR" düğmesine basana kadar döngü
kendini yeniler.

### Sınırlar

- Tüm test verisi `TEST-` ön ekli ve `stores.is_test = true` olan mağazalarda tutulur;
  gerçek müşteri verisine dokunulmaz, vitrin/panel listelerinde görünmez.
- Ödeme çağrıları sandbox/test modunda simüle edilir.
- 20.000 gerçek eşzamanlı kullanıcı tek kutudan üretilemez. Panelde ölçek hedefi
  20.000'e kadar ayarlanabilir (varsayılan 500); gerçek 20.000 VU için
  `loadtest/k6/storefront.js` ve `loadtest/k6/checkout.js` senaryolarını k6 Cloud
  veya dağıtık k6 operator üzerinde çalıştırın.
