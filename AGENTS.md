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
