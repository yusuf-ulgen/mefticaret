
## Ödeme (yerleşik/Paddle)
- [x] Yerleşik ödeme sağlayıcısını etkinleştir (Paddle, test ortamı)
- [x] Platform paketlerini ödeme sağlayıcısında ürün/fiyat olarak oluştur (aylık + yıllık)
- [x] Kasa (checkout) akışı ve abonelik webhook iş kuralları

## Mef-Ultra Teması
- [x] Tema paketi, özgün görseller ve tema mağazası kaydı
- [x] Header, ana sayfa, PLP, PDP ve AJAX sepet deneyimi
- [x] Tema editörü/önizleme entegrasyonu
- [x] Mobil-masaüstü etkileşim ve regresyon doğrulaması

- [x] Paket bazlı özellik (modül) hakları: plan_features modül satırları, menü filtresi, sunucu tarafı zorlama ve abonelik ekranında özellik listesi.

## Tema Stüdyosu yükseltmesi
- [x] Zengin ayar alanları (metin, alan, sayı, kaydırıcı, seçim, çoklu seçim, radyo, anahtar, adres, zengin metin, görsel yükleme, renk, yazı tipi, ürün/koleksiyon seçici)
- [x] Satır bazlı blok düzenleyici (sürükle-sırala, ekle, sil)
- [x] Sürüm geçmişi çekmecesi (geri yükle/sil)
- [x] Klavye kısayolları: Ctrl+S/Z/Shift+Z/D/H/Shift+A, Delete, Escape

## Kolay Panel v4.0
- [x] Özel gün kampanyası: indirim kodu + mağaza sayfasında duyuru
- [x] Etiket tasarla & yazdır (logo, "Sevgiyle Yapıldı", içindekiler, QR — A4'te 8 etiket)
- [x] Dükkan QR kodu indirme + canlı yayın satış linki (yayın etiketiyle)
- [x] Malzeme & tazelik takibi (yeşil/sarı/kırmızı) ve ürüne bağlı içindekiler
- [x] Siparişi komşuya devret (aynı şehirdeki aktif mağazalar, onay akışı)
- [ ] Aras Kargo hesap bilgileri (kullanıcıdan bekleniyor)
- [ ] QNBpay canlı bilgileriyle gerçek kart tahsilatı testi (kullanıcıdan bekleniyor)

## Ev üreticisi vitrini
- [x] Kolay Panel mağazalarını kurumsal görünümden ayır; bağımsız vitrini tüm mağaza alt sayfalarında koru
- [x] Ev üreticisi kaydında Shopier tarzı gerçek vitrini otomatik yayınla; ürün/kategori/takip bağlantıları ve satışa ara verme durumu
- [x] Kolay Panel mağazalarını kalıcı mikro mağaza türüyle kurumsal mağaza, paket, abonelik ve panel rotalarından ayır
- [x] Mikro mağaza kurulumunu tek sunucu işlemiyle plansız ve bağımsız oluştur; kurumsal yükseltme köprüsünü kaldır

## Kolay Panel v5 (giriş, arama, ödeme, e-posta)
- [x] Girişte telefon/SMS doğrulaması kaldırıldı; e-posta + şifre girişi ve kayıt, şifremi unuttum bağlantısı
- [x] Ürün listesi sayfasında ItemList/Product yapısal verisi (fiyat + stok), micro vitrin meta metinleri güçlendirildi
- [x] Google Search Console: vitrin, ürün listesi ve örnek ürün adresleri tek tek incelendi (vitrin/ürün "URL is unknown", ürün listesi "Discovered - currently not indexed")
- [x] Ürün sayfasında "Hemen satın al" → doğrudan ödeme sayfası, sipariş mevcut kasa akışında kaydediliyor
- [ ] Stok/fiyat/sipariş e-postaları: gönderici alan adı kurulumu kullanıcıdan bekleniyor

- [x] Ana sayfaya referans videodaki sipariş, ürün seçimi ve kartlı ödeme animasyonu eklendi; mobil/masaüstü doğrulandı.

- [x] Sistem izolasyonu güçlendirildi: veritabanında 109 tabloya çapraz mağaza referans koruması (app_private.enforce_tenant_refs) + para çekme talebinde mağaza yöneticisi kontrolü.
- [x] E-ticaret rehberi SEO güçlendirildi (başlık/açıklama, HowTo yapısal veri, içindekiler, karşılıklı iç bağlantılar).
- [x] İngilizce rehber /en/how-to-start-an-online-store eklendi; tr/en hreflang, site haritası ve hızlı indeksleme listesi güncellendi.
- [x] Kolay Panel Mağazam sekmesine 4 adımlı "Yeni mağaza rehberi" kartı eklendi (gerçek veriye göre kendini tamamlar).
- [x] Doğrulama: typecheck temiz; rehber sayfaları 200; panel rehber kartı 3/4 adım gösteriyor; micro vitrin ve ürün listesi 393px'de sorunsuz.
