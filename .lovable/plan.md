# Kolay Paneli kurumsal görünümden ayırma

## Yapılacaklar
- Kolay Panel mağazalarını yalnızca gerçek `micro` ev üreticisi kaydına göre bağımsız vitrine yönlendir; tema adını mağaza türü belirteci olarak kullanma.
- Ürün, kategori, sepet, arama, hesap ve sipariş takibi dahil tüm vitrin alt sayfalarında aynı bağımsız üst yapıyı koru.
- Kolay Panel başlığındaki kurumsal panele dönüş bağlantısını kaldır; kurumsala geçiş yalnızca mevcut yükseltme akışından yapılsın.
- Kurumsal mağazaların mevcut tema, menü ve mobil alt navigasyonunu değiştirme.
- Telefon ve masaüstünde bir Kolay Panel mağazası ile bir kurumsal mağazayı karşılaştırarak doğrula.

## Teknik ayrıntılar
- Ayrım `home_maker_profiles.panel_mode = 'micro'` sunucu verisine dayanacak.
- Vitrin kabuğu bu değeri ortak mağaza sorgusundan okuyacak; `home-maker-shop` tema adı tek başına ayrımı tetiklemeyecek.
- Mağaza, ürün ve sipariş kimlikleri ile mevcut veri akışları korunacak.
