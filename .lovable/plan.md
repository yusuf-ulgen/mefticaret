# Rehberler, Kolay Panel başlangıç turu ve İngilizce sayfa

## 1. E-ticaret rehberini Google için güçlendir
- `/e-ticaret-nasil-yapilir` başlığını arama kalıbına yakınlaştır, açıklamayı "nasıl yapılır / neler gerekli / maliyet / kendi sitem mi pazaryeri mi" sorularını kapsayacak şekilde yeniden yaz.
- Sayfa içi bölüm bağlantıları (içindekiler) ekle; rehberden paketler, mağaza kurma, pazaryeri ve dropshipping sayfalarına, o sayfalardan da rehbere karşılıklı iç bağlantı ver.
- HowTo + FAQ yapısal verisi ekle, site haritası ve hızlı indeksleme listesini güncelle.

Not: Google'da ilk sıraya çıkmayı ne biz ne Semrush garanti edebilir; yapabileceğimiz, doğru sayfayı doğru sorularla eşleştirip Google'a hızlı bildirmek. Sıralama Google'ın kararı ve zaman alır.

## 2. İngilizce sayfa ve yurt dışı kırılım
- `/en/how-to-start-an-online-store` adresinde İngilizce rehber sayfası; Türkçe rehberle karşılıklı `hreflang` (tr / en) bağlantısı.
- Ana sayfa ve rehberlerde dil geçiş bağlantısı; site haritasına ekleme.
- Yurt dışı arama kırılımı: şu an yabancı ülkelerden gösterim neredeyse yok. Sayfa yayına girdikten sonra Search Console ülke raporunu okuyup ölçülen durumu paylaşırım. Türkiye'den gelen aramaları başka ülkeye "yönlendirmek" mümkün değil; yurt dışı talep ancak İngilizce içerikle zamanla oluşur.

## 3. Kolay Panel'e "Yeni mağaza rehberi"
- Kolay Panel Mağazam sekmesinde dört adımlı başlangıç kartı: mağaza oluştur → vitrin/tema kur → ürün yükle → ödeme ayarla.
- Her adım gerçek veriye bakarak kendini tamamlar (mağaza var mı, vitrin yayında mı, ürün var mı, tahsilat yöntemi tanımlı mı) ve ilgili ekrana götürür; tamamlanınca kart kapanır.

## 4. E-ticaret rehberi sayfası
Sayfa geçen turda eklendi; bu turda 1. maddedeki bağlantı ve meta iyileştirmeleriyle tamamlanacak.

## 5. Uçtan uca doğrulama
Kolay Panel'den yeni hesap + mağaza açıp tema, ürün ve ödeme adımlarını sırayla geçerek şunları kontrol ederim: her adımda veritabanı yetkisi doğru çalışıyor mu, boş vitrin hata vermeden açılıyor mu, ürün eklendiğinde vitrine yansıyor mu. Sonuçları ekran görüntüleriyle bildiririm.

## Teknik notlar
- Yeni rotalar: `src/routes/e-ticaret-nasil-yapilir.tsx` (güncelleme), `src/routes/en.how-to-start-an-online-store.tsx`.
- Kolay Panel kartı: `src/routes/_authenticated/store.$storeId.kolay.tsx` + `kolay-parts.tsx`; mevcut sorgular kullanılacak, yeni tablo yok.
- `sitemap[.]xml.ts` ve `src/lib/indexnow.server.ts` yeni URL'lerle güncellenecek.
- Doğrulama: `bunx tsgo --noEmit`, Playwright 393px ve 1280px.
