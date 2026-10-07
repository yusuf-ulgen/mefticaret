# QNB eSolutions ile otomatik faturalandırma — düzeltme ve kurulum planı

## Bugünkü durum (inceleme sonucu)

Dokümantasyon, 4 servis tanımı (WSDL) ve servis şemaları (XSD) tek tek indirilip mevcut kodla karşılaştırıldı.

- Şu ana kadar QNB'ye **hiç belge gönderilmemiş**: gönderim kayıtları boş.
- Ayarlarda servis adresleri **boş**, ERP kodu **boş** (UTE31415 olmalı), ama sistem "açık" görünüyor.
- e-Fatura gönderiminde zorunlu **erpKodu**, **gonderenEtiket**, **alanEtiket** alanları hiç gönderilmiyor.
- e-Arşiv'de erpKodu yalnız doluysa ekleniyor; şu an hiç eklenmiyor.
- e-Arşiv test ortamı ayrı bir giriş adresi ve ayrı kullanıcı istiyor (`connectortest` + `13178864312.portaltest`), kod ise e-Fatura girişini kullanıyor.
- Faturadaki KDV satırlara oranlanarak bölünüyor; farklı KDV oranlı satırlarda GİB kontrolünden dönebilir.
- **Otomatik faturalama yok:** belge yalnız süper yönetici panelinden elle gönderilebiliyor.
- **Gelir kaynakları:**
  - Paket/abonelik: fatura kaydı oluşuyor (henüz 0 kayıt), ama e-faturaya gitmiyor.
  - AI kredi satışları (4 sipariş): fatura kaydı oluşmuyor.
  - Komisyonlar (genel ve Kolay Panel): fatura kaydı oluşmuyor; sadece raporda hesaplanıyor.
  - Uygulama satışları ve tema mağazası: **tahsilat kaydı yok**, yani ortada faturalanacak gerçek bir ödeme yok.

Doğrulanan ve doğru olanlar: servis ad alanları, `belgeNoTipi` alan adı (şemada böyle), OID → YEREL sırasıyla durum sorgulama, alıcının e-Fatura mükellefi olup olmadığını kontrol edip TEMELFATURA/EARSIVFATURA seçimi, e-Arşiv şube/kasa `DFLT`.

## Yapılacaklar

### 1. Bağlantıyı dokümana birebir uydurma
- Test ve canlı ortam için tüm adresler sabit tanımlanır (e-Fatura `erpefaturatest1` + e-Arşiv `connectortest`/`earsivtest`; canlıda tek kullanıcı).
- ERP kodu `UTE31415` her e-Fatura ve e-Arşiv gönderiminde zorunlu gider.
- e-Fatura gönderiminde `gonderenEtiket` (portalda Hizmet Aktivasyonu'ndaki GB etiketi) ve alıcının PK etiketi (`alanEtiket`) gönderilir.
- `belgeHash` MD5 büyük harfle gönderilir; e-Arşiv'de `donenBelgeFormati` sayı olarak (9).
- e-Arşiv için ayrı giriş adresi ve ayrı kullanıcı/şifre (yalnız test ortamında gerekli).
- Hız sınırı: saniyede en fazla 5 istek (sıraya alma ile).
- Ayarlar ekranında boş adres veya ERP kodu varsa "açık" yapılamaz.

### 2. Fatura içeriğini düzeltme (UBL)
- Her satır kendi KDV oranı ve tutarıyla yazılır; oranlama kaldırılır.
- Fatura ön eki tam 3 büyük harf olarak doğrulanır (GİB biçimi: 3 harf + yıl + 9 hane).
- Alıcı bilgisi mağazanın ayarlarındaki ünvan, vergi no ve adresten gelir. Vergi no yoksa e-Arşiv'de nihai tüketici olarak düzenlenir.

### 3. Tüm gelirler için fatura kaydı
- **Paket/abonelik:** mevcut fatura kaydı kullanılır.
- **AI kredi satışı:** ödeme alındığında fatura kaydı oluşur.
- **Komisyon (genel + Kolay Panel):** her mağaza için **aylık tek fatura** (ay içindeki komisyon toplamı). Mefticaret ürünün satıcısı olmadığı için ürün bedeli değil, yalnız komisyon faturalanır.
- **Uygulama ve tema mağazası:** bugün tahsilat akışı yok. Ödeme alındığı an fatura oluşturacak bağlantı noktası hazırlanır; tahsilat açıldığında otomatik çalışır.

### 4. Otomatik gönderim ve takip
- Ödenen fatura otomatik olarak sıraya girer.
- Akış: alıcı kontrolü → e-Fatura veya e-Arşiv → gönderim → durum sorgulama (Alındı / İşlendi / İşleme Hatası, GİB ve alıcı yanıtı).
- Hata alan belge iki kez yeniden denenir, sonra süper yöneticiye bildirim düşer. Aynı fatura asla iki kez gönderilmez (fatura başına tek belge kilidi).
- Zamanlanmış kontrol yalnız sırada belge varken çalışır.

### 5. Süper yönetici ekranı
- Kaynağa göre listeleme (paket, kredi, komisyon, uygulama, tema), durum, ETTN, fatura no, e-Arşiv görüntüleme linki, hata nedeni, yeniden gönder.
- "Bağlantıyı test et" düğmesi: giriş + alıcı sorgulama.

### 6. Test ortamında doğrulama (canlıdan önce)
- `erpefaturatest1` → `erpefaturatest2` arasında gerçek e-Fatura gönderimi ve durum sorgulama.
- `portaltest` ile gerçek e-Arşiv faturası; dönen görüntüleme linki açılarak kontrol.
- Her iki sonuç size gösterilmeden canlıya geçilmez.

## Sizden gerekenler
1. e-Fatura test kullanıcıları `13178864312` ve `3178864313` için QNB'nin e-postayla gönderdiği şifreler. Bunlar güvenli bir formdan istenecek; sohbete yazmayın.
2. e-Arşiv test şifresi (ekran görüntüsündeki) aynı güvenli formdan girilecek. İlk girişte portal şifre değişikliği isteyebilir; o durumda yeni şifre girilir.
3. Portalda Hizmet Aktivasyonu menüsündeki gönderici etiketi (GB, `urn:mail:...`).
4. Canlıya geçişte: canlı servis kullanıcısı (QNB, portal kullanıcısıyla web servis kullanıcısının ayrı olmasını öneriyor).

## Teknik ayrıntılar
- Ana dosyalar: `src/lib/einvoice.server.ts`, `einvoice-soap.server.ts`, `einvoice-ubl.server.ts`, `einvoice.functions.ts`, `einvoice-schemas.ts`, `routes/_authenticated/admin.einvoice.tsx`.
- Yeni gizli bilgiler: `QNB_EARSIV_USERNAME`, `QNB_EARSIV_PASSWORD` (yalnız test). Mevcut `QNB_EINVOICE_USERNAME` ve `QNB_EINVOICE_PASSWORD` güncellenir.
- Migration:
  - `einvoice_settings`: `earsiv_login_url`, `sender_alias` (GB etiketi) alanları.
  - `invoices`: `source_type` (subscription / ai_credit / commission / app / theme), `source_id`, buyer snapshot alanları, `(source_type, source_id)` tekil indeks.
  - `einvoice_documents`: fatura başına tekil aktif belge kısıtı ve `attempts` alanı.
- Kuyruk: mevcut `job_queue` ile; fatura ödendiğinde iş eklenir, sıra boşalınca zamanlayıcı durur. Durum sorgulama "Alındı" için kısa aralıklarla birkaç kez yapılır.
- Aylık komisyon faturası `commissions` tablosu ile Kolay Panel defterindeki ödenmiş sipariş komisyonundan üretilir; aynı ay için tekrar üretilmez.
- Tüm gönderimler sunucuda yapılır; şifreler yalnız sunucu ortamında okunur, hiçbir yere yazılmaz.
