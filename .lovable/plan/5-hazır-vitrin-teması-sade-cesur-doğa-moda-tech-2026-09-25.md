# 5 Hazır Vitrin Teması: Sade, Cesur, Doğa, Moda, Tech

Mevcut 5 hazır tasarım (Minimal/Bold/Nature/Boutique/Tech), senin verdiğin tam tasarım sistemleriyle değiştirilecek. Mağaza sahibi Hazır Temalar ve Tema Marketi'nden birini seçip tek dokunuşla kurabilecek. Kurduktan sonra her şey Tema Editörü v2'de düzenlenebilir kalacak.

## Ne yapılacak

**1. Beş temanın renkleri ve yazı tipleri**
Her tema, verdiğin renkleri (ana, ikincil, vurgu, arka plan, metin, kenarlık) ve yazı tiplerini kullanacak:
- Sade: Playfair Display + Inter
- Cesur: Space Grotesk 900 + DM Sans, koyu mod varsayılan
- Doğa: Lora + Source Sans 3, el yazısı vurgular için Caveat
- Moda: Cormorant Garamond + Jost, 15px, geniş harf aralığı
- Tech: Plus Jakarta Sans + Inter + JetBrains Mono, mavi→mor geçişli renk

Yazı tipleri yalnız seçili tema için yüklenecek; önceden bağlantı kurulacak ve hızlı yüklenecek.

**2. Yeni ana sayfa bölümleri**
Hepsi editörde sürüklenebilir ve ayarlanabilir olacak:
- Kayan şerit (marquee)
- Geri sayımlı flash indirim
- Güven rozetleri (kargo/iade/güvenli ödeme)
- Animasyonlu sayaçlar
- Değerlerimiz ikonları
- Yuvarlak kategoriler
- Üretici hikâyesi
- Instagram 9'lu ızgara
- Lookbook (dağınık ızgara + fotoğraftaki ürüne dokununca ürün etiketi)
- Tek öne çıkan ürün
- Marka hikâyesi
- Basında biz logo şeridi
- Özellik kartları
- Plan karşılaştırma tablosu
- SSS (açılır-kapanır)
- Geçişli çağrı bandı
- Video arka planlı hero seçeneği
- Doğa teması için organik şekilli görseller

**3. Temaya özel ürün kartı davranışları**
Kart bölüme göre ayarlanabilecek:
- Sade: üzerine gelince ikinci görsel
- Cesur: "3 kaldı!" stok barı, sınırlı stok rozeti, hızlı bakış penceresi
- Doğa: malzeme listesi, üretim yeri etiketi (ör. "Ege'den"), organik/helal/vegan rozetleri
- Moda: renk seçici noktalar, favoriye ekleme kalbi
- Tech: Yeni/Çok Satan/İndirimli rozetleri

**4. Ortak başlık ve mobil deneyim**
- Kaydırınca küçülen yapışkan başlık
- Koleksiyonlar için mega menü
- Anlık arama
- Sepet rozeti, hesabım ikonu, telefonda hamburger menü
- Alt gezinme çubuğu
- En az 44px dokunma alanları
- Yüklenirken iskelet görünüm
- Sağdan kayan sepet paneli: miktar, kaldırma, kupon, KDV'li toplam, "Ödemeye Geç"

**5. Tema renklerinin diğer sayfalara taşınması**
Mevcut ürün listesi, ürün detayı ve ödeme sayfaları seçili temanın renk ve yazı tiplerini alacak. Bu sayfalardaki filtre, galeri, varyant, yorum ve il/ilçe özellikleri zaten var; yeniden yazılmayacak, sadece görünüşleri temaya uyacak.

## Kapsam dışı (ayrı bir adımda yapılabilir)
- Moda'daki beden rehberi ve "Outfit'i tamamla" önerileri
- Tech'deki ürün karşılaştırma aracı ve teknik özellik tablosu, ürün sayfasında
- "Uzman Desteği" canlı sohbet: mevcut Mesaj Merkezi bağlantısı kullanılır, yeni sohbet sistemi kurulmaz
- Next/Image: bu platformda yok. Görseller mevcut WebP + tembel yükleme ile gelir.

## Teknik ayrıntılar
- `src/lib/theme-v2.ts`:
  - Yeni section/block tanımları ve varsayılanlar
  - `V2_FONTS` listesine yeni fontlar
  - `letter_spacing`, `gradient` ve `heading_accent_font` global ayarları
  - `v2RootCss` güncellemesi
- `src/components/theme-v2/page-renderer.tsx`:
  - Yeni bölümlerin render'ı
  - Ürün kartı varyantları
  - Hızlı bakış (shadcn Dialog)
  - Sepet slide-over (shadcn Sheet)
  - Sayaç/marquee (CSS + `prefers-reduced-motion`)
  - Framer Motion yalnız sepet ve hızlı bakış girişlerinde
- Yeni migration:
  - `v2_theme_presets` içindeki 5 kaydı güncelleme (anahtar korunur)
  - `v2_theme_templates` resmî kayıtlarını senkronlama
  - Mevcut mağaza temalarına dokunulmaz
- Font yükleme: storefront route head'inde yalnız aktif temanın Google Fonts linki + preconnect.
- Legacy storefront ürün/liste/ödeme sayfalarına `v2RootCss` değişkenlerinin uygulanması.
- Testler: preset doğrulama, sanitize, CSS üretimi. Playwright ile telefon boyutunda 5 temanın kurulup yayınlanması.
