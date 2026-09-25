# Tema Sistemi v2: Marketplace, Kütüphane, Önizleme, Sürümler, Zip

## Mevcut sistemle çakışmalar ve kararlar
Birçok parça zaten var: eski tema tabloları (`themes`, `store_themes`, `store_installed_themes`, `store_theme_purchases`, `store_theme_versions`, `theme_settings`, `theme_preview_sessions`), bir önceki turda kurulan Tema Editörü v2 (`v2_themes`, `v2_theme_pages`, `v2_theme_presets`) ve `/api/v2/themes` uçları. Bunların hiçbiri silinmeyecek, adı da değişmeyecek.

- **Mağazanın temaları:** ayrı bir `v2_tenant_themes` tablosu açılmayacak, çünkü aynı işi yapan `v2_themes` zaten var ve editör ona bağlı. Onun yerine `v2_themes`'e yalnızca yeni sütunlar eklenecek: `template_id`, `status` (active/draft/archived), `version`, `installed_at`, `settings`, `customizations`. Mevcut satırlar kendiliğinden "active" ya da "draft" olur.
- **Adresler:** `/admin/themes` şu an süper yönetici sayfası, ona dokunulmayacak. Satıcı sayfaları mağaza panelinde açılacak:
  - `/store/{id}/theme-marketplace` (liste ve detay)
  - `/store/{id}/theme-library`
  - `/store/{id}/theme-library/{themeId}/versions`
  - Süper yönetici `/admin/theme-templates` sayfasında şablon ekleyip düzenleyecek.
- **Ücretli temalar:** mevcut QNBpay tema lisansı akışı kullanılacak. Ücretli bir şablon, lisansı yoksa yüklenmez. Tek seferlik ödeme olur; aylık tema aboneliği bu turda yok.
- **Redis:** sistemde yok. Üretilen CSS 1 saat boyunca mevcut `cache_entries` tablosunda tutulacak ve her kayıtta ya da yayınlamada sıfırlanacak.
- **Mevcut hazır tasarımlar:** Minimal, Bold, Boutique, Tech ve Nature, `v2_theme_presets`'ten resmi, ücretsiz marketplace şablonu olarak kopyalanacak. Kendi ekran görüntüleri gerçek önizlemeden alınacak.

## Veritabanı (yalnızca yeni ekleme)
- `v2_theme_templates`: ad, slug, açıklama, önizleme görseli ve demo linki, yazar, sürüm, fiyat, kategori, etiketler, resmi/öne çıkan bilgisi, indirme sayısı, ortalama puan, sayfa yapısı, varsayılan ayarlar, varlık zip adresi. Herkes yayındakileri görebilir; yalnızca platform yöneticisi yazabilir.
- `v2_theme_template_screenshots`: görsel, sıra, cihaz (desktop/tablet/mobile).
- `v2_theme_template_reviews`: mağaza başına 1 yorum ve 1–5 puan. Ortalama puanı ve indirme sayısını veritabanı günceller.
- `v2_theme_versions`: tam yedek, etiket, değişiklik özeti, kim değiştirdi. Her kayıtta otomatik oluşur; son 50 sürüm tutulur.
- `v2_theme_assets`: dosya türü (css/js/image/font), anahtar, metin ya da depolama adresi. JS dosyaları vitrine eklenmeden önce güvenlik kontrolünden geçer. Varsayılan olarak yalnızca CSS ve görseller vitrine eklenir; JS dosyası yalnızca saklanır.
- `v2_theme_preview_tokens`: tahmin edilemez bir anahtarın özeti (hash) ve 24 saatlik geçerlilik süresi.
- Tüm mağaza tabloları için mağaza üyeliğine göre erişim kuralı ve gerekli izinler tanımlanır.
- Plan özellikleri: `v2_theme_system`, `v2_theme_marketplace`, `v2_theme_versions`, `v2_theme_export`, `v2_theme_import`, `v2_dark_mode`. Hepsi varsayılan olarak kapalı.

## Global tema ayarları
- Mevcut ayar şeması 7 gruba genişletilecek: renkler (9), tipografi, düzen, butonlar, görseller, koyu mod, logo ve favicon. Bilinmeyen alanlar kayıtta atılır.
- Fontlar hazır listeden seçilir (Geist, Inter, Manrope, DM Sans, Playfair, JetBrains Mono ve diğerleri). Seçilen font önceden yüklenir.
- CSS üretici, istekteki `--color-*`, `--font-*`, düzen ve buton değişkenlerini, üretilmiş hover rengini ve `[data-theme="dark"]` bloğunu yazar. Koyu mod "otomatik" seçiliyse sistem tercihine göre çalışır.
- Editördeki "Tema Ayarları" sekmesi bu gruplarla bir accordion olur; telefonda alt sheet içinde açılır ve renk seçimi telefonun kendi renk seçicisiyle yapılır.
- Logo ve favicon mevcut medya deposuna yüklenir.

## Önizleme
- **Editör içi:** tuval bir iframe'e taşınır (`/theme-preview-frame`). Editör taslağı `postMessage` ile gönderir; mesajın geldiği adres kontrol edilir ve yalnızca izinli mesaj türleri kabul edilir. Masaüstü, tablet ve mobil arası geçiş ile tam ekran düğmesi olur.
- **Paylaşılabilir önizleme:** `/preview/{slug}?theme=…&token=…`. Anahtar sunucuda kontrol edilir ve 24 saat geçerlidir. Sayfa gerçek vitrin gibi görünür ve arama motorlarına kapalıdır (noindex). "Bu Temayı Yayınla" düğmesi yalnızca oturum açmış mağaza yetkilisine görünür.

## Zip indir ve yükle
- **İndir:** `theme.json` (ayarlar ve sayfa yapısı), `assets/` ve `README.md`. Tarayıcıda `fflate` ile oluşturulur.
- **Yükle:** zip sürükle-bırak. Şema doğrulaması, boyut ve dosya sayısı sınırı, çakışma uyarısı (aynı ad ya da slug), önizleme, onay ve "taslak" olarak ekleme. Kontrolün tamamı sunucuda tekrar yapılır.

## Kütüphane ve marketplace ekranları
- **Marketplace:** arama, kategori sekmeleri (Tümü / Moda / Elektronik / Yiyecek / Genel / Öne Çıkan), fiyat filtresi. Telefonda 1, masaüstünde 3 sütun kart. Kartlarda puan, fiyat, Önizle ve Yükle/Satın al düğmeleri.
- **Detay:** ekran görüntüsü galerisi (cihaz sekmeleri), canlı demo iframe'i, özellikler, yorumlar ve puan verme.
- **Kütüphane:** aktif tema kartı (Özelleştir, Önizle, ⋮ menü), ardından diğer temaların listesi. ⋮ menüsünde Önizle, Yayınla, Kopyala, Yeniden adlandır, Sürüm geçmişi, İndir ve Sil var. Aktif tema silinemez.
- **Sürüm geçmişi:** "Şu an aktif" rozeti, tarih ve kişi, özet, Önizle ve "Bu sürüme dön" (dönmeden önce mevcut hâl yedeklenir).
- Menüye "Tema Kütüphanesi" ve "Tema Marketi" eklenir; bu girdiler plan özellikleri kapalıyken görünmez.

## API
Yeni uçlar `/api/v2/` altında, mevcut API anahtarı izinleri (`read_themes` ve `write_themes`) ve istek sınırıyla eklenir:
- `theme-templates` (liste, detay, yükle)
- `themes` (liste, oluştur, detay, güncelle, sil, yayınla, kopyala, sürümler, sürüme dön, önizleme anahtarı, dışa aktar, içe aktar, ayarlar, css)

Mevcut `/api/v2/themes` davranışı korunur; yalnızca yeni alt yollar eklenir.

## Teknik ayrıntılar
- `src/lib/theme-system-v2.ts`: ayar şeması, CSS üretici, zip şeması.
- `theme-system-v2.server.ts` ve `.functions.ts`: `requirePlanModule` ile her özellik ayrı kontrol edilir.
- `theme-v2-api.server.ts` genişletilir.
- Vitrin (`s.$slug.index.tsx`) ayarlardan üretilen CSS'i ve kritik değişkenleri sayfanın içine yazar, font önceden yüklenir.
- Ücretli yükleme `store_theme_purchases` lisans kontrolünü tekrar kullanır.
- Tamamlanınca typecheck, CSS üretici ve zip doğrulama testleri çalıştırılır. Bir özellik test için açılıp kurma, düzenleme, yayınlama, sürüme dönme, önizleme bağlantısı ve zip akışı tarayıcıda denenir.

## Kapsam dışı
- Aylık tema aboneliği.
- Üçüncü taraf geliştiricilerin tema satması.
- Redis ve harici CDN (mevcut depolama kullanılır).
- Ürün, koleksiyon ve sepet sayfalarının v2 ile gösterilmesi. Bunlar önceki turdan açık kalan iş; ayrıca istenirse yapılır.
