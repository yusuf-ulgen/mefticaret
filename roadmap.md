
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

- [x] Kolay Panel rehber sayfasi (/kolay-panel-rehberi) eklendi; site haritasi + IndexNow + rehber ic baglantilari guncellendi.
- [x] E-ticaret rehberinde Turkce oncelik: tr/tr-TR hreflang, og:locale tr_TR, sitemap priority 1.0; Ingilizce sayfa priority 0.3.

- [x] Müşteri hesap paneli v2 (genel bakış, siparişler, kargo takip, iade, adres defteri, favoriler, puan/kampanya, hesap ayarları + puan sistemi)

- [x] Global & E-İhracat modülü: ülke bazlı fiyatlar, kur risk marjı, IOSS/OSS + ABD satış vergisi, DDP/DDU teslim maliyeti simülatörü, küresel ödeme sağlayıcıları, mikro ihracat taşıyıcıları, İngilizce ticari fatura / paket listesi / ETGB belgeleri
- [x] Dil bazli sitemap (tr/en/de/ar) + sitemap-index/robots/IndexNow, vitrin hreflang alternatifleri, ?lang= dil secimi
- [x] E-ihracat otomatik AI cevirisi: panelden secili dillere toplu ceviri (store_locales + translation_jobs), kalan satirlar kuyruk worker'inda
- [x] Dil bazli ana sayfa (/en, /de, /ar) + dil degistirici, vitrin SSR meta'si ?lang= duyarli
- [x] sitemap-tr/en/de/ar.xml Google Search Console'a gonderildi (mefticaret.com, hatasiz)
- [x] E-Ihracat paneli gercek magazada test edildi: Almanya vergi simulatoru (%19 → 22.80), ETGB-20260919-0001 belgesi olusturuldu
- [ ] Global modül bekleyen: Stripe/PayPal/Klarna ve DHL/FedEx/UPS/PTT/Navlungo/ShipEntegra/Aramex hesap anahtarları (satıcıdan gelmeli)

## Global dil ve sipariş doğrulaması
- [x] Google Search Console'da /en ilk 10 sonucu ve Türkçe görünürlük karşılaştırması (henüz /en sonucu yok; Türkçe ana sayfa önde)
- [x] EN/DE/AR ürün görünümü, fiyat, açıklama ve SEO çevirilerini doğrula; görünür ürün çevirilerini locale ile eşleştir
- [x] Gerçek siparişten otomatik mikro ihracat beyannamesi PDF'i ve taslak kargo etiketi üret
- [ ] İngilizce vitrinde sipariş, ödeme, kargo takibi ve kapanış akışını uçtan uca doğrula
- [x] Almanya vergi hesaplamasını gerçek mağaza bağlamında doğrula; Arap pazarı vergisini yapılandırılmış oran yokken uydurma

## Global & E-İhracat (19 Eyl 2026)
- [x] Yönetici oturumuyla E-İhracat Suite, Bölgesel Katalog, Kârlılık sekmeleri tarayıcıda doğrulandı
- [x] Küresel satış ısı haritası + döviz bazlı gelir raporu (gerçek ödenmiş siparişlerden)
- [x] AI Çeviri Stüdyosu (ürün başlığı/açıklama/SEO, Arapça RTL doğrulandı, slug çevrilmiyor)
- [ ] Stripe / PayPal / Klarna canlı entegrasyonu — mağaza sahibinin API anahtarları bekleniyor
- [ ] DHL Express / FedEx API — hesap numarası + API kimlik bilgileri bekleniyor (gerçek takip kodu bunlar olmadan üretilemez)
- [ ] /en siparişinde ödeme sonrası otomatik kargo takip + fatura akışı (yukarıdaki anahtarlara bağlı)

## Ana sayfada yeni özellikler
- [x] Global e-ihracat, büyüme/lojistik ve e-posta pazarlama özelliklerini ana sayfada görünür ve mobil uyumlu sun
- [x] Ana sayfa masaüstü ve mobil görünümünü doğrula

## Tedarikçi portalı & otomasyon genişletmesi (talep listesi)
- [x] Tedarikçi giriş ekranı: /tedarikci-giris — e-posta kayıt + doğrulama, şifre sıfırlama, sunucu tarafı tedarikçi rol kontrolü
- [x] Ana sayfanın alt bölümüne tedarikçi giriş ve yeni kayıt bağlantıları eklendi
- [ ] Senkron paneli: mağaza ürününe yansıyan senkron durumu/hata detayları (portal + mağaza tarafı)
- [ ] Tedarikçi portalı için anon/tedarikçi rol taraması ve komisyon doğrulaması
- [ ] Çark/kazı-kazan indirim kodlarının kasa akışına ve net satış/komisyon dışına alınması
- [ ] Çark kodlarının e-posta bültenine yönlendirilmesi ve kampanya tıklama cirosu
- [ ] Otomasyon akış diyagramında tetikleyici-koşul-aksiyon bağlantı görünümü
- [ ] B2B Cari Hesap + RFQ masası uçtan uca test (teklif → onay → sipariş)
- [ ] Gerçek sepet siparişlerine göre stok düşümü, tükenme tahmini ve teslim noktası
- [ ] Otomasyon düğümü tetikleme testi (sepet tutarı / teslimat ülkesi)
- [ ] Saatlik XML + stok senkron görevinin portalda gösterilmesi
- [ ] Vitrinde tedarikçi bilgisi ve senkron durumu
- [ ] Gerçek tedarikçi hesabı ile uçtan uca test (dosya yükleme → sipariş → komisyon defteri)

## Mobil B2B Tedarikçi Uygulaması
- [ ] Trend_Molli referansındaki 20 ekranı teslim al ve ekran sırasını eşleştir (kullanıcı yüklemesi bekleniyor)
- [ ] Mobil kabuk ve alt menü: Profil, Siparişler, Ürünler, Değişimler, Analiz
- [ ] Gerçek cüzdan, sipariş ayrıntısı, kargo, ödeme ve teslimat başarı görünümü
- [ ] Akıllı XML/CSV/Excel alan eşleştirme: varyant, galeri, vergi ve GTİP dahil
- [ ] Rol kontrollü Mağazama Aktar ve çift yönlü stok eşlemesi
- [ ] İade/değişim ile stok/fiyat hareketleri görünümü
- [ ] Gerçek verili Recharts analiz ekranları ve mobil/masaüstü doğrulama
