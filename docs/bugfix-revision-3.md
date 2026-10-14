# 45 maddelik bugfix incelemesi — yerel değişiklikler

14 Ekim takip düzeltmeleri ve kullanıcının belirlediği kod bazında kabul kapsamı için [güncel takip raporuna](bugfix-followup-2026-10-14.md) bakın. Bu dosya ilk teslimin tarihsel kaydıdır.

Kaynaklar: `Mefticaret_Bugfix_Oncesi_Sonrasi.html` ve `Mefticaret_Birlesik_Hatalar_ve_Kontrol_Listesi (1).pdf`.

Değişiklikler `fix/45-report-bugfixes` branch'inde teslim edilir. Deploy, canlı migration, gerçek ödeme/iade, e-posta gönderimi veya canlı yük testi yapılmadı. Aşağıdaki tablo kod müdahalesini ve korunmuş davranışları kaydeder; 45 bağımsız canlı hatanın tekrar üretilip kapatıldığı anlamına gelmez. Raporun kendisinde kapalı, tarihsel ve birbiriyle örtüşen maddeler bulunuyor.

| ID      | Yapılan çalışma                                                                                                                                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01     | Paket ve dönem seçimi kayıt, doğrulama, onboarding ve faturalandırmada taşınır. Seçim ücretli plan hakkı vermez; mağaza ücretsiz planda açılır.                                                                                 |
| A04     | Aylık/yıllık fiyatlar aynı DB alanları ve ortak hesapla gösterilir. Eksik yıllık fiyat ücretsiz olarak sunulmaz; indirim gerçek fiyat farkından hesaplanır.                                                                     |
| A05     | Güncel sitemap envanteri sunucuda oluşturulup incelenir. Sayfalama, yinelenen adresler, noindex mağazalar ve yayınlanmamış politika bağlantıları ele alındı.                                                                    |
| B01     | Tedarikçi katalog arama, kategori, sıralama ve sayfalama sunucuda yapılır; yalnız ilk 500 kayıt aranmaz.                                                                                                                        |
| B02     | Sipariş kaleminin tedarikçisi kalıcı ilişki tablosunda tutulur. Ürün silinmesi/katalog değişmesi tarihsel sahipliği değiştirmez. Eski ilişki çözülemiyorsa sıfır tutar uydurulmaz.                                              |
| B03     | Görsel önce optimize, sonra kaynak URL, ardından yerel yedek kullanır. Kaynak değişiminde hata durumu sıfırlanır. Gerçek bozuk kaynak URL ayrıca kontrol edilmeli.                                                              |
| B04     | Ürün açıklamasındaki HTML kontrollü düz metin olarak gösterilir.                                                                                                                                                                |
| B05     | Katalog formunda alan etiketleri, benzersiz bağlantılı kimlikler ve erişilebilir kayıt hatası eklendi.                                                                                                                          |
| B06     | SEO ürün sayısı ve taraması tüm katalogdan gelir; kesilmiş 300/500 kayıt kapsamı kaldırıldı.                                                                                                                                    |
| B07     | Ödeme bekleyen hesaplar yalnız aktif, pending ödemeleri içerir; iade/iptal edilmiş siparişler hariçtir.                                                                                                                         |
| B08     | Panel seçimi oturum sahibinin rol ve mağaza üyeliklerinden sunucuda çıkarılır; birden fazla panelde seçim sunulur.                                                                                                              |
| B09     | Dijital teslimat türü sipariş kaleminde saklanır. Kargo yalnız fiziksel kalemleri içerir; karma sipariş fiziksel kargoyla tamamen teslim edilmiş sayılmaz.                                                                      |
| B10     | İzleme göstergelerinde örneklem ve ölçüm zamanı/kapsamı ayrılır; hedef VU aktif kullanıcı olarak gösterilmez.                                                                                                                   |
| B11     | Eksik metrik sıfır/sağlıklı yapılmaz. DB ve veri toplama hataları bilinmeyen veya hata durumuna gider.                                                                                                                          |
| B12     | Belge dili ve yönü rota diliyle eşleşir; kontrollü public dil ile panelin seçilen dili ayrılır.                                                                                                                                 |
| F01     | Raporda stoklu örneğin sepete eklenmesi zaten çalışıyordu. Sepet miktar hesabında stok 0'ın 1'e yükseltilmesi kaldırıldı ve stok sınırı test edildi.                                                                            |
| F02     | Doğru müşteri giriş hedefi korunur. Giriş/kayıt ortak dönüş kuralı yalnız checkout veya aynı mağaza hesabını kabul eder.                                                                                                        |
| F03     | Checkout yalnız görünür, aktif, yayınlanmış ve yürürlükteki üç politika sürümünü kabul ettirir; eksik belgede sipariş kapalıdır.                                                                                                |
| F04     | Beş dilde telefon hedefinin `tel:` olarak korunmasına regresyon testi eklendi. Gerçek arama yapılmadı.                                                                                                                          |
| F05     | Beş dilde kayıt niyeti, paket ve dönemin bağlantı dönüşümlerinde korunması test edildi.                                                                                                                                         |
| F06     | Gerçek referans içeriği varsa referans bölümü gösterilir; yoksa boş bölüme götüren referans bağlantıları saklanır.                                                                                                              |
| F07     | Blog slug değişiklikleri doğrudan güncel slug'a 301 gider. Silinmiş/yayınlanmamış yazı 404 verir. Bilinmeyen eski slug'lar tahmin edilmedi.                                                                                     |
| F08     | Mevcut boş e-posta açıklaması korunur; bildirim alanla ilişkilendirilir, hata kalıcı gösterilir, eşzamanlı reset tıklaması kapatılır.                                                                                           |
| F09     | Rehberde telefon/SMS OTP ve e-posta seçenekleri uygulamanın gerçek akışına göre anlatılır.                                                                                                                                      |
| F10     | Public giriş/şifre sıfırlama metinleri ve dönüş bağlantıları beş dilde taşınır. Türkçe rehber içeriğine bağlantılar içerik diliyle etiketlenir.                                                                                 |
| F11     | Eski mağaza politika adresleri canonical adreslere 301 gider. Politika kabul sürümleri siparişle aynı DB transaction'ında kaydedilir. F03 ile örtüşür.                                                                          |
| Kontrol | Başarılı HTTP koşusu eşzamanlı alışveriş, banka ödemesi veya CWV testi olarak sunulmaz. Koşu yanında kapsam veya kanıt eksikliği gösterilir.                                                                                    |
| L01     | SSR/istemci tarih çıktısında sabit İstanbul zaman dilimi kullanılır; blog veri hataları boş içerik diye yutulmaz. Tarihsel React #418 loglarının kesin kök nedeni doğrulanmadı.                                                 |
| L02     | Chunk yükleme hatasında mevcut ekran otomatik yenilenmez; kullanıcı çalışmasını koruyup yenileyebilir. Hata ekranında chunk'a özel yenileme eylemi bulunur. Otomatik taslak geri yükleme veya sıfır kesinti garantisi verilmez. |
| L03     | Eksik şablon adı/konusu, eksik etiket ve kategori listeleri aramayı çökertmez; eski kayıt testleri eklendi. Tarihsel logla kesin eşleşme doğrulanmadı.                                                                          |
| N01     | AI dekont okuması ödeme yapmaz: uygun sonuç pending_review olur. Mağaza yetkisi, aynı dekont kontrolü ve banka referanslı açık manuel onay bulunur.                                                                             |
| N02     | Sağlayıcı iade referansı başına muhasebe etkisi atomik ve tekildir. Erken webhook doğrudan toplam artırmaz; doğrulanmış sağlayıcı yanıtıyla mutabakat yapılır.                                                                  |
| N03     | İade talebi/sağlayıcı çağrısı atomik sahiplenilir. Belirsiz zaman aşımında kör tekrar çağrısı yapılmaz; doğrulanmış referansla çağrısız mutabakat mümkündür.                                                                    |
| N04     | Checkout dönüşü müşteri kaydı, doğrulama bağlantısı ve giriş/kayıt geçişlerinde korunur. Sepet depolaması değişmedi.                                                                                                            |
| N05     | Panelin gerçek senaryosu sıralı HTTP örnekleme ve test verisiyle sipariş simülasyonu olarak kaydedilir; VU hedefi ölçüm değildir.                                                                                               |
| N06     | Sipariş arama/sayfalama/CSV sunucuda, RLS kapsamında yapılır. Özet tüm mağaza siparişlerinden ve para birimleri ayrı tutularak hesaplanır.                                                                                      |
| N07     | Tedarikçi ayrıntı sorgularındaki kesilme/hata sessiz boş başarıya dönmez; ilişki eksikliği açık gösterilir.                                                                                                                     |
| P01     | 429 yanıtı bekleme saniyesi ve no-store içerir. Limit gevşetilmedi; yeni kapasite ölçümü yapılmadı.                                                                                                                             |
| P02     | Reddedilmiş sunucu modülü promise'i kalıcı önbellekte tutulmaz. 500 yanıtları istek kimliği, zaman ve süreyle ilişkilendirilir. Tarihsel 492 hatanın kesin kök nedeni ve yük altında düzelme doğrulanmadı.                      |
| P03     | Kullanıcı hedefinden çarpılarak bulunan trafik kapasite ölçümü olarak gösterilmez. Yeni bağımsız yük testi yapılmadı.                                                                                                           |
| T01     | N01 ile aynı dekont akışı. Ek olarak iade/iptal edilmiş siparişin kolay panelden yeniden tahsil edilmiş yapılması engellendi; güncelleme mevcut duruma bağlıdır.                                                                |
| T02     | Tamamlanmış eski iadenin tutarı/durumu değiştirilemez; ekranda İade tamamlandı gösterilir. Yeni iade akışındaki tek işlem garantisi SQL testleriyle kontrol edilir.                                                             |
| T03     | Tedarikçi kaynak stok/fiyatı ile mağazaya aktarılmış stok/fiyat ayrı alanlarda, kendi güncelleme zamanlarıyla gösterilir.                                                                                                       |
| T04     | SEO ürün, varyant ve yayınlanmış sitemap kapsamları açıkça ayrılır; tarama tüm kayıtlara sayfalanır.                                                                                                                            |
| T05     | Eşik ve mutabakat başarı mesajları yalnız tamamlanmış, ölçülmüş kontrolde verilir; hata/durdurulmuş/eksik sonuç başarılı yapılmaz.                                                                                              |

## Yerel doğrulama

- Vitest: `npx vitest run --config vitest.config.ts`.
- Tip kontrolü: `npx tsc --noEmit`.
- Production paketleme: `npm run build`; yalnız üç tanımlı statik sayfa prerender edilir. Windows'taki MCP yol ayracı uyumluluğu düzeltildi; worker import.meta.url ve Reflect düzeltmeleri korundu.
- SQL: `scripts/verify-bugfix-sql.mjs`, bellekte izole PGlite/PostgreSQL örneğinde dokuz yeni migration'ı uygular. Fixture şeması kullanılır; bütün eski migration'ların ve gerçek Supabase RLS ortamının testi değildir. Gerçek banka çağrısı yoktur.
- SQL aracı proje bağımlılığı değildir. Geçici dizine `npm install --prefix <qa-dizini> --no-save --package-lock=false @electric-sql/pglite` kurulabilir; ardından `node scripts/verify-bugfix-sql.mjs <qa-dizini>/node_modules/@electric-sql/pglite/dist/index.js` çalıştırılır.
- Mevcut dosyalardaki lint `any` borcu ayrıca kaydedildi; eklenen dosyalarda lint hatası bırakılmadı.

## Canlı doğrulama için kalan koşullar

Yeni migration dosyaları henüz veritabanına uygulanmadı; kodun yeni kolon/RPC kullanan yolları bunlara bağlıdır. Yayına alma ayrı bir iştir. Tarihsel tedarikçi bağlantısı zaten kaybolmuş kayıtlar gerçek kaynaktan mutabakat gerektirir. İşletmeye ait politika metinleri yetkili işletme tarafından yayımlanmalıdır; metin veya fiyat uydurulmadı. Canlı stok/görsel, gerçek oturumla checkout dönüşü, chunk kesintisi, mobil/tarayıcı görünümü, OAuth/e-posta, sağlayıcı sandbox iadesi ve eşzamanlı yük senaryoları bu yerel kontrollerle kanıtlanmış sayılmaz.
