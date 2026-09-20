# Mobil B2B Tedarikçi Uygulaması ve Akıllı Alan Eşleştirme

## Amaç
Mevcut gerçek tedarikçi verilerini ve güvenli erişim modelini koruyarak, Trend_Molli referanslarındaki mobil deneyimi Mefticaret’e uyarlamak. Uygulama; tedarikçi ve yetkili satıcı rollerine göre gerçek sipariş, ürün, stok, komisyon, ödeme ve analiz verileriyle çalışacak.

## Uygulama kapsamı

### 1. Mobil uygulama iskeleti
- Mevcut masaüstü mağaza panelini etkilemeyen ayrı bir tedarikçi uygulama kabuğu oluşturulacak.
- Turuncu üst alan, açık zemin, kompakt kartlar ve sabit alt menü referans ekranların ölçü ve hiyerarşisine göre uygulanacak.
- Alt menü: **Profil, Siparişler, Ürünler, Değişimler, Analiz**.
- Masaüstünde aynı içerik genişletilmiş iki sütunlu yerleşime dönüşecek; mobilde tek elle kullanıma öncelik verilecek.

### 2. Profil, finans ve ödeme cüzdanı
- Gerçek komisyon defterinden `Net = Hakediş - Ödenen - Kesilen` özeti üretilecek.
- Bekleyen, yolda, ulaşan ve iade sayaçları gerçek siparişlerden hesaplanacak.
- Teslimat başarı oranı halka grafikle gösterilecek.
- IBAN kaydetme ve bakiye sınırı kontrollü ödeme talebi mevcut güvenli sunucu işlemleri üzerinden korunacak.
- Ödeme/kesinti geçmişi yeşil ve kırmızı durum ayrımıyla gösterilecek; uydurma hareket üretilmeyecek.

### 3. Sipariş ve kargo masası
- Durum filtreleri ve mobil sipariş kartları eklenecek.
- Kartlarda müşteri, telefon, adres, tutar, ürün görselleri, taşıyıcı ve takip kodu gösterilecek.
- Sipariş ayrıntı panelinde ürün satırları, SKU, varyant, adet, birim fiyat, not ve %0,50 komisyon/net hakediş yer alacak.
- Kabul, kargoya verme, takip kodu ve etiket işlemleri mevcut yetki kontrolleriyle çalışacak.

### 4. Ürün kataloğu ve akıllı alan eşleştirme
- Mevcut XML/CSV/Excel/JSON motoru mobil sürükle-bırak akışına dönüştürülecek.
- Başlık, açıklama, alış/satış fiyatı, SKU, barkod, renk/beden varyant matrisi, galeri, vergi oranı ve GTİP alanları desteklenip satır içi hata vurguları gösterilecek.
- Kategori ve sıralama panelleri, ürün ızgarası ve ürün ayrıntı paneli oluşturulacak.
- Ürün ayrıntısında iki sepet seçimi, varyantlar, görsel indirme, paylaşım ve WhatsApp tetikleyicisi bulunacak.

### 5. Mağazama Aktar ve çift yönlü stok
- Hem tedarikçi hem satıcı hesabında erişim sunulacak; her rolde mağaza üyeliği ve ürün sahipliği sunucuda doğrulanacak.
- Başlık, açıklama, galeri, varyant, stok ve SEO alanları mağaza kataloğuna tek işlemde kopyalanacak.
- Satıcının kayıtlı varsayılan kâr kuralı uygulanacak; örnek %30 kod içine sabitlenmeyecek.
- Kaynak ürün ile mağaza ürünü arasında kalıcı eşleme kurulacak; satış ve tedarikçi beslemesi stok değişiklikleri güvenli biçimde senkronize edilecek.
- Çakışma, stok alt sınırı ve devre dışı kaynak durumları kayda alınacak.

### 6. Değişimler
- İki alt sekme olacak: **İade & Değişim** ve **Stok & Fiyat Hareketleri**.
- İlk sekme gerçek iade taleplerini ve kargo durumlarını; ikinci sekme ürün senkronu, fiyat ve stok hareket geçmişini gösterecek.

### 7. Analiz
- Favori ürünler, çok satanlar ve satış grafik alt sekmeleri oluşturulacak.
- Çok satanlar görünümü Genel / Sattıklarım ayrımını yetkiye uygun gerçek sorgularla sunacak.
- Saatlik, günlük, aylık ve yıllık zaman aralığı; adet ve ciro ölçütü seçilebilecek.
- Recharts ile etkileşimli grafik; adet, ciro, reklam bütçesi, sepet ortalaması ve reklam/ciro oranı gerçek mevcut veriden hesaplanacak. Veri yoksa açık boş durum gösterilecek.

## Güvenlik ve veri kuralları
- Tedarikçi yalnız kendi kayıtlarını görecek; satıcı yalnız üyesi olduğu mağazaya ürün aktarabilecek.
- Yönetici yetkisi istemciden, URL’den veya yerel depolamadan kabul edilmeyecek.
- Yeni tablolarda açık izinler, satır güvenliği ve mağaza/tedarikçi kapsamı aynı veritabanı değişikliğinde tanımlanacak.
- Gizli anahtar, sahte ödeme/kargo sonucu, sabit limit veya örnek finansal veri eklenmeyecek.

## Teknik uygulama
- React 19, TypeScript, Tailwind CSS v4, mevcut Shadcn bileşenleri ve Recharts kullanılacak.
- Mevcut `supplierDeskOverview`, ödeme, kargo, besleme ve import işlemleri korunup mobil ekranların ihtiyaç duyduğu güvenli sorgularla genişletilecek.
- Ürün kaynak eşlemesi ve çift yönlü stok için mağaza kapsamlı yeni kayıt modeli ve idempotent sunucu işlemleri eklenecek.
- Büyük dosyalarda tarayıcıyı kilitlememek için doğrulama ve yazma parçalı ilerleyecek; sonuçlar yükleme geçmişine kaydedilecek.

## Doğrulama
- Sağlanan 20 ekranın her biri mobil görünümde görsel karşılaştırmayla kontrol edilecek.
- Profil, sipariş filtreleme/ayrıntı/kargo, alan eşleme, hatalı satır, mağazaya aktarım, stok senkronu, iade/değişim ve analiz akışları gerçek yetkili hesapla uçtan uca test edilecek.
- Tedarikçinin başka tedarikçi verisine, satıcının başka mağazaya erişemediği ayrıca doğrulanacak.
- 393 px mobil ve 1280 px masaüstünde taşma, örtüşme ve alt menü güvenli alanı kontrol edilecek.

## Referans bekleme noktası
20 Trend_Molli ekranı henüz yüklenen dosyalar arasında görünmüyor. Uygulamaya başlamadan önce kullanıcı bunları görsel veya tek PDF olarak yükleyecek; ekran sırası ve ayrıntıları bu referanslara göre birebir eşlenecek.
