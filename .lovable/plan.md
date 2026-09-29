# XML Entegratör v2 — 4 yeni özellik

Mevcut beslemeler, eşleştirmeler ve çalışmalar korunur; yalnız ekleme yapılır. Hepsi mevcut `module_xml_integrator` paket kontrolünün arkasında çalışır.

## 1. Sürükle-bırak alan eşleştirme
- Eşleştirme ekranı gruplara ayrılır: Temel Bilgiler, Fiyat, Stok & Lojistik, Görseller, Varyantlar (+ yeni grup ekle, daralt/aç).
- Satırlar tutamaçla sürüklenip grup içinde/gruplar arası taşınır; sil ve ⚙️ düğmesi.
- ⚙️ Alan Ayarları penceresi: kaynak alan, yedek alan (boşsa), dönüşüm tipi (Doğrudan, Ön/Son Ek, Kırp, Büyük/Küçük Harf, Regex, Formül, Statik, Böl, Çarp), formül test kutusu (anında sonuç), koşul (alan + eşittir/değildir/içerir/büyüktür/küçüktür/boş/dolu + değer), varsayılan değer, zorunlu, notlar.
- Çoklu görsel: image[0..n] ve virgülle ayrılmış tek alan desteği.
- İçe aktarma motoru yedek alan, koşul ve yeni dönüşümleri uygular; eski eşleştirmeler aynen çalışır.

## 2. Eşleştirme şablonları
- Hazır platform şablonları: Giyim Tedarikçisi (TR), WooCommerce XML, Hepsiburada Tedarikçi.
- Mağazanın kendi şablonları: mevcut eşleştirmeyi kaydet, uygula, yeniden adlandır, sil; kullanım sayısı ve son kullanım.

## 3. Duraklat / Devam / Durdur
- Canlı ilerleme kartına Duraklat, Devam et, Durdur düğmeleri; hız (kayıt/dk) ve kalan süre.
- Motor her parti sonrası duraklatma/durdurma isteğini kontrol eder; duraklatılan çalışma kaldığı yerden devam eder.

## 4. Hatalı ürünler + otomatik eşik
- "Hatalı Ürünler" listesi (son çalışma): hata türü filtresi, hata nedeni ve kaynak değer, çoklu seçim, Seçilenleri yeniden dene / Seçilenleri atla.
- Besleme ayarı: "X hatada otomatik durdur" (varsayılan 100) ve bildirim e-postası; eşik aşılınca besleme duraklatılır, satıcıya bildirim ve panelde kırmızı uyarı.

## Teknik ayrıntılar
- Yeni tablolar: `xml_mapping_templates` (store_id null = platform şablonu, is_public), `xml_run_failed_items` (run_id, feed_id, store_id, sku, error_type, message, raw_data, status pending/retried/skipped). RLS: `can_manage_store`; GRANT authenticated + service_role.
- `xml_feeds` ek kolonlar: `mapping_groups jsonb`, `field_rules jsonb` (alan başına fallback/condition/transform/default/required/notes), `max_errors_before_pause int default 100`, `error_notification_email text`, `paused_reason text`.
- `xml_runs` ek kolonlar: `control_state text` (running/pause_requested/paused/stop_requested), `resume_cursor int`, `rate_per_min numeric`.
- Sunucu işlevleri `xml-integrator.functions.ts` içinde, requireSupabaseAuth + mağaza yetki kontrolü; motor değişiklikleri `xml-import-engine.server.ts` ve `xml-transforms.ts`.
- Sürükle-bırak için `@dnd-kit/core` + `@dnd-kit/sortable`.
- Formül değerlendirme güvenli, `eval` yok (yalnız sayı, value, + - * / parantez).
