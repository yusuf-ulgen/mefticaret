# Analitik Paneli v2 (Shopify benzeri)

## Mevcut durum
- Vitrin zaten her ziyareti, ürün görüntülemeyi, sepete eklemeyi, ödemeye geçişi, satın almayı ve aramayı kaydediyor (ziyaretçi/oturum, UTM, cihaz, ülke/şehir dahil).
- Tek bir "Analitik" sayfası, "Canlı İzleme" ve basit CSV'li "Raporlar" sayfası var. Günlük özet tablosu yok.

Yeni tablolar sıfırdan açmak yerine mevcut kayıtlar genişletilecek; böylece bugüne kadar toplanan veri kaybolmaz ve çift kayıt olmaz.

## Yapılacaklar

**1. Veri**
- Ziyaret kayıtlarına sayfa başlığı ve sayfada kalma süresi eklenir.
- Oturum özeti (giriş sayfası, kaynak, cihaz, başlangıç/bitiş, sayfa sayısı) mevcut kayıtlardan hesaplanan bir görünüm olarak sunulur.
- Yeni günlük özet tablosu: oturum, ziyaretçi, sayfa görüntüleme, sipariş, ciro, ortalama sepet, dönüşüm, geri dönen müşteri.
- Sipariş oluşunca/ödenince o günün özeti anında güncellenir; her gece 00:05'te (İstanbul) önceki gün yeniden hesaplanır.
- Özellik anahtarı `analytics_v2` paketlere eklenir (varsayılan açık).
- Tüm veriler mağaza bazlı; mağaza sadece kendi verisini görür.

**2. Sayfalar** (tek "Analitik" menüsü altında sekmeler)
1. Genel Bakış: bugün / dün / 7 / 30 / 90 gün / özel aralık; 4 KPI kartı (önceki döneme göre ▲▼ %); satış + ziyaretçi grafiği (saatlik/günlük/haftalık/aylık); "Şu an X kişi sitede".
2. Satışlar: brüt / vergi / kargo / indirim / iade ayrımı; ödeme yöntemi pasta grafiği; dönem karşılaştırması; gün × saat ısı haritası.
3. Siparişler: durum dağılımı, ortalama kargoya verme süresi, iade oranı.
4. Ürünler: en çok satanlar (liste + çubuk grafik), en çok görüntülenenler, sepete eklenip alınmayanlar, stoğu azalanlar.
5. Müşteriler: yeni / geri dönen oranı, en çok harcayan 10 müşteri, il bazlı Türkiye dağılımı (il listesi + yoğunluk çubukları), ortalama müşteri değeri.
6. Trafik: Organik / Direkt / Sosyal / Reklam / E-posta; cihaz; ülke/şehir; UTM kampanya performansı.
7. Dönüşüm Hunisi: Ziyaretçi → Ürün görüntüleme → Sepet → Ödeme → Satın alma.
- Canlı İzleme sayfası yenilenir: aktif ziyaretçi (son 5 dk), hangi sayfadalar, son 5 sipariş; anlık güncelleme + 30 sn yedek yenileme.

**3. Raporlar**
- Hazır şablonlar: günlük satış özeti, haftalık performans, aylık büyüme, ürün performansı, müşteri segmenti.
- Tarih aralığı seçip CSV, Excel ve PDF indirme.
- Zamanlanmış e-posta: günlük (08:00), haftalık, aylık; mağaza sahibi açar/kapatır, alıcı e-postalarını girer.

**4. Dış erişim (API v2)**
- `/api/v2/analytics/overview`, `sales`, `products/top`, `customers`, `traffic`, `conversion-funnel`, `live`; mevcut mağaza API anahtarıyla, yalnız o mağazanın verisi.
- Sonuçlar 5 dakika önbelleğe alınır.

**5. Süper yönetici**
- Mevcut platform analitiğine mağaza karşılaştırma tablosu (ciro, sipariş, ziyaretçi, dönüşüm) eklenir.

**6. Mobil**
- KPI kartları: telefonda yatay kaydırma, tablette 2×2, masaüstünde 1×4.
- Grafiklerde dokununca bilgi balonu; geniş grafikler yerine sekmeli görünüm.
- Tarih seçici telefonda alttan açılan pencere.
- Tablolar telefonda liste görünümü; tüm analitik sayfalarında aşağı çekip yenileme.
- Grafik renkleri tema renklerinden, koyu modla uyumlu.

## Sınırlar
- Grafiklerde iki parmakla yakınlaştırma yerine dokunup bilgi görme ve aralık seçme olacak.
- Türkiye haritası çizim olarak değil, il sıralı yoğunluk listesi olarak gösterilecek (harita dosyası eklemek sayfayı ağırlaştırır). İstenirse sonra eklenebilir.
- Laravel/Redis/Queue yerine sistemin mevcut zamanlayıcısı ve önbelleği kullanılır.
- Zamanlanmış e-postalar mağazanın doğrulanmış e-posta alan adıyla gider; alan adı yoksa gönderim bekler.

## Teknik ayrıntılar
- Migration: `analytics_events` + `page_title`, `time_on_page_ms`; `analytics_sessions_v` view (security_invoker); `analytics_daily_summary` (store_id,date unique, GRANT + RLS store manager); `analytics_report_schedules`; `refresh_analytics_daily(store,date)` SECURITY DEFINER (execute revoke anon/auth); orders trigger → refresh; pg_cron `5 21 * * *` UTC.
- `src/lib/analytics-v2.server.ts`: overview/sales/top/customers/traffic/funnel/live hesaplama; daily summary + ham olaylar birleşimi; önceki dönem karşılaştırması.
- `analytics-v2.functions.ts` (requireSupabaseAuth + store access guard) ve `/api/v2/$` router genişletmesi (API key scope `analytics:read`), in-memory + DB tabanlı 5 dk cache.
- Tracker snippet'e sayfa başlığı ve `visibilitychange` ile süre gönderimi.
- Route: `store.$storeId.analytics.tsx` sekmeli layout'a çevrilir, alt sekmeler ayrı bileşen dosyaları; Recharts ile `var(--primary)`/`--chart-*` token'ları.
- Rapor export: CSV mevcut helper, Excel `xlsx` (SheetJS), PDF `jspdf` (mevcut PDF export altyapısı yeniden kullanılır); zamanlanmış rapor `/api/public/cron/analytics-reports` + gizli anahtar kontrolü.
