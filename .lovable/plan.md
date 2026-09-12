# Mef-Ultra E-Ticaret Teması

## Amaç
Mef-Ultra’yı mevcut Mefticaret tema mağazasına eklenen, gerçek mağaza ürün/kategori/sepet verilerini kullanan ve masaüstü ile mobilde çalışan premium bir tema olarak oluşturmak.

## Yapılacaklar
1. **Tema paketi ve görsel kimlik**
   - Mef-Ultra tema kaydı, fiyat/özellik/kapak bilgileri ve kurulum şablonu.
   - Uyumlu hero, lookbook, kampanya ve sosyal akış görsellerinden oluşan özgün varlık seti.
   - Modern siyah, beyaz, mercan ve yeşil vurgulu; güçlü ticari tipografi ve erişilebilir kontrast.

2. **Dönüşüm odaklı vitrin**
   - Sayaçlı duyuru şeridi, para birimi/dil seçimleri, sticky header, görselli arama, çok seviyeli mega menü.
   - Favori, karşılaştırma ve AJAX sepet sayaçları; mobil menü ve hızlı alt navigasyon.
   - Slider hero, dairesel kategoriler, sekmeli ürünler, hotspot lookbook, stok göstergeli flash sale ve sosyal galeri.

3. **Ürün listeleme ve ürün detay deneyimi**
   - Fiyat, renk, beden ve stok filtreleri; 2/3/4 kolon ve liste görünümü.
   - Hover görsel değişimi, renk swatch’ları, hızlı bakış ve hızlı sepete ekleme.
   - Zoom ve küçük görseller galerisi, varyant seçiciler, beden tablosu, canlı izleyici/stok uyarısı, teslimat hesabı, birlikte alınanlar ve akordeon içerikler.

4. **Sepet ve ticari akış**
   - Ücretsiz kargo ilerlemesi, gerçek sepet satırları, adet güncelleme, sipariş notu ve ödeme yönlendirmesi.
   - Sepet içinde gerçek ürünlerden tamamlayıcı ürün önerileri.

5. **Editör, önizleme ve doğrulama**
   - Tema Stüdyosu bölüm ayarlarıyla düzenlenebilir alanlar ve tema mağazasında canlı önizleme/kurulum.
   - Mobil ve masaüstü görsel kontroller; arama, menü, filtre, hızlı bakış, varyant ve sepet akışlarının etkileşim testi.
   - Mevcut temalar ve ödeme/SEO/veri akışları korunacak.

## Teknik ayrıntılar
- Mevcut TanStack Start, React, TypeScript, Tailwind v4, Lucide ve mağaza veri sorguları kullanılacak.
- Tema davranışı Mef-Ultra kimliğine göre izole edilecek; diğer temalara görsel veya davranış regresyonu taşınmayacak.
- Sahte ürün/fiyat/stok kullanılmayacak; demo içerik yalnızca tema mağazası önizlemesinde gösterilecek.
- Hareketler `prefers-reduced-motion`, klavye kullanımı ve WCAG 2.2 AA hedefleriyle uyumlu olacak.
