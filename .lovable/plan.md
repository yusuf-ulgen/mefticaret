# Tedarikçi Panelini Tam Mobil Uyumlu Hale Getirme

## Amaç
Mevcut tedarikçi panelinin işlevlerini ve gerçek verilerini değiştirmeden, bütün ekranları 393 px telefon genişliğinde rahatça kullanılabilir hale getirmek.

## Yapılacaklar
- Panel üst alanını ve beş bölümlü sabit alt menüyü güvenli alanlarla, kesilmeyen başlıklarla ve yeterli dokunma alanlarıyla düzenlemek.
- Profil, bakiye, B2B cari hesap, RFQ, banka ve ödeme alanlarını telefonda tek sütuna; metrikleri okunabilir iki sütunlu düzene geçirmek.
- Sipariş filtrelerini yatay taşma olmadan çalıştırmak; ürün satırlarını masaüstünde tablo, telefonda görselli kart olarak göstermek.
- Kargo firması, takip numarası, kabul, etiket ve kargoya verme işlemlerini telefon ekranında tam genişlikte ve başparmak erişimine uygun sunmak.
- Ürün arama, kategori, sıralama, seçim ve mağazaya aktarma araçlarını küçük ekranlarda üst üste ve sabit genişlik sorunu olmadan düzenlemek.
- Ürün ayrıntısı, Mapping Studio ve diğer açılır pencereleri telefon ekranını kaplayan, kendi içinde kaydırılabilen görünüme dönüştürmek.
- XML/Excel yükleme, durum rozetleri, hata/uyarı denetçisi ve yükleme geçmişini telefonda kart listesi olarak göstermek.
- Değişimler, stok/fiyat hareketleri ve analiz grafiklerini taşma olmadan ölçeklemek; uzun ad ve tutarların diğer içerikleri itmesini önlemek.
- Masaüstü düzenini koruyup 393×667 ve 1280 px görünümlerinde görsel doğrulama yapmak.

## Teknik ayrıntılar
- Değişiklikler yalnız tedarikçi panelinin sunum katmanında yapılacak; veri sorguları, yetki kapsamı ve ödeme/senkron iş kuralları değişmeyecek.
- Mobil başlıklarda `grid-cols-[minmax(0,1fr)_auto]`, metin alanlarında `min-w-0`, sabit araçlarda `shrink-0` kullanılacak.
- Tablolar küçük ekranda semantik kart listelerine dönüşecek; masaüstü tabloları korunacak.
- Mevcut tasarım tokenları ve Button bileşenleri kullanılacak.

## Doğrulama
- Tedarikçi hesabıyla Profil, Siparişler, Ürünler, Değişimler ve Analiz bölümleri tek tek açılacak.
- 393×667 görünümünde yatay taşma, örtüşme, kesilen düğme/metin ve alt menü güvenli alanı kontrol edilecek.
- 1280 px görünümünde masaüstü düzeninde gerileme olmadığı doğrulanacak.
