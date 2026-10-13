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
BASE_URL=https://staging.example.test bun loadtest/storefront-load.ts --users 50 --seconds 60

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
- Panel koşusu test siparişlerini DB üzerinde simüle eder; gerçek ödeme sağlayıcısını çağırmaz.
- 20.000 gerçek eşzamanlı kullanıcı tek kutudan üretilemez. Panelde ölçek hedefi
  20.000'e kadar ayarlanabilir (varsayılan 500); gerçek 20.000 VU için
  `loadtest/k6/storefront.js` ve `loadtest/k6/checkout.js` senaryolarını k6 Cloud
  veya dağıtık k6 operator üzerinde çalıştırın.

## k6 Cloud bağlama (gerçek 20.000 VU)

Senaryolar k6 Cloud'a hazırdır (`ext.loadimpact` ayarları gömülü; yerel çalıştırmada
yok sayılır). Hedef adres herkese açık bir URL olmalı: yayındaki site
(`https://mefticaret.com`) veya sabit önizleme adresi.

### 1) Grafana Cloud hesabı ve token

1. https://grafana.com → ücretsiz hesap → **Grafana Cloud** stack'i açın.
2. Sol menüden **Testing & k6** → **k6 Cloud**'u etkinleştirin (free katman yeterli).
3. **k6 Cloud → Setup & API token** sayfasından API token ve proje kimliğini (projectID)
   kopyalayın. Token yalnız kendi bilgisayarınızda env değişkeni olarak tutulur;
   projeye yazılmaz, buraya yapıştırılmaz.

### 2) k6 kurulumu (kendi bilgisayarınız)

```bash
# macOS
brew install grafana/tap/xk6 && brew install k6
# Linux (deb/rpm) veya Windows: https://grafana.com/docs/k6/latest/set-up/install-v2/
```

### 3) TEST mağazalarını hazır et

k6 senaryoları `test-store-1 … test-store-N` mağazalarına vurur. Bu mağazalar yalnızca
yönetim panelindeki orkestratör turunda üretilir:

1. Süper admin olarak `/admin/load-test` → **TURU BAŞLAT**.
2. Tohumlama (Veri tohumlama) fazı bitince **DURAKLAT** — TEST verisi silinmeden kalır.
3. Panelde ölçek hedefini k6 Cloud çalıştırmanızla tutarlı seçin (örn. 1.000 mağaza / 50.000 ürün).

### 4) Yükü k6 Cloud ile bas

```bash
export K6_CLOUD_TOKEN="..."        # 1. adımdaki token
export K6_CLOUD_PROJECT_ID="..."   # 1. adımdaki proje kimliği

# Vitrin: 20.000 eşzamanlı gezinti/filtreleme (varsayılan bölge: Frankfurt)
BASE_URL=https://staging.example.test VUS=20000 DURATION=15m bash loadtest/k6/cloud-run.sh storefront

# Kasa: 10.000 sipariş, sandbox ödeme
BASE_URL=https://staging.example.test VUS=1000 ORDERS=10000 bash loadtest/k6/cloud-run.sh checkout

# Bölge değiştirmek için: K6_LOAD_ZONE=amazon:us:ashburn
```

Sonuçları ve p95/hata grafiklerini Grafana Cloud k6 panosundan izlersiniz; eşikler
(p95 < 200 ms vitrin, p95 < 400 ms kasa, hata < %1/%2) aşıldığında k6 testi FAIL işaretler.

### 5) Temizlik

Test bitince `/admin/load-test` panelinden turu **DURDUR** — TEST verisi
(`purge_load_test_data`) silinir, vitrine asla sızmaz.

### Bilinen sınırlar

- `checkout.js` senaryosu `/api/public/loadtest/cart` ve `/api/public/loadtest/checkout`
  uç noktalarını çağırır; bu uç noktalar henüz projede yok — kasa yükü için önce
  korumalı (yalnız TEST mağazaları + izin anahtarı) olarak eklenmeli.
- k6 Cloud trafiği Grafana'nın IP havuzundan gelir; genel API hız sınırı (100 istek/dk)
  IP başına uygulandığından yüksek VU'da 429'lar normaldir ve hata oranına dahildir.
  Vitrin ölçümünü önce 1.000–2.000 VU ile doğrulayıp artırın.


## Revizyon 3 geliştirmeleri — gerçek ölçüm kapsamı

- `k6/storefront.js` yalnız HTTP vitrin/liste gezinmesidir; tarayıcıda sepet veya CWV ölçmez. Olmayan `/search` isteği kaldırıldı.
- k6 `handleSummary` JSON dosyası hedef VU, ölçülmüş en yüksek VU, süre, iterasyon, istek/sn, p95, hata ve 429 sayısını ayırır. Yarım/kanıtsız koşu tam başarı sayılmaz; CPU/RAM/DB alanı ölçüm kaydı olmadan `null` kalır.
- `k6/checkout.js` yalnız endpoint sözleşmesini ölçer. 4xx başarılı checkout sayılmaz; eksik endpointte hazırlık aşamasında durur. Bu projede korumalı test checkout endpointleri henüz yoktur.
- `storefront-load.ts` hedef worker ile ölçülen eşzamanlı istek sayısını ayırır; 404/429 hatadır. Boş ölçüm ve SIGINT ile durdurulan koşu başarı vermez.
- `stock-race.ts`: tek stok senaryosunda tam bir başarılı işlem ve kalanların açık stok reddi gerekir. Bütün isteklerin 404/401 olması aşırı satış testini geçirmez.
- Normal kullanıcı ve test trafiği raporda ayrı değerlendirilir. Rate limitler kaldırılmadı. Aynı senaryo/rota/cihaz/örnek veri/limitlerle önce-sonra ölçülmelidir.
- Sonuç eşikleri işletmece seçilen test hedefidir; kapasite veya sabit hız garantisi değildir. Yeni gerçek koşu yapılmadan sonuç uydurulmaz.
