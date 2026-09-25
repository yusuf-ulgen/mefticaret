# Tema Editörü v2 — Bölüm + Blok sistemi

## Mevcut durum
Platformda zaten bir Tema Stüdyosu var (bölüm listesi, sürükle-sırala, canlı önizleme, cihaz görünümü, ayar paneli, renk/font/görsel/zengin metin alanları, sürümler). Bu sisteme **dokunulmayacak**. v2 yanında ayrı çalışacak, paket özelliği kapalıyken hiçbir mağaza etkilenmeyecek.

## Yapılacaklar

1. **Veritabanı (yalnız ekleme)**
   - `v2_themes`, `v2_theme_pages`, `v2_sections`, `v2_blocks`, `v2_theme_presets` tabloları; mağaza bazlı RLS (mevcut `can_manage_store` kontrolü), vitrin için yalnız yayınlanmış temanın okunması.
   - Taslak ve yayın ayrımı: editör taslak üzerinde çalışır, "Yayınla" taslağın anlık görüntüsünü yayına kopyalar.
   - 5 resmi preset: Minimal, Bold, Boutique, Tech, Nature.
   - Paket özellikleri: `v2_theme_editor`, `v2_theme_presets`, `v2_custom_html` — tüm paketlerde kapalı.

2. **Bölüm ve blok kataloğu**
   - 12 bölüm tipi (hero, öne çıkan ürünler, banner, duyuru, yorumlar, blog, görsel+metin, video, özel HTML, bülten, koleksiyon listesi, zengin metin) ve 14 blok tipi, istenen ayarlarla.
   - Sunucu tarafında ayarlar yalnız tanımlı alanlar ve tiplerle kabul edilir.
   - Özel HTML: DOMPurify ile temizlenir, yalnız `v2_custom_html` açık mağazalarda eklenebilir.

3. **API — `/api/v2/themes`, `/api/v2/sections`, `/api/v2/blocks`, `/api/v2/theme-presets`**
   - İstenen tüm uçlar; mevcut API anahtarı kapsamları, rate limit, UUID doğrulama ve özellik kontrolü ile.
   - Değişiklikte vitrin önbelleği temizlenir, vitrin render önbelleği 10 dk.

4. **Editör (3 panel, `/store/$storeId/theme-editor-v2`)**
   - Sol: bölümler ve altında bloklar, iki seviyeli sürükle-sırala, göster/gizle, onaylı sil, "Bölüm ekle" ve "Blok ekle" pencereleri.
   - Orta: canlı önizleme, mobil/tablet/masaüstü, sayfa seçici (ana sayfa, ürün, koleksiyon, sepet, blog, özel), tıkla-seç.
   - Sağ: seçilen bölüm/blok ayarları — mevcut stüdyonun renk, font, görsel yükleme, link seçici, kaydırıcı, açma/kapama ve TipTap alanları tekrar kullanılır.
   - Global Tema Ayarları sekmesi: renkler, tipografi (h1–h6, p), butonlar, düzen.
   - Geri al / yinele (Ctrl/Cmd+Z, Ctrl/Cmd+Y, 50 adım), taslak tarayıcıda saklanır ve yenilemede geri yüklenir.
   - Preset penceresi: önizleme, "Uygula" (yalnız renk/font), "Sıfırdan uygula" (yapı da değişir).

5. **Mobil kullanım**
   - Bölümler tam ekran liste, ayarlar alttan açılan pencere, önizleme ayrı sekme, uzun basınca sürükleme, en az 44px dokunma alanları.

6. **Vitrin**
   - `PageRenderer → SectionRenderer → BlockRenderer`; global ayarlardan CSS değişkenleri; tüm görseller varsayılan lazy.
   - Mağazada yayınlanmış bir v2 tema **ve** özellik açıksa ana sayfa v2 ile çizilir. Diğer durumlarda mevcut vitrin aynen devam eder.

7. **Doğrulama**
   - Katalog/ayar normalizasyonu ve undo/redo için birim testler, tip kontrolü, özellik açılmış bir mağazada tarayıcı testi.

## Kapsam dışı / notlar
- Redis yok; mevcut veritabanı tabanlı önbellek kullanılacak. Görseller mevcut medya depolamasından servis edilir.
- Ayrı "preset marketplace" satışı yok; presetler yalnız bu özellik açıkken listelenir.
- İlk sürümde vitrinde v2 yalnız ana sayfa ve özel sayfalarda devreye girer; ürün/koleksiyon/sepet sayfa şablonları editörde tasarlanabilir ama vitrindeki mevcut sayfalar değişmez (sonraki adım).
