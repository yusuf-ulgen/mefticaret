# Mefticaret AI: Tek OpenAI Motoru + Kredi Sistemi

Tüm yapay zekâ özelliklerini tek bir OpenAI motoruna bağlıyoruz, süper admin için kontrol masası kuruyoruz ve satıcılar için kredi cüzdanı + paket satışı ekliyoruz.

## 1. Süper Admin — AI Motor Masası (`/admin/settings/ai-engine`)

- **Ana OpenAI anahtarı**: anahtar yalnızca sunucuda saklanan gizli değer olarak tutulur; panelde yalnızca "bağlı / bağlı değil" durumu ve test butonu görünür (anahtar hiçbir zaman ekrana veya tarayıcıya gönderilmez).
- **Motor yönlendirme**: hangi işin hangi modele gideceği panelden seçilir. Varsayılan:
  - GPT-4o-mini → ürün açıklaması, SEO metinleri, destek sohbeti, etiket/kategori, çeviri
  - GPT-4o → e-posta otomasyonu, Store CoPilot, pazarlama/kampanya stratejisi, satış analizi
  - DALL·E 3 → AI Foto Stüdyo ve ürün arka planı
- **Finans widget'ı**: gerçek OpenAI token maliyeti (USD) ile satılan kredi paketlerinden gelen ciro (TRY) karşılaştırması; kâr marjı, dönem grafiği, en çok harcayan mağazalar.
- Kullanım grafiği: günlük istek, kredi ve maliyet eğrisi.

## 2. Kredi ve Cüzdan Sistemi

- Her mağazanın kredi bakiyesi + hareket dökümü (kazanım, harcama, iade).
- Kredi düşümü (sunucuda sabitlenir, panelden yönetilir):
  - Ürün açıklaması / SEO metni = 1
  - AI Stüdyo görseli = 2
  - E-posta / SMS kampanya taslağı = 2
  - Store CoPilot işlemi = 2
- Paketler: Başlangıç 50 kredi / 1.299 TL, Pro 100 kredi / 2.499 TL, Kurumsal 250 kredi / 5.999 TL. Fiyat ve kredi miktarı yalnızca sunucudan okunur.
- **Tek tıkla satın alma**: mevcut ödeme altyapısı (QNBpay/Mefpay) üzerinden ödeme bağlantısı; ödeme onayı geldiğinde krediler otomatik yüklenir, fatura kaydı ve bildirim oluşur.
- Satıcı üst çubuğunda canlı kredi sayacı; bakiye azaldığında uyarı ve "kredi yükle" kısayolu.

## 3. Merkezî AI Çalıştırıcı

- Tüm AI çağrıları tek kapıdan geçer: yetki → mağaza kredisi kontrolü → OpenAI isteği → başarılı yanıtta kredi düşümü + kayıt.
- Kredi yetersizse OpenAI'ye istek gitmez; satıcıya "kredi yükle" bağlantılı net hata mesajı gösterilir.
- Hata/iptal durumunda kredi düşülmez; her çağrı için token, süre, maliyet ve model kaydı tutulur.

## 4. Mevcut özelliklerin bağlanması

Ürün açıklaması, SEO ve blog yazarı, çeviri stüdyosu, destek asistanı, CoPilot, kampanya/e-posta üretimi ve Foto Stüdyo dahil tüm mevcut AI ekranları bu yeni motoru ve kredi kapısını kullanacak. Diğer sağlayıcı seçenekleri (Gemini/Anthropic) satıcı panelinden kaldırılır; yönlendirme kararı yalnızca süper adminde kalır.

## Teknik notlar

- Yeni tablolar: `ai_engine_settings` (model yönlendirme + fiyat/maliyet katsayıları), `ai_credit_packages`, `store_ai_credits`, `ai_credit_ledger`, `ai_credit_orders`; hepsi RLS + GRANT ile tenant-scoped (mağaza yöneticisi kendi kaydını görür, platform admin hepsini).
- `src/lib/ai.server.ts` içindeki `callProvider` OpenAI'ye sabitlenir; `src/lib/ai-credits.server.ts` kredi rezerve/düşüm mantığını tutar; `src/routes/api/ai/execute.ts` merkezî uç nokta olur (JWT doğrulaması zorunlu).
- Görsel üretimi `photo-ai.server.ts` içinde DALL·E 3 (`images/generations`, `images/edits`) ile değiştirilir.
- Kredi satışı `plan-checkout.server.ts` ile aynı QNBpay akışını ve webhook'unu kullanır; webhook'ta paket türüne göre kredi yüklemesi yapılır.
- Anahtar için `OPENAI_API_KEY` gizli değeri gerekir; plan onaylanınca sizden isteyeceğim.

## Onayınızı beklediğim nokta

OpenAI anahtarı hesabınıza ait kullanım faturasına yansır; kredi paketleri de bu maliyeti karşılamak için satılır. Bu yapı sizin için uygunsa uygulamaya başlıyorum.
