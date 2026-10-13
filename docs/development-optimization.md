# Geliştirme ve optimizasyon — yerel teslim kaydı

Kaynak: Mefticaret_Gelistirme_Oncesi_Sonrasi.html ve Mefticaret_Gelistirme_ve_Optimizasyon_Onerileri (1).pdf; ortak 27 madde (G01–G27).
Branch: `feat/development-optimization`; başlangıç HEAD: `682ca80`.
Commit, push, deploy, canlı migration, sağlayıcı işlemi ve canlı yük testi yapılmadı.

Kullanıcı ayrı test DB/sandbox hesabının henüz tanımlı olmadığını bildirdi ve yerel kontrollerin tamamlanmasını istedi. Aşağıdaki “yerel tamam” durumu kod uygulaması ve yerel doğrulamayı belirtir. Gerçek cihaz, staging, sağlayıcı ve işletme teyitleri tamamlanmış sayılmaz. Önceki gün yapılan ortak işlerin kanıtı `bugfix-revision-3.md` içindedir; gereksiz ikinci uygulama yapılmadı.

| ID | Yerel çalışma / kaynak kanıtı | Dış ortamda kalan doğrulama |
| --- | --- | --- |
| G01 | Tek katalog ekranı; ekle/düzenle/toplu işlem korunur. RFQ aynı filtre, 25'li sayfa ve `supplier-catalog-query.ts` önbelleğine bağlı. `catalog-actions.tsx`, `supplier.panel.tsx`. | Gerçek tedarikçi oturumuyla katalog/RFQ. |
| G02 | Müşteri ve SEO listesinde sunucu araması, 25'li sayfa, tam toplam ve kapsam etiketi. Ortak tedarikçi kataloğu/RFQ; mevcut sipariş sayfalaması korunur. `kolay-customers.functions.ts`, `kolay-seo-dashboard.functions.ts`. | Büyük gerçek katalog/CRM, eski kayıtlarda arama. |
| G03 | XML/CSV/JSON 200 kayıtlık cursor, içerik parmak izi, tekrar çalıştırmada devam, atomik çalışma sahiplenmesi; başarılı/kısmi/hata ayrımı, kalan ve son başarı. Kesilen işi manuel açma. `supplier-workflow.server.ts`, `xml-integrator.ts`. | Gerçek feed, ağ kesintisi; kaynak alan/görsel hatalarının gerçek veriyle incelenmesi. Görseller ayrı indirme işi olarak test edilmedi. |
| G04 | Kaynak, mağaza varyant ve depo stoku/rezervasyon/tarih ayrı; rezervasyon iki kez düşülmez. `supplier-desk.server.ts`, `workspace-panels.tsx`. | İşletmenin stok önceliği teyidi ve gerçek sipariş/iptal/iade hareketi. |
| G05 | Ortak kategori yaprağı kuralı, import önizlemesi: yeni/mevcut/ulaşılamayan ürün, varyant, hedef kategori, fiyat ve kota; SKU uyarısı. `import-category.ts`, `import-preview.tsx`. | Gerçek eşleme verisi ve benzer kategori adlarının işletme kararı. |
| G06 | Ayarlar Profil/Teslimat/Ödeme/SEO/Pazarlama grupları; form bölüm değişiminde korunur, değişiklik ve kaydetme/hata görünür. Galeri değişikliği takip edilir, mağaza değişiminde form sıfırlanır. `store-tab.tsx`. | Bağlantı kesintisinde gerçek kayıt ve mobil form kullanımı. |
| G07 | Satış/Katalog/Finans/Pazarlama/Ayarlar, mevcut arama, mağazaya özel favoriler; iki güncelleme hedefi ayrı adlandırıldı, yazım düzeltildi. `store-nav.ts`, `app-shell.tsx`. | Gerçek panel kullanıcı deneyimi. |
| G08 | Ürün editöründe 100dvh, kaydırma, belirgin kapatma ve sabit eylem; varyant mobil kolonları, kontrollü finans tablosu, import dialog kaydırması. | 360/375/768 px, masaüstü, klavye ve odak davranışı çalıştırılmadı; yalnız CSS ile mobil uyum onayı verilmedi. |
| G09 | Ortak `query-status.tsx`; hata/boş/yükleniyor/önceki veri ayrımı, tekrar deneme. Finans, SEO, müşteri, katalog, ayarlar ve izleme seçili ekranları. Stüdyo istatistik sorgu hatası sunucuda fırlatılır. | Gerçek ağ/DB kesintisinde ekran ve SSR davranışı. |
| G10 | Ekip ad/e-posta/rol/kapsam ve son kayıtlı değiştiren kişi; sunucuda mağaza yönetici kontrolü. `stores.functions.ts`, `store-access.server.test.ts`. | Gerçek Supabase oturumlarında tüm rol/RLS kombinasyonları. Audit kaydı mevcut best-effort mekanizmaya bağlıdır. |
| G11 | Hazırlık rehberi ve yüzdesi aktif ürünler/yayınlanmış zorunlu politikaları ortak sunucu kaynağından okur; OTP rehberi korunur. `store-readiness.functions.ts`, `setup-guide.tsx`. | Gerçek mağaza ayarları ve işletmenin politika yayınlaması. |
| G12 | Mevcut platform/dil/mağaza sitemap üreticileri korunur; yönetici kapsam envanteri hata ve adetleri ayrı gösterir. `sitemap-inventory.tsx`, `platform-seo.functions.ts`. | Gerçek URL, canonical/hreflang ve yayın/gizleme değişiklikleri. |
| G13 | Public ürün/SEO meta ve gerçek medya kuralı ortak; eski og_image desteklenir. SEO sayfasındaki tüm ürün medyası sayfalı okunur, mevcut tam katalog denetimi korunur. `product-seo-data.ts`. | Gerçek galeri/meta/canonical/hreflang örnekleri. |
| G14 | Önceki locale/auth dönüş ve SSR lang/RTL uygulaması korunup mevcut regresyonlarla doğrulandı. Ortak çok dilli bileşenler ayrılmadı. | EN/DE/FR/AR gerçek giriş ve dönüş ekranları. |
| G15 | AST ile sabit public link/rota envanteri; yönetici eski/yeni slug ve 301/404 envanteri. `check-public-links.mjs`, `slug-inventory.tsx`. | 49 içerik/anchor hedefinin gerçek içerikle doğrulanması; tarihsel slug verisi. Script HTTP crawl yapmaz. |
| G16 | Önceki yayınlanmış politika/sürüm ve atomik kabul kaydı korunur; hazırlık listesi aynı checkout kaynağına bağlı. Politika kaydında hazırlık önbelleği yenilenir. | İşletmenin onaylı metni ve gerçek checkout kabul kaydı; hukuki içerik onayı yapılmadı. |
| G17 | Seçilen paket/dönem özeti aynı paket farklı dönem için de görünür, gerçek destek rotasına bağlantı. Önceki kayıt dönüşü ve fiyat hesabı korunur. | Enterprise fiyatının işletme teyidi ve gerçek destek kanalı. Yeni fiyat uydurulmadı. |
| G18 | Public storage dönüşümü ve private signed görsel ayrımı; özel görsel 480/960/1440 genişlikleri imzalanırken üretilir. Detay SmartImage/srcSet/priority ve preload aynı kaynakları kullanır, hata halinde orijinal kaynak korunur. `signed-image.server.ts`, `image.ts`. | Sağlayıcının gerçek dönüşüm desteği, transfer/LCP ve kırık kaynak davranışı. İlk sekiz özel görsel için boyut üretilir. |
| G19 | Grafikler lazy yüklenir; müşteri sayfası özetleri RLS altında DB aggregate ile hesaplanır, tüm siparişler istemciye/uygulama sunucusuna taşınmaz. `analytics-panel.tsx`, yeni SQL migration. Statik bundle karşılaştırması kaydedildi. | Aynı cihaz/rota CWV/Lighthouse ve gerçek DB süreleri. Bundle farkı kapasite/CWV kanıtı değildir. |
| G20 | Loglara client/server sürümü ve bileşen; incelemede/çözüldü durumları, ilk/son/tekrar kayıtları korunur. Sağlık hata/veri yok durumunda bilinmiyor, son ölçüm görünür. `monitoring.server.ts`, `error-log-desk.tsx`. | Gerçek kesinti/telemetri ve alarm davranışı. Mesaj/uyarı gönderimi yapılmadı. |
| G21 | Önceki SSR başlangıç verisi ve formu koruyan chunk kurtarma korunur. Analitik tarih kovası açık İstanbul saat dilimi; eski istemci sürümü logda. | Deploy sonrası eski sekme ve SSR/hydration tarayıcı senaryosu. |
| G22 | 429 güvenlik sınırları korunur; kalan bekleme süresi kullanıcı mesajında ve Retry-After içinde. `rate-limit.server.ts`, checkout/supplier çağrıları. | Gerçek normal trafik/test trafik ölçümü. |
| G23 | Yük raporu hedef/ölçülen VU, istek/sn, p95, hata, 429 ve yarım koşuyu ayırır; eksik metrik null. Stok yarışında tam bir başarı gerekir. `run-summary.js`, loadtest scriptleri/README. | k6 staging koşusu + CPU/RAM/DB. Checkout k6 contract endpoint'leri mevcut değil; script kurulumu bunu hata olarak bildirir. Tarayıcı/ödeme uçtan uca testi olarak sunulmaz. |
| G24 | Yetkili mağazaya özel sipariş tahsilat/banka/iade/ledger/tedarikçi komisyonu izi; işlem türleri ve belirsiz/processing sonuçlar ayrı. `order-financial-trail.functions.ts`, `financial-trail.tsx`. Mevcut atomik iade/kilit kuralları korunur. | Sandbox callback, paralel iade, sağlayıcı başarı sonrası DB/ağ hatası ve gerçek mutabakat. |
| G25 | Önceki kalıcı sipariş-kalem sahipliği korunur; tüm tedarikçi geçmişini sayfalayan eksik ilişki CSV raporu, başka tedarikçinin kalemleri açılmaz. `supplier-desk.functions.ts`, `supplier.panel.tsx`. | Örnek tarihsel veriyle güvenli onarım. Kaynağı kayıp ilişki tahmin edilip yazılmadı. |
| G26 | Kullanıcının yerel kapsam talebiyle build/tip/test/link/SQL kontrolleri, tekrar çalıştırılabilir `verify-local.mjs`, makine okunur sonuç. | Test DB/sandbox henüz tanımlı değil; gerçek uçtan uca senaryolar `not_run`. |
| G27 | Bu madde bazlı kaynak/kanıt/kalan iş kaydı; JSON sonuçları ve bundle/link envanteri. | Staging ve canlı doğrulama sonradan bu kayda eklenmeli. |

## Yerel doğrulama ve ölçüm

- Başlangıç regresyonu: 111 test; geliştirmelerle 129 test. Son çalıştırmanın geçme/kalma sonucu ve zamanları `local-qa-results.json` içindedir.
- Build ve TypeScript kontrolü; statik link kontrolü: 137 link, eksik rota 0. İçerik/anchor doğrulaması gereken 49 hedef ayrı kaydedilir (`public-link-inventory.json`).
- İzole PGlite: önceki 32 SQL kontrolü ve yeni 7 müşteri aggregate/RLS kontrolü. Canlı DB kullanılmadı. Yeni kontroller >2.000 sipariş, normalize telefon/e-posta, tek sayım, durum/para birimi ve iki mağaza izolasyonunu kapsar.
- Tedarikçi statik JS import zinciri: ilk yerel geliştirme build'i 355.478 gzip byte; lazy grafik sonrası 254.495 gzip byte (~%28,4 düşüş). Başlangıç temiz HEAD ölçümü değildir. Son build ölçümü `bundle-comparison.json` içinde güncellenir; tarayıcı, CSS, ağ, cache ve DB ölçümü değildir.
- Loadtest TypeScript dosyaları ayrıca strict tip kontrolünden; k6 JavaScript dosyaları sözdizimi kontrolünden geçti. Gerçek yük isteği atılmadı.
- Birim testler, build ve SQL testleri gerçek cihaz/ödeme sağlayıcısı testi yerine geçmez. Ayrıntılı dış senaryo listesi JSON raporda `not_run` olarak tutulur.

## Migration bağımlılığı

`supabase/migrations/20261013100000_customer_page_summaries.sql` yeni ve yalnız yerelde. CRM aggregate çağrısı çalışması için yayınlanacak ortamda bu migration uygulanmalı; uygulanmadığında ekran hata/tekrar deneme gösterir. Fonksiyon SECURITY INVOKER ve mevcut RLS ile çalışır. Migration canlıya uygulanmadı. Önceki günün sahiplik/iade/politika migration'ları da hedef ortamın mevcut migration durumuna göre kontrol edilmeli.

## Tekrar çalıştırma

`npm run verify:local -- --sql-runtime <PGlite dist/index.js yolu>`

SQL çalışma zamanı verilmezse SQL kontrolü `not_run`, toplam yerel durum `incomplete` olur; geçirilmiş sayılmaz. Loglar işletim sisteminin geçici dizinine yazılır. Bu komut build/tip/test/link/izole SQL çalıştırır; sağlayıcı veya canlı DB çağırmaz.

Bitirilen maddeler (yerel uygulama/kontrol kapsamı): 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27.
