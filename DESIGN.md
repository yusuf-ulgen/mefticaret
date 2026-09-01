# Mefticaret Tasarım Dili

Shopify'ın klonu değil: kendi "mürekkep + safran" dilimiz.

## Temeller
- Renk: OKLCH token'ları (`src/styles.css`). Koyu mürekkep sidebar, safran vurgular. Bileşenlerde asla sabit renk (`bg-black`, `#hex`) kullanılmaz; yalnızca semantik token'lar.
- Tipografi: başlıklar **Sora** (`font-display`, -0.02em tracking), gövde **Manrope**.
- Yüzeyler: `surface-card`, `hero-surface`, `brand-gradient`, `grid-lines` utility'leri.
- Ritim: 4/8px ölçek, `space-y-6` sayfa ritmi, `max-w-7xl` içerik genişliği.

## Bileşen kuralları
- Modern sidebar + sticky header (panel), tablo/kart karışımı listeler, grafikler için `chart`.
- Modal: `dialog`, yan panel: `drawer`/`sheet`, geri bildirim: `sonner` toast.
- Boş durum: `EmptyState` (`components/ui/empty-state.tsx`).
- Yükleniyor: `TableSkeleton` / `CardSkeleton` / `ChartSkeleton` (`components/ui/data-skeleton.tsx`).
- Yıkıcı işlem: `ConfirmDialog` (`components/ui/confirm-dialog.tsx`).
- Tooltip: `components/ui/tooltip`.

## Erişilebilirlik (WCAG 2.2 AA hedefi)
- Her panelde "İçeriğe geç" skip-link'i; `main` odaklanabilir (`tabIndex={-1}`).
- Semantik landmark'lar: `aside` (etiketli), `header`, `nav aria-label`, `main`.
- Global `:focus-visible` outline; `prefers-reduced-motion` ile animasyonlar kapanır.
- Tüm form alanları `Label` ile bağlanır; ikon-only butonlarda `aria-label`.
- Yükleniyor durumları `aria-busy` + `aria-live="polite"`, boş durumlar `role="status"`.

## Denetim kayıtları
Tüm audit yazımları `src/lib/audit.server.ts` üzerinden geçer:
- `recordAudit(client, entry)` — yeni kodda tercih edilen API.
- `insertAuditRow(client, row)` — ham kolon payload'ı; her kayda IP + user-agent ekler.
- `src/lib/audit.ts` — action sözlüğü (`auth.login`, `auth.logout`, ürün/sipariş/ödeme/yetki/abonelik/API key/domain/uygulama/veri silme) ve `auditDiff` yardımcısı.
- Giriş/çıkış olayları `src/lib/audit.functions.ts` içindeki `logAuthEvent` ile yazılır.
Her kayıt: kullanıcı, IP, user-agent, tarih, işlem, entity, entity ID, eski değer, yeni değer.
