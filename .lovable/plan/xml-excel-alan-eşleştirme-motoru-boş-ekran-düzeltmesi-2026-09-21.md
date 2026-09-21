# XML/Excel Alan Eşleştirme Motoru — boş ekran düzeltmesi

## Amaç
Uzak tedarikçi beslemelerini tarayıcı CORS engeline takılmadan sunucuda indirip çözümlemek; değişken XML köklerini otomatik bulmak ve hiçbir hata durumunda boş pencere göstermemek.

## Uygulama
1. **Güvenli sunucu proxy'si**
   - `/api/xml-parser` POST adresi ekle; oturum ve kullanıcının seçili tedarikçiye erişimini sunucuda doğrula.
   - URL içindeki tedarikçi sorgu parametrelerini koru; iç ağ/metadata adreslerini ve güvenli olmayan yönlendirmeleri mevcut SSRF korumasıyla engelle.
   - Yanıt boyutu, süre ve satır sınırları uygula; URL ve parolaları kayıtlara veya kullanıcıya geri döndürme.

2. **Evrensel dosya ve XML çözümleme**
   - `fast-xml-parser` ile XML’i namespace, CDATA, öznitelik ve iç içe dizi desteğiyle ayrıştır.
   - İçerik başlığı, dosya imzası ve URL uzantısını birlikte değerlendirerek XML, XLS/XLSX, CSV ve TSV algıla.
   - Excel’i ikili veri olarak, CSV/TSV’yi PapaParse ile çöz; mevcut 5.000 satırlık aktarım sınırını koru.

3. **Uyarlanabilir kök ve alan bulma**
   - XML ağacını sınırlı derinlikte dolaş; yinelenen nesne dizilerini ürün kökü adayı olarak puanla.
   - `product`, `Urun`, `item`, `ArrayOfProduct` gibi adları yalnız ipucu olarak kullan; asıl seçim tekrar sayısı ve ürün-benzeri alan yoğunluğuna dayansın.
   - Seçilen kökü ve alternatif kök adaylarını arayüze döndür; düğümleri noktalı yollarla düzleştirirken varyant ve medya dizilerini koru.
   - Başlık, fiyat, SKU, barkod, stok, varyant, galeri ve video alanları için Türkçe/İngilizce akıllı eşleştirmeyi uygula.

4. **Boş ekran yerine kurtarma görünümü**
   - İndirme, biçim algılama, ayrıştırma ve boş sonuç hatalarını ayrı tanı mesajlarıyla göster.
   - “Proxy ile yeniden yükle” ve “Manuel kök düğüm seç” işlemlerini ekle; manuel seçim aynı kaynakta yeniden çözümleme yapsın.
   - Hata olsa bile eşleştirme penceresinin başlık, tanı kartı ve kapatma kontrolleri her zaman görünsün.

5. **Mapping Studio ve aktarım**
   - Solda seçilen kök, kaynak düğüm ağacı ve ilk ürünün örnek değerlerini göster.
   - Sağda mevcut Mefticaret hedef alanlarını koru; otomatik önerileri önceden doldur.
   - Alt işlemi “Eşleştirmeyi Uygula ve Toplu Aktarımı Başlat” olarak tek ve belirgin çağrıya dönüştür; yalnız geçerli satırlarla mevcut güvenli kuyruğu başlat.

## Teknik ayrıntılar
- Yeni bağımlılık: Worker uyumlu saf JavaScript `fast-xml-parser`; mevcut `@e965/xlsx` ve `papaparse` korunur.
- Uygulama içi sunucu adresi TanStack Start route olarak yazılır; ayrı Edge Function oluşturulmaz.
- Veri tabanı şeması, RLS politikaları, ürün yayınlama ve fiyat/stok iş kuralları değişmez.
- Uzaktan kaynak okuma yalnız oturum açmış ve ilgili tedarikçiye yetkili kullanıcı için çalışır.

## Doğrulama
- İç içe köklü XML, namespace'li XML, CDATA, çoklu görsel/video, CSV/TSV ve XLSX örnekleriyle ayrıştırıcı testleri.
- Boş/bozuk XML ve erişilemeyen URL’de tanı kartı ile iki kurtarma işlemini doğrulama.
- Gerçek tedarikçi hesabında 393×667 ve masaüstünde eşleştirme penceresini; taşma, konsol hatası ve toplu aktarım çağrısını kontrol etme.
