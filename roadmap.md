# Roadmap

## Couture teması
- [x] Adım 1: Couture teması, efekt paketi, ana sayfa, /demo/couture, özellik anahtarları
- [x] Adım 2: Üç katlı yapışkan üst menü, mega menü, anlık arama, mobil menü/alt menü, sağdan sepet paneli, footer
- [x] Adım 3: Liste filtreleri/sıralama, ürün detayı (mercek, taksit, akordeon, yorum dağılımı, yapışkan alt bar)
- [x] Adım 4: Adımlı ödeme (81 il/ilçe), Hesabım sekmeleri
- [ ] Couture özellik anahtarlarını vitrinde uygulamak (şu an yalnız tanımlı, kapalı)

## Mystique teması (fantezi/kostüm)
- [ ] Tema, efekt paketi, bölümler, chrome, /demo/mystique

## Güvenlik & güvenlik duvarı (v2_security, varsayılan kapalı)
Not: Yeni genel API adresi oluşturulmayacak; tüm işlemler panel içi sunucu fonksiyonlarıyla.
- [x] Adım 1: sec_ tabloları + RLS/GRANT + varsayılan WAF/fraud kuralları
- [x] Adım 2: Güvenlik katmanı sunucu kodu: IP/ülke kontrolü, hız limiti, WAF, bot tespiti, brute-force kilitleri, saldırı kaydı
- [x] Adım 3: Dolandırıcılık risk skoru motoru (hız, coğrafya, sipariş, cihaz, e-posta/telefon) ve inceleme kuyruğu
- [x] Adım 4: /admin/security paneli (Genel bakış, Saldırılar, IP kuralları, WAF, Fraud, Oturumlar, KVKK, Ayarlar)
- [ ] Adım 5: Gerçek zamanlı uyarılar (e-posta/webhook) + haftalık özet
- [ ] Adım 6: Oturum/cihaz güvenliği, parola politikası, 2FA zorunluluk uygulaması


## Mesajlar (WhatsApp benzeri)
- [x] Tablolar/RLS/depo, liste, sohbet, anlık mesaj, medya/ses/tepki/yanıt/silme, yeni sohbet/grup, profil/durum, tablet düzeni, çevrimdışı önbellek, sayfa içi + arka plan bildirimi
- [ ] Uygulama tamamen kapalıyken telefon bildirimi (web push) — ayrı adım
- [ ] module_chat paket anahtarı ile açma/kapama
- [x] Kayıt/giriş (tanıtım, 6 haneli kod, Google/Apple, şifre sıfırlama), mağaza bağlama, QR/rehber, profil kartı, engelle/şikayet, gizlilik, bildirim ayarları, KVKK indir/sil, açık rıza, TR/EN giriş
- [ ] Şikayet moderasyon ekranı (Süper Admin)
- [ ] App Store / Google Play: yerel uygulama derlemesi burada yapılamaz
- [x] E-ticaret sitesi kurma maliyeti rehberi (/e-ticaret-maliyeti)

## Referans panel (foursid) eksik uygulamaları — sırayla yapılacak
- [x] Menü grupları/sırası referansla aynı (Genel, Katalog, Satışlar, Kullanıcılar, İçerik, Pazarlama, İstatistikler, Uygulamalar, Genel Ayarlar, Operasyon Yönetimi)
- [x] Perakende Satış (kasa + perakende satışlar listesi)
- [x] Ödeme Bildirimleri (havale onay/ret)
- [x] Misafir Kullanıcılar listesi
- [x] Pazarlama izinleri (KVKK abonelik/izin listesi)
- [x] SMS Pazarlama
- [x] Takvim
- [x] Cookie Builder (çerez bandı oluşturucu)
- [x] Hızlı Güncelleme tablosu (fiyat/stok satır içi)
- [ ] Ana sayfa "Mağaza özeti" (Bugün/Dün/1 Hafta/30 Gün) + sipariş sayfası özet kartları/sekmeler
- Yapılmayacak: Forsid Buket, Magenty, Artboard, OpenAI Ads, Fast Cart (referansa özel ürünler/markalar)
