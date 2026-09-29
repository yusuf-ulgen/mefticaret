# Blog Sistemi v2 — Mağaza ve Platform Blogu

Mevcut yazılar, adresler (/blog/yazi-adi, /s/magaza/blog) ve veriler korunur; yalnız ekleme yapılır. Yeni özellikler `v2_blog_system` anahtarının arkasında (başlangıçta kapalı), açılınca eski ekran yerine yeni düzenleyici görünür.

## Mevcut durum (zaten var)
- Mağaza blogu: kategori, etiket, yazar, taslak/yayın/zamanlanmış durum, zamanlı yayın, AI yazar, kapak görseli üretimi.
- Platform blogu (mefticaret.com/blog): ayrı yazı listesi, Süper Yönetici düzenleme.
- Eksik: zengin düzenleyici (şu an düz metin kutusu), SEO sekmesi/skoru, yorumlar, beğeni/görüntülenme, revizyon geçmişi, ilgili yazılar, inceleme/arşiv durumları, mobilde kaydetme ve görsel yükleme sorunları.

## 1. Shopify seviyesinde düzenleyici (mağaza + platform)
- Sekmeler: İçerik / SEO / Ayarlar; mobilde sabit kompakt araç çubuğu.
- Araç çubuğu: H1-H3, kalın/italik/altı çizili, alıntı, kod, madde/numaralı/görev listesi, görsel (dosyadan yükleme), video (YouTube/Vimeo), tablo, ayraç, bilgi/uyarı/başarı kutusu, ürün kartı, koleksiyon, otomatik içindekiler, bağlantı.
- "/" komutları: /h1 /h2 /h3 /image /video /table /quote /code /product /collection /toc.
- Ürün kartı seçici: mağaza ürünlerinde arama, görünüm (Kart / Satır / Minimal); vitrinde görsel, fiyat, puan ve Sepete Ekle.
- Kapak görseli yükleme (1200×630 önerisi, alt metin), kelime sayısı ve okunma süresi.
- Kaydet menüsü: Taslak kaydet, Önizle (yeni sekme), İncelemeye gönder, Şimdi yayınla, Zamanla. 30 sn'de bir otomatik kayıt; mobilde form sıfırlanma hatası giderilir.
- Eski düz metin yazılar düzenleyicide otomatik biçimlendirilmiş açılır.

## 2. SEO sekmesi
- Google sonuç önizlemesi, SEO başlığı/açıklaması (karakter sayacı), URL, anahtar kelimeler, sosyal paylaşım başlığı/görseli, Schema tipi (BlogPosting/Article/NewsArticle/HowTo), canonical, noindex.
- SEO skoru 0-100 ve kontrol listesi (başlık uzunluğu, açıklama, kapak, H2 sayısı, iç bağlantı, görsel alt metni, kelime sayısı).
- Yayın sayfasında yapılandırılmış veri (JSON-LD) ve sosyal etiketler.

## 3. Yazı listesi ve yayın akışı
- Durumlar: Taslak, İncelemede, Zamanlanmış, Yayında, Arşiv.
- Filtre: durum, yazar, kategori, tarih, arama; Liste / Kart görünümü.
- İşlemler: Düzenle, Önizle, Kopyala, Arşivle, Zamanlamayı iptal et; öne çıkan yazı.
- Yayın takvimi: aylık görünüm (taslak / zamanlanmış / yayında).

## 4. Yorumlar, beğeni, görüntülenme
- Vitrinde yorum formu (ad, e-posta, yanıtlar), beğen düğmesi, görüntülenme sayacı.
- Panelde yorum moderasyonu: Onayla, Spam, Sil, Bekleyenlerin tümünü onayla; blog bazlı "herkes / kayıtlı / kapalı" ve onay zorunluluğu.
- Spam koruması: gizli tuzak alanı, IP başına günde 5 yorum, yasaklı kelime listesi, bağlantılı yorum otomatik incelemeye.

## 5. Revizyonlar ve ilgili yazılar
- Her kayıtta sürüm; geçmiş listesi, önizleme ve geri yükleme.
- İlgili yazılar: önce elle seçilenler, sonra aynı kategori, sonra ortak etiket (3 yazı); yazı sayfasının altında.

## 6. Vitrin
- Blog ayarları: düzen (liste / ızgara / dergi), sayfa başı yazı, yazar/tarih/etiket/yorum göster.
- Yazı sayfası: kategori yolu, yazar kutusu, içindekiler, ürün kartları, ilgili yazılar, yorumlar; "Daha fazla yükle".

## Kapsam dışı (ayrıca istenirse)
- Yeni genel API uçları (/api/v2/blogs): panel içi işlemlerle karşılanır.
- AI içerik planı ekranı: mevcut AI yazar korunur, yeni plan ekranı eklenmez.

## Teknik ayrıntılar
- Mağaza yazıları `store_pages` (page_kind='blog'), platform yazıları `platform_posts` içinde kalır; iki tabloya `ADD COLUMN IF NOT EXISTS` ile: body_json, cover_alt, reading_time_minutes, word_count, post_type, featured, allow_comments, seo_keywords, og_title, og_description, og_image_url, schema_type, view/like/comment_count, revision_count, last_edited_by/at. Durum listesine review/archived eklenir.
- Yeni tablolar (store_id null = platform): blog_settings, blog_comments, blog_post_revisions, blog_post_likes, blog_post_views (günlük tekil), blog_related_posts, blog_post_categories. Hepsi RLS + GRANT; yönetim `can_manage_store`, platform için süper admin; vitrin yalnız onaylı yorumları ve yayındaki yazıları okur.
- Yorum/beğeni/görüntülenme yazma işlemleri doğrulamalı sunucu işlevleri + mevcut hız sınırı ile; e-posta/IP yalnız panelde görünür.
- Düzenleyici mevcut Tiptap paketleri + table, task-list, image, youtube, underline eklentileri; ürün kartı ve bilgi kutusu özel düğümler. HTML çıktısı sunucuda temizlenir (XSS).
- Görsel yükleme mevcut depolama/medya kitaplığı üzerinden.
- Zamanlı yayın mevcut `publish_due_blog_posts` işine bağlanır; yeni sık tekrarlanan iş eklenmez.
- Paket anahtarları: blog_rich_editor, blog_product_blocks, blog_comments, blog_revisions, blog_seo_tools, blog_editorial_calendar, blog_related_posts (plan_features).
