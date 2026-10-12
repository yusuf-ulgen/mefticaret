<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Mesajlar (/mesajlar): chat_* tabloları + RLS (app_private.is_chat_member), anlık katman realtime; kişi kapsamı ve sohbet açma yalnız chat.functions.ts sunucu işlevlerinde — neden: kiracılar arası sızıntıyı önlemek.
- Mağaza sohbet kanalları (store_team, store_inbox) üyeliği yalnız chat-store.server.ts içinde store_users/customers kayıtlarından eşitlenir — neden: satıcı yalnız kendi mağazasının mesajlarını görsün.
- AI Anahtar Kelime Üreticisi (/store/$storeId/keywords) yalnız keyword-generator.functions.ts sunucu işlevleriyle merkezî callProvider'ı kullanır — neden: kredi kontrolü/düşümü tek yerde, yeni genel API açılmaz.

- Tedarikçi iş akışı (satın alma siparişi, mesaj, XML besleme, iyzico/PayTR ödeme) yalnız supplier-workflow.functions.ts sunucu işlevlerinden geçer; ödeme anahtarları supplier_payment_settings tablosunda yalnız sunucuya açıktır — neden: kiracılar arası sızıntı ve anahtar ifşasını önlemek.
- Tedarikçi paneli /supplier/panel (giriş gerekli), /supplier herkese açık SEO tanıtım sayfasıdır — neden: Google girişli sayfaları indeksleyemez.
- Tedarikci Katalogu (magazaya aktar + otomatik fiyat/stok esitleme) yalniz supplier-catalog.functions.ts / supplier-catalog.server.ts uzerinden calisir; store_supplier_imports tablosuna istemci yazamaz — neden: kiracilar arasi sizinti olmadan tum magazalar tum tedarikcileri gorebilsin.

- Platform ana sayfası tek bileşendir (src/components/platform-home.tsx); TR/EN/DE/FR/AR rotaları onu locale ile render eder, metinler landing-dict.ts sözlüğünden (Türkçe metin anahtar) çevrilir — neden: diller arasında düzen birebir aynı kalsın.
- Ev Hanımları giriş sayfası tek bileşendir (home-maker-auth-page.tsx); TR/EN/DE/FR/AR rotaları onu locale ile render eder, metin ve meta home-maker-i18n.ts içindedir — neden: diller arasında düzen aynı kalsın.
- Platform Analitik Merkezi (v2, /admin/analytics) platform_settings 'v2_superadmin_analytics' anahtarıyla açılır; tüm platform geneli okumalar yalnız platform-analytics.server.ts içinde assertPlatformAdmin sonrası yapılır ve KPI/rapor/CSV aynı veri kümesinden üretilir — neden: kiracı sızıntısını önlemek ve toplamların tutarlı kalması.
- Satıcı paneli v2 tasarımı yalnız AppShell içindeki .seller-v2 sınıfıyla (src/styles.css token geçersiz kılma) uygulanır; platform_settings v2_seller_design bayrağıyla açılır — neden: süper yönetici, vitrin ve checkout etkilenmesin, bayrak kapanınca eski görünüm dönsün.

- QNB e-belge gönderimi yalnız einvoice.server.ts sendInvoice üzerinden; otomatik gönderim invoices.status=paid tetikleyicisi + kuyruk (einvoice-auto.server.ts) ile yapılır ve başarısız gönderim otomatik tekrar edilmez — neden: mükerrer resmî fatura riskini önlemek.
- Sunucu paketindeki createRequire(import.meta.url) satırları build sonrası vite.config.ts içindeki workerImportMetaUrlFix ile sabit URL'e düşürülür — neden: edge worker'da import.meta.url tanımsız, aksi halde tüm sayfalar 500 döner.
- Vitrin görüntüleme para birimi (TRY/GEL/USD) yalnız src/lib/display-currency.tsx üzerinden; tahsilat ve kayıtlar mağaza ana para biriminde kalır, Gürcistan/mikro ihracat kuralları (KDV %0, ETGB, kimlik zorunluluğu) src/lib/export-ge.ts + checkout.server.ts içinde sunucuda uygulanır — neden: istemci tutarına güvenilmesin, tek kaynak olsun.
