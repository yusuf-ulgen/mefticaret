WITH brand(code, domain) AS (VALUES
 ('aliexpress-marketplace','aliexpress.com'),
 ('allegro-marketplace','allegro.pl'),
 ('aras-kargo','araskargo.com.tr'),
 ('beymen-partner','beymen.com'),
 ('e-fatura','gib.gov.tr'),
 ('ebay-marketplace','ebay.com'),
 ('facebook-marketplace','facebook.com'),
 ('ga4-analytics','analytics.google.com'),
 ('google-ads-sync','ads.google.com'),
 ('google-marketing-platform','marketingplatform.google.com'),
 ('google-tag-manager','tagmanager.google.com'),
 ('hepsiburada-marketplace','hepsiburada.com'),
 ('instagram-dm','instagram.com'),
 ('iyzico-pay','iyzico.com'),
 ('kargo-entegrator-shipping','kargoentegrator.com'),
 ('klaviyo-marketing','klaviyo.com'),
 ('lighthouse-audit','developer.chrome.com'),
 ('logo-muhasebe','logo.com.tr'),
 ('make-automation','make.com'),
 ('megabutik-marketplace','megabutik.com'),
 ('meta-embedded-signup','meta.com'),
 ('meta-pixel','meta.com'),
 ('n11-marketplace','n11.com'),
 ('odeal-payments','odeal.com'),
 ('ozon-marketplace','ozon.ru'),
 ('parasut-accounting','parasut.com'),
 ('paytr-pay','paytr.com'),
 ('pazarama-marketplace','pazarama.com'),
 ('perads-marketing','perads.co'),
 ('printful-dropshipping','printful.com'),
 ('pts-shipping','pts.net'),
 ('shipink-shipping','shipink.io'),
 ('tiktok-business','tiktok.com'),
 ('tiktok-dm','tiktok.com'),
 ('tiktok-shop','shop.tiktok.com'),
 ('trendyol-efatura','trendyol.com'),
 ('trendyol-marketplace','trendyol.com'),
 ('verimor-sms','verimor.com.tr'),
 ('walmart-marketplace','walmart.com'),
 ('whatsapp-crm','whatsapp.com'),
 ('yurtici-kargo','yurticikargo.com')
)
UPDATE public.apps a
SET logo_url = 'https://www.google.com/s2/favicons?domain=' || b.domain || '&sz=128'
FROM brand b
WHERE a.code = b.code;

UPDATE public.apps
SET logo_url = 'https://mefticaret.com/favicon.png'
WHERE logo_url IS NULL OR logo_url = '';