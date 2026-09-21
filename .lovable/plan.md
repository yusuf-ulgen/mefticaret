# Sistem Dayanıklılığı, Yük Testi ve Otomatik Hata İzleme

Mefticaret'te hız sınırlama, kuyruk ve sistem durumu ekranının temeli zaten var. Bu çalışma eksik parçaları tamamlar: gerçek stok kilidi, hata kayıt masası, dark-mode izleme paneli, Slack/webhook uyarıları, içe aktarma doğrulaması ve yük testi seti.

## 1. Yarış durumu (flash sale stok)
- Veritabanı tarafında `reserve_variant_stock(_variant_id, _qty)` fonksiyonu: satırı `FOR UPDATE` ile kilitler, stok yetersizse hata döner, yeterliyse tek adımda düşürür ve hareket kaydı için önceki/sonraki değeri döndürür.
- Kasa akışı (`src/lib/checkout.server.ts`) oku-yaz yerine bu fonksiyonu çağırır; aynı tek adet ürüne eşzamanlı iki sipariş geldiğinde ikincisi "stok tükendi" ile reddedilir.

## 2. Hata kayıt masası (Error Log Desk)
- Yeni `app_error_logs` tablosu: seviye (CRITICAL/WARNING/INFO), kaynak, mesaj, stack, rota, kullanıcı, mağaza, parmak izi, sayaç, ilk/son görülme. Yalnız platform yöneticisi okur; yazma servis tarafından.
- Sunucu tarafı yakalayıcı (`src/start.ts` hata katmanı + kuyruk başarısızlıkları) ve tarayıcı tarafı genel yakalayıcı (React hata sınırı + `window.onerror`/`unhandledrejection`) aynı kaydı besler; aynı hata tekrarlarsa sayaç artar.
- Tarayıcı raporları için `/api/public/telemetry/error` uç noktası: IP başına hız sınırlı, boyut sınırlı, PII içermez.

## 3. Sistem sağlığı ve izleme paneli
- `fetchSystemHealth` genişler: veritabanı gecikmesi (ms), önbellek isabet oranı (%), API yanıt süreleri (p50/p95), kuyruk bekleyen/gecikmiş iş sayısı, son hata oranı; her metrik için Sağlıklı / Bozulmuş / Kesinti eşiği.
- `/admin/system` yenilenir: koyu temalı izleme paneli, yeşil/sarı/kırmızı durum göstergeleri, canlı sayaçlar ve kuyruk backlog grafiği.
- `/admin/logs` içine "Hata Kayıtları" sekmesi: arama, seviye filtresi, stack trace açılır detay, kullanıcı/mağaza bilgisi, çözüldü işaretleme.

## 4. Uyarı tetikleyicileri
- Eşik aşıldığında veya CRITICAL hata düştüğünde Slack/genel webhook'a bildirim; adres platform ayarlarından girilir (gizli anahtar kod içinde tutulmaz).
- Aynı uyarı için susturma penceresi (ör. 15 dk) ve gönderim kaydı, uyarı seli olmaması için.

## 5. Kuyruk ve hız sınırı tamamlama
- XML/CSV/Excel içe aktarma ve alan eşleştirme işi kuyruğa taşınır; istek yalnız işi kuyruğa alır, ilerleme panelde görünür.
- Push bildirim ve e-posta pazarlama gönderimleri kuyruk kanalına alınır; en fazla 3 deneme, üstel geri çekilme, son hata kaydı.
- Hız sınırı kuralları: genel API 100/dk, içe aktarma tetikleyicisi 10/dk; mevcut `RATE_LIMITS` bu değerlerle güncellenir ve içe aktarma/besleme uçlarına uygulanır.

## 6. Veri doğrulama ve temizleme
- Tüm içe aktarma/alan eşleştirme yükleri Zod şemasıyla doğrulanır; tanımsız alan, aşırı uzun metin ve hatalı tip reddedilir.
- Metin alanları HTML/script temizliğinden geçer (XSS), sorgular parametreli kalır (SQL enjeksiyonu), sunucu fonksiyonlarında CSRF koruması korunur.

## 7. Yük testi stratejisi
- Depoya `loadtest/` altında çalıştırılabilir senaryolar: vitrin gezinme, arama, sepete ekleme, kasa, tedarikçi içe aktarma, admin paneli.
- Her senaryo için hedef eşikler (p95 yanıt süresi, hata oranı) ve nasıl çalıştırılacağını anlatan kısa `loadtest/README.md`.
- Tek adet stokta 50 eşzamanlı kasa denemesiyle yarış durumu doğrulaması.

## Teknik notlar
- Yeni tablo için RLS + GRANT: okuma yalnız platform yöneticisi, yazma servis rolü.
- Ölçümler gerçek verilerden gelir; sahte/sabit değer kullanılmaz.
- Metrik toplama hafif tutulur: örnekleme ve toplulaştırma veritabanı tarafında yapılır.
- Doğrulama: `bunx tsgo --noEmit`, yük senaryolarının kısa bir turu ve `/admin/system`, `/admin/logs`, kasa akışının tarayıcı kontrolü.
