# Çok Dilli Ana Sayfa Eşitlemesi

## Amaç
Türkçe ana sayfadaki düzeni, bölüm sırasını ve işlevleri İngilizce, Almanca, Fransızca ve Arapça ana sayfalarda birebir korumak; yalnızca görünen metinleri dile göre değiştirmek.

## Yapılacaklar
- Türkçe ana sayfayı tüm dillerin kullandığı tek ortak sayfa yapısına dönüştürmek.
- Üst menü, açılır menüler, giriş/kayıt düğmeleri ve mobil menüyü her dilde çevirmek.
- Türkçe sayfadaki tüm bölümleri diğer dillere taşımak:
  - Ana tanıtım ve avantajlar
  - Canlı satış/ödeme akışı
  - Evde üreticiler için Kolay Panel
  - Modüller, entegrasyonlar ve platform özellikleri
  - Global satış, ihracat ve büyüme araçları
  - Uygulama vitrini
  - Paketler ve aylık/yıllık seçim
  - Rehberler, blog, sık sorulan sorular
  - Tedarikçi portalı, son çağrı ve alt bilgi
- Dinamik paket, uygulama ve blog verisini aynı tutup çevrilebilir etiketleri dile göre göstermek.
- Arapçada aynı yapıyı RTL yönünde korumak; diğer dillerde LTR kullanmak.
- Her dilin başlık, açıklama, sosyal paylaşım ve hreflang bilgilerini eksiksiz tutmak.
- 393 px telefon ve masaüstünde beş dili karşılaştırarak bölüm sırası, yatay taşma, menü ve görünür metinleri doğrulamak.

## Teknik yaklaşım
- Ortak sayfa bileşeni ve tip güvenli dil sözlükleri kullanılacak; ayrı dil sayfalarında farklı JSX düzenleri bırakılmayacak.
- Türkçe yönetim panelinden gelen ana sayfa içeriği Türkçede korunacak; diğer diller aynı alanların yerelleştirilmiş karşılığını ortak sözlükten alacak.
- Yerelleştirilmemiş Türkçe bağımsız sayfalara giden bağlantılar, dil sürümü mevcutsa o sürüme; mevcut değilse güvenli ortak işlem sayfasına yönlenecek.
- Mevcut veri erişimi, ödeme, üyelik ve güvenlik davranışları değiştirilmeyecek.
