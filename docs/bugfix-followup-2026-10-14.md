# 45 maddelik rapor — 14 Ekim takip çalışması

Başlangıç: kullanıcının ilettiği `682ca806` kontrolü; 26 geçti, 5 açık, 14 atlandı.
Teslim dalı: `main`; canlı repodaki `6f8261b5` ve öncesindeki Lovable değişiklikleri korunarak birleştirildi. Bu belge kaynak PDF/HTML ve önceki test kayıtlarını değiştirmez.

## Kabul kapsamındaki değişiklik

Kullanıcının talebiyle aşağıdaki 14 madde, eski kayıtların yeniden üretilmesi şartı kaldırılarak **Geçti — kod bazında** kabul edilir. Geçmiş hata kaydının kapanması, geçmişteki koşunun yeniden çalıştırıldığı anlamına gelmez. Gerçek banka, e-posta teslimatı, tarayıcı hydration veya eşzamanlı kapasite sonucu bu statüden çıkarılamaz.

| ID      | Sonuç                                         | Güncel kanıt ve kapsam                                                                                                                                                                                                                                                                                     |
| ------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01     | Geçti — kod bazında                           | `landing-destinations.test.ts` seçimi korur. Yeni `stores.functions.test.ts` gerçek `createStore` işleyicisinde aylık/yıllık seçimin kaydını ve ücretli seçimde bile ücretsiz başlangıç planını doğrular. Auth kayıt metadata ve e-posta dönüşü, onboarding ve billing parametre aktarımı kodda incelendi. |
| A04     | Geçti — kod bazında                           | `plan-price.test.ts`: tek kayıtlı fiyat kaynağı, yıllık toplam/aylık eşdeğer, gerçek indirim ve eksik fiyat. Eski Enterprise rakamlarını işletme tarafından yeniden onaylatma koşulu bu teknik kabulden çıkarıldı; yeni ticari fiyat atanmadı.                                                             |
| F07     | Geçti — kod bazında ve yerel HTTP             | Yeni yerel test yazısıyla 10 HTTP kontrolü geçti: yayın 200, iki eski slug'dan güncel sluga 301, listede güncel bağlantı, eksik/taslak/silinmiş yazıda 404. Tarihsel iki yazının geri getirilmesi kabul kapsamı dışında.                                                                                   |
| Kontrol | Geçti — kod bazında                           | `loadtest-result.test.ts` tarihsel toplamların ve hedef kullanıcı değerlerinin kapasite kanıtı yapılmadığını doğrular. Eski 40.000 istek koşusunu yeniden çalıştırma şartı kaldırıldı. Yeni yük koşusu yok.                                                                                                |
| L01     | Geçti — kod bazında; tarihsel kayıt kapatıldı | `date-rendering.test.ts` farklı sunucu/istemci saat dilimlerinde aynı çıktıyı ve bozuk/eksik tarihi doğrular. Blog SSR başlangıç verisi ve sorgu hata yolları incelendi. Tarihsel React #418 olayının kesin kök nedeni veya tüm tarayıcı hydration senaryoları kanıtlanmış değildir.                       |
| L02     | Geçti — kod bazında; tarihsel kayıt kapatıldı | `chunk-recovery.test.ts`; `ChunkRecovery` mevcut ekranı korur, otomatik reload yapmaz, kullanıcının yenilemesini bekler. Gerçek deploy sırasında eski sekme deneyi bu kabulün dışında.                                                                                                                     |
| N01     | Geçti — kod bazında                           | `receipt-review.test.ts` tutar eşleşmesini yalnız `pending_review` yapar. SQL kontrolleri yetkisiz onay, aynı dekont/banka referansı tekrarı, iptal/iade durumlarını sınar. Gerçek banka tahsilatı yapılmadı.                                                                                              |
| N02     | Geçti — kod bazında                           | İzole gerçek SQL'de tekrar webhook, sağlayıcı işlem anahtarı ve muhasebe tekilliği kontrolleri geçti. QNB sandbox çağrısı yok.                                                                                                                                                                             |
| N03     | Geçti — kod bazında                           | Atomik claim SQL kontrollerine ek olarak `refunds.server.test.ts` gerçek `processRefund` fonksiyonunda paralel çağrı ve sağlayıcı başarısından sonra DB hatası/toparlanma senaryolarında tek sağlayıcı çağrısını doğrular. Dış sağlayıcı sahtedir.                                                         |
| N04     | Geçti — kod bazında                           | `customer-return.test.ts`; login/register hedefi, `emailRedirectTo` ve kayıt sonrası oturumlu/oturumsuz dönüş yolları incelendi. Aynı mağaza checkout hedefi korunur; sepet depolaması değişmedi. Gerçek e-posta teslimatı denenmedi.                                                                      |
| N06     | Geçti — kod bazında                           | Yeni `order-list.functions.test.ts`: gerçek sunucu işleyicilerinde 250 kayıt, en eski sipariş araması, beş sayfa, tam/seçili dışa aktarım, mağaza filtresi ve sorgu hataları. SQL özeti tüm dönem/para birimi/başka mağaza ayrımını doğrular.                                                              |
| P01     | Geçti — kod bazında                           | `rate-limit.test.ts`: 429, `Retry-After`, `no-store` ve bekleme saniyesi. Eski 50/100 kullanıcı koşusunu yeniden çalıştırma şartı kaldırıldı; yeni kapasite sayısı üretilmedi.                                                                                                                             |
| P02     | Geçti — kod bazında; tarihsel kayıt kapatıldı | `retryable-module.test.ts`: başarısız modül yüklemesi kalıcı cache olmaz, sonraki istek tekrar deneyebilir. Build ve normal HTTP kontrolleri ayrı kaydedilir. Eski 492 HTTP 500 olayının kesin nedeni veya uzun koşunun sonucu yeniden kanıtlanmış değildir.                                               |
| T01     | Geçti — kod bazında                           | N01 ile aynı iş; ikinci bağımsız finansal doğrulama sayılmaz.                                                                                                                                                                                                                                              |

## Açık maddelerde yapılan düzeltmeler

### B02 — geçmiş kalem sahipliği

`loadSupplierDeskOrders`, snapshot eksik olduğunda **aynı sipariş ve aynı kalemi** gösteren tekil komisyon sahibini kullanır. Snapshot varsa komisyonla üzerine yazılmaz. Birden fazla komisyon sahibi, eksik ilişki veya başka siparişin komisyonu sahiplik kanıtı olmaz. Siparişin başlığındaki tedarikçiden tüm kalemler için sahiplik türetilmez.

`20261014100000_recover_supplier_commission_history.sql`, aynı kesin kanıtı kalıcı ilişkiye aktarır; tekrar çalışması yeni etki üretmez. Kaynağı tamamen kaybolmuş veri uydurulmaz. Gerçek sipariş okuyucusu, çelişkili geçmiş ve sekiz alt sorgu hatası yeni testlerle kontrol edildi.

**Canlı tamamlanma koşulu:** MEF-LCHUKMIPL ve MEF-K603UZO6D için migration sonrası kalem/sahiplik kontrolü; kanıt yoksa gerçek sipariş/komisyon arşivinden onarım. Bu oturumda canlı DB yazma erişimi yoktu; bu iki siparişin onarıldığı iddia edilmez.

### B03 — ürün fotoğrafı

Katalog stüdyosunun yedek mekanizmasını atlayan `img` alanı `SmartImage` kullanır. Kart ve detaylarda optimize kaynak/orijinal kaynak sonrası aynı ürünün diğer fotoğrafları denenir; hepsi başarısızsa yerel yedek gelir. Görsel kaynağı değişince hata durumu sıfırlanır. Kayıtlı XML/raw görsel alanları da aynı üründen alınır; HTML URL ayraçları çözülür. Aynı kaynak çözümlemesi mağazaya aktarmada kullanılır.

**Canlı tamamlanma koşulu:** çardak kaydındaki gerçek kaynakların erişimi kontrol edilmeli; hiçbirinde dosya yoksa gerçek fotoğraf yeniden yüklenmeli. Bu oturumda o ürünün özel kaynak verisine veya gerçek fotoğrafına erişilemedi; fotoğrafın geri geldiği iddia edilmez.

### F03 / F11 — politika yayınlama

Eksik şablon/sorgu/taslak oluşturma hataları artık sessizce yutulmaz. Panel, henüz kaydı bile olmayan zorunlu belgeyi ve çerez politikasını eksik listesinde gösterir.

`20261014101000_publish_policy_atomically.sql` ve mevcut `publishPolicy` sunucu işleviyle sürüm oluşturma, aktiflik ve görünür yayın işaretçisi tek transaction'da değişir. Yetki, mağaza kapsamı, boş metin ve eski taslak kontrol edilir. Eski başarısız yayından kalan sürüm varsa numara ilerletilir; tarihçe silinmez. Başarısız yayında önceki sürüm korunur. Yayınlama belgeyi görünür yapar. Hazır metinler kendiliğinden yayımlanmaz.

Kod veritabanından önce yayımlanırsa yalnız RPC'nin henüz bulunmadığı kesin `PGRST202` yanıtında mevcut tablolara uyumlu yayın yolu kullanılır: yeni sürüm hazırlanır, eski belge korunarak yayın işaretçisi karşılaştırmalı güncellenir, ardından eski aktiflik temizlenir. İşaretçi değişemezse yeni aktiflik geri alınır. Belirsiz RPC/ağ hatasında ikinci yazma yolu denenmez. Bu uyumluluk yolu çok istekli bir geçiştir; tek transaction garantisi yeni RPC kurulu olduğunda geçerlidir. İki yeni SQL dosyası, canlı repodaki önceki migration düzenine uygun `drizzle/migrations/0010_report_followup_repairs.sql` ve journal kaydıyla da teslim edilir. İzole SQL aracı iki kopyanın birebir eşleşmesini kontrol eder.

**Canlı tamamlanma koşulu:** Web dijitalin Gizlilik/İade/Mesafeli Satış ve çerez metinleri, Yılmaz'ın çerez metni gerçek mağaza bilgileriyle yayımlanmalı. Kullanıcının düzeltme yetkisi bu işi kapsar; engel tekrar onay ihtiyacı değil, canlı yönetici oturumu/DB yazma erişiminin ve mağaza metinlerinin bu oturumda bulunmamasıdır.

### T05 — sistem özeti

Sunucu, sıfır API örneğinde hata oranı/süreyi `null` döndürür. Süresi eksik kayıtlar ortalama paydasına girmez; gerçekten ölçülmüş 0 korunur. Alt özet de `Ölçüm yok` gösterir ve süre örnek sayısını belirtir. Sistem tablo sayımındaki sorgu hataları sıfıra dönüşmez. `api-health-summary.test.ts` ile doğrulandı.

## Sonuçların okunması

- Önceki 26 kabul bu takip çalışmasında geri alınmadı; hepsinin yeniden canlı denendiği iddia edilmez.
- Önceki 14 atlanan madde, kullanıcının belirlediği yeni kapsamda kod bazında kabul edildi.
- T05 yerel kod düzeltmesiyle geçti.
- B02, B03, F03 ve F11 için kod düzeltmeleri hazır; **canlı veride kapanış bekleyen dört ID / üç iş** var.
- Bu nedenle 45/45 canlı geçti sonucu verilmez. Kod kabulü ile gerçek veri onarımı ayrı tutulur.

## Doğrulama

Son çalıştırılan otomatik kontrollerin sayıları ve sonuçları `bugfix-followup-2026-10-14.json` dosyasında tutulur. Tekrar:

```powershell
node node_modules/vitest/vitest.mjs run --config vitest.config.ts
node scripts/verify-bugfix-sql.mjs local-test.local/qa-runtime/node_modules/@electric-sql/pglite/dist/index.js
node scripts/verify-optimization-sql.mjs local-test.local/qa-runtime/node_modules/@electric-sql/pglite/dist/index.js
node node_modules/typescript/bin/tsc --noEmit
npm run build
```

İki yeni migration tam yerel Supabase şemasına da uygulandı; gerçek `authenticated` rolüyle politika yayımlama ve `anon` rolüyle yayımlanan metni okuma kontrol edildi. Deneme politikası rollback ile kaldırıldı. Altı yerel hesabın girişi/rol izolasyonu mevcut yerel doğrulama aracıyla geçti. Kod, kullanıcının belirttiği `main` üzerinden teslim edilir. Canlı migration'ın uygulanması ve dağıtım sonucu ayrı doğrulama gerektirir; doğrudan canlı DB işlemi yapılmadı.
