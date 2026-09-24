# Kargo Takibi ve Müşteri Bildirimleri

Mevcut altyapının üzerine kurulur. Kargo kayıtları, Aras Kargo bağlantısı, Verimor SMS, WhatsApp Business ve e-posta gönderimi zaten var. Mağaza sahibine giden uyarılar da hazır. Aynı işi yapan ikinci bir sistem kurulmaz; eksik parçalar eklenir.

## Faz 1 — Kargo takibi
- **Mevcut kargo kaydı genişletilir:** kargo firması anahtarı (yurtici/aras/mng/ptt/surat/dhl/ups/fedex), tahmini teslim tarihi ve yeni durumlar ("Kargoya verildi", "Dağıtımda", "Teslim edilemedi").
- **Kargo geçmişi:** Her hareket (durum, açıklama, şehir/ilçe, saat) ayrı ayrı saklanır.
- **Kargo firması ayarları:** Mağaza başına müşteri numarası, anahtarlar, test modu ve açık/kapalı durumu tutulur. Anahtarlar şifreli saklanır, ekranda yalnızca son 4 hanesi görünür.
- **Sipariş sayfası (panel):** "Kargo Bilgileri" kartı (firma, takip no, durum rozeti), zaman çizelgesi, tahmini teslim ve "Şimdi güncelle" düğmesi. Elle hareket de eklenebilir.
- **Herkese açık takip sayfası `/kargo-takip/{takipNo}`:** Mağaza logosu ve tema renkleriyle zaman çizelgesi ve tahmini teslim tarihi gösterilir. "Bağlantıyı kopyala" ve paylaş düğmeleri var. Sayfa Google'a kapalıdır (noindex); telefon, adres ve e-posta gösterilmez.
- **Otomatik güncelleme:** Açık kargolar 2 saatte bir kontrol edilir; teslim edilince kargo kapanır ve bildirim gider.
  - **Gerçek bağlantı yalnızca Aras'ta var.** Yurtiçi, MNG, PTT, Sürat, DHL, UPS ve FedEx için mağazanın bu firmalarla anlaşması ve anahtarları gerekir.
  - Anahtar gelene kadar bu firmalarda durum elle güncellenir ve müşteri firmanın kendi takip sayfasına yönlendirilir. Sahte durum üretilmez.

## Faz 2 — Müşteri bildirimleri
- **Şablonlar:** olay × kanal (e-posta/SMS/WhatsApp) × dil (tr/en). Aşağıdaki olayların her biri için Türkçe varsayılan şablon hazır gelir:
  - Sipariş alındı
  - Sipariş onaylandı
  - Kargoya verildi
  - Dağıtımda
  - Teslim edildi
  - İade tamamlandı
- **Değişkenler:** `{{customer_name}}`, `{{order_number}}`, `{{order_total}}`, `{{tracking_number}}`, `{{carrier_name}}`, `{{tracking_url}}`, `{{refund_amount}}`, `{{store_name}}`, `{{store_logo_url}}`.
- **Otomatik tetikleme noktaları:**
  - sipariş oluşturma ve onay
  - kargo durum değişimi
  - iade tamamlanması (şu an tek gönderilen iade e-postası da bu sisteme taşınır)
- **Güvenlik ve KVKK:**
  - Her gönderimde tekrar önleme anahtarı kullanılır; aynı olay aynı müşteriye aynı kanaldan bir kez gider.
  - Aynı sipariş olayı için en fazla 1 SMS gönderilir.
  - Her e-postada abonelikten çıkma bağlantısı olur.
  - SMS'lere "STOP" ile çıkış bilgisi eklenir; gelen STOP yanıtı abonelikten çıkarır.
  - Abonelikten çıkanlar ayrı bir tabloda kaydedilir.
- **Panel — Bildirimler sayfası, 3 sekme:**
  1. **Kanal Ayarları:** gönderici adı ve bağlı SMS, WhatsApp ve e-posta durumları.
  2. **Şablonlar:**
     - olay listesi ve kanal açma/kapama anahtarları
     - SMS için canlı 160 karakter sayacı
     - WhatsApp ön onay uyarısı
     - 375px telefon önizlemesi
     - "Test gönder" düğmesi
  3. **Bildirim Geçmişi:** kanal, durum, tarih ve müşteriye göre filtre; başarısız gönderimler için "Yeniden gönder".
- **Müşteri — Hesabım > Bildirim Tercihleri:** olay × kanal anahtarları ve ayrı "Pazarlama e-postaları" seçeneği.
- **Özellik anahtarı:** Mevcut paket/özellik sistemine `notification_v2` eklenir; kapalı mağazalarda yeni bildirimler gitmez.

## Faz 3 — Dış bağlantı noktaları
`/api/v2` altında sipariş kargoları, kargo detayı, takip, elle güncelleme ve kimlik doğrulamasız herkese açık takip uçları eklenir. Mevcut API anahtarı ve hız sınırı sistemi kullanılır.

## İstekten farklı olanlar
- **SMS:** Netgsm, Twilio ve Vonage yerine bağlı Verimor kullanılır. Netgsm istenirse ayrıca eklenir.
- **E-posta:** SMTP, Mailgun ve SendGrid yerine platformun kendi e-posta gönderimi kullanılır. Teslim, geri dönme ve şikâyet takibi hazır gelir.
- **Laravel Scheduler:** Yerine veritabanı zamanlayıcısı (2 saatte bir) kullanılır.
- **Push bildirimi (PWA) bu turda yok:** Ayrı bir bildirim servisi kurmak gerekir. Panel içi zil zaten var ve kullanılır.

## Teknik detaylar
- **Migration:**
  - shipments'e yeni kolonlar: `carrier_key`, `estimated_delivery_date`, yeni enum değerleri `picked_up`/`out_for_delivery`/`failed`
  - yeni tablolar: `shipment_events`, `carrier_settings` (şifreli kimlik bilgisi), `customer_notification_templates`, `customer_notification_logs` (UNIQUE `idempotency_key`), `customer_notification_prefs`, `customer_unsubscribes`
  - hepsinde GRANT + RLS `can_manage_store`; müşteri kendi tercihlerini RLS ile görür
  - mevcut `notification_settings` (mağaza sahibi uyarıları) olduğu gibi kalır
- **Sunucu:**
  - `customer-notify.server.ts`: `dispatchCustomerEvent(orderId, eventKey)` fonksiyonu tercih, abonelik, SMS sınırı ve tekrar önleme kontrollerinden sonra `sendTemplateEmail` / `sendSms` (Verimor) / `sendWhatsAppMessage` ile gönderir
  - `carrier-sync.server.ts`: firma adaptörleri, şimdilik yalnızca Aras
  - `/api/public/shipments/sync`: gizli anahtarla korunur; pg_cron 2 saatte bir çağırır
  - `/api/public/unsubscribe`: imzalı token ile çalışır
- **Herkese açık takip:** tahmin edilemeyen takip numarası + mağaza eşleşmesiyle çalışan `SECURITY DEFINER` fonksiyon; yalnızca güvenli kolonları döndürür.
