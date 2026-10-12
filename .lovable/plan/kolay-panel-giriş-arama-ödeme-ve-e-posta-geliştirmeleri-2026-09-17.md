# Kolay Panel: giriş, arama, ödeme ve e-posta geliştirmeleri

Beş isteği tek turda, birbirini bozmadan sırayla yapacağım. Kolay Panel kurumsal paketlerden bağımsız kalmaya devam eder.

## 1. Girişte telefon doğrulaması kalkıyor, e-posta + şifre geliyor

- `/ev-hanimlari` ekranındaki SMS kodu akışı tamamen kaldırılır.
- Yerine tek ekranda "Giriş yap" / "Hesap oluştur" sekmesi: e-posta, şifre (en az 8 karakter) ve kayıtta ad.
- "Şifremi unuttum" bağlantısı e-posta ile sıfırlama gönderir.
- Girişten sonra akış aynı: kaydı olmayan üretici `/ev-hanimlari/kurulum` adımına, kaydı olan doğrudan Kolay Panel'e gider. `home_maker` rolü yine sunucu tarafında atanır.
- Kurumsal giriş ekranları değişmez.

## 2. Ürünler için doğal arama sayfası

- Kolay Panel mağazalarına arama motorlarına açık ürün listesi sayfası: `/s/<magaza>/products` içinde arama kutusu, kategori/etiket seçimi ve fiyat sıralaması; sonuçlar telefon vitriniyle aynı canlı stok ve fiyatı gösterir.
- Bu sayfa ve ürün sayfaları için ürün verisi işaretlemesi (Product/ItemList) eklenir, böylece Google sonuçlarında fiyat ve stok görünür.
- Kolay Panel mağazalarının ürün sayfaları ürün site haritasına eklenir; mağaza içi hızlı arama sayfası (anlık sonuç) arama motorlarına kapalı kalır ki aynı içerik iki kez indekslenmesin.

## 3. Google Search Console kontrolü

- Doğrulanmış `mefticaret.com` kaydı üzerinden Kolay Panel mağazalarının vitrin, ürün listesi ve örnek ürün adresleri tek tek incelenir.
- Her adres için indeks durumu, Google'ın gördüğü başlık/açıklama uyumu ve engel var mı raporlanır. Google'a "yeniden taranma" isteği bu arayüzden gönderilemez; durumu ve gerekiyorsa yapılacakları yazarım.

## 4. Ürün seçilince ödeme sayfası ve otomatik sipariş

- Vitrin ve ürün sayfasındaki karta "Hemen satın al" düğmesi: ürün doğrudan ödeme sayfasına taşınır, sepete uğramaya gerek kalmaz.
- Ödeme sayfası Kolay Panel mağazaları için sadeleşir: ad, telefon, adres ve ödeme yöntemi.
- Sipariş, ödeme başlarken taslak olarak kaydedilir; ödeme onaylanınca "ödendi" olur, iptal edilirse kapatılır. Sipariş hem mağaza sahibinin Siparişlerim ekranında hem süper yönetici tarafında görünür.
- Kartla tahsilat kapalıysa düğme IBAN/WhatsApp ile onaylı siparişe düşer; sahte ödeme onayı verilmez.

## 5. Stok, fiyat ve sipariş e-postaları

- Bunun için önce size ait bir gönderici alan adının kurulması gerekiyor; kurulum penceresini açacağım.
- Alan adı hazır olduktan sonra üç bildirim: yeni sipariş (mağaza sahibine), stok kritik seviyeye düştü, fiyat değişikliği onayı.
- Alıcıya ayrıca sipariş özeti e-postası gider. Bildirimler Kolay Panel ayarlarından tek tek açılıp kapatılabilir.

## Teknik notlar

- Auth: `supabase.auth.signInWithPassword` / `signUp` + `resetPasswordForEmail`; `ev-hanimlari.index.tsx` yeniden yazılır, `getHomeMakerProfile` ve `createHomeMakerStore` RPC akışı korunur.
- SEO: `s.$slug.products.tsx` içinde ItemList + Product JSON-LD; `sitemap-products.xml` micro mağazaları kapsar; `s.$slug.search.tsx` `noindex` kalır.
- Ödeme: `startOrderPayment` + `placeOrder` yeniden kullanılır; `?buy=<productId>` arama parametresi ile tek ürün kasası; micro mağazalarda plan/abonelik kontrolü yok.
- E-posta: Lovable yönetimli gönderim (`sendTemplateEmail`), şablonlar `src/lib/email-templates/`; kuyruk/tablo oluşturulmaz. Sipariş tetikleyicisi sunucu fonksiyonunda çalışır.
- Doğrulama: `bunx tsgo --noEmit`, 360px Playwright akışı (giriş, arama, satın al) ve vitrin/sitemap HTTP kontrolleri.
