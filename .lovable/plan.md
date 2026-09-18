# Ana Sayfa Alışveriş ve Ödeme Animasyonu

## Amaç
Yüklenen videodaki hareket sırasını ana sayfanın ilk ekranında, Mefticaret markasına uyarlanmış canlı bir ürün ve ödeme animasyonu olarak oluşturmak.

## Uygulama
- Ana sayfanın ilk ekranındaki mevcut yan ürün kartlarını, mobilde de görünen tek bir animasyon sahnesiyle değiştirmek.
- Videodaki akışı aynı sırayla canlandırmak:
  1. Mefticaret ödeme bildirimi, sipariş özeti ve banka kartının üst üste açılması
  2. Ürünlerin 2×3 ızgaraya dağılıp sırayla seçilmesi
  3. Seçili ürün sayısı ve toplam tutarın aşamalı güncellenmesi
  4. Kartların yatay kaydırılarak ödeme kartının seçilmesi
  5. Güvenli ödeme, siparişlerin gönderilmesi ve başlangıç görünümüne dönüş
- Animasyonu yaklaşık 45 saniyelik, kesintisiz tekrar eden ve videodaki yumuşak kayma/ölçeklenme ritmine yakın kurmak.
- Ürünleri telifli görselleri kopyalamadan, Mefticaret’e ait sade ürün minyatürleri ve Türkçe metinlerle göstermek.
- Hareket azaltma ayarı açık cihazlarda animasyonu durdurup anlaşılır bir sabit görünüm sunmak.

## Teknik Detaylar
- Animasyon ayrı ve küçük bir React bileşeni olacak; ana sayfaya yerleştirilecek.
- Zaman çizelgesi CSS keyframe’leriyle yürütülecek; gereksiz video dosyası veya ağır animasyon paketi eklenmeyecek.
- Mobil ve masaüstü boyutları ayrı kontrol edilerek taşma ve metin çakışması önlenecek.
- Sonuç, canlı önizlemede telefon ve masaüstü ölçülerinde görsel olarak doğrulanacak.
