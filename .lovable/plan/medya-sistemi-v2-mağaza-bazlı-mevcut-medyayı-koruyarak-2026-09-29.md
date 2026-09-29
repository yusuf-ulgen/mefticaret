# Medya Sistemi v2 — mağaza bazlı, mevcut medyayı koruyarak

Mevcut Medya sayfası (/store/$storeId/medya), klasörler ve yüklenmiş dosyalar korunur. Her mağaza yalnız kendi medyasını görür. Tüm eklemeler geri alınabilir (yeni sütun/tablo, hiçbir şey silinmez).

## Yapılacaklar

1. **Format desteği ve limitler**
   - Görsel (JPEG, PNG, WebP, GIF, AVIF, SVG, BMP, TIFF, HEIC, ICO), video (MP4, WebM, MOV, MKV, AVI, …), ses (MP3, WAV, FLAC, AAC, OGG, M4A), belge (PDF, Office, TXT, CSV, ZIP, XML, JSON), 3D (GLB, GLTF, OBJ, STL).
   - Dosya başına boyut sınırı (görsel 50 MB, video 2 GB, belge 100 MB, ses 50 MB, 3D 100 MB). Pakete göre günlük yükleme kotası sunucuda denetlenir. .exe gibi çalıştırılabilir dosyalar engellenir.
2. **Tarayıcıda otomatik görsel işleme (yüklerken)**
   - WebP sürümü, 150/400/800 küçük görseller, bulanık ön izleme (blurhash), baskın renk + 5 renk paleti, boyut/şeffaflık bilgisi.
   - Konum (GPS) ve kamera bilgileri KVKK gereği temizlenir (görsel yeniden kodlanır).
   - HEIC (iPhone) → JPEG dönüştürme.
   - Video: süre, çözünürlük ve kapak karesi (poster) çıkarılır.
3. **Medya Kütüphanesi arayüzü**
   - Tür filtresi (görsel/video/ses/belge/3D), sıralama, arama, grid/liste görünümü, klasör sayıları.
   - Sürükle-bırak toplu yükleme, dosya bazlı ilerleme, kota çubuğu; mobilde Kamera/Galeri/Dosya.
   - Sağ detay paneli: önizleme, bilgi, tasarruf oranı, alt metin/başlık/etiket düzenleme, URL kopyalama, boyut seçimi, indir/sil. Video için oynatıcı ve kapak karesi seçimi; 3D için döndürülebilir görüntüleyici.
4. **Görsel düzenleyici** — kırp (serbest/1:1/4:3/16:9/3:4), boyutlandır, döndür/çevir, parlaklık/kontrast/doygunluk, geri al/yinele; üzerine yaz veya yeni dosya kaydet.
5. **Filigran** — logo veya metin, 9 konum + döşeme, opaklık, boyut, kenar boşluğu, "yalnız ürün görselleri" seçeneği, canlı önizleme. Yeni yüklemelere uygulanır; "mevcut görsellere uygula" yeni kopya oluşturur, orijinali silmez.
6. **Ürün sayfası** — ürün düzenlemede "Kütüphaneden seç", URL ile ekleme, ürün videosu (yükleme veya YouTube/Vimeo) ve 3D model; vitrinde galeride video ve 3D görünüm.
7. **Özellik anahtarı** `v2_media_system` (varsayılan kapalı) — kapalıyken mevcut Medya sayfası aynen çalışır.

## Yapılamayacaklar (dürüst sınırlar)

Sunucumuz bulut üzerinde hafif bir ortamda çalışıyor; ağır video/dosya işleme programları çalıştırılamıyor. Bu yüzden:
- **Video dönüştürme** (H.264/WebM/HLS kalite seçenekleri, hover GIF) yapılmaz; video yüklendiği formatta oynatılır.
- **RAW (CR2, NEF, ARW, DNG), AI, EPS, TIFF** dosyaları saklanır ama önizleme/dönüşüm olmaz (TIFF tarayıcıya bağlı).
- **Virüs taraması** yok; bunun yerine dosya türü ve imza kontrolü yapılır.
- **AVIF üretimi** yalnız destekleyen tarayıcıda yapılır, aksi hâlde yalnız WebP.
- **Otomatik arka plan silme** ve anlık boyutlandırma adresi (/img/…/800x600) bu fazda yok.
- PDF'teki PHP/Laravel/Redis/Supervisor altyapısı bu projeye uygulanmaz.

## Teknik detaylar

- `media_assets` tablosuna `ADD COLUMN IF NOT EXISTS`: media_type, processing_status/error, webp_url, avif_url, thumbnail_sm/md/lg_url, blurhash, dominant_color, color_palette, has_transparency, is_animated, video_poster_url, fps, watermark_applied, original_filename, uploaded_by. (`folder_id`, `tags`, `alt`, `caption`, `usage_count` zaten var.)
- Yeni tablolar: `media_watermark_settings` (store_id başına), `media_upload_usage` (günlük bayt sayacı). GRANT + RLS `app_private.can_manage_store`.
- Kota ve tür/boyut doğrulaması `media-library.functions.ts` içinde `registerMediaAsset` öncesi sunucuda; limitler paket özellik tablosundan.
- İşleme: `browser-image-compression` yerine yerel canvas/OffscreenCanvas + `blurhash` + `heic2any`; 3D için `@google/model-viewer` yalnız istemcide dinamik yükleme.
- Mevcut storage yolu yapısı değişmez; türevler aynı klasörde `-sm.webp` vb. soneklerle.
