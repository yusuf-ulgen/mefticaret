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
