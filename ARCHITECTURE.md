# Mefticaret — Mimari

## Katmanlar

| Katman | Nerede | Sorumluluk |
| --- | --- | --- |
| Presentation | `src/routes`, `src/components` | Rotalar, sayfa bileşenleri, UI durumu. İş kuralı içermez. |
| Application | `src/lib/*.functions.ts`, `src/routes/api/**` | `createServerFn` RPC'leri ve HTTP uçları; doğrulama, yetki, orkestrasyon. |
| Domain | `src/lib/<konu>.ts`, `src/modules/*` | Saf iş kuralları ve hesaplamalar (fiyat, vergi, kâr, ledger, otomasyon). |
| Infrastructure | `src/integrations/*`, `src/lib/*.server.ts` | Veritabanı, storage, cache, queue, dış sağlayıcılar. |

Kural: Presentation yalnızca Application'ı çağırır; Application, Domain + Infrastructure'ı birleştirir; Domain hiçbir I/O yapmaz.

## Modüller

Kod tek monolit değil, 15 bağımsız modül olarak gruplanır. Her modülün genel yüzeyi
`src/modules/<modül>/index.ts` barrel'ıdır:

```
src/modules/
  products  orders     customers  payments   shipping
  inventory subscriptions marketplace analytics seo
  cms       ai         notifications marketing integrations
```

Modüller arası ortak parçalar `src/shared` altındadır:

```
src/shared/
  components/  services/  types/  utils/
```

Yeni kod yazarken modül dışından erişim barrel üzerinden yapılır
(`import { productQuery } from "@/modules/products"`), böylece modül içi dosya
yapısı bağımsız olarak değiştirilebilir.

## Uygulama yüzeyleri (`/apps` karşılığı)

Bu proje tek TanStack Start deployment'ıdır; istenen `apps/admin`,
`apps/storefront`, `apps/api` ayrımı rota ön ekleriyle sağlanır:

| Yüzey | Rota deseni | Render |
| --- | --- | --- |
| Admin & mağaza paneli | `src/routes/_authenticated/**` | SPA benzeri, `no-store` |
| Storefront | `src/routes/s.$slug.**` | SSR + kenar cache (`s-maxage`) |
| API | `src/routes/api/v1/**`, `src/routes/api/public/**` | Raw HTTP, scope/imza doğrulamalı |

## Backend taşınabilirliği

İş kuralları Domain katmanında saf TypeScript olarak durur; veri erişimi
Infrastructure'da izoledir. PostgreSQL şeması, queue (`job_queue`), cache
(`cache_entries`) ve FTS arama katmanı SQL tarafında tanımlıdır; bu sayede
Application katmanı ileride başka bir runtime'a (ör. Laravel + Redis worker)
taşınsa dahi şema, kuyruk ve arama sözleşmeleri değişmeden kalır.

## Sayfa haritası

- Genel: `/login`, `/register`, `/forgot-password`, `/auth`, `/onboarding`
- Süper admin: `/admin`, `/admin/stores`, `/admin/users`, `/admin/subscriptions`,
  `/admin/payments`, `/admin/themes`, `/admin/apps`, `/admin/settings` (+ ticket,
  komisyon, webhook, audit ekranları)
- Mağaza: `/store/$storeId/dashboard`, `products`, `products/new`, `orders`,
  `customers`, `inventory`, `collections`, `discounts`, `marketing`, `analytics`,
  `themes`, `domains`, `payments`, `shipping`, `settings`, `apps`, `seo`,
  `ai`, `automations`
- Storefront: `/s/$slug`, `/s/$slug/p/$productSlug`, `/s/$slug/c/$collectionSlug`,
  `/s/$slug/cart`, `/s/$slug/checkout`, `/s/$slug/account`
