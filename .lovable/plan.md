# 3 saatlik otomatik stres testi, veri tohumlama ve dayanıklılık orkestratörü

## Önce iki önemli uyarı

1. **Test verisi canlı veritabanına yazılır.** Mefticaret'in tek bir bulut veritabanı var; önizleme ve yayındaki site aynı veriyi kullanıyor. Bu yüzden tüm sahte mağaza/ürün/sipariş kayıtları `TEST-` ön ekiyle ve `is_test` işaretiyle açılır, vitrinde ve panel listelerinde görünmez, temizlik adımı yalnızca bu işaretli kayıtları siler. Gerçek müşteri verisine asla dokunulmaz.
2. **20.000 eşzamanlı kullanıcı bu ortamdan üretilemez.** Yük üreteci tek bir kutudan çalışır ve sitenin önündeki koruma katmanı bu hacmi engeller; ayrıca 3 saatte bir sürekli çalışan test, bulut maliyetini kalıcı olarak yükseltir. Uygulama şu şekilde olur: senaryolar 20.000 sanal kullanıcıyı hedefleyecek biçimde yazılır ve ölçek panelden ayarlanır (varsayılan 500 eşzamanlı), gerçek 20.000 için k6 Cloud / harici yük sağlayıcısı gerekir — bunu panelde açıkça belirtiriz.

## Yapılacaklar

### 1. Veri tohumlama ve temizlik
- `TEST-` etiketli 1.000 mağaza, mağaza başına izole ayarlar; 50.000 ürün ve Beden/Renk varyant matrisi tedarikçi XML/eşleştirme motorundan geçirilerek üretilir.
- Tohumlama parça parça (batch) ve arka plan kuyruğunda çalışır; her turda önce eski test verisi silinir (mağaza → ürün/varyant/stok/sipariş/kargo/iade zinciri).
- Ölçek panelden ayarlanabilir (ör. 100 mağaza / 5.000 ürün ile prova).

### 2. Trafik ve işlem simülasyonu
- k6 senaryoları: vitrin gezinme + filtreleme + sepete ekleme; ayarlanabilir sanal kullanıcı sayısı ve süre.
- Sipariş akışı: test ödeme sağlayıcısı üzerinden kasa (gerçek Mefpay/iyzico'ya para hareketi gitmez, test modu), sipariş kalemlerinin tedarikçi panellerine otomatik bölünmesi, ardından Beklemede → Hazırlanıyor → Kargoda (takip barkodu) → Teslim → İade talebi geçişleri.
- Hedef 10.000 sipariş; panelden düşürülebilir.

### 3. Doğrulama ve mutabakat
- Aşırı satış kontrolü: eşzamanlı kasa altında stoğu 0 olan üründen satış olmadığı doğrulanır (mevcut satır kilidi mekanizması üzerinden).
- Finansal mutabakat: %0,1 platform satış, %0,70 Mefpay, %0,50 tedarikçi komisyonu kuruş hassasiyetinde yeniden hesaplanıp kayıtlarla karşılaştırılır; sapma varsa rapora "kritik" olarak düşer.
- Ölçümler: API gecikmesi (eşik < 200 ms), veritabanı yükü, önbellek isabet oranı, hata oranı — mevcut izleme altyapısından okunur.

### 4. Zamanlayıcı, rapor ve uyarılar
- Her 3 saatte bir tekrarlayan tur: temizlik (00:00) → tohumlama (00:05) → yük/trafik (00:15) → raporlama ve temizlik (02:45).
- Tur bitince yönetim paneline yürütme özeti düşer; başarısız eşiklerde Slack/webhook uyarısı gider.
- Yönetici açıkça durdurana kadar döngü kendini yeniler.

### 5. Süper Admin yük monitörü (`/admin/load-test`)
- "Sonraki otomatik sıfırlama ve test turu: 02s:14d:30s" geri sayımı.
- Canlı gösterge grafikleri: sanal kullanıcı, saniyedeki sipariş, veritabanı yükü, hata oranı.
- Kırmızı **"TEST SÜİTİNİ DURDUR"** anahtarı; ölçek ayarları; son turların rapor listesi ve detay görünümü.

## Teknik notlar
- Yeni tablolar: `load_test_runs` (tur durumu, faz, ölçek, metrik özetleri), `load_test_events` (faz logları), `load_test_findings` (aşırı satış/mutabakat sapmaları) — hepsi yalnız platform admin RLS'i.
- Orkestrasyon mevcut iş kuyruğu üzerinde yeni iş türleriyle (`loadtest_purge`, `loadtest_seed`, `loadtest_traffic`, `loadtest_verify`, `loadtest_report`); 3 saatlik tekrar `pg_cron` ile 15 dakikalık kontrol yerine tur bitiminde kendini planlar.
- Tohumlama/temizlik yalnız service_role ile, `createServerFn` arkasında ve platform admin doğrulamasıyla çalışır.
- k6 senaryoları `loadtest/` altında (mevcut `storefront-load.ts`, `stock-race.ts` yanına `k6/` klasörü); panelden tetiklenen turlar sonuç JSON'unu `load_test_runs`'a yazar.
- Tüm ödeme çağrıları sağlayıcıların test/sandbox modunda; canlı anahtar kullanılmaz.
