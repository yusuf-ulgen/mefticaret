# Canlıya Geçiş: Kalan Eksikler

Demo veriler silindi: iki demo mağaza (Atlas Moda, Nova Teknoloji) ve bunlara bağlı 72 ürün, 59 sipariş, 49 müşteri, abonelik ve finans kayıtları ile `test@example.com` hesabı kaldırıldı. Sistemde artık yalnızca gerçek mağazalar var: Ütebaylar Market (yayında), Sultanbutik ve omermagazasi (taslak).

## 1. Demo altyapısının kapatılması
- Mağazalarım sayfasındaki "Demo mağaza" tanıtım kartı kaldırılacak.
- Veritabanındaki demo mağaza üretici fonksiyon devre dışı bırakılacak, böylece canlıda yanlışlıkla demo kayıt oluşmayacak.
- Yayın kontrolü artık yalnızca gerçek yayın durumuna bakacak (demo istisnası kaldırılacak).

## 2. Ödeme ve fatura tarafında canlı geçiş
- QNBpay: canlı üye işyeri anahtarı panele girilecek, gizli anahtar güvenli kayıt formuyla eklenecek, ardından canlı bağlantı testi yapılacak. **Bu iki bilgiyi senden almam gerekiyor.**
- QNB e-Fatura: QNB'nin verdiği giriş ve fatura servis adresleri girilecek, tek fatura ile uçtan uca gönderim ve durum sorgulaması denenecek. **Servis adresleri sende.**

## 3. Paket ve yetki tamamlamaları
- Süper yönetici paket ekranına modül aç/kapa anahtarları eklenecek.
- Kalan sınır kontrolleri bağlanacak: alan adı ekleme, ekip üyesi ekleme, API anahtarı, ek dil, bildirim otomasyonu.

## 4. Satıcı paneli son rötuşlar
- Sipariş ve müşteri ekranları mobilde kart listesi olarak optimize edilecek.
- Panel favorileri mağaza bazlı hale getirilecek (şimdi tüm mağazalarda ortak).

## 5. Yayın öncesi kontrol listesi
- www.mefticaret.com alan adı hâlâ "başlatıldı" durumunda — doğrulaması tamamlanacak.
- Zorunlu yasal sayfalar (KVKK, gizlilik, mesafeli satış, iade/teslimat) yayında mı kontrol edilecek.
- E-posta gönderim alan adı doğrulaması ve şifre sıfırlama/sipariş e-postalarının canlı testi.
- Müşterilerin kendi harcama ve sipariş metriklerini değiştirebilmesine dair açık güvenlik uyarısı kapatılacak.

## Teknik notlar
- Demo temizliğinde `ledger_entries` silme koruması yalnızca temizlik anında devre dışı bırakıldı ve hemen geri açıldı.
- Kalan 7 adet "RLS Enabled No Policy" bilgi notu, yalnızca sunucu tarafından okunan kimlik bilgisi tablolarına ait; kasıtlı ve değiştirilmeyecek.
