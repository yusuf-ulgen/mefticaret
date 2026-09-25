# Couture — Premium Moda Teması (adım adım)

Mağazada zaten olanlar tekrar yazılmaz; Couture onları kendi görünümüyle giydirir: ürün yorumları, beden rehberi, favoriler, karşılaştırma, stok bildirimi, koleksiyon/ürün/sepet/ödeme/hesap sayfaları, JSON-LD ve sitemap.

## Adım 1 — Tema ve ana sayfa (bu turda)
- Hazır Temalar'a **Couture**: verilen renkler (kırık beyaz, bej, derin siyah, bordo), Cormorant Garamond + Jost + Cormorant italik, 4px köşe, gölgeler, 1400px genişlik, 300/600ms geçişler.
- "Couture" efekt paketi: bölümler kayarak açılır, ürün kartları sırayla gelir, hero görseli 8 sn yavaş yakınlaşır, düğmede basma efekti, linklerde soldan alt çizgi, favoride kalp patlaması.
- 11 ana sayfa bölümü: ikiye bölünmüş hero (mobilde tam ekran görsel + alttaki yazı), 5 kategori (mobilde yana kaydırmalı), editöryel banner, "Bu Sezonun Favorileri", masonry lookbook, yeni gelenler kaydırıcısı, markalar şeridi, garantiler, müşteri yorumları, Instagram, bülten.
- Ürün kartı: ikinci görsele geçiş, alttan kayan "Sepete Ekle", renk noktaları, eski fiyat, gerçek puan ve yorum sayısı (yorumu olmayan ürünlerde gösterilmez).
- `/demo/couture` tanıtım sayfası (örnek ürünlerle, "Bu Temayı Kur" düğmesi).

## Adım 2 — Mağaza iskeleti
- Üç katlı yapışkan üst menü: kapatılabilir duyuru şeridi, arama + ikonlar, kategori satırı; 50px kaydırınca küçülür ve buzlu beyaz olur.
- Mega menü (mağaza kategorilerinden, 2 kampanya görseli), anlık arama (300ms, görsel+fiyat, popüler ve son aramalar).
- Mobil tam ekran menü, alt menü (Ana, Arama, Favoriler, Hesap, Sepet).
- Sağdan açılan sepet paneli: adet, kupon, ara toplam/kargo/indirim, "Bunları da sevebilirsin", uçan ürün ve sepet rozeti zıplaması.
- Dört sütunlu footer ve ödeme logoları (yalnızca mağazada açık yöntemler).

## Adım 3 — Liste ve ürün sayfası
- Filtreler (beden, renk, fiyat aralığı, marka, koleksiyon, indirimli) ve adetleri, aktif filtre çipleri, 6 sıralama, ızgara/liste görünümü, mobilde alttan açılan filtre/sıralama.
- Ürün detayı: küçük görseller + büyütme merceği, renk/beden seçimi, stok ve gerçek "Son X adet", adet seçici, QNBPay taksit tablosu, akordeonlar (açıklama, ölçü, malzeme/bakım, kargo/iade), puan dağılımı ve yorum filtreleri, "Bununla güzel gider", mobilde yapışkan alt bar.

## Adım 4 — Ödeme ve hesap
- Adım göstergeli ödeme: 81 il / bağlı ilçe seçici, fatura adresi, adres kaydetme; yalnızca mağazada gerçekten açık yöntemler (kart/QNBPay, kapıda ödeme, havale/EFT, mağaza kredisi).
- Hesabım sekmeleri: siparişler (takip, iade, tekrar sipariş), adresler, favoriler (sepete taşı, stok bildirimi), yorumlar, bilgiler.

## Kapsam dışı / dürüst sınırlar
- iyzico ve PayTR bağlı değil; bağlanmadıkça seçenek olarak gösterilmez. Kart bilgileri bizim sayfamızda değil, QNBPay'de girilir.
- App Store / Google Play rozetleri yalnızca mağaza bağlantı eklerse görünür.
- Instagram bölümü yüklenen görsellerle çalışır; canlı Instagram akışı yok.
- Uydurma puan, yorum, "X kişi bakıyor" veya sahte stok yok; demo sayfasındaki içerik "örnek" olarak işaretlenir.
- Lighthouse 90+ hedeflenir ama garanti edilmez; ölçüm yayın sonrası yapılır.

## Teknik
- Özellik anahtarları (`theme_couture`, `couture_wishlist`, `couture_quick_view`, `couture_size_guide`, `couture_reviews`, `couture_instagram`, `couture_compare`, `couture_back_in_stock`) paket özelliklerine eklenir, varsayılan kapalı; kapalıyken ilgili parça gizlenir, mevcut sistem etkilenmez.
- Adım 1: `v2_theme_presets` + `v2_theme_templates` kaydı, `style_preset: "couture"`, yeni bölüm türleri `category_tiles`, `editorial_banner`, `lookbook_masonry` (mevcut `lookbook`/`collection_list` yeterli değilse), `/demo/$slug` route'u.
- Adım 2–4: Couture teması seçili mağazalarda `storefront-chrome` ve ilgili route'larda koşullu Couture bileşenleri; diğer temalar değişmez.
- Her adım sonunda typecheck, testler ve 390px telefon ekranında Playwright ile kontrol.
