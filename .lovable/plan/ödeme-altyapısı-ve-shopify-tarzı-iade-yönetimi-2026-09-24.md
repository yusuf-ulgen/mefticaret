# Ödeme altyapısı ve Shopify tarzı iade yönetimi

## Mevcut durum (korunacak)
- Siparişlere bağlı ödemeler, ödeme hareketleri ve temel iade kayıtları zaten var.
- QNBpay canlı çalışan tek sağlayıcı (3D, taksit, iade imzası mevcut). Havale ve kapıda ödeme de mevcut.
- Ödemeler sayfasında iyzico/PayTR/Stripe kartları var, ancak bu sağlayıcıların gerçek API bağlantısı yok.

Yeni yapı bunların üzerine kurulur. Mevcut ödeme akışı bozulmaz, eski kayıtlar taşınır.

## Faz 1 — İade yönetimi (Shopify gibi)
- Sipariş detayında sağ üstte ⋮ menüsü ve içinde "İade Et".
- İade ekranı, telefonda alttan açılan ve aşağı kaydırınca kapanan pencere olarak açılır. İçinde şunlar olur:
  - Ürünlerin yanında onay kutusu ve adet seçici
  - Ürün başına "Stoka geri ekle" anahtarı
  - Otomatik hesaplanan ama düzenlenebilen tutar
  - İade yöntemi: orijinal ödeme / mağaza kredisi / manuel
  - Neden listesi (5 seçenek) ve not alanı
  - Onaydan önce özet ve tek dokunuşla "İade Et ₺X"
- Güvenlik kuralları:
  - Tutar, iade edilebilir kalan tutarı aşamaz; kısmi iadelerde kalan tutar izlenir.
  - Her iadenin tek kullanımlık bir kimliği olur, böylece aynı iade iki kez yapılamaz.
  - Her işlem kullanıcı ve zaman bilgisiyle denetim kaydına yazılır.
- İade numarası mağaza başına sıralı üretilir: REF-0001.
- "Orijinal ödeme" seçilirse QNBpay iadesi kullanılır. Havale ve kapıda ödemede iade manuel olarak işaretlenir.
- "Mağaza kredisi" seçilirse tutar müşterinin kredi bakiyesine eklenir. Bakiye müşteri hesabında görünür ve ödemede kullanılabilir.
- Müşteri tarafında:
  - Sipariş sayfasında iade durumu rozeti ve iade geçmişi
  - İade tamamlanınca e-posta

## Faz 2 — Ödeme sağlayıcı altyapısı
- Mağaza başına sağlayıcı listesi:
  - Aç/kapa anahtarı, test modu, sıralama
  - Şifreli saklanan kimlik bilgisi formu (API anahtarı, gizli anahtar, üye iş yeri no)
  - Desteklenen para birimleri
- Sağlayıcı başına taksit kuralları: en düşük tutar, taksit sayısı, ek oran.
- Ödeme hareketleri kaydı: durum, tarih ve sağlayıcıya göre filtrelenir.
- Ödeme sayfasında:
  - Logolu ödeme yöntemi seçici
  - Taksit tablosu
  - 3D Secure yönlendirmesi
  - Temaya uyan başarılı/başarısız sayfaları
- Genel API: `/api/v2/payments/*`, `/api/v2/orders/{id}/transactions|capture|void|refunds`, `/api/v2/refunds/{id}/*`. Mevcut API anahtarı yetkisiyle korunur.
- Geri dönüş ve bildirim adresleri, her sağlayıcının kendi imza doğrulamasıyla çalışır.

## Faz 3 — Yeni sağlayıcıların gerçek bağlantısı
Sıra: iyzico → PayTR → Stripe → PayPal. Her biri ancak mağazanın test kimlik bilgileriyle doğrulandıktan sonra "hazır" sayılır. Kimlik bilgisi olmayan sağlayıcı ödeme sayfasında gösterilmez; sahte başarı gösterilmez.

## Kapsam dışı / farklılıklar
- Laravel Jobs yerine sağlayıcı çağrıları sunucuda, tekrar denemeli bir iş kuyruğu tablosuyla arka planda çalışır.
- Çevrimdışı kuyruk yalnızca iade formu için uygulanır: bağlantı kesilirse işlem bekletilir ve bağlantı gelince gönderilir. Aynı iadenin iki kez gitmesini tek kullanımlık kimlik engeller.
- Kayıtlı kart yalnızca kart saklamayı destekleyen sağlayıcılarda, sağlayıcının kendi kart anahtarıyla yapılır. Kart numarası hiçbir zaman bizde tutulmaz.

## Technical details
- Migration:
  - `payment_providers` ve `payment_installments` tabloları
  - `refunds` tablosuna şu sütunlar: `refund_number`, `refund_method`, `note`, `idempotency_key` (unique), `total_tax`
  - `refund_line_items` ve `refund_transactions` tabloları
  - `customer_store_credits` bakiyesi ve hareket tablosu
  - Hepsi için GRANT ve mağaza bazlı RLS (`can_manage_store`)
- `process_refund` security-definer RPC tek transaction'da çalışır:
  - Kalan iade edilebilir tutarı kilitleyerek kontrol eder.
  - Satırları ve stok iadesini yazar.
  - Bir `order_events` / denetim kaydı ekler.
- Sağlayıcı iadesi: QNBpay için mevcut `qnbpay.server.ts` iade çağrısı; diğerleri için `PaymentProviderAdapter` arayüzü (initiate/verifyCallback/refund/capture/void).
- Kimlik bilgileri pgsodium yerine sunucu tarafında AES-GCM ile, gizli bir anahtar kullanılarak şifrelenir.
- UI shadcn Sheet/Drawer (vaul) ile yapılır ve yalnız tema token'ları kullanılır. Dokunma hedefleri en az 44px.
