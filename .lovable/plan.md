# Mefticaret Global & E-İhracat Modülü

Mağazaların yurt dışına satış yapabilmesi için tek bir "Global" bölümü: ziyaretçinin ülkesine göre dil/para birimi/vergi, ülke bazlı fiyatlar, küresel ödeme yöntemleri, gümrük-vergi hesabı, uluslararası kargo ve mikro ihracat belgeleri, çok dilli SEO.

Mevcut altyapıdan yeniden kullanılacaklar: pazarlar (markets), çoklu para birimi ve canlı kur motoru, fiyat listeleri, vergi motoru, kargo/gönderi modülü, çeviri ve dil altyapısı, site haritası üretimi. Yeni olan kısım bunların "sınır ötesi" katmanı.

## Faz 1 — Lokasyon & Döviz Motoru
- Ziyaretçinin ülkesi isteğin coğrafi başlığından okunur; ülkeye eşlenen pazar, dil, para birimi ve vergi kuralı otomatik seçilir. Ziyaretçi seçimi hatırlanır ve otomatiği ezer.
- Kur marjı (exchange buffer): mağaza bazında %0–5 arası risk marjı; ürün fiyatı gösterilirken canlı kura uygulanır, yönetim ekranında "kur + marj = kullanılan kur" şeffaf gösterilir.
- Ülke bazlı özel fiyat: bir ürüne belirli ülke/pazar için sabit fiyat atama (TL, EUR, USD). Sabit fiyat varsa kur dönüşümü devre dışı kalır.
- Vitrinde ülke/dil/para birimi seçici ve fiyatın hangi kurdan hesaplandığı bilgisi.

## Faz 2 — Gümrük & Vergi Motoru
- AB OSS/IOSS: 150 EUR altı/üstü ayrımı, alıcı ülkesinin KDV oranı, B2B'de vergi numarası ile ters yükleme (0 KDV) ve kayıt.
- ABD eyalet bazlı satış vergisi: eyalet oranı tablosu + eşik (nexus) ayarı; fatura satırına yansıtma.
- DDP/DDU seçimi ve gümrük simülatörü: ürün GTIP kodu, menşe, ağırlık, değer ve varış ülkesine göre tahmini gümrük vergisi + KDV + kargo; kasada "toplam teslim maliyeti" olarak gösterilir.
- Vergi ve gümrük tutarları siparişe kalıcı yazılır (sonradan kur/oran değişse bile fatura sabit kalır).

## Faz 3 — Küresel Ödeme Altyapısı
- Global ödeme yöntemleri paneli: her yöntem ülke ve para birimi bazında açılır/kapatılır, sıralanır.
- Stripe (kart, Apple Pay, Google Pay), PayPal, Klarna (şimdi al sonra öde), SEPA/Sofort bağlayıcıları: ödeme başlatma, dönüş sayfası, imzalı bildirim (webhook) doğrulaması, iade ve kısmi iade.
- Her yöntem için test/canlı modu; anahtarlar yalnızca sunucu tarafında saklanır.
- Kasada ziyaretçinin ülkesine uygun yöntemler ve yerel para biriminde tahsilat.

## Faz 4 — Lojistik, Mikro İhracat & Kargo
- Taşıyıcı bağlayıcıları: DHL Express, FedEx, UPS, PTT, Navlungo, ShipEntegra, Aramex. Her biri için hesap bilgileri, fiyat sorgulama, gönderi oluşturma, etiket alma, takip.
- Kasada gerçek zamanlı uluslararası kargo fiyatları (ağırlık/desi + varış ülkesi), teslim süresi tahmini.
- Mikro ihracat belgeleri: İngilizce Ticari Fatura (Commercial Invoice), paket listesi ve ETGB için gerekli beyan bilgileri; tek tıkla PDF; gönderiye eklenen kargo etiketi.
- Markalı global sipariş takibi: müşteri kendi dilinde takip ekranı, taşıyıcıdan gelen durumların yerelleştirilmiş adımları, e-posta bildirimi.

## Faz 5 — Çok Dilli SEO & İçerik Yerelleştirme
- Yapay zekâ ile toplu çeviri: ürün başlığı, açıklama, kategori, SEO başlık/açıklama → İngilizce, Almanca, Arapça, Fransızca, Rusça. Toplu işlerde kuyruk, ilerleme takibi, çeviriyi elle düzeltme ve kilitleme.
- Dil bazlı adresler (`/en/`, `/de/` …), her sayfada dinamik hreflang + canonical, dile özel XML site haritaları ve site haritası indeksi.
- Arapça/İbranice için tema düzeninin otomatik sağdan sola dönmesi (yön, hizalama, ikon yönleri).

## Faz 6 — Yönetim Paneli Deneyimi
- Sol menüde yeni "E-İhracat & Global" grubu: Genel Bakış, Ülke Bazlı Fiyatlar, Gümrük & Vergi, Mikro İhracat Kargo, Küresel Ödemeler, Çeviri & Dil.
- Genel Bakış panosu: ülke yoğunluğunu gösteren dünya haritası, en çok ihracat yapılan ülkeler, döviz ve TL bazlı gelir grafiği, kur marjı kazanç/gider özeti, bekleyen gümrük belgeleri.
- Süper yönetici tarafında platform genelinde ihracat hacmi ve taşıyıcı/ödeme sağlayıcı sağlık durumu.

## Teknik notlar
- Yeni tablolar mağaza kapsamlı (`store_id`), RLS + GRANT ve mevcut çapraz kiracı koruma tetikleyicisiyle kurulur: `country_prices`, `global_payment_methods`, `tax_jurisdictions` / `us_sales_tax_rates`, `customs_profiles` (GTIP, menşe, ağırlık), `export_documents`, `global_carriers`, `global_shipments`, `translation_jobs` / `content_translations`.
- Fiyat, vergi ve gümrük hesapları saf servis katmanında (`pricing-engine`, `tax-engine` yanına `customs-engine`, `fx-buffer`) yazılır ve birim testlenir; kasa ve fatura aynı servisi kullanır.
- Ödeme ve kargo sağlayıcıları adaptör deseniyle eklenir (mevcut kur sağlayıcı gateway'i gibi): sağlayıcı kaydı + adaptör + failover + hata/durum kaydı.
- Çeviri Lovable AI üzerinden çalışır; ek anahtar gerekmez.
- Dış çağrılar yalnızca sunucu işlemlerinden; anahtarlar gizli değişkenlerde; webhook'lar imza doğrulamalı genel uç noktalarda.

## Sizden gerekenler (fazlar sırasında istenecek)
- Stripe, PayPal, Klarna hesap anahtarları (test yeterli).
- DHL/FedEx/UPS/PTT/Navlungo/ShipEntegra/Aramex için hangi hesaplara sahip olduğunuz ve API bilgileri.
- Mikro ihracat için firma bilgileri: vergi no, ihracatçı adresi, varsayılan GTIP kodları.

Faz 1 ve 2 bu bilgiler olmadan tamamlanabilir; ödeme ve kargo fazları bağlayıcı olarak kurulur, hesap bilgisi geldiğinde canlıya alınır.
