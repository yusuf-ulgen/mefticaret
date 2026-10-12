# Ev üreticisi mağaza vitrini

## Amaç
Ev hanımları paketine kaydolan herkesin, kurulum biter bitmez görsellerdeki sade iki kolonlu düzende çalışan gerçek bir mağaza vitrini ve ürün sayfaları olsun.

## Yapılacaklar
- Ev hanımı kurulumunda açılan mağazayı otomatik olarak yayına hazırla; mağaza adresi ilk girişten itibaren erişilebilir olsun.
- Yeni mağazaya vitrinin ihtiyaç duyduğu temel ayarları güvenli biçimde oluştur; mağaza adı, kategori ve iletişim bilgileri aynı gerçek mağaza kaydına bağlı kalsın.
- Görsellerdeki mobil düzeni varsayılan vitrin yap: yuvarlak logo, mağaza adı/açıklaması, iletişim, kayan kategoriler, ürün sayısı, sıralama/filtre ve iki kolonlu ürünler.
- Ürün kartlarını gerçek ürün detay sayfalarına, kategori sekmelerini gerçek kategori sayfalarına, sipariş takibini gerçek takip ekranına bağla.
- Mağaza duraklatıldığında görsellerdeki gibi anlaşılır bir “satışlara ara verdi” bildirimi göster; ürünleri göstermeye devam edip satın alma akışını kapalı tut.
- Kolay Panel’deki “Mağaza sayfam” alanının yeni mağazanın gerçek adresini açtığını doğrula.
- Telefon boyutunda kayıt → panel → vitrin → ürün sayfası akışını test et.

## Teknik ayrıntılar
- Mevcut `/s/{slug}` yapısı ve ortak ürün/sipariş verileri korunacak; ayrı veya sahte veri oluşturulmayacak.
- Değişiklik yalnızca ev hanımları kurulum varsayılanları ve vitrin sunumuyla sınırlı olacak; kurumsal giriş ve panel rotaları değişmeyecek.
- Yetki kontrolleri sunucu tarafında ve mevcut satır güvenliği altında kalacak.
