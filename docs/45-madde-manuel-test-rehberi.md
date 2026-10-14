# Mefticaret — 45 madde için adım adım test rehberi

**14 Ekim güncellemesi:** Kullanıcının talebiyle önceki 14 atlanan madde kod bazında kontrol edilerek kabul edildi; eski kayıt/yük koşusunu yeniden üretme koşulları kaldırıldı. Güncel sonuçlar ve canlı veri bekleyen işler [takip raporundadır](bugfix-followup-2026-10-14.md). Aşağıdaki 13 Ekim kutuları tarihsel manuel koşunun kaydıdır; güncel kod kabul durumunu göstermez.

Hazırlanma: 13 Ekim 2026. Kod: `feat/development-optimization`, `e4923f8`.

Son kontrol koşusu: 13 Ekim 2026, local/deecc88. 1 geçti, 3 kaldı, 41 blokeli. Tarayıcı bağlantısı bulunamadı; Windows native pipe yeniden başlatma sonrası da erişilemedi. Tüm maddeler tamamlanmadı. Ayrıntı: `docs/manual-review-2026-10-13.json`. Önceki kanıtsız + işaretleri bu koşunun sonucuna göre kaldırıldı.

Bu rehber test talimatıdır; testlerin çalıştırıldığı veya geçtiği anlamına gelmez. Kaynak rapordaki 45 kimlik korunmuştur. T01/N01 ve F11/F03 ortak işlerdir; **Kontrol** açık hata değildir. Eski rapordaki üst/alt tedarikçi katalogları güncel kodda ortak katalog ekranına dönüştürüldüğünden test güncel ekran üzerinden yapılır.

## Başlamadan önce

1. Local siteyi aç: **http://127.0.0.1:5173**. Aşağıdaki `/...` adreslerini bu adrese ekle.
2. `MAGAZA_ID` panel adresindeki kimliktir; `MAGAZA_SLUG` vitrinin kısa adıdır. Örneğin `/store/UUID/orders` ile `/s/web-dijital` farklı değerler kullanır. `/stores` üzerinden mağazanı açıp adresinden kimliğini al. Vitrin bağlantısından slug'ı al. Eski rapordaki ürün/sipariş örnekleri yoksa aynı özelliğe sahip test kaydı kullan.
3. Ayrı tarayıcı profilleri hazırla: **süper yönetici**, **satıcı**, **Kolay Panel sahibi**, **tedarikçi A**, **tedarikçi B**, **vitrin müşterisi**. Tek profil kullanıyorsan rol değiştirirken çıkış yap. Public testleri gizli pencerede yap.
4. `SUPABASE_SERVICE_ROLE_KEY` local sunucuya eklenmiş ve sunucu yeniden başlatılmış olmalı. Giriş, DB ve bazı dekont testleri için ilgili hizmet ayarları da gerekir.
5. **Local uygulama, local veritabanı demek değildir.** Bağlandığın Supabase gerçek veritabanıysa ürün silme, politika yayınlama, sipariş, tahsilat ve iade işlemleri gerçek veriyi değiştirir. Bu rehberde veri değiştiren senaryolar için ayrı test DB/mağaza; ödeme/iade için sağlayıcı sandbox kullan.
6. Kodun gerektirdiği migration'lar hedef test DB'ye uygulanmış olmalı. `docs/bugfix-revision-3.md` ve `docs/development-optimization.md` bağımlılıkları açıklar. Eksik kolon/RPC hatasını bu ön koşul tamamlanana kadar **Blokeli** kaydet.
7. Chrome/Edge'de **F12 → Network** aç. **Preserve log** seç; Console'u da izle. HTTP durumunu Network'ten kontrol et; ekranda “bulunamadı” yazması tek başına 404 kanıtı değildir.

### Test verisi hazırlığı

| Veri | Gerektiği maddeler |
| --- | --- |
| 1.000'den fazla tedarikçi ürünü; ilk sayfalarda olmayan bilinen SKU | B01 |
| 250 mağaza siparişi; en eski sipariş numarası; farklı para birimleri | N06 |
| Çok tedarikçili sipariş; geçmiş ürün bağlantısı değişmiş örnek | B02, N07 |
| Görseli olan ürün; kırık URL'li ürün; HTML açıklamalı ürün | B03–B06 |
| Yalnız dijital, yalnız fiziksel ve karma sipariş | B09 |
| 3 aktif bekleyen, 1 iade edilmiş, 1 iptal edilmiş, 1 başarısız ödeme | B07 |
| Test politikaları ve aktif/yayınlanmamış sürümleri | F03, F11 |
| Bekleyen ödeme, iptal/iade siparişi, tamamlanmış iade | N01–N03, T01–T02 |
| TEST mağazaları ve ayrı yük testi ortamı | B10–B11, N05, P01–P03, Kontrol, T05 |

### Sonucu nasıl kaydetmelisin?

Her maddenin sonundaki kutuyu işaretle. Bir maddede birden fazla senaryo varsa hepsi geçmeden **Geçti** deme. Veri/hesap/sağlayıcı yoksa **Blokeli**; denemediysen **Çalıştırılmadı** seç. Başarısızlıkta ekran görüntüsü, adres, rol, sipariş/ürün kimliği, saat, görünen hata ve varsa Network request ID kaydet. Şifre/anahtar içeren görüntü kaydetme.

## A — Paket ve sitemap

### 01 · A01 — Paket ve dönem seçiminin korunması

**Sayfa/rol:** Public `/` paket kartları → `/auth` → onboarding → `/store/MAGAZA_ID/billing`. Yeni test hesabı gerekir; doğrulama e-postası gönderilebilir.

1. Ana sayfada bir ücretli paket seç, önce aylık dönemde kayıt düğmesine bas.
2. Kayıt ekranında seçilen paket/dönem özetini ve adres parametrelerini kontrol et.
3. Giriş/kayıt arasında geçiş yap; ardından test hesabıyla kaydı ve gerekiyorsa e-posta doğrulamasını tamamla.
4. Onboarding'i tamamlayıp mağazanın faturalandırma ekranına git.
5. Ayrı yeni test hesabıyla aynı paketin yıllık dönemi için tekrarla.

**Beklenen:** Paket ve dönem adımlarda korunur; aylık/yıllık seçimi doğru özetlenir. Paket seçmek ödeme yapmak değildir: satın alma tamamlanmadan ücretli plan hakkı açılmamalı, mağaza ücretsiz planda başlamalı.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 02 · A04 — Enterprise ve diğer paket fiyatlarının tutarlılığı

**Sayfa/rol:** Public `/` paketler; yönetici `/admin/plans`; mağaza `/store/MAGAZA_ID/billing`.

1. Yönetici ekranından aynı paketin kayıtlı aylık ve yıllık fiyatını, para birimini not et. Onaylı işletme fiyatı yoksa fiyat doğruluğu kısmını blokeli bırak.
2. Public paket kartında aylık ve yıllık seçenekler arasında geçiş yap.
3. Faturalandırmada aynı paketin aylık/yıllık teklifini kontrol et.
4. Gösterilen yıllık toplamı DB'deki yıllık toplamla karşılaştır. Aylık eşdeğer sunuluyorsa yıllık toplam / 12 ile eşleşmesini kontrol et.
5. İndirim varsa `(12 × aylık − yıllık) / (12 × aylık) × 100` hesabıyla karşılaştır. Ayrı test verisinde yıllık fiyatı eksik paketle davranışı kontrol et.

**Beklenen:** Aynı paket aynı fiyat kaynağından hesaplanır; dönem ve toplam açıktır. Eksik fiyat 0/ücretsiz yapılmaz. Eski ₺190.000/₺250.000 rakamları zorunlu beklenen fiyat değildir; işletmenin onaylı kaydı esas alınır.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 03 · A05 — Sitemap envanteri

**Sayfa/rol:** Public `/sitemap.xml`, `/sitemap-index.xml`, `/sitemap-tr.xml`, `/sitemap-en.xml`, `/sitemap-de.xml`, `/sitemap-fr.xml`, `/sitemap-ar.xml`, `/api/public/sitemap/MAGAZA_SLUG`; yönetici `/admin/site-seo` içindeki sitemap envanteri.

1. Sitemap/index adreslerini aç. Index'in gösterdiği alt sitemap'leri takip et; tüm içerik tek dosyada olmayabilir.
2. Mağaza sitemap'ini aç; yayınlanmış bir ürünün adresini arat.
3. Test mağazasında taslak/gizli bir ürün ve yayınlanmamış politika seç; bunların sitemap'te bulunmadığını kontrol et.
4. Envanter kartının platform/dil/mağaza kapsamını ve adetlerini karşılaştır; büyük katalogda son sayfalardan bilinen yayınlanmış ürünü de ara.
5. Ayrı test mağazasında noindex durumunu kontrol et; yayın kurallarına aykırı indekslenebilir mağaza adresleri üretilmemeli.

**Beklenen:** Geçerli XML; doğru kapsam ve yayın filtreleri; yinelenmeyen canonical URL'ler. Güncel adet gösterilir veya hata açıkça belirtilir. Eski 39/115/104 sayıları hedef değildir. XML'deki domain yapılandırılmış canonical domain olabilir, zorunlu olarak localhost olması beklenmez.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

## B — Tedarikçi, satıcı, Kolay Panel ve ölçümler

### 04 · B01 — Tam tedarikçi kataloğunda arama

**Sayfa/rol:** Tedarikçi `/supplier/panel` → **Ürünler** → katalog ve **B2B Cari Hesap & RFQ** ürün seçicisi. Satıcı katalog görünümü ayrıca `/store/MAGAZA_ID/supplier-catalog`.

1. 1.000'den fazla ürünü olan tedarikçiyi seç; ilk 1.000 kaydın dışında bilinen SKU'yu not et.
2. Ürünler ekranında SKU'yu ara; adıyla tekrar ara.
3. Kategori, sıralama ve sonraki/önceki sayfa kontrollerini dene.
4. Aynı Ürünler sekmesindeki **B2B Cari Hesap & RFQ** bölümüne ilerle; **RFQ ürün araması** alanında aynı SKU'yu ara. Teklif göndermeden bırakabilirsin.
5. Aynı filtre/satılabilirlik koşullarında görünen ürün kimliğini karşılaştır.

**Beklenen:** Ürün ilk sayfada olmasa da bulunur. Seçiciler aynı uygun katalog kapsamını kullanır. Filtre değişince sayfa geçerli sayfaya döner. Network'te tüm katalog bir defada indirilmez; sunucu araması ve sayfalama çalışır. Farklı yetki/görünürlük filtreleri varsa bunları eşitlemeden adetleri karşılaştırma.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 05 · B02 — Sipariş kaleminin kalıcı tedarikçi sahipliği

**Sayfa/rol:** `/supplier/panel` → **Siparişler** → sipariş ayrıntısı; satıcı `/store/MAGAZA_ID/orders`.

1. Tedarikçi A ve B ürünlerini içeren test siparişinin ürün/miktar/fiyatlarını satıcı ekranından not et.
2. A ile giriş yapıp siparişi aç; yalnız A'nın kalemlerini ve bunların alt toplamını kontrol et.
3. B ile tekrar et; yalnız B'nin kalemlerini görmelisin.
4. Ayrı test DB'de siparişte kullanılan ürünün katalog bağlantısını değiştir/sil; iki tedarikçinin geçmiş siparişini tekrar aç.
5. Geçmiş sahipliği çözülemeyen eski bir kayıt aç; ilişki uyarısını ve varsa eksik ilişki CSV raporunu kontrol et.

**Beklenen:** Sipariş anındaki sahiplik korunur; katalog değişmesi geçmiş kalemi kaybettirmez. Başka tedarikçinin kalemi görünmez. Sahipliği bilinmeyen kayıt sessiz boş liste/₺0 başarı olarak sunulmaz; ilişki kontrolü gerektiği belirtilir. Eski verideki kayıp ilişki kendiliğinden onarılmış sayılmaz.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 06 · B03 — Kırık ürün görseli

**Sayfa/rol:** `/supplier/panel` → Ürünler; `/store/MAGAZA_ID/supplier-catalog`; `/s/MAGAZA_SLUG/p/URUN_SLUG`.

1. Sağlam görselli ürünü aç; gerçek görselin geldiğini kontrol et.
2. Kırık URL'li test ürününü aç. Varsa rapordaki 3×3 çardak ürününü kullan; yoksa eşdeğer fixture gerekir.
3. F12 Network'te optimize görsel isteğini ve ardından kaynak görsel denemesini incele.
4. İki kaynak da başarısızsa yerel yedeğin ve açıklamanın görünmesini kontrol et.
5. Test ürününün görselini sağlam URL ile değiştirip ekranı yenile/başka ürün seçerek geri gel.

**Beklenen:** Optimize kaynak başarısız olduğunda orijinal kaynak denenir; ikisi de bozuksa kontrollü yedek görünür. Sonsuz istek döngüsü ve çökme olmaz. Kaynak değişince eski hata durumu kalmaz. Yedek görünmesi bozuk orijinal URL'nin onarıldığı anlamına gelmez.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 07 · B04 — HTML ürün açıklaması

**Sayfa/rol:** Tedarikçi `/supplier/panel` → Ürünler → ürün ayrıntısı; satıcı tedarikçi kataloğu ayrıntısı.

1. Test ürününe `<p>Örnek <strong>ürün</strong></p><ul><li>Özellik</li></ul>` açıklaması gir.
2. Ürün ayrıntısını ve satıcının katalog görünümünü aç.
3. Açıklamayı oku; etiketlerin ham yazı olarak görünmediğini kontrol et.
4. Test ortamında güvenlik fixture'ındaki script/olay işleyicili içeriği geliştiriciyle dene; Console'u izle.

**Beklenen:** “Örnek ürün / Özellik” okunabilir metin olarak görünür; ham `<p>` vb. etiketler görünmez. Mevcut uygulama düz metne temizler; kalın yazı ve madde işaretinin birebir korunması şart değildir. Gömülü kod çalışmaz.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 08 · B05 — Ürün formu etiketleri ve hata açıklaması

**Sayfa/rol:** `/supplier/panel` → Ürünler → yeni ürün/ürün düzenleme.

1. Formu aç; ürün adı ve fiyat etiketine tıkla. İlgili alan odaklanmalı.
2. Açıklama ve görsel alanlarını da kontrol et.
3. Yalnız Tab/Shift+Tab ile tüm alanlara ve kaydet/kapat eylemlerine git.
4. Zorunlu alanı boş veya geçersiz bırakıp kaydetmeyi dene; hata metnini kontrol et.
5. F12 Elements → Accessibility bölümünde alanın adını ve hata bağlantısını incele. İki form açılabiliyorsa kimlik çakışması olmadığını kontrol et.

**Beklenen:** Her alan anlaşılır erişilebilir ada ve ilişkili etikete sahiptir. Hata görülür/duyurulur; yanlış alan odaklanmaz. Geçersiz ürün kaydedilmez. Teknik doğrulamada ilgili `label for`/`id` ve hata için erişilebilir ilişki bulunur.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 09 · B06 — SEO'da yanlış “Görsel yok” uyarısı

**Sayfa/rol:** `/store/MAGAZA_ID/seo`; Kolay Panel `/store/MAGAZA_ID/kolay` → **Mağazam** içindeki SEO kartı; ürün vitrini.

1. Vitrinde galerisi görünen bir ürün seç; ürün kimliğini ve görsel sayısını not et.
2. SEO ekranında aynı ürünü ara; varsa denetimi yeniden çalıştır.
3. Medya sayısını ve “Görsel yok” uyarısını kontrol et.
4. İlk 500/1.000 ürünün dışında görselli örnek ve çok görselli büyük mağazayla tekrarla.
5. Gerçekten görselsiz ürünle karşılaştır; onun uyarısı kaybolmamalı.

**Beklenen:** Gerçek ürün medyası esas alınır; büyük katalog sınırı yüzünden görselli ürüne yanlış uyarı verilmez. Görselsiz ürün doğru uyarı alır. Denetim/önbellek güncellenmeden eski raporu güncel sonuç diye değerlendirme.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 10 · B07 — Ödeme bekleyen sipariş sayacı

**Sayfa/rol:** `/store/MAGAZA_ID/orders`; Kolay Panel sipariş/özet kartları.

1. Üç aktif pending ödeme siparişi, bir refunded, bir cancelled ve bir failed ödeme kaydını test DB'de hazırla.
2. Sipariş listesindeki ödeme bekleyen sayısını kontrol et.
3. Bekleyen ödeme filtresini aç; görünen siparişlerle sayacı karşılaştır.
4. İade/iptal kaydının bekleyen listesinde olmadığını kontrol et; CSV varsa aynı kapsamı dışa aktar.
5. Bir pending siparişi test akışıyla ödenmiş yapıp yenile.

**Beklenen:** Başlangıçta bu fixture için bekleyen sayı 3'tür; iade/iptal/failed sayılmaz. Bir bekleyen ödenince sayı 2 olur. Filtre, KPI ve CSV aynı ödeme kurallarını kullanır.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 11 · B08 — Giriş sonrası doğru panel

**Sayfa/rol:** `/auth?mode=login`, `/stores`, `/store/MAGAZA_ID/kolay`, `/supplier/panel`.

1. Çıkış yap; yalnız Kolay Panel mağazası bulunan test hesabıyla genel girişten oturum aç.
2. Giriş sonrası hedefi kontrol et; Kolay Panel'e ulaşmalısın.
3. Yalnız standart satıcı hesabıyla tekrar et; yetkili standart mağaza ekranına/seçimine gitmelisin.
4. Her iki mağaza türüne erişen hesapla dene; panel/mağaza seçiminin sunulduğunu kontrol et.
5. Geçerli uygulama içi `next` hedefiyle giriş yap; hedef korunmalı. Ayrı hesapla yetkisiz mağaza adresini açmayı dene.

**Beklenen:** Sunucu rol ve üyeliklere göre hedef seçer; Kolay hesabı yanlış panele zorlanmaz. Çoklu erişimde seçim mümkündür. `next` yetkiyi aşmaz; başka mağaza verisi açılmaz. Tedarikçi için kendi giriş akışından panel erişimini ayrıca kontrol et.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 12 · B09 — Dijital/karma siparişte kargo

**Sayfa/rol:** `/store/MAGAZA_ID/kolay` → Siparişler; `/store/MAGAZA_ID/orders` → ayrıntı/kargo.

1. Yalnız dijital test siparişini aç; kargo/el teslimi seçeneklerini incele.
2. Fiziksel siparişi aç; uygun kargo akışının çalıştığını kontrol et.
3. Bir dijital + bir fiziksel kalemli karma siparişi aç; kargo oluştururken kalemleri kontrol et.
4. Fiziksel kalemin teslimini test ortamında tamamla; dijital kalemin teslim durumunu kontrol et.
5. Geliştiriciyle dijital kaleme doğrudan sunucu kargo isteği dene; yalnız düğmenin gizlenmesi yeterli değildir.

**Beklenen:** Yalnız dijital sipariş fiziksel kargoya açılmaz; sunucu da reddeder. Karma siparişin yalnız fiziksel kalemi sevk edilir. Fiziksel teslimat tek başına dijital kalemi veya tüm karma siparişi tamamlanmış yapmaz.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 13 · B10 — Hedef VU ve anlık ölçüm ayrımı

**Sayfa/rol:** Süper yönetici `/admin/load-test`.

1. Çalışan tur yokken monitörü aç; hedef/örneklem ve aktif ölçüm başlıklarını oku.
2. Test ortamında hedef değerini değiştir; tur başlatmadan anlık göstergeyi kontrol et.
3. Çalışmış bir turun ayrıntısını aç; kapsam ve ölçüm zamanını kontrol et.
4. Gerçek k6 çıktısı varsa ölçülen VU ile panel hedefini karşılaştır.

**Beklenen:** Hedefi değiştirmek gerçekten o sayıda kullanıcı çalıştırmış gibi gösterilmez. Ölçüm yokluğu açık olur; hedef, örneklem ve ölçülen eşzamanlılık ayrı sunulur. Eski 20.000 hedefi aktif 20.000 kullanıcı kanıtı değildir.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 14 · B11 — Eksik/sıfır test sonucu

**Sayfa/rol:** `/admin/load-test` → Son turlar/Bulgular; `/admin/system`.

1. Test DB'de sonuç metriği eksik yeni turu göster; eşik mesajını not et.
2. `failed` ve `stopped` tur örneklerini ayrı ayrı aç.
3. Tamamlanmış, metrikleri mevcut, `thresholdFailures=0` örneğini aç.
4. Pozitif başarısız eşik sayılı tamamlanmış turu aç.
5. Test ortamında veri sorgusunu Network request blocking veya geliştirici fixture'ıyla başarısız yap; yeniden dene.

**Beklenen:** Eksik/yarım/başarısız tur “eşikler tamam” olmaz. Ölçülmüş tamamlanan sıfır başarısızlık anlamlı başarı mesajıdır; pozitif sayı başarısızlığı belirtir. Sorgu hatası sağlıklı sıfır sonuç gibi sunulmaz. Eski kayıt fixture'ı olmadan bu durumların tümü onaylanamaz.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 15 · B12 — Belge dili ve RTL

**Sayfa/rol:** Public `/`, `/en`, `/de`, `/fr`, `/ar`; dil taşınan giriş sayfaları.

1. Her dil adresini aç; F12 Console'da `document.documentElement.lang` çalıştır.
2. Sırasıyla `tr`, `en`, `de`, `fr`, `ar` olmasını kontrol et.
3. `/ar` için `document.documentElement.dir` değerini ve görsel yazı yönünü kontrol et.
4. Arapçadan İngilizce/Türkçeye uygulama içi geçiş yap; önceki RTL/dil kalmamalı.
5. Ctrl+U ile sayfa kaynağındaki `<html>` dil/yönünü kontrol et; yalnız sonradan DOM değişmesi yeterli değildir.

**Beklenen:** SSR ve istemci rota diliyle tutarlıdır; Arapça doğru RTL kapsamına sahiptir. Diğer dilde Arapça yön kalmaz. Panelin seçilen dili public rota davranışından ayrı değerlendirilebilir.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

## F — Public akışlar

### 16 · F01 — Stok ve sepete ekleme

**Sayfa/rol:** `/s/MAGAZA_SLUG/p/URUN_SLUG`, `/s/MAGAZA_SLUG/cart`, `/s/MAGAZA_SLUG/checkout`.

1. Stoku 0 olan ürünü aç; satın alma düğmesini kontrol et ve sepete eklemeyi dene.
2. Stoku 2 olan üründen 1 adet ekle; sepeti ve checkout'u aç.
3. Sepette miktarı 2'ye, ardından 3'e çıkarmayı dene.
4. Ürün sepetteyken test stokunu 0 yap; checkout'ta tekrar doğrulat.
5. Test sonunda sepeti boşalt.

**Beklenen:** Stok 0, yapay biçimde 1'e yükseltilmez. Stoklu ürün doğru varyant/miktar/fiyatla sepete geçer. Stok üstü miktar ve stok tükenmiş checkout reddedilir/açıklanır. Rapordaki sweatshirt artık stok dışıysa onu başarılı satın alma örneği olarak kullanma.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 17 · F02 — Checkout'tan doğru müşteri girişine gitme

**Sayfa/rol:** Gizli pencere, dolu sepet → `/s/MAGAZA_SLUG/checkout`.

1. Stoklu test ürünü ekleyip checkout'u aç.
2. “Giriş yap / Üye ol” bağlantısına bas.
3. Açılan adresi kontrol et: aynı mağazanın `/s/MAGAZA_SLUG/login?return=checkout` akışı olmalı.
4. Mevcut test müşteri hesabıyla giriş yap.
5. Checkout'a dönüşte sepet ve mağaza kimliğini kontrol et.

**Beklenen:** Platform yönetici `/auth` ekranına gitmez. Aynı mağazanın müşteri girişi açılır ve girişten sonra dolu sepetle checkout'a döner. OAuth etkinse aynı testi o yöntemle ayrıca yap; test edilmemiş OAuth geçilmiş sayılmaz.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 18 · F03 — Zorunlu politika sürümleri ve checkout engeli

**Sayfa/rol:** Satıcı `/store/MAGAZA_ID/policies`; müşteri checkout ve `/s/MAGAZA_SLUG/politika/POLITIKA_SLUG`.

1. Test mağazasında gizlilik, iade/değişim, mesafeli satış belgelerinden birini yayınlanmamış bırak.
2. Dolu sepetle checkout'u aç; belge linklerini kontrol et ve sipariş tamamlamayı dene.
3. Yetkili işletmenin test/onaylı metinlerini aktif, görünür, yayınlanmış ve yürürlükte sürümler olarak hazırla.
4. Checkout'u yenile; üç linkten her birini açıp sürüm/içeriği kontrol et.
5. Kabul kutularını önce boş bırak, sonra işaretle; sandbox siparişini tamamla.
6. Geliştiriciyle siparişin kabul kayıtlarını DB'de kontrol et: belge ve sürüm kimliği siparişle eşleşmeli; başarısız siparişte kopuk kabul kaydı olmamalı.

**Beklenen:** Eksik zorunlu belgede sipariş kapalıdır. Yayındaki doğru sürümler okunabilir ve kabul edilmeden sipariş tamamlanmaz. Sipariş/kabul sürümleri aynı işlemde kaydedilir. Platform politikası mağaza politikasının yerine geçmez. Çerez belgesi ayrıca kontrol edilir; üç zorunlu checkout belgesiyle aynı zorunluluk varsayılmaz.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 19 · F04 — “Bizi Arayın” telefon bağlantısı

**Sayfa/rol:** `/`, `/en`, `/de`, `/fr`, `/ar`.

1. Her dilde “Bizi Arayın” karşılığına git.
2. Sağ tık → bağlantı adresini kopyala veya Elements'te `href` değerini incele.
3. Hedefin `tel:` ile başladığını ve doğru işletme numarası olduğunu kontrol et.
4. Mobilde dokununca telefon uygulaması numarayla açılmalı; aramayı başlatmadan iptal et.

**Beklenen:** Her dilde telefon hedefi korunur; blog/iletişim formu gibi ilgisiz sayfaya gitmez. Numaranın doğruluğu işletme kaydıyla karşılaştırılır; gerçek arama test için gerekli değildir.

**Sonuç:** [ ] Geçti [x] Kaldı [ ] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Local /en SSR: Call Us bağlantısının href değeri #referanslar; beklenen tel: değil. public-http-results.json ve platform-home.tsx:113. Diğer telefon/mobil senaryoları tamamlanmadı.)*

### 20 · F05 — Ücretsiz kayıt düğmeleri

**Sayfa/rol:** Beş dilde ana sayfa; genel `/auth`.

1. Menü, ana hero ve paket alanındaki ücretsiz kayıt CTA'larını sırayla tıkla.
2. Açılan ekranda Ad Soyad ve hesap oluşturma eylemini kontrol et.
3. Giriş moduna geçip tekrar kayıt moduna dön.
4. Paket/dönemden başlayan CTA için seçim özetini; çevirili sayfada locale'i kontrol et.

**Beklenen:** Kayıt niyeti korunur; kullanıcı varsayılan giriş formunda bırakılmaz. Dil ve varsa paket/dönem parametreleri geçişlerde kaybolmaz. Her CTA ayrı kontrol edilir; birinin çalışması tümünü kanıtlamaz.

**Sonuç:** [ ] Geçti [x] Kaldı [ ] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Local hero CTA /auth?locale=en adresine gider; mode=register eksik. auth.tsx:62 varsayılan login. Diğer kayıt CTA geçişleri tamamlanmadı.)*

### 21 · F06 — Referanslar bağlantısı

**Sayfa/rol:** Beş dilde ana sayfa, menü/footer; gerekiyorsa yönetici içerik ayarları.

1. Menü ve açılır menülerde referanslar bağlantısını ara.
2. Yayınlanmış gerçek referans içeriği olan test yapılandırmasında bağlantıya bas.
3. Sayfanın görünür referans bölümüne kaydığını ve hedef kimliğinin bulunduğunu kontrol et.
4. İçeriği olmayan ayrı test yapılandırmasında menü/footer'ı yeniden kontrol et.

**Beklenen:** İçerik varsa doğru bölüm açılır. İçerik yoksa boş/olmayan `#referanslar` hedefine götüren bağlantı saklanır. Bölümün içeriksiz ortamda görünmemesi hata değildir. İki yapılandırmadan yalnız biri mevcutsa diğerini blokeli kaydet.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### + 22 · F07 — Eski blog slug'ı ve gerçek 404

**Sayfa/rol:** `/blog`, `/blog/YAZI_SLUG`; yönetici `/admin/site-blog`, SEO slug envanteri `/admin/site-seo`.

1. Test DB'de yayınlanmış blog yazısının eski ve güncel slug'ını not et.
2. Eski slug adresini doğrudan aç; Network'te document isteğinin ilk yanıtını izle.
3. Yönlendirme hedefinin doğrudan güncel canonical slug olduğunu kontrol et.
4. Olmayan slug ve silinmiş/yayınlanmamış test yazısı adresini aç.
5. Rapordaki “SEO Rehberi/Mefticaret Nedir” eski adreslerini biliniyorsa ayrıca kontrol et; kayıtlı yönlendirme yoksa 301 bekleme.

**Beklenen:** Kayıtlı slug geçmişi 301 ile güncel adrese gider; gereksiz zincir oluşmaz. Olmayan/gizli yazı HTTP 404 verir. İç linkler güncel yazıya gider. Tarihsel adresin neye taşındığı bilinmiyorsa tahmini yönlendirme yapılmaz.

**Sonuç:** [x] Geçti [ ] Kaldı [ ] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; 10 gerçek local HTTP/DB fixture kontrolü geçti: yayınlı 200; eski ve ara slug doğrudan güncel canonical slug 301; blog listesi güncel bağlantı; olmayan, gizli ve silinmiş yazı 404. Kanıt: local-test.local/f07-results.json.)*

**13 Ekim 2026 local doğrulaması:** Gerçek uygulama sunucusunda anonim HTTP istekleriyle 9/9 kontrol geçti. Yayınlı test yazısı 200; iki kez slug değiştirildikten sonra ilk ve ara slug doğrudan son slug'a 301 (yönlendirme zinciri yok); son slug 200 ve beklenen yazı içeriği mevcut; bilinmeyen slug 404; yayından kaldırılmış yazının güncel/eski slug'ları 404; silinmiş yazının güncel/ara slug'ları 404. 404 yanıtlarında “Yazı bulunamadı” metni doğrulandı. Geçici local test yazısı ve ona ait yönlendirmeler temizlendi; diğer yazılara dokunulmadı. Kanıt: `local-test.local/f07-results.json`; tekrar çalıştırma: `node local-test.local/test-f07.mjs`. Chrome ve IAB açma girişimleri “Browser is not available” döndü; görsel/istemci gezinme kontrolü yapılmadı. Tarihsel SEO Rehberi/Mefticaret Nedir slug eşlemeleri ayrıca doğrulanmadı; bu test kayıtlı slug geçmişi mekanizmasını sınar.

### 23 · F08 — Boş e-postayla şifre sıfırlama

**Sayfa/rol:** `/supplier` giriş alanı veya tedarikçi giriş bağlantısı; genel `/auth?mode=login`.

1. E-posta alanını boş bırakıp “Şifremi unuttum”a bas.
2. Görünen açıklamayı ve alanla ilişkisini kontrol et; birkaç saniye sonra tamamen kaybolmamalı.
3. E-posta biçimi geçersiz örnekle tekrar dene.
4. Gerçek sıfırlama gönderimini ayrıca test edeceksen test e-posta hesabını kullan; işlem sürerken tekrar basmayı dene.

**Beklenen:** Boş alanda e-posta yazılması istenir; sessiz davranış veya başarısızlığı başarı gibi gösterme olmaz. Gönderim sürerken eşzamanlı reset engellenir. E-posta ulaşması ayrı hizmet testi olduğundan yalnız boş alan testiyle onaylanmaz.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 24 · F09 — Kolay Panel rehberinin giriş seçenekleri

**Sayfa/rol:** `/kolay-panel-rehberi`; `/ev-hanimlari`, `/en/ev-hanimlari` ve diğer dil eşdeğerleri.

1. Rehberde kayıt/giriş bölümünü oku.
2. “SMS kodu yoktur” gibi eski ifadelerin kalmadığını kontrol et.
3. Kolay giriş ekranında telefon/SMS OTP, e-posta/şifre ve kayıt seçeneklerini karşılaştır.
4. Rehberin bağlantılarını aç; beklenen giriş ekranına gitmeliler.

**Beklenen:** Açıklama gerçek seçeneklerle tutarlıdır; SMS/telefon kodu ve e-posta akışını doğru anlatır. Hizmet etkin değilse mesaj açık olmalıdır. Bu madde için gerçek SMS gönderimi şart değildir; OTP teslimatı ayrı testtir.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 25 · F10 — Giriş/kayıt/şifre sıfırlamada dil devamlılığı

**Sayfa/rol:** `/en`, `/de`, `/fr`, `/ar` → genel giriş/kayıt ve Kolay giriş.

1. İngilizce ana sayfadan genel kayıt CTA'sına bas; dilini kontrol et.
2. Girişe, şifre sıfırlamaya ve tekrar kayda geç; her adımın metnini/adresini kontrol et.
3. Ana sayfaya dönüp Kolay Panel CTA'sını aç; dil öneki korunmalı.
4. Aynı adımları Almanca, Fransızca ve Arapçada tekrar et.
5. Rehber/paket içerik linklerini kontrol et; yalnız Türkçe içerikse içerik dili belirtilmeli.

**Beklenen:** Genel auth akışı varsayılan Türkçeye dönmez; locale ve dönüş parametreleri korunur. Arapçada yön doğru kalır. Çevrilmemiş içerik bağlantısı kullanıcıya içerik dilini açıklar.

**Sonuç:** [ ] Geçti [x] Kaldı [ ] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Local /en /de /fr /ar SSR içinde landing-growth-suite.tsx:115 kayıt CTA hedefi /auth?mode=register; locale taşınmıyor. Auth varsayılan locale tr. Diğer geçişler tamamlanmadı.)*

### 26 · F11 — Eski politika adresleri ve kabul kayıtları

**Sayfa/rol:** `/s/MAGAZA_SLUG/privacy`, `/s/MAGAZA_SLUG/terms`, `/s/MAGAZA_SLUG/returns`; canonical `/s/MAGAZA_SLUG/politika/POLITIKA_SLUG`.

1. Üç eski mağaza adresini sırayla aç; Network'te ilk document yanıtını incele.
2. Yönlendirme hedefini, mağaza slug'ını ve politika türünü kontrol et.
3. Hedefte yayınlanmış doğru belgenin açıldığını kontrol et.
4. F03'teki sipariş/kabul sürümü testini bu maddeye de bağla; ikinci sipariş oluşturmak gerekmez.

**Beklenen:** Eski adresler aynı mağazanın doğru canonical politika adresine HTTP 301 gider. Doğru belge açılır; yayımlanmamış belge yayımlanmış gibi yapılmaz. Kabul sürümü siparişle birlikte kaydedilir. Bu iş F03 ile örtüşür.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

## Kontrol — Başarılı uzun koşunun kapsamı

### 27 · Kontrol — HTTP başarısını alışveriş kapasitesi saymama

**Sayfa/rol:** `/admin/load-test` → tur ayrıntısı; yük testinin ham raporu.

1. Başarılı uzun koşu kaydını aç; süre, toplam istek ve HTTP durumlarını oku.
2. Koşunun hangi adresleri/senaryoları çalıştırdığını kontrol et.
3. Tamamlanan oturum sayısı, hedef kullanıcı ve gerçek eşzamanlı kullanıcı değerlerini ayır.
4. Ödeme/checkout/CWV başarısı gibi iddiaların ham senaryoyla desteklenip desteklenmediğine bak.

**Beklenen:** Yalnız ana sayfa/blog HTTP isteği atan koşu bu kapsamla etiketlenir. 40.000 HTTP 200 veya 20.000 tamamlanmış oturum, 20.000 eşzamanlı alışveriş/ödeme başarısı diye sunulmaz. Ölçülmeyen metrik bilinmiyor/kanıt yok olarak kalır. Bu madde açık hata değil, rapor doğruluğu kontrolüdür.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

## L — Hata kayıtları ve eski istemci

### 28 · L01 — Blog SSR/hydration ve tarih çıktısı

**Sayfa/rol:** `/blog`, `/blog/YAZI_SLUG`; yönetici `/admin/logs`.

1. Yayınlanmış tarihli yazıyı doğrudan adresle aç; Console'u temizleyip sert yenile.
2. Aynı yazıya blog listesinden uygulama içi bağlantıyla git.
3. Tarih ve içeriğin ilk yükleme/sonraki görünümde değişmediğini kontrol et.
4. Tarayıcı saat dilimini farklı yapan test cihazı/profilinde tekrar et; metnin İstanbul tarih kuralını korumasını kontrol et.
5. Yeni React hydration uyarısı/#418 varsa saat, rota ve sürümü `/admin/logs` ile eşleştir. Ayrı fixture ile blog veri sorgusu hatasını dene.

**Beklenen:** Tarih çıktısı SSR ve istemcide tutarlıdır; hydration hatası oluşmaz. Veri hatası “yazı yok” diye yutulmaz. Eski 73 log kaydı silinmek zorunda değildir; yeni tekrar oluşup oluşmadığı esas alınır. Tarihsel #418'in tüm nedenleri bu tek testle çözülmüş sayılmaz.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 29 · L02 — Dinamik modül yükleme hatası ve formu koruma

**Sayfa/rol:** `/auth` ve lazy yüklenen panel ekranları. Tam test için iki production build'in yayımlandığı ayrı staging gerekir.

1. Mevcut sürümde bir form aç; kaydedilmemiş örnek metin yaz.
2. Form açık kalırken staging'e yeni build yayımla; eski sekmede henüz yüklenmemiş lazy ekrana git. Alternatif kontrollü denemede ilgili JS chunk isteğini Network request blocking ile engelle.
3. Chunk hata mesajını ve yenileme eylemini kontrol et; kendiliğinden sayfa yenilenmemeli.
4. Mevcut forma erişilebiliyorsa metni kopyala/kaydet. Kullanıcı yenilemesini bilinçli seç.
5. Engeli kaldırıp yenile; yeni sürüm ekranının açılmasını kontrol et.

**Beklenen:** Hata kontrollü görünür; otomatik reload kaydedilmemiş çalışmayı habersiz silmez. Kullanıcı yenileyebilir. Yenilemeden sonra form taslağının otomatik geri gelmesi garanti edilmez. Vite dev modunda eski production chunk senaryosu tam olarak doğrulanamaz.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 30 · L03 — E-posta pazarlamada eksik kayıt alanları

**Sayfa/rol:** `/store/MAGAZA_ID/email-marketing`; `/admin/email-marketing`.

1. Test DB'de adı veya konusu eksik eski şablon; etiket/kategori listesi eksik eski kayıt hazırla.
2. E-posta pazarlama sayfasını aç; şablon/listeler arasında geçiş yap.
3. Arama kutusuna kelime yaz, sil, farklı kelime yaz; kategori/etiket filtrelerini dene.
4. Sağlam şablonun aramada hâlâ bulunduğunu kontrol et; Console ve yeni loglara bak.

**Beklenen:** Eksik alanlar `undefined.toLowerCase` hatasıyla ekranı çökertmez. Arama sağlam kayıtları doğru filtreler; eksik kayıt anlaşılır biçimde ele alınır. Kampanya/e-posta göndermeden bu test yapılabilir. Eski logun kesin nedeni ayrıca doğrulanmadığı için yeni tekrarı izle.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

## N — Finansal doğruluk ve veri erişimi

### 31 · N01 — Dekont okuma ve açık tahsilat onayı

**Sayfa/rol:** `/store/MAGAZA_ID/kolay` → **Siparişler** → **Dekont kontrolü**; `/store/MAGAZA_ID/orders` ve siparişin finansal izi. Test siparişi ve AI/dekont hizmeti gerekir. Dekont kartı yalnız uygun bekleyen sipariş varsa görünür.

1. Aktif, ödemesi bekleyen test siparişinin durum/tahsilat tutarını not et.
2. Siparişi seç; tutarı eşleşen test dekontunu yükle ve okuma sonucunu bekle.
3. Sipariş ayrıntısını ayrı sekmede yenile; ödeme durumunu kontrol et.
4. Banka teyidi kutusu ve geçerli referans olmadan onaylamayı dene.
5. Gerçek test banka kaydı/sandbox referansını kontrol edip açık manuel onay ver; sipariş ve finansal izi yenile.
6. Aynı dekontu/incelemeyi yeniden işle; ayrıca farklı test siparişinde “Dekontu reddet” akışını dene.

**Beklenen:** AI okuması yalnız inceleme sonucu (`pending_review`) üretir; otomatik `paid`/tahsilat olmaz. Referans ve açık teyit olmadan onay verilemez. Yetkili manuel onay tek finansal etki yaratır; tekrar bakiye artırmaz. Reddetme ödeme durumunu değiştirmez. Başka mağaza sahibi erişemez.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 32 · N02 — Aynı iade callback'inin tekrar gelmesi

**Sayfa/rol:** `/admin/qnbpay`; `/store/MAGAZA_ID/orders` → finansal iz; ilgili iade kaydı. **Geliştirici + sağlayıcı sandbox gerekir.**

1. Sandbox'ta 100 birim ödenmiş işlem ve 20 birimlik iade hazırla; başlangıç iade toplamı ve satırlarını not et.
2. Sağlayıcının geçerli imzalı başarılı callback'ini aynı sağlayıcı iade referansıyla gönder.
3. Aynı bildirimi 10 kez ve ardından paralel tekrarlarla ilet; sahte/imzasız istek kullanma.
4. Senkron iade başarı yanıtı ardından aynı callback gelecek senaryoyu dene.
5. Erken callback'i, doğrulanmış sağlayıcı yanıtından önce ilet; mutabakat öncesi toplamı kontrol et.
6. Panel ve DB'de iade toplamını, sağlayıcı referansını ve muhasebe etkisini karşılaştır.

**Beklenen:** Doğrulanmış 20 birimlik tek iade toplamı 20 artırır; 40/200 olmaz. Aynı referans tek muhasebe etkisidir. Erken bildirim tek başına doğrulanmamış toplam artırmaz; sağlayıcı sonucuyla mutabakat yapılır. Panel yenilemek callback tekrar testinin yerine geçmez.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 33 · N03 — Eşzamanlı iade ve belirsiz zaman aşımı

**Sayfa/rol:** `/store/MAGAZA_ID/returns`, sipariş/finansal iz, `/admin/qnbpay`. **Sandbox ve kontrollü ağ/DB hata fixture'ı gerekir.**

1. Tek pending test iadesini iki yetkili tarayıcı oturumunda aç.
2. İadeyi aynı anda işleme al; geliştirici testiyle aynı iade kimliğine gerçekten paralel iki sunucu isteği gönderildiğini doğrula.
3. Sağlayıcı logundan dış iade çağrısı sayısını kontrol et.
4. Sağlayıcı başarılı olduktan sonra DB cevabını kontrollü kes; ayrıca sağlayıcı sonucu belirsiz timeout senaryosunu dene.
5. Tekrar eylemini dene; belirsiz durumun kör yeni para iadesi çağrısı üretmediğini kontrol et.
6. Doğrulanmış sağlayıcı referansıyla mutabakatı tamamla ve toplamı kontrol et.

**Beklenen:** Aynı iade atomik sahiplenilir; yarışta tek sağlayıcı işlemi olur. Belirsiz timeout görünür processing/inceleme durumunda kalır; kör tekrar yoktur. Doğrulanmış referansla yeni dış çağrı olmadan tek etkiyle sonuçlandırılabilir. İki kez tıklayıp tek düğmenin disabled olması sunucu yarışını kanıtlamaz.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 34 · N04 — Müşteri kaydı ve doğrulama sonrası checkout dönüşü

**Sayfa/rol:** `/s/MAGAZA_SLUG/checkout` → login → register → e-posta doğrulama. Yeni test müşteri e-postası gerekir.

1. Gizli pencerede stoklu ürünü sepete ekle; checkout'tan müşteri girişine git.
2. “Kayıt ol”a bas; adres/dönüş bilgisinin checkout niyetini taşıdığını kontrol et.
3. Yeni test hesabını oluştur; gönderilen doğrulama e-postasını aynı tarayıcı profilinde aç.
4. Doğrulama/giriş tamamlanınca hedefi ve sepeti kontrol et.
5. Login/register arasında ileri geri geçiş yaparak dönüşün korunmasını dene.

**Beklenen:** Aynı mağazanın checkout'una ve aynı sepete dönülür; varsayılan account ekranına kaybolmaz. Doğrulama linki doğru test ortamını hedefler. Farklı cihazda link açma ayrı senaryodur; tarayıcıdaki sepetin kendiliğinden cihazlar arasında taşınması beklenmez.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 35 · N05 — Panel koşusunun gerçek kapsamı

**Sayfa/rol:** `/admin/load-test` → tur/senaryo ayrıntısı; k6 ham raporu.

1. Panelde hedef VU/ölçek değerini ve senaryo açıklamasını oku.
2. Yalnız test DB'de küçük bir tur çalıştır veya mevcut tamamlanmış turun kaydını aç. Tur başlatma veri üretme/sıfırlama yapabilir.
3. Turda HTTP örneklemesi ve DB test siparişi simülasyonunun hangi ölçümleri ürettiğini kontrol et.
4. Gerçek k6 koşusu varsa ölçülen en yüksek VU/istek-sn değerini panel hedefiyle ayrı karşılaştır.

**Beklenen:** Panelin sıralı HTTP örneklemesi ve DB simülasyonu açıkça tanımlanır; hedef değer gerçek paralel tarayıcı/ödeme yükü diye sunulmaz. k6 ölçümü yoksa gerçek VU kanıtı eksik kalır. DB simülasyonu banka ödemesi sayılmaz.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 36 · N06 — 200 kaydın dışındaki sipariş araması, toplam ve CSV

**Sayfa/rol:** `/store/MAGAZA_ID/orders`; gerekirse müşteriler ekranı.

1. En az 250 test siparişi hazırla; en eski ve son siparişin numarasını not et.
2. En eski sipariş numarasını ve müşteri bilgisini arat; tarih/durum filtresiyle tekrar bul.
3. Sonraki/önceki sayfalara git; toplam kayıt ile gösterilen sayfa sayısını karşılaştır.
4. Filtreli CSV indir; ilgili kapsamın son sayfasındaki kaydın bulunduğunu ve satır sayısını karşılaştır.
5. Tüm dönem KPI'larını DB/bağımsız fixture toplamıyla karşılaştır; farklı para birimlerinin ayrı olduğunu kontrol et.
6. Başka mağaza hesabıyla aynı sipariş numarasını ara; sonuç görünmemeli.

**Beklenen:** İlk 200 sınırı yoktur; eski kayıt sunucu aramasıyla bulunur. CSV seçilen kapsamın tamamıdır, yalnız mevcut sayfa değildir. Özet tüm ilgili veriden gelir; TRY/USD gibi tutarlar tek anlamsız toplamda birleştirilmez. Mağaza izolasyonu korunur. Müşteri listesi için >500 kayıt aramasını ek regresyon olarak yapabilirsin.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 37 · N07 — Tedarikçi alt sorgu hatası ile boş veri ayrımı

**Sayfa/rol:** `/supplier/panel` → Siparişler → ayrıntı. Geliştirici kontrollü DB hata fixture'ı gerekir.

1. Sağlam kalemli test siparişini aç; miktar ve alt toplamını not et.
2. Ayrı ayrı sipariş kalemi, komisyon/eşleme ve görsel alt sorgusunu test fixture'ıyla başarısız yap.
3. Ekranı/isteği yenile; hata ve tekrar deneme davranışını kontrol et.
4. Hata fixture'ını kaldır; tekrar dene ve doğru verinin geldiğini kontrol et.
5. Gerçekten boş başarılı sonuçla ve tarihsel ilişkisi eksik siparişle karşılaştır.

**Beklenen:** Başarısız/kesilmiş sorgu sessiz `[]`/₺0 başarılı sipariş görünümüne dönüşmez. Açıklayıcı hata veya ilişki uyarısı vardır; tekrar denemeyle toparlanır. Tarayıcıdan tek RPC isteğini engellemek tüm isteği test eder; tek alt DB sorgusunu kanıtlamaz.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

## P — Hız sınırı ve uzun koşu

### 38 · P01 — HTTP 429 ve bekleme süresi

**Sayfa/rol:** Ayrı test ortamındaki hız sınırına tabi işlem; Network; `loadtest/rate-limit-check.ts` teknik senaryosu.

1. Normal tek kullanıcı işlemini yap; hata/429 var mı not et.
2. Geliştiriciyle ilgili uç/işlem için test ortamında sınırı kontrollü aş. Hangi işlemin hangi limiti kullandığını önce doğrula.
3. İlk 429 yanıtında `Retry-After`, `Cache-Control` ve kullanıcı mesajını kontrol et.
4. Belirtilen süre dolmadan tekrar dene; kalan bekleme süresini izle.
5. Süre dolunca normal tek istek yap ve toparlanmayı kontrol et.

**Beklenen:** 429 açıklayıcıdır; bekleme saniyesi ve `no-store` vardır. Süre dolmadan aşırı tekrar engellenir, sonra normal trafik çalışır. Aynı IP'deki yoğun test 429'u kapasite çökmesi/500 diye etiketlenmez. Limitin kaldırılması geçme kriteri değildir.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 39 · P02 — Uzun koşu HTTP 500 ve hata sonrası toparlanma

**Sayfa/rol:** Ayrı staging HTTP yük senaryosu; `/admin/logs`, `/admin/system`; sunucu logları.

1. Karşılaştırılacak rota, veri, build, süre, eşzamanlılık ve eşikleri sabitle; önce kısa başlangıç koşusu yap.
2. Eski yaklaşık 65 dakikalık sorunu sınamak için en az bu pencereyi kapsayan kontrollü koşu çalıştır; daha kısa koşu yeterli kanıt değildir.
3. İstek sayısı, 5xx sayısı, zamanları ve p95'i ham çıktıdan kaydet.
4. Her 500'ü sunucu request ID, zaman, süre ve logla eşleştir.
5. Geliştirici fixture'ında modül yüklemesini bir kez başarısız yapıp sebebi kaldır; sonraki isteğin kalıcı eski rejected promise'e takılmadan yeniden yükleyebildiğini kontrol et.

**Beklenen:** Hata gözlenirse teşhis edilebilir; geçici modül yükleme hatası kalıcı zehirlenmiş önbellek yaratmaz. Uzun koşu kabulü önceden seçilen eşik ve ham veriye dayanır. Tarihsel 492 HTTP 500'ün kök nedeni doğrulanmadığından “aynı sorun kesin düzeldi” sonucu otomatik çıkarılmaz. Dev sunucusu kapasite kıyasına uygun değildir.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 40 · P03 — Tahmini trafik yerine bağımsız ölçüm

**Sayfa/rol:** k6 çıktı JSON'u ve `/admin/load-test` raporları. k6 kurulu ve `test-store-1` gibi mevcut TEST mağazaları gerekir.

1. Staging adresini, mevcut TEST mağaza sayısını ve küçük başlangıç VU değerini belirle.
2. PowerShell'de aşağıdaki örneğin adres/sayılarını gerçek test ortamına göre doldur; `STORE_COUNT`, mevcut `test-store-N` aralığı olmalı.

   ```powershell
   $env:BASE_URL = 'https://TEST-ORTAMI-ADRESI'
   $env:STORE_COUNT = '1'
   $env:VUS = '5'
   $env:DURATION = '1m'
   k6 run loadtest/k6/storefront.js
   ```

3. `loadtest-storefront-summary.json` içindeki hedef VU, ölçülen maksimum VU, süre, istek/sn, p95, hata ve 429'u kontrol et.
4. 50/100/500 gibi hedefleri gerçekten ayrı koşularla ölç; bir koşuyu çarparak diğerinin sonucu sayma.
5. Kısa ayrı koşuyu Ctrl+C ile kes; yarım çıktının tam başarı sayılmadığını kontrol et.

**Beklenen:** Sonuç gerçek ham ölçümdür; örneğin 100 kullanıcının trafik değerini ×5 yaparak 500 kullanıcı ölçümü sunulmaz. Eşik aşımları saklanmaz; ölçülmeyen CPU/RAM/DB null/eksik kalır. Bu script HTTP vitrin testidir; checkout endpointleri projede eksik olduğundan `checkout.js` ile ödeme kapasitesi doğrulanmış sayılamaz. Örnekteki 5 VU bir test başlangıcıdır, kapasite hedefi değildir.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

## T — Teyit ve tekrar işlem kontrolleri

### 41 · T01 — İptal/iade siparişini eski dekontla ödenmiş yapmama

**Sayfa/rol:** Kolay Panel → **Siparişler** → **Dekont kontrolü**; sipariş ayrıntısı. N01 ile ortak akış.

1. N01 testinin okuma/onay/tekrar sonuçlarını bu maddeye bağla.
2. Ayrı test DB'de iptal edilmiş ve iade edilmiş siparişlerin ödeme durumlarını not et.
3. Dekont seçicisinde bu siparişlerin sunulmadığını kontrol et.
4. Geliştiriciyle eski açık ekran/önceden alınmış istek kullanarak bu siparişlere yeniden dekont onayı veya tahsil edildi güncellemesi dene.
5. DB ve finansal izi yeniden kontrol et.

**Beklenen:** UI ve sunucu iptal/iade kaydını eski dekontla yeniden paid yapmaz. Durum ve bakiye değişmez; uygun hata görünür. Yalnız seçicide gizlenmesi yeterli değildir; stale isteğin sunucuda reddi de kontrol edilir.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 42 · T02 — Tamamlanmış iadeyi tekrar işlememe

**Sayfa/rol:** `/store/MAGAZA_ID/returns`; yeni iade kaydı/finansal iz.

1. Tamamlanmış test iadesini aç; tutar, durum ve toplamı not et.
2. “İade tamamlandı” durumunu ve tekrar tamamlama düğmesinin kapalı/yok olduğunu kontrol et.
3. Tutar/durum düzenlemeyi dene; tamamlanmış finansal kaydı değiştirmen engellenmeli.
4. İade tamamlanmadan açılmış eski ikinci sekmede tekrar tamamlama isteğini dene.
5. Geliştiriciyle doğrudan tekrar sunucu isteği ve DB toplam kontrolü yap; yeni akış için N02/N03 sonuçlarını bağla.

**Beklenen:** Tamamlanmış iade değiştirilemez/tekrar finansal etki üretmez. Eski sekme veya direkt istek korumayı aşmaz. Tek sağlayıcı iadesi/tek muhasebe etkisi korunur; görünür düğme tek başına çift ödeme kanıtı değildir.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 43 · T03 — Kaynak stok ve mağaza stoku ayrımı

**Sayfa/rol:** `/supplier/panel` → Ürünler/stok görünümü; `/store/MAGAZA_ID/supplier-catalog`; mağaza ürün/depo ekranı.

1. Kaynak stoku ile mağazaya aktarılmış stoku farklı olan test ürünü seç; varyant kimliğini eşleştir.
2. Tedarikçi kaynak stok/fiyat ve güncelleme zamanını not et.
3. Mağaza varyant/depo stok-fiyatı, rezervasyon ve güncelleme zamanını ayrı not et.
4. Test ortamında kaynak stoğu değiştir; senkron öncesi ve sonrası alanları karşılaştır.
5. Test siparişiyle rezervasyon oluştur; tek rezervasyonun iki kez düşülmediğini kontrol et. İptal/iade sonrası stok davranışını işletmenin stok kuralıyla karşılaştır.

**Beklenen:** Kaynak ve aktarılmış/depo stokları açıkça ayrı etiketlenir; zamanları görünür. Farklı sayı tek başına hata değildir. Senkron/rezervasyon işletme kuralına uyar; aynı rezervasyon iki kere düşülmez. Kaynak önceliği konusunda onaylı kural yoksa o kabul kısmını blokeli kaydet.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 44 · T04 — SEO ürün/varyant/sitemap kapsam ayrımı

**Sayfa/rol:** `/store/MAGAZA_ID/seo`, Kolay SEO kartı, `/admin/site-seo` envanteri; mağaza sitemap'i.

1. Test katalogdaki toplam ürün, aktif/yayınlı ürün ve varyant sayısını ayrı çıkar.
2. SEO kartındaki toplam ve denetlenen ürün sayısını/filtre kapsamını oku.
3. Büyük katalogda son sayfalardaki bilinen ürünü arayıp denetim sonucunu kontrol et.
4. Mağaza sitemap'inde yayınlı ürün URL sayısını say; varyant sayısıyla karıştırma.
5. Test ürününü gizle/yayından kaldır; SEO envanteri ve sitemap değişimini kendi kurallarına göre kontrol et.

**Beklenen:** Ürün, varyant, denetlenen kapsam ve indekslenebilir URL farklı metrikler olarak açıklanır. Tarama sabit ilk kayıt sınırında kalmaz. Sitemap yalnız yayın kuralına uygun URL'leri içerir; bütün metriklerin eşit olması beklenmez. B06/A05 sonuçlarını da bağla.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

### 45 · T05 — Veri yokluğu, sistem sağlığı ve başarı ifadeleri

**Sayfa/rol:** `/admin/system` → sistem sağlık paneli; `/admin/load-test` → eşik/mutabakat özeti.

1. Ölçüm bulunmayan test ortamında sağlık panelini aç; API p50/p95, hata oranı ve DB ölçümünü ayrı incele.
2. Ölçümlü ortamda son ölçüm tarihini ve kaynak/kapsamı kontrol et.
3. Sağlık sorgusunu Network blocking veya test fixture'ıyla başarısız yap; veri yokluğu ile hata ayrımını gözle.
4. Eksik, durdurulmuş, failed ve tamamlanmış ölçümlü turu ayrı aç.
5. Mutabakat/eşik başarı mesajının yalnız ilgili kontrol gerçekten tamamlandığında verildiğini kontrol et.

**Beklenen:** Ölçüm yokken “0 ms / %0 hata / sağlıklı” başarı sonucu üretilmez; bilinmiyor/ölçüm yok/hata açıkça görünür. Son ölçüm zamanı vardır. DB ölçümü var diye API ölçülmüş sayılmaz; “kesinti” de kanıtsız verilmez. Eşik/mutabakat başarısı yalnız tamamlanmış ve ölçülmüş kontrolde gösterilir. Sayfadaki tüm ilgili kartları incele; tek sağlık kartının doğru olması diğer kartları onaylamaz.

**Sonuç:** [ ] Geçti [ ] Kaldı [x] Blokeli [ ] Çalıştırılmadı *(13 Ekim 2026, local/deecc88; Tam manuel kabul tarayıcı/fixture/sağlayıcı ön koşulları nedeniyle doğrulanamadı; teknik kanıt ve eksik adımlar sonuç kaydında.)*

## Teknik regresyonları çalıştırma

Proje klasöründe PowerShell aç. Bunlar manuel/sağlayıcı testlerinin yerine geçmez; dış servis çağrısı olmadan yerel kod kontrollerini destekler.

```powershell
npx vitest run --config vitest.config.ts
npx tsc --noEmit
npm run check:links
```

İlgili örnek testler: `receipt-review.test.ts` (N01/T01), `shipment-items.test.ts` (B09), `supplier-item-ownership.test.ts` (B02), `customer-return.test.ts` (F02/N04), `loadtest-result.test.ts` (B10/B11/Kontrol/N05/T05), `date-rendering.test.ts` (L01), `chunk-recovery.test.ts` (L02), `email-marketing.test.ts` (L03), `plan-price.test.ts` (A04), `rate-limit.test.ts` (P01), `retryable-module.test.ts` (P02). SQL fixture kontrollerinin kurulumu `docs/bugfix-revision-3.md` içinde bulunur. Gerçek Supabase RLS ve sağlayıcı davranışını ayrıca doğrula.

## Önerilen çalışma sırası

1. Public hızlı tur: B12, F04–F10, F02/F01, A04/A05.
2. Mevcut hesap/veriyle panel turu: B01–B08, B10–B11, L01/L03, N06, T03–T05, Kontrol.
3. Ayrı test verisiyle değişiklik turu: A01, B02–B05, B09, F03/F11, N01/N04, T01/T02.
4. Geliştirici/sandbox/staging turu: N02/N03/N07, L02, P01–P03 ve eksik/hatalı durum fixture'ları.

Bu sıralama test bağımlılıklarını azaltır; her maddenin yukarıdaki tüm senaryoları ayrıca kaydedilir.

## Sonuç kayıt şablonu

Her madde için aşağıdaki satırı çoğalt:

| ID | Durum | Ortam/build | Hesap rolü | Veri kimliği | Beklenen/gerçek fark | Kanıt ve saat |
| --- | --- | --- | --- | --- | --- | --- |
| A01 | Çalıştırılmadı | local/e4923f8 | — | — | — | — |

Kaynaklar: Kullanıcının Downloads klasöründeki `Mefticaret_Bugfix_Oncesi_Sonrasi.html` ve `Mefticaret_Birlesik_Hatalar_ve_Kontrol_Listesi (1).pdf`; repo `docs/bugfix-revision-3.md`, `docs/development-optimization.md`, `loadtest/README.md` ve güncel rota/bileşenler. Bu rehber, eski raporun hedef taslaklarını güncel kod davranışına göre test adımlarına çevirir.
